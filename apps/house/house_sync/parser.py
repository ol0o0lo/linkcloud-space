"""纯文本房表解析，不访问数据库。"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation

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
