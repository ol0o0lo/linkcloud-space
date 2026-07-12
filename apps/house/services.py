from __future__ import annotations

from copy import deepcopy
from typing import TYPE_CHECKING

from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.http import Http404

from apps.house.constants import ContactRole, HouseStatus, LeaseStatus
from apps.house.exceptions import ResourceInUseException
from apps.settings.constants import ValueType

DEFAULT_BUILDING_SETTING_KEY = "property_rental.default_building_id"
RESOURCE_PREVIEW_LIMIT = 5
PUBLISH_RULES_SETTING_KEY = "property_rental.publish_rules"
PUBLISH_RULE_MODE_REQUIRED = "required"
PUBLISH_RULE_MODE_WARNING = "warn"
PUBLISH_RULE_MODE_OFF = "off"

HOUSE_PUBLISH_RULE_LABELS = {
    "landlord": "房东主体",
    "rent": "租金",
    "cover": "封面图",
    "images": "房源图片",
    "floor_plan": "户型图",
    "video": "视频",
}

HOUSE_PUBLISH_ISSUE_LABELS = {
    "landlord": "缺房东",
    "rent": "缺租金",
    "cover": "缺封面",
    "images": "图片不足",
    "floor_plan": "缺户型图",
    "video": "视频不足",
}

DEFAULT_HOUSE_PUBLISH_RULES = {
    "landlord": {"mode": PUBLISH_RULE_MODE_REQUIRED, "label": HOUSE_PUBLISH_RULE_LABELS["landlord"]},
    "rent": {"mode": PUBLISH_RULE_MODE_REQUIRED, "label": HOUSE_PUBLISH_RULE_LABELS["rent"]},
    "cover": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["cover"]},
    "images": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["images"], "min_count": 3},
    "floor_plan": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["floor_plan"]},
    "video": {"mode": PUBLISH_RULE_MODE_OFF, "label": HOUSE_PUBLISH_RULE_LABELS["video"], "min_count": 1},
}

if TYPE_CHECKING:
    from apps.accounts.models import User
    from apps.organizations.models import Organization


def get_estate_delete_check(estate):
    buildings = estate.buildings.order_by("name", "id")
    count = buildings.count()
    if not count:
        return {"can_delete": True, "resources": []}

    preview = buildings.only("id", "name", "address")[:RESOURCE_PREVIEW_LIMIT]
    return {
        "can_delete": False,
        "resources": [
            {
                "type": "building",
                "label": "关联楼栋",
                "count": count,
                "items": [{"id": building.pk, "label": f"{building.name} · {building.address}" if building.address else building.name} for building in preview],
                "truncated": count > RESOURCE_PREVIEW_LIMIT,
                "target": {"path": "/property-rental/estates", "query": {"view": "buildings", "estate_id": estate.pk}},
            }
        ],
    }


def get_building_delete_check(building):
    houses = building.houses.order_by("room_number", "id")
    count = houses.count()
    if not count:
        return {"can_delete": True, "resources": []}

    preview = houses.only("id", "room_number")[:RESOURCE_PREVIEW_LIMIT]
    return {
        "can_delete": False,
        "resources": [
            {
                "type": "house",
                "label": "关联房源",
                "count": count,
                "items": [{"id": house.pk, "label": f"{building.name} / {house.room_number}"} for house in preview],
                "truncated": count > RESOURCE_PREVIEW_LIMIT,
                "target": {"path": "/property-rental/houses", "query": {"building_id": building.pk}},
            }
        ],
    }


def _delete_checked_resource(resource, get_delete_check, message: str) -> int:
    check = get_delete_check(resource)
    if not check["can_delete"]:
        raise ResourceInUseException(message, check)

    resource_id = resource.pk

    try:
        # Keep the outer row lock while a savepoint shields the follow-up
        # delete check from a database-level PROTECT fallback.
        with transaction.atomic():
            deleted_count, _deleted_details = resource.delete()
    except (IntegrityError, ProtectedError):
        # Do not catch OperationalError (for example, SQLite's "database is locked"):
        # without a reliable fresh read, it cannot be reported as RESOURCE_IN_USE.
        check = get_delete_check(resource)
        raise ResourceInUseException(message, check) from None

    if not deleted_count:
        raise Http404

    return resource_id


def delete_estate(organization: Organization, estate_id: int) -> int:
    from apps.house.models import Estate

    with transaction.atomic():
        try:
            estate = Estate.objects.select_for_update().get(pk=estate_id, organization=organization)
        except Estate.DoesNotExist:
            raise Http404 from None
        return _delete_checked_resource(estate, get_estate_delete_check, "小区已关联楼栋，不能删除。")


def delete_building(organization: Organization, building_id: int) -> int:
    from apps.house.models import Building

    with transaction.atomic():
        try:
            building = Building.objects.select_for_update().get(pk=building_id, organization=organization)
        except Building.DoesNotExist:
            raise Http404 from None
        return _delete_checked_resource(building, get_building_delete_check, "楼栋已关联房源，不能删除。")


def claim_landlord_contact_for_bound_phone(user: User, organization: Organization | None, phone: str | None):
    """手机号绑定后的房东 Contact 统一认领入口。"""
    if organization is None or not phone:
        return None

    from apps.accounts.models import normalize_phone, split_phone
    from apps.house.models import Contact

    normalized_phone = normalize_phone(phone)
    _country_code, national_number = split_phone(normalized_phone)
    phone_candidates = {value for value in {phone, normalized_phone, national_number} if value}

    qs = Contact.objects.filter(
        organization=organization,
        phone__in=phone_candidates,
    )
    landlord_contacts = [contact for contact in qs if ContactRole.LANDLORD in contact.roles]
    existing = next((contact for contact in landlord_contacts if contact.user_id == user.pk), None)
    if existing is not None:
        return existing

    contact = next((contact for contact in landlord_contacts if contact.user_id is None), None)
    if contact is None:
        return None

    contact.user = user
    contact.save(update_fields=["user", "updated_at"])
    return contact


def get_landlord_houses(user: User, organization: Organization):
    from apps.house.models import House

    return (
        House.objects.select_related("building__estate", "landlord")
        .filter(
            landlord__user=user,
            building__organization=organization,
        )
        .order_by("building__estate__name", "building__name", "room_number")
    )


def get_landlord_leases(user: User, organization: Organization):
    from apps.house.models import Lease

    return (
        Lease.objects.select_related("house__building__estate", "house__landlord", "tenant", "source_viewing_record")
        .filter(
            organization=organization,
            house__landlord__user=user,
            house__building__organization=organization,
        )
        .order_by("-start_date", "-id")
    )


def _default_building_setting():
    from apps.settings.models import DefaultSetting

    metadata = {
        "description": "房源租赁默认楼栋",
        "label": "默认楼栋",
        "widget": "select",
        "ui": {"options_source": "house.buildings"},
        "category": "property_rental",
    }
    setting, _ = DefaultSetting.objects.get_or_create(
        key=DEFAULT_BUILDING_SETTING_KEY,
        defaults={
            "value": 0,
            "value_type": ValueType.INTEGER,
            **metadata,
        },
    )
    update_fields = []
    for field, value in metadata.items():
        if getattr(setting, field) != value:
            setattr(setting, field, value)
            update_fields.append(field)
    if update_fields:
        setting.save(update_fields=update_fields)
    return setting


def normalize_house_publish_rules(value):
    rules = deepcopy(DEFAULT_HOUSE_PUBLISH_RULES)
    if not isinstance(value, dict):
        return rules

    for key, default_rule in DEFAULT_HOUSE_PUBLISH_RULES.items():
        raw_rule = value.get(key)
        if not isinstance(raw_rule, dict):
            continue
        mode = raw_rule.get("mode")
        if mode in {PUBLISH_RULE_MODE_REQUIRED, PUBLISH_RULE_MODE_WARNING, PUBLISH_RULE_MODE_OFF}:
            rules[key]["mode"] = mode
        if "min_count" in default_rule:
            raw_count = raw_rule.get("min_count", default_rule["min_count"])
            try:
                rules[key]["min_count"] = max(int(raw_count), 0)
            except (TypeError, ValueError):
                rules[key]["min_count"] = default_rule["min_count"]

    return rules


def _publish_rules_setting():
    from apps.settings.models import DefaultSetting

    metadata = {
        "description": "控制房源发布时哪些资料缺失会阻断发布，哪些仅做提醒。",
        "label": "房源发布规则",
        "widget": "json_editor",
        "ui": {"options_source": "house.publish_rules"},
        "category": "property_rental",
    }
    setting, _ = DefaultSetting.objects.get_or_create(
        key=PUBLISH_RULES_SETTING_KEY,
        defaults={
            "value": deepcopy(DEFAULT_HOUSE_PUBLISH_RULES),
            "value_type": ValueType.JSON,
            **metadata,
        },
    )
    update_fields = []
    if setting.value_type != ValueType.JSON:
        setting.value_type = ValueType.JSON
        update_fields.append("value_type")
    if not setting.value:
        setting.value = deepcopy(DEFAULT_HOUSE_PUBLISH_RULES)
        update_fields.append("value")
    for field, value in metadata.items():
        if getattr(setting, field) != value:
            setattr(setting, field, value)
            update_fields.append(field)
    if update_fields:
        setting.save(update_fields=update_fields)
    return setting


def get_org_house_publish_rules(organization: Organization):
    from apps.settings.models import OrganizationSetting

    setting = _publish_rules_setting()
    override = OrganizationSetting.objects.filter(organization=organization, setting=setting).first()
    return normalize_house_publish_rules(override.value if override else setting.value)


def evaluate_house_publish_state(house, rules=None):
    publish_rules = normalize_house_publish_rules(rules)
    images = house.images or []
    image_roles = {item.get("image_role") for item in images if isinstance(item, dict)}
    image_count = len(images)
    video_count = len(house.videos or [])
    issue_flags = {
        "landlord": not bool(house.landlord_id),
        "rent": not bool(house.asking_rent),
        "cover": "cover" not in image_roles,
        "images": image_count < publish_rules["images"]["min_count"],
        "floor_plan": "floor_plan" not in image_roles,
        "video": video_count < publish_rules["video"]["min_count"],
    }

    blocking_issues: list[str] = []
    warning_issues: list[str] = []
    for key, is_missing in issue_flags.items():
        if not is_missing:
            continue
        rule = publish_rules[key]
        if rule["mode"] == PUBLISH_RULE_MODE_OFF:
            continue
        target = blocking_issues if rule["mode"] == PUBLISH_RULE_MODE_REQUIRED else warning_issues
        target.append(HOUSE_PUBLISH_ISSUE_LABELS[key])

    return {
        "can_publish": not blocking_issues,
        "blocking_issues": blocking_issues,
        "warning_issues": warning_issues,
        "rule_snapshot": publish_rules,
    }


@transaction.atomic
def ensure_default_building(organization: Organization):
    from apps.house.models import Building, Estate
    from apps.settings.models import OrganizationSetting

    setting = _default_building_setting()
    override = OrganizationSetting.objects.select_for_update().filter(organization=organization, setting=setting).first()
    if override:
        building = Building.objects.select_related("estate").filter(pk=override.value, organization=organization).first()
        if building:
            return building

    estate, _ = Estate.objects.get_or_create(
        organization=organization,
        name="默认项目",
        defaults={
            "display_name": "默认项目",
            "province": "默认",
            "city": "默认",
            "district": "默认",
            "address": "默认",
        },
    )
    building, _ = Building.objects.get_or_create(
        organization=organization,
        estate=estate,
        name="默认楼栋",
        defaults={"floors": 1, "address": ""},
    )
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


def set_default_building(organization: Organization, building_id: int):
    from apps.house.models import Building
    from apps.settings.models import OrganizationSetting

    setting = _default_building_setting()
    building = Building.objects.select_related("estate").get(pk=building_id, organization=organization)
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


@transaction.atomic
def recalculate_house_status(house_id: int):
    """统一重算房态；人工 locked/renovating 不被无 active 租约时覆盖。"""
    from apps.house.models import House, Lease

    house = House.objects.select_for_update().get(pk=house_id)
    if house.status in {HouseStatus.LOCKED, HouseStatus.RENOVATING}:
        return house

    has_active = Lease.objects.filter(house_id=house_id, status=LeaseStatus.ACTIVE).exists()
    next_status = HouseStatus.RENTED if has_active else HouseStatus.VACANT
    if house.status != next_status:
        House.objects.filter(pk=house.pk).update(status=next_status)
        house.status = next_status
    return house


def validate_org_scoped_media_refs(*, instance, refs, media_by_id, field):
    """固定媒体字段只允许引用组织目录下的媒体。"""
    org = getattr(instance, "organization", None)
    if org is None:
        return
    prefix = f"uploads/orgs/{org.pk}/"
    invalid = [media.pk for media in media_by_id.values() if not (media.file.name or "").startswith(prefix)]
    if invalid:
        raise ValueError(f"媒体文件必须属于当前组织目录: {invalid}")
