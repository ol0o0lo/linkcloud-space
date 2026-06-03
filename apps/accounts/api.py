import json
import logging

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.shortcuts import get_object_or_404

import requests as http_requests
from ninja import File, Form, Query, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.pagination import paginate

from apps.accounts.schemas import (
    AdminUserOut,
    AvatarOut,
    ForceLogoutOut,
    ImpersonateUserOut,
    MeOut,
    ResetMfaOut,
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
    return request.user


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


def _get_admin_user(request, user_id: int):
    require_superuser(request)
    User = get_user_model()
    return get_object_or_404(User, pk=user_id)


@admin_users_router.patch("/{user_id}/status/", response=AdminUserOut, summary="启用或禁用用户")
def patch_user_status(request, user_id: int, payload: UserStatusPatchIn):
    """由超级管理员启用或禁用用户账号；禁止通过该接口禁用自己。"""
    user = _get_admin_user(request, user_id)
    if user.pk == request.user.pk and payload.is_active is False:
        raise HttpError(400, "You cannot disable your own account.")
    user.is_active = payload.is_active
    user.save(update_fields=["is_active"])
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
    user.phone = None
    user.phone_verified = False
    user.save(update_fields=["phone", "phone_verified"])
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
