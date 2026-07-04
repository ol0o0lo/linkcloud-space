from django.conf import settings
from django.utils import dateformat
from django.utils.timezone import now

from ninja import Router, Schema
from ninja.errors import HttpError

from apps.accounts.models import User
from apps.base.permissions import require_superuser
from apps.base.utils.email import send_email
from apps.base.utils.timezones import get_timezone_label
from apps.notifications.services import notify
from apps.organizations.models import Organization, OrganizationMember
from apps.organizations.session import get_member_count, get_owner_count

router = Router(tags=["应用/系统"])


class AppContextUserOut(Schema):
    id: int
    email: str
    username: str
    first_name: str
    last_name: str
    timezone: str
    timezone_display: str
    avatar_url: str | None
    phone_country_code: str
    phone_national_number: str
    phone_verified: bool
    real_name_status: str
    real_name_masked: str = ""
    id_number_masked: str = ""
    is_staff: bool
    is_superuser: bool
    is_hijacked: bool
    organizations: list[dict]


class AppContextOrgOut(Schema):
    id: int
    name: str
    slug: str
    is_owner: bool


class AppContextOut(Schema):
    user: AppContextUserOut | None
    org: AppContextOrgOut | None
    organizations: list[dict]
    orgMemberCount: int
    orgOwnerCount: int
    siteName: str
    instance: str
    signupOpen: bool
    version: str
    amapJsapiKey: str = ""
    amapSecurityJsCode: str = ""


def _get_app_version() -> str:
    return "unknown"


@router.get("/version/", auth=None, summary="获取应用版本")
def get_version(request):
    """返回当前前端构建版本标识，用于客户端版本展示与调试。"""
    return {"version": _get_app_version()}


@router.get("/enums/", auth=None, summary="获取后端枚举映射")
def list_enums(request):
    """返回前端筛选和回显需要的后端枚举值。"""
    from apps.access.constants import AccessPermission, AccessRoleCode, AccessScope, FinancePermission, OrganizationPermission, SettingsPermission, TeamPermission
    from apps.accounts.constants import AdminUserRole, PhoneCountryCode, RealNameIdCardSide, RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
    from apps.house.constants import ContactRole, EstatePropertyType, HouseDecoration, HouseOrientation, HousePublishStatus, HouseStatus, LeaseStatus, ViewingRecordStatus
    from apps.media.constants import MediaExtension, MediaScope, MediaType, ResourceType
    from apps.notifications.constants import NotificationChannel, NotificationDispatchScope, NotificationDispatchStatus
    from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent
    from apps.settings.constants import SettingWidget, ValueType
    from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus

    registry = {
        "access.scope": AccessScope,
        "access.role_code": AccessRoleCode,
        "access.permission": AccessPermission,
        "access.organization_permission": OrganizationPermission,
        "access.team_permission": TeamPermission,
        "access.settings_permission": SettingsPermission,
        "access.finance_permission": FinancePermission,
        "accounts.admin_user_role": AdminUserRole,
        "accounts.phone_country_code": PhoneCountryCode,
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
        "notifications.dispatch_scope": NotificationDispatchScope,
        "notifications.dispatch_status": NotificationDispatchStatus,
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
    keys = request.GET.get("keys")
    if keys:
        try:
            registry = {key: registry[key] for key in keys.split(",")}
        except KeyError as exc:
            raise HttpError(400, f"Unknown enum key: {exc.args[0]}") from exc

    return {key: [{"label": str(label), "value": str(value)} for value, label in enum_cls.choices] for key, enum_cls in registry.items()}


@router.get("/app-context/", auth=None, response=AppContextOut, summary="获取应用上下文")
def app_context(request):
    """返回当前用户、当前租户和前端初始化所需的全局上下文信息。"""
    if not request.user.is_authenticated:
        return {
            "user": None,
            "org": None,
            "organizations": [],
            "orgMemberCount": 0,
            "orgOwnerCount": 0,
            "siteName": getattr(settings, "SITE_NAME", ""),
            "instance": getattr(settings, "INSTANCE", ""),
            "signupOpen": getattr(settings, "ACCOUNT_SIGNUP_OPEN", False),
            "version": _get_app_version(),
            "amapJsapiKey": getattr(settings, "AMAP_JSAPI_KEY", ""),
            "amapSecurityJsCode": getattr(settings, "AMAP_SECURITY_JS_CODE", ""),
        }

    user = request.user
    org = getattr(request, "org", None)
    user_orgs = [{"id": o.pk, "name": o.name, "slug": o.slug} for o in Organization.objects.filter(organizationmember__user=user)]
    org_data = None
    if org and org.pk:
        org_data = {"id": org.id, "name": org.name, "slug": org.slug, "is_owner": org.is_owner}

    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "timezone": user.timezone,
            "timezone_display": get_timezone_label(user.timezone),
            "avatar_url": user.avatar_url,
            "phone_country_code": user.phone_country_code,
            "phone_national_number": user.phone_national_number,
            "phone_verified": user.phone_verified,
            "real_name_status": user.real_name_status,
            "real_name_masked": user.real_name_masked,
            "id_number_masked": user.id_number_masked,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
            "is_hijacked": getattr(user, "is_hijacked", False),
            "organizations": user_orgs,
        },
        "org": org_data,
        "organizations": user_orgs,
        "orgMemberCount": get_member_count(request),
        "orgOwnerCount": get_owner_count(request),
        "siteName": getattr(settings, "SITE_NAME", ""),
        "instance": getattr(settings, "INSTANCE", ""),
        "signupOpen": getattr(settings, "ACCOUNT_SIGNUP_OPEN", False),
        "version": _get_app_version(),
        "amapJsapiKey": getattr(settings, "AMAP_JSAPI_KEY", ""),
        "amapSecurityJsCode": getattr(settings, "AMAP_SECURITY_JS_CODE", ""),
    }


@router.get("/test-notifications/staff-users/", summary="获取测试通知收件人列表")
def test_notifications_staff_users(request):
    """返回可用于发送测试通知的 staff 用户列表，仅超级管理员可用。"""
    require_superuser(request)
    users = User.objects.filter(is_staff=True).order_by("first_name", "last_name", "email")
    return [{"id": u.pk, "full_name": u.get_full_name() or u.username, "email": u.email} for u in users]


class TestNotificationIn(Schema):
    user_id: int
    send_email: bool = True
    send_in_app: bool = True


@router.post("/test-notifications/", summary="发送测试通知")
def send_test_notification(request, payload: TestNotificationIn):
    """向指定 staff 用户发送测试邮件或站内通知，仅超级管理员可用。"""
    require_superuser(request)
    if not payload.send_email and not payload.send_in_app:
        raise HttpError(400, "Select at least one notification channel.")
    try:
        recipient = User.objects.get(pk=payload.user_id, is_staff=True)
    except User.DoesNotExist as exc:
        raise HttpError(400, "Invalid recipient.") from exc

    date_time = dateformat.format(now(), settings.SHORT_DATETIME_FORMAT)
    subject = f"Test Email ({date_time})"
    debug_settings = [
        (name, getattr(settings, name, None))
        for name in (
            "SETTINGS_MODULE",
            "EMAIL_HOST",
            "EMAIL_HOST_USER",
            "EMAIL_PORT",
            "EMAIL_CONFIG",
            "EMAIL_BACKEND",
        )
    ]
    context = {"subject": subject, "date_time": date_time, "debug_settings": debug_settings}

    if payload.send_email:
        send_email(
            recipient,
            recipients=[recipient],
            subject=subject,
            base_template_name="emails/test_email",
            context=context,
        )

    if payload.send_in_app:
        sender_org = request.org.instance if getattr(request.org, "id", None) else None
        if sender_org is not None and not OrganizationMember.objects.filter(user=recipient, organization=sender_org).exists():
            raise HttpError(
                400,
                f"{recipient.get_full_name() or recipient.username} isn't a member of "
                f"{sender_org.name}. Switch to an organization they belong to (or none) "
                f"to send a personal-scope test notification.",
            )
        notify(
            [recipient],
            title="Test Notification",
            body="This is a test notification.",
            actor=request.user,
            organization=sender_org,
        )

    recipient_label = f"{recipient.get_full_name() or recipient.username} ({recipient.email})"
    if payload.send_email and payload.send_in_app:
        return {"message": f"Email + in-app notification sent to {recipient_label}"}
    if payload.send_email:
        return {"message": f"Email sent to {recipient_label}"}
    return {"message": f"In-app notification sent to {recipient_label}"}
