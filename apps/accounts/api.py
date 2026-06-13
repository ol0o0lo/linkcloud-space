import json
import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404

import requests as http_requests
from allauth.mfa.adapter import get_adapter as get_mfa_adapter
from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import generate_totp_secret
from allauth.mfa.utils import is_mfa_enabled
from ninja import File, Form, Query, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.pagination import paginate

from apps.accounts.schemas import (
    AdminRealNameDecisionIn,
    AdminRealNameVerificationRowOut,
    AdminUserCreateIn,
    AdminUserOut,
    AdminUserPasswordIn,
    AdminUserPatchIn,
    AvatarOut,
    ForceLogoutOut,
    ImpersonateUserOut,
    MeOut,
    RealNameLogOut,
    RealNameRetryIn,
    RealNameSubmitIn,
    RealNameVerificationDetailOut,
    RealNameVerificationOut,
    ResetMfaOut,
    TotpSetupOut,
    UserOut,
    UserPatchIn,
    UserStatusPatchIn,
    WechatPhoneIn,
    WechatPhoneOut,
)
from apps.base.ninja_pagination import make_pagination
from apps.base.permissions import require_authenticated, require_superuser

logger = logging.getLogger(__name__)

users_router = Router(tags=["用户/资料"])
admin_users_router = Router(tags=["用户/生命周期"])
real_name_router = Router(tags=["用户/实名"])
admin_real_name_router = Router(tags=["用户/实名后台"])


def _users_qs(request):
    User = get_user_model()
    filter_kwargs = {"is_active": True}
    if request.org.id is None:
        filter_kwargs["pk"] = request.user.pk
    else:
        filter_kwargs["organizationmember__organization"] = request.org.pk
    return User.objects.filter(**filter_kwargs).only("id", "username", "first_name", "last_name", "timezone").order_by("first_name")


@users_router.get("/me/", response=MeOut, summary="获取当前用户信息")
def get_me(request):
    """返回当前登录用户的资料、权限相关标记和展示信息。"""
    require_authenticated(request)
    profile_fallback = {
        "signature": "资料待补充",
        "country": "China",
        "tags": [
            {"key": "verified-email", "label": "已验证邮箱"},
            {"key": "verified-phone", "label": "已绑定手机"},
        ],
        "notice": [
            {
                "id": "profile-notice-1",
                "title": "资料完善",
                "logo": "https://gw.alipayobjects.com/zos/rmsportal/WdGqmHpayyMjiEhcKoVE.png",
                "description": "待补充基础资料字段",
                "updatedAt": "2026-06-13T09:00:00+08:00",
                "member": "账户中心",
                "href": "",
                "memberLink": "",
            },
            {
                "id": "profile-notice-2",
                "title": "安全检查",
                "logo": "https://gw.alipayobjects.com/zos/rmsportal/zOsKZmFRdUtvpqCImOVY.png",
                "description": "已启用标准 allauth 登录",
                "updatedAt": "2026-06-13T09:00:00+08:00",
                "member": "认证中心",
                "href": "",
                "memberLink": "",
            },
        ],
        "notify_count": 2,
        "unread_count": 1,
    }
    return {
        "avatar_url": request.user.avatar_url,
        "email": request.user.email,
        "first_name": request.user.first_name,
        "id": request.user.id,
        "id_number_masked": request.user.id_number_masked,
        "is_staff": request.user.is_staff,
        "is_superuser": request.user.is_superuser,
        "last_name": request.user.last_name,
        "phone": request.user.phone,
        "phone_country_code": request.user.phone_country_code,
        "phone_national_number": request.user.phone_national_number,
        "phone_verified": request.user.phone_verified,
        "real_name_masked": request.user.real_name_masked,
        "real_name_status": request.user.real_name_status,
        "real_name_verified_at": request.user.real_name_verified_at.isoformat() if request.user.real_name_verified_at else None,
        "timezone": request.user.timezone,
        "username": request.user.username,
        **profile_fallback,
    }


@users_router.get("/", response=list[UserOut], summary="获取用户列表")
@paginate(make_pagination(default_page_size=50))
def list_users(request, q: str | None = Query(None, description="按用户姓名搜索。")):
    """返回当前租户下可见的用户列表，支持按姓名关键字筛选。"""
    require_authenticated(request)
    qs = _users_qs(request)
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q))
    return qs


@users_router.get("/impersonate-search/", response=list[ImpersonateUserOut], summary="搜索可代登录用户")
def impersonate_search(request, q: str = Query("", description="按姓名、用户名或邮箱搜索。")):
    """供超级管理员搜索可用于 impersonate 的用户候选列表。"""
    require_authenticated(request)
    if not request.user.is_superuser:
        raise HttpError(403, "Superuser permission required.")
    User = get_user_model()
    qs = User.objects.filter(is_active=True).exclude(pk=request.user.pk)
    q = q.strip()
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q) | Q(email__icontains=q))
    qs = qs.order_by("first_name", "last_name")[:20]
    return [
        {
            "id": u.pk,
            "username": u.username,
            "email": u.email,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "full_name": u.get_full_name(),
            "avatar_url": u.avatar_url,
        }
        for u in qs
    ]


@users_router.get("/{user_id}/", response=UserOut, summary="获取指定用户信息")
def get_user(request, user_id: int):
    """返回当前租户范围内指定用户的资料信息。"""
    require_authenticated(request)
    return get_object_or_404(_users_qs(request), pk=user_id)


@users_router.patch("/{user_id}/", response=UserOut, summary="更新当前用户资料")
def patch_user(request, user_id: int, payload: UserPatchIn):
    """更新当前登录用户自己的基础资料，不允许修改他人账户。"""
    require_authenticated(request)
    user = get_object_or_404(_users_qs(request), pk=user_id)
    if user != request.user:
        raise HttpError(403, "You can only update your own profile.")
    old_tz = user.timezone
    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(user, field, value)
    user.full_clean()
    user.save()
    if user.timezone != old_tz:
        logger.info("User %s timezone changed from %s to %s", user.pk, old_tz, user.timezone)
    return user


@users_router.post("/me/avatar/", response=AvatarOut, summary="上传用户头像")
def upload_avatar(
    request,
    image: UploadedFile = File(..., description="头像图片文件。"),
    crop_data: str = Form("{}", description="头像裁剪参数 JSON 字符串。"),
):
    """上传并裁剪当前用户头像，返回新的头像地址。"""
    require_authenticated(request)
    from apps.accounts.services import process_and_save_avatar

    try:
        crop = json.loads(crop_data or "{}")
    except (TypeError, json.JSONDecodeError) as exc:
        raise HttpError(400, "Invalid crop_data: must be JSON.") from exc
    if not isinstance(crop, dict):
        raise HttpError(400, "Invalid crop_data: must be a JSON object.")

    try:
        avatar_url = process_and_save_avatar(request.user, image, crop)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc

    return {"avatar_url": avatar_url}


@users_router.delete("/me/avatar/", response={204: None}, summary="删除用户头像")
def delete_avatar(request):
    """删除当前用户头像并恢复为默认展示状态。"""
    require_authenticated(request)
    from apps.accounts.services import delete_user_avatar

    delete_user_avatar(request.user)
    return Status(204, None)


@users_router.post("/me/wechat-phone/", response=WechatPhoneOut, summary="绑定微信手机号")
def bind_wechat_phone(request, payload: WechatPhoneIn):
    """通过微信小程序手机号凭证为当前用户绑定手机号。"""
    require_authenticated(request)
    from allauth.socialaccount.models import SocialApp

    from apps.accounts.providers.wechat_miniprogram.client import get_phone_number
    from apps.accounts.services import bind_phone_to_user

    try:
        app = SocialApp.objects.get(provider="wechat_miniprogram")
    except SocialApp.DoesNotExist:
        from allauth.socialaccount.adapter import get_adapter as get_social_adapter

        provider = get_social_adapter().get_provider(request, "wechat_miniprogram")
        app = provider.app

    try:
        phone = get_phone_number(app, payload.phone_code)
    except (ValueError, http_requests.RequestException) as e:
        raise HttpError(400, str(e)) from e

    try:
        user, merged = bind_phone_to_user(request, request.user, phone)
    except ValueError as e:
        raise HttpError(400, str(e)) from e
    return {"phone": phone, "merged": merged}


@users_router.get("/me/mfa/totp-setup/", response=TotpSetupOut, summary="获取 TOTP 初始化信息")
def get_totp_setup(request):
    """返回当前用户可用于初始化 TOTP 的密钥和 otpauth URL。"""
    require_authenticated(request)
    if is_mfa_enabled(request.user, [Authenticator.Type.TOTP]):
        raise HttpError(409, "TOTP is already enabled.")

    secret = generate_totp_secret()
    return {
        "secret": secret,
        "totp_url": get_mfa_adapter().build_totp_url(request.user, secret),
    }


def _get_admin_user(request, user_id: int):
    require_superuser(request)
    User = get_user_model()
    return get_object_or_404(User, pk=user_id)


def _prevent_self_admin_lockout(request, user, data: dict):
    if user.pk != request.user.pk:
        return
    if data.get("is_active") is False:
        raise HttpError(400, "You cannot disable your own account.")
    if data.get("is_staff") is False:
        raise HttpError(400, "You cannot remove staff access from your own account.")
    if data.get("is_superuser") is False:
        raise HttpError(400, "You cannot remove superuser access from your own account.")


@admin_users_router.get("/", response=list[AdminUserOut], summary="获取后台用户列表")
@paginate(make_pagination(default_page_size=50))
def list_admin_users(request, q: str | None = Query(None, description="按姓名、用户名或邮箱搜索。")):
    """由超级管理员查看全量用户列表，用于后台账号生命周期管理。"""
    require_superuser(request)
    User = get_user_model()
    qs = User.objects.all().order_by("id")
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q) | Q(email__icontains=q))
    return qs


@admin_users_router.post("/", response=AdminUserOut, summary="创建后台用户")
def create_admin_user(request, payload: AdminUserCreateIn):
    """由超级管理员创建用户，可同时设置角色、手机号和初始密码。"""
    require_superuser(request)
    User = get_user_model()
    data = payload.dict()
    password = data.pop("password")
    user = User(**data)
    user.set_password(password)
    user.full_clean()
    user.save()
    return user


@admin_users_router.patch("/{user_id}/", response=AdminUserOut, summary="更新后台用户")
def patch_admin_user(request, user_id: int, payload: AdminUserPatchIn):
    """由超级管理员更新用户资料、角色与联系方式。"""
    user = _get_admin_user(request, user_id)
    data = payload.dict(exclude_unset=True)
    _prevent_self_admin_lockout(request, user, data)
    for field, value in data.items():
        setattr(user, field, value)
    user.full_clean()
    user.save()
    return user


@admin_users_router.patch("/{user_id}/status/", response=AdminUserOut, summary="启用或禁用用户")
def patch_user_status(request, user_id: int, payload: UserStatusPatchIn):
    """由超级管理员启用或禁用用户账号；禁止通过该接口禁用自己。"""
    user = _get_admin_user(request, user_id)
    data = payload.dict()
    _prevent_self_admin_lockout(request, user, data)
    user.is_active = payload.is_active
    user.full_clean()
    user.save(update_fields=["is_active"])
    return user


@admin_users_router.post("/{user_id}/set-password/", response=AdminUserOut, summary="设置用户密码")
def set_admin_user_password(request, user_id: int, payload: AdminUserPasswordIn):
    """由超级管理员直接设置用户密码。"""
    user = _get_admin_user(request, user_id)
    user.set_password(payload.password)
    user.save(update_fields=["password"])
    return user


@admin_users_router.post("/{user_id}/force-logout/", response=ForceLogoutOut, summary="强制用户退出登录")
def force_logout_user(request, user_id: int):
    """删除 allauth 记录的用户会话，使用户需要重新登录。"""
    user = _get_admin_user(request, user_id)
    from allauth.usersessions.models import UserSession

    user_sessions = list(UserSession.objects.filter(user=user))
    for user_session in user_sessions:
        user_session.end()
    deleted_sessions = len(user_sessions)
    return {"deleted_sessions": deleted_sessions}


@admin_users_router.post("/{user_id}/reset-mfa/", response=ResetMfaOut, summary="重置用户 MFA")
def reset_user_mfa(request, user_id: int):
    """删除用户已配置的 allauth MFA authenticators。"""
    user = _get_admin_user(request, user_id)
    from allauth.mfa.models import Authenticator

    deleted_authenticators, _ = Authenticator.objects.filter(user=user).delete()
    return {"deleted_authenticators": deleted_authenticators}


@admin_users_router.delete("/{user_id}/phone/", response={204: None}, summary="解绑用户手机号")
def unbind_user_phone(request, user_id: int):
    """清空用户手机号及验证状态。"""
    user = _get_admin_user(request, user_id)
    user.set_phone_number(None)
    user.phone_verified = False
    user.save(update_fields=["phone", "phone_country_code", "phone_national_number", "phone_verified"])
    return Status(204, None)


@admin_users_router.delete("/{user_id}/wechat/", response={204: None}, summary="解绑用户微信账号")
def unbind_user_wechat(request, user_id: int):
    """删除用户微信开放平台和小程序 social account 绑定。"""
    user = _get_admin_user(request, user_id)
    from allauth.socialaccount.internal.flows.connect import validate_disconnect
    from allauth.socialaccount.models import SocialAccount

    accounts = list(SocialAccount.objects.filter(user=user, provider__in=["weixin", "wechat_miniprogram"]))
    try:
        for account in accounts:
            validate_disconnect(request, account)
    except ValidationError as exc:
        raise HttpError(400, "; ".join(str(message) for message in exc.messages)) from exc
    for account in accounts:
        account.delete()
    return Status(204, None)


@real_name_router.get("/me/real-name/", response=RealNameVerificationOut, summary="获取当前用户实名认证状态")
def get_my_real_name(request):
    require_authenticated(request)
    from apps.accounts.constants import RealNameProvider, RealNameSource, RealNameStatus
    from apps.accounts.real_name import get_current_real_name_verification, serialize_real_name_verification

    verification = get_current_real_name_verification(request.user)
    if verification:
        return serialize_real_name_verification(verification)
    return {
        "created_at": "",
        "failure_reason": "",
        "id": 0,
        "id_number_last4": "",
        "id_number_masked": request.user.id_number_masked,
        "is_current": False,
        "provider": RealNameProvider.MOCK_AUTO,
        "provider_label": RealNameProvider.get_choice_label(RealNameProvider.MOCK_AUTO),
        "provider_request_id": "",
        "provider_result": {},
        "real_name_masked": request.user.real_name_masked,
        "review_note": "",
        "reviewed_at": request.user.real_name_verified_at.isoformat() if request.user.real_name_verified_at else None,
        "reviewed_by": None,
        "source": RealNameSource.USER_SUBMIT,
        "source_label": RealNameSource.get_choice_label(RealNameSource.USER_SUBMIT),
        "status": request.user.real_name_status,
        "status_label": RealNameStatus.get_choice_label(request.user.real_name_status),
        "updated_at": "",
    }


@real_name_router.get("/me/real-name/logs/", response=list[RealNameLogOut], summary="获取当前用户实名认证时间线")
def list_my_real_name_logs(request):
    require_authenticated(request)
    from apps.accounts.real_name import build_real_name_timeline_row, get_current_real_name_verification

    verification = get_current_real_name_verification(request.user)
    if not verification:
        return []
    return [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]


@real_name_router.post("/me/real-name/submit/", response=RealNameVerificationOut, summary="提交实名认证申请")
def submit_my_real_name(request, payload: RealNameSubmitIn):
    require_authenticated(request)
    from apps.accounts.real_name import serialize_real_name_verification, submit_real_name_verification

    verification = submit_real_name_verification(
        user=request.user,
        real_name=payload.real_name,
        id_number=payload.id_number,
        source=payload.source,
    )
    return serialize_real_name_verification(verification)


@real_name_router.post("/me/real-name/retry/", response=RealNameVerificationOut, summary="重新提交实名认证申请")
def retry_my_real_name(request, payload: RealNameRetryIn):
    require_authenticated(request)
    from apps.accounts.constants import RealNameStatus
    from apps.accounts.real_name import get_current_real_name_verification, serialize_real_name_verification, submit_real_name_verification

    current = get_current_real_name_verification(request.user)
    if current and current.status not in {RealNameStatus.REJECTED, RealNameStatus.REVOKED}:
        raise HttpError(400, "当前实名状态不允许重新提交。")
    verification = submit_real_name_verification(
        user=request.user,
        real_name=payload.real_name,
        id_number=payload.id_number,
        source=payload.source,
    )
    return serialize_real_name_verification(verification)


@admin_real_name_router.get("/", response=list[AdminRealNameVerificationRowOut], summary="获取实名认证记录列表")
@paginate(make_pagination(default_page_size=50))
def list_admin_real_name_verifications(
    request,
    q: str | None = Query(None, description="按用户名、邮箱、手机号、实名脱敏或身份证后四位搜索。"),
    status: str | None = Query(None, description="按实名状态筛选。"),
):
    require_superuser(request)
    from apps.accounts.models import RealNameVerification

    qs = RealNameVerification.objects.select_related("user", "reviewed_by").filter(is_current=True).order_by("-created_at")
    if status:
        qs = qs.filter(status=status)
    if q:
        qs = qs.filter(
            Q(user__username__icontains=q)
            | Q(user__email__icontains=q)
            | Q(user__phone__icontains=q)
            | Q(real_name_masked__icontains=q)
            | Q(id_number_last4__icontains=q)
        )
    from apps.accounts.real_name import serialize_real_name_verification

    return [serialize_real_name_verification(item) for item in qs]


@admin_real_name_router.get("/{verification_id}/", response=RealNameVerificationDetailOut, summary="获取实名认证详情")
def get_admin_real_name_verification(request, verification_id: int):
    require_superuser(request)
    from apps.accounts.models import RealNameVerification
    from apps.accounts.real_name import build_real_name_timeline_row, serialize_real_name_verification

    verification = get_object_or_404(RealNameVerification.objects.select_related("user", "reviewed_by"), pk=verification_id)
    payload = serialize_real_name_verification(verification, include_sensitive=True)
    payload["logs"] = [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]
    return payload


def _get_admin_real_name_verification(request, verification_id: int):
    require_superuser(request)
    from apps.accounts.models import RealNameVerification

    return get_object_or_404(RealNameVerification.objects.select_related("user", "reviewed_by"), pk=verification_id)


@admin_real_name_router.post("/{verification_id}/manual-review/", response=RealNameVerificationDetailOut, summary="转人工复核")
def move_admin_real_name_to_manual_review(request, verification_id: int, payload: AdminRealNameDecisionIn):
    from apps.accounts.constants import RealNameLogAction, RealNameStatus
    from apps.accounts.real_name import admin_transition_real_name, build_real_name_timeline_row, serialize_real_name_verification

    verification = _get_admin_real_name_verification(request, verification_id)
    verification = admin_transition_real_name(
        verification,
        operator=request.user,
        to_status=RealNameStatus.MANUAL_REVIEW,
        action=RealNameLogAction.MOVED_TO_MANUAL_REVIEW,
        note=payload.note or "后台转人工复核。",
    )
    result = serialize_real_name_verification(verification, include_sensitive=True)
    result["logs"] = [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]
    return result


@admin_real_name_router.post("/{verification_id}/approve/", response=RealNameVerificationDetailOut, summary="人工通过实名认证")
def approve_admin_real_name(request, verification_id: int, payload: AdminRealNameDecisionIn):
    from apps.accounts.constants import RealNameLogAction, RealNameStatus
    from apps.accounts.real_name import admin_transition_real_name, build_real_name_timeline_row, serialize_real_name_verification

    verification = _get_admin_real_name_verification(request, verification_id)
    verification = admin_transition_real_name(
        verification,
        operator=request.user,
        to_status=RealNameStatus.VERIFIED,
        action=RealNameLogAction.MANUAL_APPROVED,
        note=payload.note or "后台人工审核通过。",
    )
    result = serialize_real_name_verification(verification, include_sensitive=True)
    result["logs"] = [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]
    return result


@admin_real_name_router.post("/{verification_id}/reject/", response=RealNameVerificationDetailOut, summary="人工驳回实名认证")
def reject_admin_real_name(request, verification_id: int, payload: AdminRealNameDecisionIn):
    from apps.accounts.constants import RealNameLogAction, RealNameStatus
    from apps.accounts.real_name import admin_transition_real_name, build_real_name_timeline_row, serialize_real_name_verification

    verification = _get_admin_real_name_verification(request, verification_id)
    verification = admin_transition_real_name(
        verification,
        operator=request.user,
        to_status=RealNameStatus.REJECTED,
        action=RealNameLogAction.MANUAL_REJECTED,
        note=payload.note or "后台人工审核驳回。",
    )
    result = serialize_real_name_verification(verification, include_sensitive=True)
    result["logs"] = [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]
    return result


@admin_real_name_router.post("/{verification_id}/revoke/", response=RealNameVerificationDetailOut, summary="撤销实名认证")
def revoke_admin_real_name(request, verification_id: int, payload: AdminRealNameDecisionIn):
    from apps.accounts.constants import RealNameLogAction, RealNameStatus
    from apps.accounts.real_name import admin_transition_real_name, build_real_name_timeline_row, serialize_real_name_verification

    verification = _get_admin_real_name_verification(request, verification_id)
    verification = admin_transition_real_name(
        verification,
        operator=request.user,
        to_status=RealNameStatus.REVOKED,
        action=RealNameLogAction.REVOKED,
        note=payload.note or "后台撤销实名认证。",
    )
    result = serialize_real_name_verification(verification, include_sensitive=True)
    result["logs"] = [build_real_name_timeline_row(log) for log in verification.logs.select_related("operator").all()]
    return result
