import math

from django.core.exceptions import ValidationError

from apps.house.services import DEFAULT_LOCATION_SETTING_KEY
from apps.settings.constants import SettingWidget, ValueType
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting

DEFAULT_WIDGET_BY_VALUE_TYPE = {
    ValueType.TEXT: SettingWidget.INPUT,
    ValueType.PASSWORD: SettingWidget.PASSWORD,
    ValueType.JSON: SettingWidget.JSON_EDITOR,
    ValueType.BOOLEAN: SettingWidget.SWITCH,
    ValueType.INTEGER: SettingWidget.INPUT_NUMBER,
    ValueType.FLOAT: SettingWidget.INPUT_NUMBER,
}


def _serialize_value(value, value_type: str):
    """根据 value_type 处理返回值。password 脱敏，其余做类型转换。"""
    if value_type == ValueType.PASSWORD:
        return "********"
    if value_type == ValueType.BOOLEAN:
        return bool(value)
    if value_type == ValueType.INTEGER:
        return int(value)
    if value_type == ValueType.FLOAT:
        return float(value)
    return value


def _build_result(default: DefaultSetting, value, is_customized: bool) -> dict:
    return {
        "key": default.key,
        "label": default.label or default.key,
        "value": _serialize_value(value, default.value_type),
        "value_type": default.value_type,
        "description": default.description,
        "widget": default.widget or DEFAULT_WIDGET_BY_VALUE_TYPE.get(default.value_type, SettingWidget.INPUT),
        "ui": default.ui,
        "category": default.category,
        "is_customized": is_customized,
    }


def validate_location_setting_value(key: str, value) -> None:
    if key != DEFAULT_LOCATION_SETTING_KEY or value is None:
        return
    if not isinstance(value, dict) or set(value) != {"address", "lat", "lng"}:
        raise ValidationError({"value": "默认定位必须包含 address、lat 和 lng。"})
    address, lat, lng = value["address"], value["lat"], value["lng"]
    if not isinstance(address, str) or not address.strip():
        raise ValidationError({"value": "默认定位地址不能为空。"})
    if any(isinstance(item, bool) or not isinstance(item, int | float) or not math.isfinite(item) for item in (lat, lng)):
        raise ValidationError({"value": "默认定位经纬度必须是有限数字。"})
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise ValidationError({"value": "默认定位经纬度超出范围。"})


# ---------------------------------------------------------------------------
# Org 设置
# ---------------------------------------------------------------------------


def get_org_setting(org, key: str) -> dict:
    """获取 org 某个 key 的值，fallback 到 default。"""
    default = DefaultSetting.objects.get(key=key)
    override = OrganizationSetting.objects.filter(organization=org, setting=default).first()
    if override:
        return _build_result(default, override.value, is_customized=True)
    return _build_result(default, default.value, is_customized=False)


def get_all_org_settings(org) -> list[dict]:
    """获取 org 全量设置项（所有 default key，标注是否已覆盖）。"""
    defaults = DefaultSetting.objects.all()
    overrides = {
        os.setting_id: os.value
        for os in OrganizationSetting.objects.filter(organization=org).select_related("setting")
    }
    results = []
    for default in defaults:
        if default.pk in overrides:
            results.append(_build_result(default, overrides[default.pk], is_customized=True))
        else:
            results.append(_build_result(default, default.value, is_customized=False))
    return results


def set_org_setting(org, key: str, value) -> OrganizationSetting:
    """覆盖 org 的某个 key（upsert）。"""
    validate_location_setting_value(key, value)
    default = DefaultSetting.objects.get(key=key)
    obj, _ = OrganizationSetting.objects.update_or_create(
        organization=org,
        setting=default,
        defaults={"value": value},
    )
    return obj


def delete_org_setting(org, key: str) -> None:
    """删除 org 的覆盖，恢复使用默认值。"""
    default = DefaultSetting.objects.get(key=key)
    OrganizationSetting.objects.get(organization=org, setting=default).delete()


# ---------------------------------------------------------------------------
# Team 设置（fallback 直接到 default，不经过 Org）
# ---------------------------------------------------------------------------


def get_team_setting(team, key: str) -> dict:
    default = DefaultSetting.objects.get(key=key)
    override = TeamSetting.objects.filter(team=team, setting=default).first()
    if override:
        return _build_result(default, override.value, is_customized=True)
    return _build_result(default, default.value, is_customized=False)


def get_all_team_settings(team) -> list[dict]:
    defaults = DefaultSetting.objects.all()
    overrides = {
        ts.setting_id: ts.value
        for ts in TeamSetting.objects.filter(team=team).select_related("setting")
    }
    results = []
    for default in defaults:
        if default.pk in overrides:
            results.append(_build_result(default, overrides[default.pk], is_customized=True))
        else:
            results.append(_build_result(default, default.value, is_customized=False))
    return results


def set_team_setting(team, key: str, value) -> TeamSetting:
    default = DefaultSetting.objects.get(key=key)
    obj, _ = TeamSetting.objects.update_or_create(
        team=team,
        setting=default,
        defaults={"value": value},
    )
    return obj


def delete_team_setting(team, key: str) -> None:
    default = DefaultSetting.objects.get(key=key)
    TeamSetting.objects.get(team=team, setting=default).delete()


# ---------------------------------------------------------------------------
# 用户偏好（无 fallback，key 无需预定义）
# ---------------------------------------------------------------------------


def get_user_setting(user, key: str, default=None):
    obj = UserSetting.objects.filter(user=user, key=key).first()
    return obj.value if obj else default


def get_all_user_settings(user) -> list[dict]:
    return [{"key": s.key, "value": s.value} for s in UserSetting.objects.filter(user=user)]


def set_user_setting(user, key: str, value) -> UserSetting:
    obj, _ = UserSetting.objects.update_or_create(
        user=user,
        key=key,
        defaults={"value": value},
    )
    return obj


def delete_user_setting(user, key: str) -> None:
    UserSetting.objects.filter(user=user, key=key).delete()
