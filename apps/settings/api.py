"""Settings API — ninja Router replacing the old DRF-based views."""

from typing import Any

from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from ninja import Router, Schema, Status
from ninja.errors import HttpError

from apps.base.permissions import require_authenticated, require_org_owner
from apps.settings.models import DefaultSetting, OrganizationSetting
from apps.settings.service import (
    delete_org_setting,
    delete_user_setting,
    get_all_org_settings,
    get_all_user_settings,
    get_org_setting,
    get_user_setting,
    set_org_setting,
    set_user_setting,
)
from apps.teams.models import Team

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SettingOut(Schema):
    key: str
    value: Any
    value_type: str
    description: str
    is_customized: bool


class UserSettingOut(Schema):
    key: str
    value: Any


class SetSettingIn(Schema):
    value: Any


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

org_router = Router(tags=["settings-org"])
user_router = Router(tags=["settings-user"])
team_router = Router(tags=["settings-teams"])


# ---------------------------------------------------------------------------
# Org settings
# ---------------------------------------------------------------------------


@org_router.get("/", response=list[SettingOut])
def list_org_settings(request):
    require_authenticated(request)
    org = request.org.instance
    return get_all_org_settings(org)


@org_router.get("/{key}/", response=SettingOut)
def get_org_setting_view(request, key: str):
    require_authenticated(request)
    org = request.org.instance
    try:
        return get_org_setting(org, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@org_router.put("/{key}/", response=SettingOut)
def put_org_setting(request, key: str, payload: SetSettingIn):
    require_authenticated(request)
    org = request.org.instance
    if not org.is_owner(request.user):
        raise PermissionDenied("Only organization owners are allowed to perform this action.")
    try:
        set_org_setting(org, key, payload.value)
        return get_org_setting(org, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@org_router.delete("/{key}/", response={204: None})
def delete_org_setting_view(request, key: str):
    require_authenticated(request)
    org = request.org.instance
    if not org.is_owner(request.user):
        raise PermissionDenied("Only organization owners are allowed to perform this action.")
    try:
        delete_org_setting(org, key)
    except (DefaultSetting.DoesNotExist, OrganizationSetting.DoesNotExist):
        raise HttpError(404, "覆盖设置不存在")
    return Status(204, None)


# ---------------------------------------------------------------------------
# User settings
# ---------------------------------------------------------------------------


@user_router.get("/", response=list[UserSettingOut])
def list_user_settings(request):
    require_authenticated(request)
    return get_all_user_settings(request.user)


@user_router.get("/{key}/", response=UserSettingOut)
def get_user_setting_view(request, key: str):
    require_authenticated(request)
    value = get_user_setting(request.user, key)
    if value is None:
        raise HttpError(404, "偏好设置不存在")
    return {"key": key, "value": value}


@user_router.put("/{key}/", response=UserSettingOut)
def put_user_setting(request, key: str, payload: SetSettingIn):
    require_authenticated(request)
    set_user_setting(request.user, key, payload.value)
    value = get_user_setting(request.user, key)
    return {"key": key, "value": value}


@user_router.delete("/{key}/", response={204: None})
def delete_user_setting_view(request, key: str):
    require_authenticated(request)
    delete_user_setting(request.user, key)
    return Status(204, None)
