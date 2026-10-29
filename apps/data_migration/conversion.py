"""Uhome 字段转换，仅返回可序列化数据，不写业务对象。"""

from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError

from apps.house.constants import HouseListingType, HouseStatus
from apps.house.models import Building, Contact, House

BUSINESS_MODELS = {"buildings": Building, "landlords": Contact, "houses": House}
ORDER = ("team", "identities", "staff", "landlords", "buildings", "houses", "staff_landlord_relations")


def source_id(data, *names):
    for name in names:
        value = data.get(name)
        if value not in (None, ""):
            return str(value.get("id")) if isinstance(value, dict) and value.get("id") is not None else str(value)
    return ""


def normalized_tags(value):
    return list(dict.fromkeys(item.strip() for item in value or [] if isinstance(item, str) and item.strip())) if isinstance(value, list) else []


def normalized_fields(record, overrides, records):
    data = record.data
    kind = record.entity_type
    if kind == "landlords":
        fields = {"name": str(data.get("name") or "").strip(), "phone": str(data.get("phone") or "").strip(), "roles": ["landlord"]}
    elif kind == "buildings":
        region = data.get("region") if isinstance(data.get("region"), dict) else {}
        total_floors = {
            item.data["floor"].get("totalFloor")
            for item in records
            if item.entity_type == "houses" and source_id(item.data, "building_id", "building") == record.source_id and isinstance(item.data.get("floor"), dict)
        } - {None, 0, ""}
        fields = {
            "name": str(data.get("name") or "").strip(),
            "address": str(data.get("address") or "").strip(),
            "floors": data.get("floors") or (next(iter(total_floors)) if len(total_floors) == 1 else None),
            "province": region.get("province") or "",
            "city": region.get("city") or "",
            "district": region.get("area") or region.get("district") or "",
            "tags": normalized_tags(data.get("tags")),
        }
        if data.get("lng") is not None and data.get("lat") is not None:
            fields["location"] = {"longitude": data["lng"], "latitude": data["lat"], "coordinate_system": data.get("coordinate_system", "gcj02")}
    elif kind == "houses":
        house_type = data.get("houseType") if isinstance(data.get("houseType"), dict) else {}
        floor = data.get("floor") if isinstance(data.get("floor"), dict) else {}
        fields = {
            "room_number": str(data.get("houseNum") or "").strip(),
            "floor": floor.get("atFloor"),
            "area": data.get("area"),
            "asking_rent": data.get("rent"),
            "bedrooms": house_type.get("rooms"),
            "living_rooms": house_type.get("halls"),
            "bathrooms": house_type.get("toilets"),
            "tags": normalized_tags(data.get("tags")),
            "status": HouseStatus.RENTED if data.get("isRented") is True else HouseStatus.LISTED if data.get("isRented") is False else HouseStatus.PAUSED,
            "listing_type": {"整租": HouseListingType.WHOLE, "合租": HouseListingType.SHARED, "公寓": HouseListingType.APARTMENT, "短租": HouseListingType.SHORT_TERM}.get(
                data.get("useWay")
            ),
            "extra": {"uhome": {key: data[key] for key in ("houseId", "title", "payMethod", "dueTime", "isTop", "atTop", "districts", "subways") if key in data}},
        }
    else:
        fields = {}
    allowed = set(fields) | ({"building_id", "landlord_id"} if kind == "houses" else set())
    for key, value in overrides.items():
        if key in allowed:
            fields[key] = value
    if "tags" in fields:
        fields["tags"] = normalized_tags(fields["tags"])
    return fields


def validate_fields(kind, fields):
    model = BUSINESS_MODELS[kind]
    errors = []
    for name, value in fields.items():
        if name in {"location", "building_id", "landlord_id"}:
            continue
        field = model._meta.get_field(name)
        try:
            if value is None and not field.null:
                raise ValidationError("此项不能为空。")
            if field.get_internal_type() == "DecimalField" and value is not None and not Decimal(str(value)).is_finite():
                raise ValidationError("金额或面积必须为有限数字。")
            cleaned = field.clean(value, None)
            fields[name] = str(cleaned) if isinstance(cleaned, Decimal) else cleaned
        except (ValidationError, InvalidOperation, TypeError, ValueError) as exc:
            message = "；".join(exc.messages) if isinstance(exc, ValidationError) else "字段值不合法。"
            errors.append((name, message))
    if kind == "buildings" and fields.get("location") is not None:
        try:
            from apps.geography.coordinates import make_wgs84_point

            location = fields["location"]
            if not isinstance(location, dict):
                raise ValueError
            make_wgs84_point(float(location["longitude"]), float(location["latitude"]), location.get("coordinate_system", "gcj02"))
            if (str(location["longitude"]), str(location["latitude"])) in {("113.343971", "23.172020"), ("113.343971", "23.17202")}:
                errors.append(("location", "旧坐标为默认占位值，请确认真实坐标或清空。"))
        except (KeyError, TypeError, ValueError, ValidationError):
            errors.append(("location", "坐标不合法，请补全或清空。"))
    return errors


def model_values(fields):
    values = dict(fields)
    if isinstance(values.get("location"), dict):
        from apps.geography.coordinates import make_wgs84_point

        point = values["location"]
        values["location"] = make_wgs84_point(float(point["longitude"]), float(point["latitude"]), point.get("coordinate_system", "gcj02"))
    return values


def target_queryset(kind, organization):
    model = BUSINESS_MODELS.get(kind)
    if model is None:
        return None
    return model.objects.filter(**({"building__organization": organization} if kind == "houses" else {"organization": organization}))


def target_fingerprint(target):
    from apps.data_migration.protocol import content_hash

    return content_hash({"pk": target.pk, "updated_at": target.updated_at.isoformat()})
