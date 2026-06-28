from functools import cache
from typing import Any

from ninja.errors import HttpError


def _label(enum_cls: Any, value: Any) -> str:
    if hasattr(enum_cls, "get_choice_label"):
        return str(enum_cls.get_choice_label(value))
    try:
        return str(enum_cls(value).label)
    except ValueError:
        return str(value)


def enum_mapping(enum_cls: Any, value: Any) -> str:
    if value is None:
        return ""
    return _label(enum_cls, value)


def enum_list_mapping(enum_cls: Any, values: list[Any] | tuple[Any, ...] | None) -> list[str]:
    return [enum_mapping(enum_cls, value) for value in (values or [])]


def enum_options(enum_cls: Any) -> list[dict[str, str]]:
    return [{"value": str(value), "mapping": str(label)} for value, label in enum_cls.choices]


@cache
def enum_registry() -> dict[str, Any]:
    from apps.access.constants import AccessPermission, AccessRoleCode, AccessScope, FinancePermission, OrganizationPermission, SettingsPermission, TeamPermission
    from apps.accounts.constants import RealNameIdCardSide, RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
    from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
    from apps.media.constants import MediaExtension, MediaScope, MediaType, ResourceType
    from apps.notifications.constants import NotificationChannel
    from apps.notifications.models import NotificationDispatch
    from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
    from apps.settings.constants import SettingWidget, ValueType
    from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus

    return {
        "access.scope": AccessScope,
        "access.role_code": AccessRoleCode,
        "access.permission": AccessPermission,
        "access.organization_permission": OrganizationPermission,
        "access.team_permission": TeamPermission,
        "access.settings_permission": SettingsPermission,
        "access.finance_permission": FinancePermission,
        "accounts.real_name_status": RealNameStatus,
        "accounts.real_name_source": RealNameSource,
        "accounts.real_name_provider": RealNameProvider,
        "accounts.real_name_log_action": RealNameLogAction,
        "accounts.real_name_id_card_side": RealNameIdCardSide,
        "house.estate_property_type": EstatePropertyType,
        "house.contact_role": ContactRole,
        "house.house_orientation": HouseOrientation,
        "house.house_decoration": HouseDecoration,
        "house.house_status": HouseStatus,
        "house.house_publish_status": HousePublishStatus,
        "house.viewing_record_status": ViewingRecordStatus,
        "house.lease_status": LeaseStatus,
        "media.scope": MediaScope,
        "media.extension": MediaExtension,
        "media.resource_type": ResourceType,
        "media.media_type": MediaType,
        "notifications.channel": NotificationChannel,
        "notifications.dispatch_scope": NotificationDispatch.Scope,
        "notifications.dispatch_status": NotificationDispatch.Status,
        "referrals.record_status": ReferralRecordStatus,
        "referrals.display_level": ReferralDisplayLevel,
        "referrals.trigger_event": ReferralTriggerEvent,
        "settings.value_type": ValueType,
        "settings.widget": SettingWidget,
        "wallet.entry_type": WalletEntryType,
        "wallet.withdrawal_pay_channel": WithdrawalPayChannel,
        "wallet.withdrawal_status": WithdrawalStatus,
        "wallet.payout_status": PayoutStatus,
    }


def selected_enum_options(keys: str | None = None) -> dict[str, list[dict[str, str]]]:
    registry = enum_registry()
    selected_keys = [item.strip() for item in (keys or "").split(",") if item.strip()]
    if not selected_keys:
        selected_keys = sorted(registry)
    unknown = [key for key in selected_keys if key not in registry]
    if unknown:
        raise HttpError(400, f"Unknown enum key: {', '.join(unknown)}")
    return {key: enum_options(registry[key]) for key in selected_keys}
