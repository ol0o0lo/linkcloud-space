from __future__ import annotations

import re
from copy import deepcopy
from typing import TYPE_CHECKING

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count, F, ProtectedError, Q
from django.http import Http404

from apps.house.constants import HOUSE_ACTIVE_STATUSES, ContactRole, HouseStatus, LeaseStatus
from apps.house.exceptions import ResourceInUseException
from apps.settings.constants import ValueType

DEFAULT_BUILDING_SETTING_KEY = "property_rental.default_building_id"
DEFAULT_LOCATION_SETTING_KEY = "property_rental.default_location"
TAG_SUGGESTIONS_SETTING_KEY = "property_rental.tag_suggestions"
INSPECTION_MAX_AGE_DAYS_SETTING_KEY = "property_rental.inspection_max_age_days"
DEFAULT_INSPECTION_MAX_AGE_DAYS = 180
MIN_INSPECTION_MAX_AGE_DAYS = 1
MAX_INSPECTION_MAX_AGE_DAYS = 3650
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

DEFAULT_TAG_SUGGESTIONS = [
    "近地铁",
    "交通便利",
    "成熟配套",
    "有电梯",
    "采光好",
    "南北通透",
    "精装修",
    "拎包入住",
]


def natural_room_sort_key(room_number: str) -> tuple[tuple[int, int | str], ...]:
    """将房号分段，确保 2 排在 10 前、A2 排在 A10 前。"""
    return tuple((0, int(part)) if part.isdigit() else (1, part.casefold()) for part in re.split(r"(\d+)", room_number) if part)


def sort_houses_for_building(houses):
    return sorted(houses, key=lambda house: (house.floor is None, house.floor or 0, natural_room_sort_key(house.room_number), house.pk))


def building_map_counts(houses) -> dict[str, int]:
    """统计已传入的有效房源，地图筛选不应改变该汇总。"""
    houses = [house for house in houses if house.status in HOUSE_ACTIVE_STATUSES]
    return {
        "total": len(houses),
        "vacant": sum(house.status == HouseStatus.VACANT for house in houses),
        "listed": sum(house.status == HouseStatus.LISTED for house in houses),
        "rented": sum(house.status == HouseStatus.RENTED for house in houses),
        "renovating": sum(house.status == HouseStatus.RENOVATING for house in houses),
    }


def get_tag_suggestions() -> list[str]:
    from apps.settings.models import DefaultSetting
    from apps.settings.values import normalize_tag_list

    setting = DefaultSetting.objects.filter(key=TAG_SUGGESTIONS_SETTING_KEY).first()
    return normalize_tag_list(setting.value if setting else DEFAULT_TAG_SUGGESTIONS, strict=False)


def normalize_inspection_max_age_days(value) -> int:
    """将租户配置归一为安全的房源资料复查周期。"""
    if isinstance(value, bool):
        return DEFAULT_INSPECTION_MAX_AGE_DAYS
    if isinstance(value, int):
        days = value
    elif isinstance(value, str) and value.strip().isdigit():
        days = int(value.strip())
    else:
        return DEFAULT_INSPECTION_MAX_AGE_DAYS
    if not MIN_INSPECTION_MAX_AGE_DAYS <= days <= MAX_INSPECTION_MAX_AGE_DAYS:
        return DEFAULT_INSPECTION_MAX_AGE_DAYS
    return days


def get_org_inspection_max_age_days(organization) -> int:
    """读取租户房源资料复查周期，未配置或脏数据时回退到 180 天。"""
    from apps.settings.models import DefaultSetting, OrganizationSetting

    setting = DefaultSetting.objects.filter(key=INSPECTION_MAX_AGE_DAYS_SETTING_KEY).first()
    if setting is None:
        return DEFAULT_INSPECTION_MAX_AGE_DAYS
    override = OrganizationSetting.objects.filter(organization=organization, setting=setting).first()
    return normalize_inspection_max_age_days(override.value if override is not None else setting.value)


def get_public_houses_queryset():
    """返回可被普通用户全局检索的公开房源。"""
    from apps.house.models import House

    return (
        House.objects.filter(
            status=HouseStatus.LISTED,
            building__organization__is_active=True,
        )
        .select_related("building__estate", "building__organization")
        .order_by("-updated_at", "-pk")
    )


PUBLIC_HOUSE_SORTS = {
    "latest": ("-updated_at", "-pk"),
    "rent_asc": (F("asking_rent").asc(nulls_last=True), "-pk"),
    "rent_desc": (F("asking_rent").desc(nulls_last=True), "-pk"),
    "area_asc": (F("area").asc(nulls_last=True), "-pk"),
    "area_desc": (F("area").desc(nulls_last=True), "-pk"),
}


def apply_public_house_filters(
    qs,
    *,
    keyword=None,
    province=None,
    city=None,
    district=None,
    min_rent=None,
    max_rent=None,
    min_area=None,
    max_area=None,
    bedrooms=None,
    living_rooms=None,
    decoration=None,
    has_elevator_access=None,
    tags=None,
    publisher_slug=None,
    sort="latest",
):
    """应用公开房源筛选和排序，供全局检索与动态配房共用。"""
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(public_description__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__address__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(building__organization__name__icontains=keyword)
        )
    if province:
        qs = qs.filter(building__estate__province__iexact=province)
    if city:
        qs = qs.filter(building__estate__city__iexact=city)
    if district:
        qs = qs.filter(building__estate__district__iexact=district)
    if min_rent is not None:
        qs = qs.filter(asking_rent__gte=min_rent)
    if max_rent is not None:
        qs = qs.filter(asking_rent__lte=max_rent)
    if min_area is not None:
        qs = qs.filter(area__gte=min_area)
    if max_area is not None:
        qs = qs.filter(area__lte=max_area)
    if bedrooms is not None:
        qs = qs.filter(bedrooms=bedrooms)
    if living_rooms is not None:
        qs = qs.filter(living_rooms=living_rooms)
    if decoration:
        qs = qs.filter(decoration=decoration)
    if has_elevator_access is not None:
        qs = qs.filter(has_elevator_access=has_elevator_access)
    for tag in tags or []:
        qs = qs.filter(Q(tags__contains=[tag]) | Q(building__tags__contains=[tag]))
    if publisher_slug:
        qs = qs.filter(building__organization__slug=publisher_slug)
    return qs.order_by(*PUBLIC_HOUSE_SORTS[sort])


def get_public_buildings_queryset():
    """返回至少包含一套公开房源的楼栋。"""
    from apps.house.models import Building

    return (
        Building.objects.filter(
            organization__is_active=True,
            houses__status=HouseStatus.LISTED,
        )
        .select_related("estate", "organization")
        .distinct()
        .order_by("estate__name", "name", "pk")
    )


def get_public_estates_queryset():
    """返回至少包含一套公开房源的小区。"""
    from apps.house.models import Estate

    return (
        Estate.objects.filter(
            organization__is_active=True,
            buildings__houses__status=HouseStatus.LISTED,
        )
        .select_related("organization")
        .distinct()
        .order_by("name", "pk")
    )


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
                "target": {"path": "/rental/properties/list", "query": {"estate_id": estate.pk, "asset_tab": "structure"}},
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
                "target": {"path": "/rental/properties/list", "query": {"building_id": building.pk}},
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


def get_landlord_relationship_contacts(user: User):
    from apps.house.models import Contact

    contacts = (
        Contact.objects.filter(user=user, is_active=True, organization__is_active=True)
        .select_related("organization")
        .annotate(
            house_count=Count("landlord_houses", distinct=True),
            public_house_count=Count(
                "landlord_houses",
                filter=Q(landlord_houses__status=HouseStatus.LISTED),
                distinct=True,
            ),
        )
        .order_by("organization__name", "name", "pk")
    )
    return [contact for contact in contacts if ContactRole.LANDLORD in (contact.roles or [])]


def get_landlord_houses_for_contact(contact):
    from apps.house.models import House

    return House.objects.select_related("building__estate", "landlord").filter(landlord=contact).order_by("building__estate__name", "building__name", "room_number")


def get_landlord_leases_for_contact(contact):
    from apps.house.models import Lease

    return (
        Lease.objects.select_related("house__building__estate", "house__landlord", "tenant", "source_viewing_record")
        .filter(organization=contact.organization, house__landlord=contact)
        .order_by("-start_date", "-id")
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


@transaction.atomic
def resolve_deal_signing_tenant(*, organization: Organization, name: str, phone: str):
    """按姓名和手机号精确复用租客，不命中时创建联系人。"""
    from apps.house.models import Contact

    normalized_name = name.strip()
    normalized_phone = phone.strip()
    if not normalized_name:
        raise ValidationError({"tenant_identity": {"name": "请输入租客姓名。"}})
    if not normalized_phone:
        raise ValidationError({"tenant_identity": {"phone": "请输入租客手机号。"}})

    try:
        contact, _created = Contact.objects.get_or_create(
            organization=organization,
            name=normalized_name,
            phone=normalized_phone,
            defaults={"roles": [ContactRole.TENANT], "is_active": True},
        )
    except ValidationError as error:
        contact = Contact.objects.filter(organization=organization, name=normalized_name, phone=normalized_phone).first()
        if contact is None:
            raise error
    if not contact.is_active:
        raise ValidationError({"tenant_identity": "该租客已停用，请先启用后再签约。"})
    if not contact.has_role(ContactRole.TENANT):
        contact.roles = [*(contact.roles or []), ContactRole.TENANT]
        contact.save(update_fields=["roles", "updated_at"])
    return contact


@transaction.atomic
def create_deal_signing(
    *,
    organization: Organization,
    house_id: int,
    tenant,
    source_viewing_record=None,
    lease_data: dict,
):
    """显式完成成交签约，不改变普通租约保存与状态流转语义。"""
    from apps.house.models import House, Lease

    try:
        house = House.objects.select_for_update().select_related("building").get(pk=house_id, building__organization=organization)
    except House.DoesNotExist:
        raise Http404 from None

    if house.status == HouseStatus.INACTIVE:
        raise ValidationError({"house": "已停用房源不能成交签约。"})

    lease = Lease.objects.create(
        organization=organization,
        house=house,
        tenant=tenant,
        source_viewing_record=source_viewing_record,
        status=LeaseStatus.ACTIVE,
        **lease_data,
    )
    if house.status != HouseStatus.RENTED:
        house.status = HouseStatus.RENTED
        house.save(update_fields=["status", "updated_at"])
    return lease


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
        defaults={"floors": 1, "address": "待补充地址"},
    )
    if not building.address:
        Building.objects.filter(pk=building.pk).update(address="待补充地址")
        building.address = "待补充地址"
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


def set_default_building(organization: Organization, building_id: int):
    from apps.house.models import Building
    from apps.settings.models import OrganizationSetting

    setting = _default_building_setting()
    building = Building.objects.select_related("estate").get(pk=building_id, organization=organization)
    OrganizationSetting.objects.update_or_create(organization=organization, setting=setting, defaults={"value": building.pk})
    return building


def validate_org_scoped_media_refs(*, instance, refs, media_by_id, field):
    """固定媒体字段只允许引用组织目录下的媒体。"""
    org = getattr(instance, "organization", None)
    if org is None:
        return
    prefix = f"uploads/orgs/{org.pk}/"
    invalid = [media.pk for media in media_by_id.values() if not (media.file.name or "").startswith(prefix)]
    if invalid:
        raise ValueError(f"媒体文件必须属于当前组织目录: {invalid}")
