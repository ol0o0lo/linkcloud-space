from __future__ import annotations

from copy import deepcopy

from django.db import transaction

from apps.organizations.models import Organization
from apps.settings.constants import ValueType

DEFAULT_BUILDING_SETTING_KEY = "property_rental.default_building_id"


DEFAULT_LOCATION_SETTING_KEY = "property_rental.default_location"


TAG_SUGGESTIONS_SETTING_KEY = "property_rental.tag_suggestions"


INSPECTION_MAX_AGE_DAYS_SETTING_KEY = "property_rental.inspection_max_age_days"


DEFAULT_INSPECTION_MAX_AGE_DAYS = 180


MIN_INSPECTION_MAX_AGE_DAYS = 1


MAX_INSPECTION_MAX_AGE_DAYS = 3650


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


DEFAULT_HOUSE_PUBLISH_RULES = {
    "landlord": {"mode": PUBLISH_RULE_MODE_REQUIRED, "label": HOUSE_PUBLISH_RULE_LABELS["landlord"]},
    "rent": {"mode": PUBLISH_RULE_MODE_REQUIRED, "label": HOUSE_PUBLISH_RULE_LABELS["rent"]},
    "cover": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["cover"]},
    "images": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["images"], "min_count": 3},
    "floor_plan": {"mode": PUBLISH_RULE_MODE_WARNING, "label": HOUSE_PUBLISH_RULE_LABELS["floor_plan"]},
    "video": {"mode": PUBLISH_RULE_MODE_OFF, "label": HOUSE_PUBLISH_RULE_LABELS["video"], "min_count": 1},
}


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
