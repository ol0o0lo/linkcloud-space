import math
from decimal import Decimal, InvalidOperation

from django.core.exceptions import ValidationError

from apps.house.services import (
    DEFAULT_LOCATION_SETTING_KEY,
    INSPECTION_MAX_AGE_DAYS_SETTING_KEY,
    MAX_INSPECTION_MAX_AGE_DAYS,
    MIN_INSPECTION_MAX_AGE_DAYS,
)
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

SETTING_SCOPE_ORGANIZATION = "organization"
SETTING_SCOPE_TEAM = "team"
LEASE_ALLOCATION_RULE_SETTING_KEY = "property_rental.lease_allocation_rule"

SETTING_VALUE_SOURCE_DEFAULT = "default"
SETTING_VALUE_SOURCE_ORGANIZATION = "organization"
SETTING_VALUE_SOURCE_TEAM = "team"


def _setting_supports_scope(setting: DefaultSetting, scope: str) -> bool:
    scopes = setting.ui.get("scopes") if isinstance(setting.ui, dict) else None
    return not isinstance(scopes, list) or scope in scopes


def _get_default_for_scope(key: str, scope: str) -> DefaultSetting:
    default = DefaultSetting.objects.get(key=key)
    if not _setting_supports_scope(default, scope):
        raise DefaultSetting.DoesNotExist(key)
    return default


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


def _build_result(default: DefaultSetting, value, is_customized: bool, *, value_source: str) -> dict:
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
        "value_source": value_source,
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


def validate_lease_allocation_rule_value(key: str, value) -> None:
    if key != LEASE_ALLOCATION_RULE_SETTING_KEY:
        return
    if not isinstance(value, dict) or set(value) != {"method", "rate_bp", "fixed_amount"}:
        raise ValidationError({"value": "签约收益规则必须包含 method、rate_bp 和 fixed_amount。"})

    method = value["method"]
    rate_bp = value["rate_bp"]
    fixed_amount = value["fixed_amount"]
    if method == "percentage":
        if isinstance(rate_bp, bool) or not isinstance(rate_bp, int) or not 1 <= rate_bp <= 10000:
            raise ValidationError({"value": "百分比规则必须设置 1 至 10000 的万分比。"})
        if fixed_amount is not None:
            raise ValidationError({"value": "百分比规则不能同时设置固定金额。"})
        return
    if method == "fixed":
        if rate_bp is not None:
            raise ValidationError({"value": "固定金额规则不能同时设置比例。"})
        try:
            amount = Decimal(str(fixed_amount))
        except (InvalidOperation, TypeError, ValueError) as exc:
            raise ValidationError({"value": "固定收益金额格式不正确。"}) from exc
        if amount <= 0 or amount.as_tuple().exponent < -2:
            raise ValidationError({"value": "固定收益金额必须大于 0，且最多保留两位小数。"})
        value["fixed_amount"] = f"{amount:.2f}"
        return
    raise ValidationError({"value": "签约收益规则只支持按比例或固定金额。"})


def validate_setting_value(key: str, value) -> None:
    validate_location_setting_value(key, value)
    validate_lease_allocation_rule_value(key, value)


def validate_inspection_max_age_days_setting_value(key: str, value) -> None:
    if key != INSPECTION_MAX_AGE_DAYS_SETTING_KEY:
        return
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValidationError({"value": "房源资料复查周期必须为整数天数。"})
    if not MIN_INSPECTION_MAX_AGE_DAYS <= value <= MAX_INSPECTION_MAX_AGE_DAYS:
        raise ValidationError({"value": f"房源资料复查周期必须在 {MIN_INSPECTION_MAX_AGE_DAYS} 到 {MAX_INSPECTION_MAX_AGE_DAYS} 天之间。"})


# ---------------------------------------------------------------------------
# Org 设置
# ---------------------------------------------------------------------------


def get_org_setting(org, key: str) -> dict:
    """获取 org 某个 key 的值，fallback 到 default。"""
    default = _get_default_for_scope(key, SETTING_SCOPE_ORGANIZATION)
    override = OrganizationSetting.objects.filter(organization=org, setting=default).first()
    if override:
        return _build_result(default, override.value, is_customized=True, value_source=SETTING_VALUE_SOURCE_ORGANIZATION)
    return _build_result(default, default.value, is_customized=False, value_source=SETTING_VALUE_SOURCE_DEFAULT)


def get_all_org_settings(org) -> list[dict]:
    """获取 org 全量设置项（所有 default key，标注是否已覆盖）。"""
    defaults = [setting for setting in DefaultSetting.objects.all() if _setting_supports_scope(setting, SETTING_SCOPE_ORGANIZATION)]
    overrides = {os.setting_id: os.value for os in OrganizationSetting.objects.filter(organization=org).select_related("setting")}
    results = []
    for default in defaults:
        if default.pk in overrides:
            results.append(_build_result(default, overrides[default.pk], is_customized=True, value_source=SETTING_VALUE_SOURCE_ORGANIZATION))
        else:
            results.append(_build_result(default, default.value, is_customized=False, value_source=SETTING_VALUE_SOURCE_DEFAULT))
    return results


def set_org_setting(org, key: str, value) -> OrganizationSetting:
    """覆盖 org 的某个 key（upsert）。"""
    validate_setting_value(key, value)
    validate_inspection_max_age_days_setting_value(key, value)
    default = _get_default_for_scope(key, SETTING_SCOPE_ORGANIZATION)
    obj, _ = OrganizationSetting.objects.update_or_create(
        organization=org,
        setting=default,
        defaults={"value": value},
    )
    return obj


def delete_org_setting(org, key: str) -> None:
    """删除 org 的覆盖，恢复使用默认值。"""
    default = _get_default_for_scope(key, SETTING_SCOPE_ORGANIZATION)
    OrganizationSetting.objects.get(organization=org, setting=default).delete()


# ---------------------------------------------------------------------------
# Team 设置（fallback 直接到 default，不经过 Org）
# ---------------------------------------------------------------------------


def get_team_setting(team, key: str) -> dict:
    default = _get_default_for_scope(key, SETTING_SCOPE_TEAM)
    override = TeamSetting.objects.filter(team=team, setting=default).first()
    if override:
        return _build_result(default, override.value, is_customized=True, value_source=SETTING_VALUE_SOURCE_TEAM)
    if default.ui.get("inherit_org"):
        organization_override = OrganizationSetting.objects.filter(organization=team.organization, setting=default).first()
        if organization_override:
            return _build_result(
                default,
                organization_override.value,
                is_customized=False,
                value_source=SETTING_VALUE_SOURCE_ORGANIZATION,
            )
    return _build_result(default, default.value, is_customized=False, value_source=SETTING_VALUE_SOURCE_DEFAULT)


def get_all_team_settings(team) -> list[dict]:
    defaults = [setting for setting in DefaultSetting.objects.all() if _setting_supports_scope(setting, SETTING_SCOPE_TEAM)]
    overrides = {ts.setting_id: ts.value for ts in TeamSetting.objects.filter(team=team).select_related("setting")}
    inherited_org_values = {
        setting.setting_id: setting.value
        for setting in OrganizationSetting.objects.filter(
            organization=team.organization,
            setting__in=[default for default in defaults if default.ui.get("inherit_org")],
        )
    }
    results = []
    for default in defaults:
        if default.pk in overrides:
            results.append(_build_result(default, overrides[default.pk], is_customized=True, value_source=SETTING_VALUE_SOURCE_TEAM))
        elif default.pk in inherited_org_values:
            results.append(
                _build_result(
                    default,
                    inherited_org_values[default.pk],
                    is_customized=False,
                    value_source=SETTING_VALUE_SOURCE_ORGANIZATION,
                )
            )
        else:
            results.append(_build_result(default, default.value, is_customized=False, value_source=SETTING_VALUE_SOURCE_DEFAULT))
    return results


def set_team_setting(team, key: str, value) -> TeamSetting:
    validate_setting_value(key, value)
    default = _get_default_for_scope(key, SETTING_SCOPE_TEAM)
    obj, _ = TeamSetting.objects.update_or_create(
        team=team,
        setting=default,
        defaults={"value": value},
    )
    return obj


def delete_team_setting(team, key: str) -> None:
    default = _get_default_for_scope(key, SETTING_SCOPE_TEAM)
    TeamSetting.objects.get(team=team, setting=default).delete()


# ---------------------------------------------------------------------------
# 用户偏好（无 fallback，key 无需预定义）
# ---------------------------------------------------------------------------


def get_user_setting(user, key: str, default=None):
    obj = UserSetting.objects.filter(user=user, key=key).first()
    return obj.value if obj else default


def get_all_user_settings(user) -> list[dict]:
    settings = UserSetting.objects.filter(user=user).exclude(key__startswith="internal.")
    return [{"key": setting.key, "value": setting.value} for setting in settings]


def set_user_setting(user, key: str, value) -> UserSetting:
    obj, _ = UserSetting.objects.update_or_create(
        user=user,
        key=key,
        defaults={"value": value},
    )
    return obj


def delete_user_setting(user, key: str) -> None:
    UserSetting.objects.filter(user=user, key=key).delete()
