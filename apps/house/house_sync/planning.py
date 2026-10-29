"""由房表和数据库快照生成公开预览及内部写入操作。"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from django.http import Http404

from apps.base.exceptions import AppException, ConflictException
from apps.house.constants import HouseStatus
from apps.house.house_sync.parser import VACANCY_SYNC_MAX_BYTES, address_match_identities, normalize_address, parse_vacancy_text
from apps.house.models import Building, House


class VacancySyncInvalidException(AppException):
    error = "VACANCY_SYNC_INVALID"
    code = 422
    message = "房表存在需要处理的问题。"


class VacancySyncConflictException(ConflictException):
    error = "VACANCY_SYNC_CONFLICT"
    message = "房表预览已经过期，请重新预览。"


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
                "is_active": house.is_active,
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
        _, _, candidates = _resolve_building(address, buildings, None)
        return "overridden", building, candidates if building in candidates else [*candidates, building]

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


def _display_value(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, list):
        return "、".join(value)
    return str(value)


def _change_item(
    house: House | None,
    room_number: str,
    *,
    before_status: str | None = None,
    after_status: str | None = None,
    changed_fields: list[str] | None = None,
    values: dict | None = None,
) -> dict:
    return {
        "house_id": house.pk if house is not None else None,
        "room_number": room_number,
        "before_status": before_status,
        "after_status": after_status,
        "changed_fields": changed_fields or [],
        "field_changes": [
            {"field": field, "before": _display_value(getattr(house, field)), "after": _display_value(values[field])}
            for field in changed_fields or []
            if house is not None and values is not None and field in values
        ],
    }


def _empty_changes() -> dict:
    return {
        "create_houses": [],
        "update_houses": [],
        "mark_paused": [],
        "mark_rented": [],
        "preserve_ignored": [],
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
        "mark_paused": sum(len(block["changes"]["mark_paused"]) for block in blocks),
        "mark_rented": sum(len(block["changes"]["mark_rented"]) for block in blocks),
        "preserve_ignored": sum(len(block["changes"]["preserve_ignored"]) for block in blocks),
    }


def _plan_hash(organization_id: int, blocks: list[dict], ignored_lines: set[int], snapshots: list[dict]) -> str:
    payload = {
        "organization_id": organization_id,
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


def build_plan(organization, *, raw_text: str, building_overrides: list[dict] | None = None, ignored_lines: list[int] | None = None, lock: bool = False) -> VacancyPlan:
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
    buildings = list(building_qs)
    if lock:
        target_ids = {
            building.pk
            for block in parsed["blocks"]
            for status, building, candidates in [_resolve_building(block["address"], buildings, overrides.get(block["block_index"]))]
            if building is not None
        }
        locked = {building.pk: building for building in building_qs.filter(pk__in=target_ids).select_for_update(of=("self",))}
        if set(locked) != target_ids:
            raise VacancySyncConflictException("楼栋数据已发生变化，请重新预览。")
        buildings = [locked.get(building.pk, building) for building in buildings]
    operations: list[HouseOperation] = []
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
        warnings = []
        ignored = [line for line in parsed_block["lines"] if line["status"] == "ignored"]
        ignored_rooms = {line["room_number"].casefold() for line in ignored if line["room_number"]}
        protect_absent_rooms = any(not line["room_number"] for line in ignored)
        if protect_absent_rooms:
            warnings.append("有忽略行无法识别房号，本楼栋清单外房源将保持原状态，不标记已租。请核对后继续。")
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
                    line.update(status="error", error_code=error["code"], message=error["message"])
                    continue
                house = matches[0] if matches else None
                if house is None:
                    changes["create_houses"].append(_change_item(None, line["room_number"], after_status=HouseStatus.PAUSED))
                    operations.append(HouseOperation(block_index, None, line["room_number"], _house_values(None, line)))
                    continue
                if not house.is_active:
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
                    line.update(status="error", error_code=error["code"], message=error["message"])
                    continue

                values = _house_values(house, line)
                changed_fields = [field for field, value in values.items() if field != "status" and getattr(house, field) != value]
                operations.append(HouseOperation(block_index, house.pk, house.room_number, values))
                if changed_fields:
                    changes["update_houses"].append(
                        _change_item(house, house.room_number, before_status=house.status, after_status=house.status, changed_fields=changed_fields, values=values)
                    )
                desired_status = values["status"]
                if house.status != desired_status:
                    changes["mark_paused"].append(_change_item(house, house.room_number, before_status=house.status, after_status=desired_status, changed_fields=["status"]))

            for house in houses:
                if not house.is_active or house.room_number.casefold() in listed_rooms:
                    continue
                if protect_absent_rooms or house.room_number.casefold() in ignored_rooms:
                    changes["preserve_ignored"].append(_change_item(house, house.room_number, before_status=house.status, after_status=house.status))
                    continue
                if house.status == HouseStatus.RENTED:
                    continue
                changes["mark_rented"].append(_change_item(house, house.room_number, before_status=house.status, after_status=HouseStatus.RENTED, changed_fields=["status"]))
                operations.append(HouseOperation(block_index, house.pk, house.room_number, {"status": HouseStatus.RENTED}))
        else:
            for line in valid_lines:
                changes["create_houses"].append(_change_item(None, line["room_number"], after_status=HouseStatus.PAUSED))
                operations.append(HouseOperation(block_index, None, line["room_number"], _house_values(None, line)))

        blocks.append(
            {
                "block_index": block_index,
                "address": parsed_block["address"],
                "building_match": building_match,
                "lines": parsed_block["lines"],
                "changes": changes,
                "errors": block_errors,
                "warnings": warnings,
            }
        )

    can_apply = not errors
    plan = {
        "mode": "preview",
        "applied": False,
        "can_apply": can_apply,
        "plan_hash": _plan_hash(organization.pk, blocks, ignored_set, snapshots) if can_apply else None,
        "summary": _summary(blocks, errors),
        "blocks": blocks,
        "errors": errors,
    }
    return VacancyPlan(plan, tuple(operations))


@dataclass(frozen=True)
class HouseOperation:
    block_index: int
    house_id: int | None
    room_number: str
    values: dict


@dataclass(frozen=True)
class VacancyPlan:
    response: dict
    operations: tuple[HouseOperation, ...]


def _house_values(house: House | None, line: dict) -> dict:
    return {
        "floor": line["floor"] if line["floor"] is not None else (house.floor if house else None),
        "asking_rent": line["asking_rent"],
        "bedrooms": line["bedrooms"],
        "living_rooms": line["living_rooms"],
        "tags": _merge_tags(house.tags if house else [], line["tags"]),
        "status": HouseStatus.LISTED if house and house.status == HouseStatus.LISTED else HouseStatus.PAUSED,
    }


def build_vacancy_sync_plan(organization, *, raw_text: str, building_overrides: list[dict] | None = None, ignored_lines: list[int] | None = None, lock: bool = False) -> dict:
    return build_plan(organization, raw_text=raw_text, building_overrides=building_overrides, ignored_lines=ignored_lines, lock=lock).response
