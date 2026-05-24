import json
import logging

import requests as http_requests
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.shortcuts import get_object_or_404

from ninja import File, Form, Query, Router, Status
from ninja.errors import HttpError
from ninja.files import UploadedFile
from ninja.pagination import paginate

from apps.accounts.schemas import AvatarOut, ImpersonateUserOut, UserOut, UserPatchIn, WechatPhoneIn, WechatPhoneOut
from apps.base.ninja_pagination import make_pagination
from apps.base.permissions import require_authenticated

logger = logging.getLogger(__name__)

users_router = Router(tags=["users"])


def _users_qs(request):
    User = get_user_model()
    filter_kwargs = {"is_active": True}
    if request.org.id is None:
        filter_kwargs["pk"] = request.user.pk
    else:
        filter_kwargs["organizationmember__organization"] = request.org.pk
    return User.objects.filter(**filter_kwargs).only("id", "username", "first_name", "last_name", "timezone").order_by("first_name")


@users_router.get("/", response=list[UserOut])
@paginate(make_pagination(default_page_size=50))
def list_users(request, q: str | None = Query(None)):
    require_authenticated(request)
    qs = _users_qs(request)
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q))
    return qs


@users_router.get("/impersonate-search/", response=list[ImpersonateUserOut])
def impersonate_search(request, q: str = Query("")):
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


@users_router.get("/{user_id}/", response=UserOut)
def get_user(request, user_id: int):
    require_authenticated(request)
    return get_object_or_404(_users_qs(request), pk=user_id)


@users_router.patch("/{user_id}/", response=UserOut)
def patch_user(request, user_id: int, payload: UserPatchIn):
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


@users_router.post("/me/avatar/", response=AvatarOut)
def upload_avatar(
    request,
    image: UploadedFile = File(...),
    crop_data: str = Form("{}"),
):
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


@users_router.delete("/me/avatar/", response={204: None})
def delete_avatar(request):
    require_authenticated(request)
    from apps.accounts.services import delete_user_avatar

    delete_user_avatar(request.user)
    return Status(204, None)


@users_router.post("/me/wechat-phone/", response=WechatPhoneOut)
def bind_wechat_phone(request, payload: WechatPhoneIn):
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

    user, merged = bind_phone_to_user(request, request.user, phone)
    return {"phone": phone, "merged": merged}
