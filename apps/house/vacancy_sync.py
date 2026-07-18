from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from copy import deepcopy
from decimal import Decimal, InvalidOperation

from django.db import IntegrityError, transaction
from django.http import Http404

from apps.base.exceptions import AppException, ConflictException
from apps.house.constants import HouseStatus
from apps.house.models import Building, House

VACANCY_SYNC_SETTING_KEY = "property_rental.vacancy_sync_force_rented"
VACANCY_SYNC_MAX_BYTES = 50 * 1024
VACANCY_SYNC_MAX_HOUSES = 1000

_ADDRESS_PUNCTUATION_RE = re.compile(r"[。、#$%^&*，；;:：！!？?\"“”‘’（）()《》〈〉【】「」『』〔〕…—～·•{}]+")
_CHINESE_NUMBER_RE = re.compile(r"[零〇一二两三四五六七八九十百千万]+")
_LANE_NUMBER_IDENTITY_RE = re.compile(r"(?P<lane>\d+)巷(?P<number>\d+)号")
_ROOM_NUMBER_RE = re.compile(r"^(?P<room>(?:[A-Za-z]+)?\d+[A-Za-z0-9-]*)")
_ROOM_BEFORE_ARABIC_TYPE_RE = re.compile(r"^(?P<room>\d{3,})(?=[1-9]房)")
_HOUSE_COUNT_PATTERN = r"[0-9零〇一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾]+"
_HOUSE_TYPE_RE = re.compile(rf"(?P<single>超级\s*大\s*单间|大\s*单间|单间)|(?P<rooms>{_HOUSE_COUNT_PATTERN})\s*房(?:\s*(?P<halls>{_HOUSE_COUNT_PATTERN})\s*厅)?")
_RENT_RE = re.compile(r"(?P<rent>\d+(?:\.\d{1,2})?)")
_CHINESE_DIGITS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "壹": 1,
    "二": 2,
    "两": 2,
    "贰": 2,
    "三": 3,
    "叁": 3,
    "四": 4,
    "肆": 4,
    "五": 5,
    "伍": 5,
    "六": 6,
    "陆": 6,
    "七": 7,
    "柒": 7,
    "八": 8,
    "捌": 8,
    "九": 9,
    "玖": 9,
}
_CHINESE_UNITS = {"十": 10, "拾": 10, "百": 100, "千": 1000, "万": 10000}


class VacancySyncInvalidException(AppException):
    error = "VACANCY_SYNC_INVALID"
    code = 422
    message = "房表存在需要处理的问题。"


class VacancySyncConflictException(ConflictException):
    error = "VACANCY_SYNC_CONFLICT"
    message = "房表预览已经过期，请重新预览。"


def normalize_address(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "")
    value = _ADDRESS_PUNCTUATION_RE.sub("", value)
    return " ".join(value.split())


def _chinese_number_to_int(value: str) -> int:
    if not any(char in _CHINESE_UNITS for char in value):
        return int("".join(str(_CHINESE_DIGITS[char]) for char in value))

    total = 0
    section = 0
    number = 0
    for char in value:
        if char in _CHINESE_DIGITS:
            number = _CHINESE_DIGITS[char]
            continue
        unit = _CHINESE_UNITS[char]
        if unit == 10000:
            section += number
            total += (section or 1) * unit
            section = 0
            number = 0
            continue
        section += (number or 1) * unit
        number = 0
    return total + section + number


def _parse_count(value: str) -> int:
    if value.isdigit():
        return int(value)
    normalized = value.translate(str.maketrans({"壹": "一", "贰": "二", "叁": "三", "肆": "四", "伍": "五", "陆": "六", "柒": "七", "捌": "八", "玖": "九", "拾": "十"}))
    return _chinese_number_to_int(normalized)


def address_identity(value: str) -> str:
    normalized = normalize_address(value).casefold().replace(" ", "")
    return _CHINESE_NUMBER_RE.sub(lambda match: str(_chinese_number_to_int(match.group(0))), normalized)


def address_match_identities(value: str) -> set[str]:
    identity = address_identity(value)
    identities = {identity}
    match = _LANE_NUMBER_IDENTITY_RE.search(identity)
    if match is None or match.group("lane") == match.group("number"):
        return identities

    swapped = identity[: match.start()] + f"{match.group('number')}巷{match.group('lane')}号" + identity[match.end() :]
    identities.add(swapped)
    return identities


def _floor_from_room_number(room_number: str) -> int | None:
    match = re.search(r"\d+", room_number)
    if not match or len(match.group(0)) < 3:
        return None
    floor = int(match.group(0)[:-2])
    return floor if floor > 0 else None


def _extract_tags(text: str) -> list[str]:
    compact = re.sub(r"\s+", "", text)
    tags: list[str] = []
    if "复式" in compact:
        tags.append("复式")
    if "超级大单间" in compact:
        tags.append("超级大单间")
    elif "大单间" in compact:
        tags.append("大单间")
    elif "大" in compact:
        tags.append("大")
    if "采光好" in compact or "光线好" in compact:
        tags.append("采光好")
    if "无遮挡" in compact:
        tags.append("无遮挡")
    return tags


def _line_error(*, line_number: int, raw: str, code: str, message: str, ignored: bool) -> dict:
    return {
        "line_number": line_number,
        "raw": raw,
        "status": "ignored" if ignored else "error",
        "error_code": code,
        "message": message,
        "room_number": None,
        "floor": None,
        "asking_rent": None,
        "bedrooms": None,
        "living_rooms": None,
        "tags": [],
    }


def _parse_house_line(line_number: int, raw: str, *, ignored: bool) -> dict:
    compact = re.sub(r"\s+", "", unicodedata.normalize("NFKC", raw))
    room_match = _ROOM_BEFORE_ARABIC_TYPE_RE.match(compact) or _ROOM_NUMBER_RE.match(compact)
    if room_match is None:
        return _line_error(line_number=line_number, raw=raw, code="ROOM_NUMBER_MISSING", message="缺少房号。", ignored=ignored)

    room_number = room_match.group("room")
    type_match = _HOUSE_TYPE_RE.search(compact, room_match.end())
    if type_match is None:
        return _line_error(line_number=line_number, raw=raw, code="HOUSE_TYPE_INVALID", message="无法识别房型。", ignored=ignored)

    rent_match = _RENT_RE.search(compact, type_match.end())
    if rent_match is None:
        return _line_error(line_number=line_number, raw=raw, code="RENT_MISSING", message="缺少租金。", ignored=ignored)

    try:
        asking_rent = Decimal(rent_match.group("rent"))
    except InvalidOperation:
        return _line_error(line_number=line_number, raw=raw, code="RENT_INVALID", message="租金格式不正确。", ignored=ignored)

    if asking_rent < 0 or asking_rent > Decimal("999999"):
        return _line_error(line_number=line_number, raw=raw, code="RENT_OUT_OF_RANGE", message="租金必须在 0 到 999999 之间。", ignored=ignored)
    if len(room_number) > 64:
        return _line_error(line_number=line_number, raw=raw, code="ROOM_NUMBER_TOO_LONG", message="房号长度不能超过 64 个字符。", ignored=ignored)

    if type_match.group("single"):
        bedrooms, living_rooms = 1, 0
    else:
        bedrooms = _parse_count(type_match.group("rooms"))
        living_rooms = _parse_count(type_match.group("halls")) if type_match.group("halls") else 1
    if bedrooms < 1 or bedrooms > 99 or living_rooms < 0 or living_rooms > 99:
        return _line_error(line_number=line_number, raw=raw, code="HOUSE_TYPE_OUT_OF_RANGE", message="房数或厅数超出允许范围。", ignored=ignored)

    description = compact[room_match.end() : type_match.start()] + type_match.group(0) + compact[rent_match.end() :]
    return {
        "line_number": line_number,
        "raw": raw,
        "status": "ignored" if ignored else "valid",
        "error_code": None,
        "message": None,
        "room_number": room_number,
        "floor": _floor_from_room_number(room_number),
        "asking_rent": asking_rent,
        "bedrooms": bedrooms,
        "living_rooms": living_rooms,
        "tags": _extract_tags(description),
    }


def parse_vacancy_text(raw_text: str, *, ignored_lines: set[int] | None = None) -> dict:
    ignored_lines = ignored_lines or set()
    normalized_text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    source_lines = normalized_text.split("\n")
    blocks_source: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    for line_number, raw in enumerate(source_lines, start=1):
        stripped = raw.strip()
        if not stripped:
            if current:
                blocks_source.append(current)
                current = []
            continue
        current.append((line_number, stripped))
    if current:
        blocks_source.append(current)

    blocks: list[dict] = []
    errors: list[dict] = []
    seen_addresses: dict[str, int] = {}
    valid_house_count = 0
    for block_index, source in enumerate(blocks_source):
        address_line_number, raw_address = source[0]
        address = normalize_address(raw_address)
        block_errors: list[dict] = []
        if not address:
            block_errors.append({"code": "BUILDING_ADDRESS_MISSING", "message": "缺少楼栋地址。", "block_index": block_index, "line_number": address_line_number})
        address_key = address_identity(address)
        if address_key in seen_addresses:
            block_errors.append(
                {
                    "code": "DUPLICATE_BUILDING_BLOCK",
                    "message": f"楼栋地址与第 {seen_addresses[address_key] + 1} 个段落重复。",
                    "block_index": block_index,
                    "line_number": address_line_number,
                }
            )
        else:
            seen_addresses[address_key] = block_index

        lines = [_parse_house_line(line_number, raw, ignored=line_number in ignored_lines) for line_number, raw in source[1:]]
        room_numbers: dict[str, int] = {}
        for line in lines:
            if line["status"] != "valid":
                if line["status"] == "error":
                    block_errors.append(
                        {
                            "code": line["error_code"],
                            "message": line["message"],
                            "block_index": block_index,
                            "line_number": line["line_number"],
                        }
                    )
                continue
            room_key = line["room_number"].casefold()
            if room_key in room_numbers:
                line["status"] = "error"
                line["error_code"] = "DUPLICATE_ROOM_NUMBER"
                line["message"] = f"房号与第 {room_numbers[room_key]} 行重复。"
                block_errors.append(
                    {
                        "code": line["error_code"],
                        "message": line["message"],
                        "block_index": block_index,
                        "line_number": line["line_number"],
                    }
                )
                continue
            room_numbers[room_key] = line["line_number"]
            valid_house_count += 1

        valid_lines = [line for line in lines if line["status"] == "valid"]
        if not valid_lines:
            block_errors.append(
                {
                    "code": "BUILDING_HAS_NO_VALID_HOUSES",
                    "message": "楼栋段落至少需要一条有效房源。",
                    "block_index": block_index,
                    "line_number": address_line_number,
                }
            )
        errors.extend(block_errors)
        blocks.append(
            {
                "block_index": block_index,
                "address": address,
                "address_line_number": address_line_number,
                "lines": lines,
                "errors": block_errors,
            }
        )

    if not blocks:
        errors.append({"code": "EMPTY_TEXT", "message": "房表文本不能为空。", "block_index": None, "line_number": None})
    if valid_house_count > VACANCY_SYNC_MAX_HOUSES:
        errors.append(
            {
                "code": "HOUSE_LIMIT_EXCEEDED",
                "message": f"单次最多处理 {VACANCY_SYNC_MAX_HOUSES} 条有效房源。",
                "block_index": None,
                "line_number": None,
            }
        )
    return {"blocks": blocks, "errors": errors, "valid_house_count": valid_house_count}


def _get_force_rented(organization) -> bool:
    from apps.settings.models import DefaultSetting, OrganizationSetting

    setting = DefaultSetting.objects.filter(key=VACANCY_SYNC_SETTING_KEY).first()
    if setting is None:
        return False
    override = OrganizationSetting.objects.filter(organization=organization, setting=setting).first()
    value = override.value if override is not None else setting.value
    return value if isinstance(value, bool) else False


def _building_snapshot(building: Building, houses: list[House]) -> dict:
    return {
        "id": building.pk,
        "updated_at": building.updated_at.isoformat(),
        "houses": [
            {
                "id": house.pk,
                "room_number": house.room_number,
                "floor": house.floor,
                "asking_rent": str(house.asking_rent) if house.asking_rent is not None else None,
                "bedrooms": house.bedrooms,
                "living_rooms": house.living_rooms,
                "tags": house.tags,
                "status": house.status,
                "updated_at": house.updated_at.isoformat(),
            }
            for house in sorted(houses, key=lambda item: item.pk)
        ],
    }


def _candidate_out(building: Building) -> dict:
    return {"id": building.pk, "name": building.name, "address": building.address}


def _resolve_building(address: str, buildings: list[Building], override_id: int | None) -> tuple[str, Building | None, list[Building]]:
    if override_id is not None:
        building = next((item for item in buildings if item.pk == override_id), None)
        if building is None:
            raise Http404
        return "overridden", building, [building]

    normalized = normalize_address(address).casefold()
    exact_address = [building for building in buildings if normalize_address(building.address).casefold() == normalized]
    if exact_address:
        return ("matched", exact_address[0], exact_address) if len(exact_address) == 1 else ("ambiguous", None, exact_address)
    exact_name = [building for building in buildings if normalize_address(building.name).casefold() == normalized]
    if exact_name:
        return ("matched", exact_name[0], exact_name) if len(exact_name) == 1 else ("ambiguous", None, exact_name)

    identities = address_match_identities(address)
    variants = [building for building in buildings if identities & (address_match_identities(building.address) | address_match_identities(building.name))]
    if variants:
        return ("matched", variants[0], variants) if len(variants) == 1 else ("ambiguous", None, variants)
    return "new", None, []


def _merge_tags(existing: list[str] | None, parsed: list[str]) -> list[str]:
    result = list(existing or [])
    for tag in parsed:
        if tag not in result:
            result.append(tag)
    return result


def _change_item(house: House | None, room_number: str, *, before_status: str | None = None, after_status: str | None = None, changed_fields: list[str] | None = None) -> dict:
    return {
        "house_id": house.pk if house is not None else None,
        "room_number": room_number,
        "before_status": before_status,
        "after_status": after_status,
        "changed_fields": changed_fields or [],
    }


def _empty_changes() -> dict:
    return {
        "create_houses": [],
        "update_houses": [],
        "mark_vacant": [],
        "mark_rented": [],
        "preserve_special_status": [],
        "inactive_conflicts": [],
    }


def _summary(blocks: list[dict], errors: list[dict]) -> dict:
    return {
        "buildings": len(blocks),
        "valid_lines": sum(line["status"] == "valid" for block in blocks for line in block["lines"]),
        "error_lines": len({error["line_number"] for error in errors if error["line_number"] is not None}),
        "ignored_lines": sum(line["status"] == "ignored" for block in blocks for line in block["lines"]),
        "create_buildings": sum(block["building_match"]["status"] == "new" for block in blocks),
        "create_houses": sum(len(block["changes"]["create_houses"]) for block in blocks),
        "update_houses": sum(len(block["changes"]["update_houses"]) for block in blocks),
        "mark_vacant": sum(len(block["changes"]["mark_vacant"]) for block in blocks),
        "mark_rented": sum(len(block["changes"]["mark_rented"]) for block in blocks),
        "preserve_special_status": sum(len(block["changes"]["preserve_special_status"]) for block in blocks),
    }


def _plan_hash(organization_id: int, force_rented: bool, blocks: list[dict], ignored_lines: set[int], snapshots: list[dict]) -> str:
    payload = {
        "organization_id": organization_id,
        "force_rented": force_rented,
        "ignored_lines": sorted(ignored_lines),
        "blocks": [
            {
                "block_index": block["block_index"],
                "address": block["address"],
                "building_id": block["building_match"]["building_id"],
                "lines": [
                    {
                        "line_number": line["line_number"],
                        "status": line["status"],
                        "room_number": line["room_number"],
                        "floor": line["floor"],
                        "asking_rent": str(line["asking_rent"]) if line["asking_rent"] is not None else None,
                        "bedrooms": line["bedrooms"],
                        "living_rooms": line["living_rooms"],
                        "tags": line["tags"],
                    }
                    for line in block["lines"]
                ],
            }
            for block in blocks
        ],
        "snapshots": snapshots,
    }
    serialized = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode()).hexdigest()


def build_vacancy_sync_plan(organization, *, raw_text: str, building_overrides: list[dict] | None = None, ignored_lines: list[int] | None = None, lock: bool = False) -> dict:
    if len(raw_text.encode("utf-8")) > VACANCY_SYNC_MAX_BYTES:
        raise VacancySyncInvalidException(f"房表文本不能超过 {VACANCY_SYNC_MAX_BYTES // 1024}KB。")

    ignored_set = set(ignored_lines or [])
    if any(line_number < 1 for line_number in ignored_set):
        raise VacancySyncInvalidException("忽略行号必须是大于 0 的整数。")
    overrides: dict[int, int] = {}
    for item in building_overrides or []:
        block_index = item["block_index"]
        if block_index in overrides:
            raise VacancySyncInvalidException("同一楼栋段落不能重复指定匹配楼栋。")
        overrides[block_index] = item["building_id"]

    parsed = parse_vacancy_text(raw_text, ignored_lines=ignored_set)
    known_block_indexes = {block["block_index"] for block in parsed["blocks"]}
    if unknown_indexes := sorted(set(overrides) - known_block_indexes):
        raise VacancySyncInvalidException(f"楼栋覆盖包含不存在的段落编号: {unknown_indexes}。")
    building_qs = Building.objects.filter(organization=organization).select_related("estate").order_by("pk")
    if lock:
        building_qs = building_qs.select_for_update(of=("self",))
    buildings = list(building_qs)
    force_rented = _get_force_rented(organization)
    blocks: list[dict] = []
    errors = list(parsed["errors"])
    snapshots: list[dict] = []
    target_buildings: dict[int, int] = {}

    for parsed_block in parsed["blocks"]:
        block_index = parsed_block["block_index"]
        match_status, building, candidates = _resolve_building(parsed_block["address"], buildings, overrides.get(block_index))
        building_match = {
            "status": match_status,
            "building_id": building.pk if building is not None else None,
            "name": building.name if building is not None else None,
            "address": building.address if building is not None else parsed_block["address"],
            "candidates": [_candidate_out(candidate) for candidate in candidates],
        }
        block_errors = list(parsed_block["errors"])
        if match_status == "ambiguous":
            error = {
                "code": "BUILDING_AMBIGUOUS",
                "message": "楼栋匹配到多个候选，请明确选择楼栋。",
                "block_index": block_index,
                "line_number": parsed_block["address_line_number"],
            }
            errors.append(error)
            block_errors.append(error)
        if match_status == "new" and len(parsed_block["address"]) > 100:
            error = {
                "code": "BUILDING_ADDRESS_TOO_LONG",
                "message": "新建楼栋地址不能超过 100 个字符。",
                "block_index": block_index,
                "line_number": parsed_block["address_line_number"],
            }
            errors.append(error)
            block_errors.append(error)
        if building is not None:
            previous_block = target_buildings.get(building.pk)
            if previous_block is not None:
                error = {
                    "code": "DUPLICATE_BUILDING_TARGET",
                    "message": f"与第 {previous_block + 1} 个段落指向同一楼栋。",
                    "block_index": block_index,
                    "line_number": parsed_block["address_line_number"],
                }
                errors.append(error)
                block_errors.append(error)
            else:
                target_buildings[building.pk] = block_index

        changes = _empty_changes()
        valid_lines = [line for line in parsed_block["lines"] if line["status"] == "valid"]
        if building is not None:
            houses_qs = House.objects.filter(building=building).order_by("pk")
            if lock:
                houses_qs = houses_qs.select_for_update()
            houses = list(houses_qs)
            snapshots.append(_building_snapshot(building, houses))
            houses_by_room: dict[str, list[House]] = {}
            for house in houses:
                houses_by_room.setdefault(house.room_number.casefold(), []).append(house)

            listed_rooms: set[str] = set()
            for line in valid_lines:
                room_key = line["room_number"].casefold()
                listed_rooms.add(room_key)
                matches = houses_by_room.get(room_key, [])
                if len(matches) > 1:
                    error = {
                        "code": "ROOM_NUMBER_AMBIGUOUS",
                        "message": f"楼栋内存在多个规范化后相同的房号：{line['room_number']}。",
                        "block_index": block_index,
                        "line_number": line["line_number"],
                    }
                    errors.append(error)
                    block_errors.append(error)
                    continue
                house = matches[0] if matches else None
                if house is None:
                    changes["create_houses"].append(_change_item(None, line["room_number"], after_status=HouseStatus.VACANT))
                    continue
                if house.status == HouseStatus.INACTIVE:
                    conflict = _change_item(house, house.room_number, before_status=house.status, after_status=house.status)
                    changes["inactive_conflicts"].append(conflict)
                    error = {
                        "code": "INACTIVE_HOUSE_CONFLICT",
                        "message": f"房源 {house.room_number} 已停用，请先人工处理。",
                        "block_index": block_index,
                        "line_number": line["line_number"],
                    }
                    errors.append(error)
                    block_errors.append(error)
                    continue

                changed_fields: list[str] = []
                desired_tags = _merge_tags(house.tags, line["tags"])
                for field, desired in (
                    ("floor", line["floor"]),
                    ("asking_rent", line["asking_rent"]),
                    ("bedrooms", line["bedrooms"]),
                    ("living_rooms", line["living_rooms"]),
                    ("tags", desired_tags),
                ):
                    if desired is not None and getattr(house, field) != desired:
                        changed_fields.append(field)
                if changed_fields:
                    changes["update_houses"].append(_change_item(house, house.room_number, before_status=house.status, after_status=house.status, changed_fields=changed_fields))
                desired_status = HouseStatus.LISTED if house.status == HouseStatus.LISTED else HouseStatus.VACANT
                if house.status != desired_status:
                    changes["mark_vacant"].append(_change_item(house, house.room_number, before_status=house.status, after_status=desired_status, changed_fields=["status"]))

            for house in houses:
                if house.status == HouseStatus.INACTIVE or house.room_number.casefold() in listed_rooms:
                    continue
                if house.status == HouseStatus.RENTED:
                    continue
                if house.status == HouseStatus.RENOVATING and not force_rented:
                    changes["preserve_special_status"].append(_change_item(house, house.room_number, before_status=house.status, after_status=house.status))
                    continue
                changes["mark_rented"].append(_change_item(house, house.room_number, before_status=house.status, after_status=HouseStatus.RENTED, changed_fields=["status"]))
        else:
            for line in valid_lines:
                changes["create_houses"].append(_change_item(None, line["room_number"], after_status=HouseStatus.VACANT))

        blocks.append(
            {
                "block_index": block_index,
                "address": parsed_block["address"],
                "building_match": building_match,
                "lines": parsed_block["lines"],
                "changes": changes,
                "errors": block_errors,
            }
        )

    can_apply = not errors
    plan = {
        "mode": "preview",
        "applied": False,
        "can_apply": can_apply,
        "plan_hash": _plan_hash(organization.pk, force_rented, blocks, ignored_set, snapshots) if can_apply else None,
        "force_rented": force_rented,
        "summary": _summary(blocks, errors),
        "blocks": blocks,
        "errors": errors,
    }
    return plan


def _max_floor(lines: list[dict]) -> int:
    floors = [line["floor"] for line in lines if line["status"] == "valid" and line["floor"] is not None]
    return max(floors, default=1)


@transaction.atomic
def apply_vacancy_sync(organization, *, raw_text: str, building_overrides: list[dict] | None, ignored_lines: list[int] | None, expected_plan_hash: str | None) -> dict:
    plan = build_vacancy_sync_plan(
        organization,
        raw_text=raw_text,
        building_overrides=building_overrides,
        ignored_lines=ignored_lines,
        lock=True,
    )
    if not plan["can_apply"]:
        raise VacancySyncInvalidException(data=plan)
    if not expected_plan_hash or expected_plan_hash != plan["plan_hash"]:
        raise VacancySyncConflictException(data={"current_plan": plan})

    result = deepcopy(plan)
    result["mode"] = "apply"
    result["applied"] = True
    for block in result["blocks"]:
        valid_lines = [line for line in block["lines"] if line["status"] == "valid"]
        building_id = block["building_match"]["building_id"]
        if building_id is None:
            try:
                building = Building.objects.create(
                    organization=organization,
                    estate=None,
                    name=block["address"],
                    address=block["address"],
                    floors=_max_floor(valid_lines),
                )
            except IntegrityError as exc:
                raise VacancySyncConflictException("楼栋数据已发生变化，请重新预览。") from exc
            block["building_match"].update(
                {
                    "status": "created",
                    "building_id": building.pk,
                    "name": building.name,
                    "address": building.address,
                    "candidates": [_candidate_out(building)],
                }
            )
        else:
            building = Building.objects.select_for_update().get(pk=building_id, organization=organization)

        houses = list(House.objects.select_for_update().filter(building=building).order_by("pk"))
        houses_by_room = {house.room_number.casefold(): house for house in houses}
        listed_rooms: set[str] = set()
        for line in valid_lines:
            room_key = line["room_number"].casefold()
            listed_rooms.add(room_key)
            house = houses_by_room.get(room_key)
            if house is None:
                try:
                    house = House.objects.create(
                        building=building,
                        room_number=line["room_number"],
                        floor=line["floor"],
                        asking_rent=line["asking_rent"],
                        bedrooms=line["bedrooms"],
                        living_rooms=line["living_rooms"],
                        tags=line["tags"],
                        status=HouseStatus.VACANT,
                    )
                except IntegrityError as exc:
                    raise VacancySyncConflictException("房源数据已发生变化，请重新预览。") from exc
                houses_by_room[room_key] = house
            else:
                house.floor = line["floor"] if line["floor"] is not None else house.floor
                house.asking_rent = line["asking_rent"]
                house.bedrooms = line["bedrooms"]
                house.living_rooms = line["living_rooms"]
                house.tags = _merge_tags(house.tags, line["tags"])
                house.status = HouseStatus.LISTED if house.status == HouseStatus.LISTED else HouseStatus.VACANT
                house.save()

        for house in houses:
            if house.status == HouseStatus.INACTIVE or house.room_number.casefold() in listed_rooms or house.status == HouseStatus.RENTED:
                continue
            if house.status == HouseStatus.RENOVATING and not result["force_rented"]:
                continue
            house.status = HouseStatus.RENTED
            house.save(update_fields=["status", "updated_at"])

        final_ids = {house.room_number.casefold(): house.pk for house in House.objects.filter(building=building)}
        for change_group in block["changes"].values():
            for change in change_group:
                change["house_id"] = final_ids.get(change["room_number"].casefold(), change["house_id"])

    return result
