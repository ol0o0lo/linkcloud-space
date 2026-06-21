"""Settings API — ninja Routers for org, team, and user settings."""

from typing import Any

from ninja import Path, Router, Schema, Status
from ninja.errors import HttpError
from pydantic import Field

from apps.access.constants import SettingsPermission
from apps.access.permissions import require_org_permission, require_team_permission
from apps.base.permissions import require_authenticated
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting
from apps.settings.service import (
    delete_org_setting,
    delete_team_setting,
    delete_user_setting,
    get_all_org_settings,
    get_all_team_settings,
    get_all_user_settings,
    get_org_setting,
    get_team_setting,
    get_user_setting,
    set_org_setting,
    set_team_setting,
    set_user_setting,
)

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class SettingOut(Schema):
    key: str
    label: str
    value: Any
    value_type: str
    description: str
    widget: str
    ui: dict[str, Any]
    category: str
    is_customized: bool


class UserSettingOut(Schema):
    key: str
    value: Any


class SetSettingIn(Schema):
    value: Any = Field(..., description="设置项的新值。")


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

org_router = Router(tags=["设置/租户设置"])
team_router = Router(tags=["设置/团队设置"])
user_router = Router(tags=["设置/个人设置"])


# ---------------------------------------------------------------------------
# Org settings
# ---------------------------------------------------------------------------


@org_router.get("/", response=list[SettingOut], summary="获取租户设置列表")
def list_org_settings(request):
    """返回当前租户全部可见设置项及其当前值。"""
    require_org_permission(request, SettingsPermission.ORG_SETTING_VIEW)
    return get_all_org_settings(request.org.instance)


@org_router.get("/{key}/", response=SettingOut, summary="获取单个租户设置")
def get_org_setting_view(request, key: str = Path(..., description="设置项 key。")):
    """返回当前租户指定设置项的当前值和元数据。"""
    require_org_permission(request, SettingsPermission.ORG_SETTING_VIEW)
    try:
        return get_org_setting(request.org.instance, key)
    except DefaultSetting.DoesNotExist as exc:
        raise HttpError(404, "设置项不存在") from exc


@org_router.put("/{key}/", response=SettingOut, summary="更新租户设置")
def put_org_setting(request, key: str = Path(..., description="设置项 key。"), payload: SetSettingIn = ...):
    """更新当前租户某个设置项的值。"""
    require_org_permission(request, SettingsPermission.ORG_SETTING_MANAGE)
    try:
        set_org_setting(request.org.instance, key, payload.value)
        return get_org_setting(request.org.instance, key)
    except DefaultSetting.DoesNotExist as exc:
        raise HttpError(404, "设置项不存在") from exc


@org_router.delete("/{key}/", response={200: dict}, summary="删除租户设置覆盖")
def delete_org_setting_view(request, key: str = Path(..., description="设置项 key。")):
    """删除当前租户某个设置项的覆盖值，恢复默认设置。"""
    require_org_permission(request, SettingsPermission.ORG_SETTING_MANAGE)
    try:
        delete_org_setting(request.org.instance, key)
    except (DefaultSetting.DoesNotExist, OrganizationSetting.DoesNotExist) as exc:
        raise HttpError(404, "覆盖设置不存在") from exc
    return Status(200, {})


# ---------------------------------------------------------------------------
# Team settings
# ---------------------------------------------------------------------------


@team_router.get("/{team_id}/", response=list[SettingOut], summary="获取团队设置列表")
def list_team_settings(request, team_id: int):
    """返回指定团队全部可见设置项及其当前值。"""
    team = require_team_permission(request, team_id, SettingsPermission.TEAM_SETTING_VIEW)
    return get_all_team_settings(team)


@team_router.get("/{team_id}/{key}/", response=SettingOut, summary="获取单个团队设置")
def get_team_setting_view(request, team_id: int, key: str = Path(..., description="设置项 key。")):
    """返回指定团队某个设置项的当前值和元数据。"""
    team = require_team_permission(request, team_id, SettingsPermission.TEAM_SETTING_VIEW)
    try:
        return get_team_setting(team, key)
    except DefaultSetting.DoesNotExist as exc:
        raise HttpError(404, "设置项不存在") from exc


@team_router.put("/{team_id}/{key}/", response=SettingOut, summary="更新团队设置")
def put_team_setting(request, team_id: int, key: str = Path(..., description="设置项 key。"), payload: SetSettingIn = ...):
    """更新指定团队某个设置项的值。"""
    team = require_team_permission(request, team_id, SettingsPermission.TEAM_SETTING_MANAGE)
    try:
        set_team_setting(team, key, payload.value)
        return get_team_setting(team, key)
    except DefaultSetting.DoesNotExist as exc:
        raise HttpError(404, "设置项不存在") from exc


@team_router.delete("/{team_id}/{key}/", response={200: dict}, summary="删除团队设置覆盖")
def delete_team_setting_view(request, team_id: int, key: str = Path(..., description="设置项 key。")):
    """删除指定团队某个设置项的覆盖值，恢复默认设置。"""
    team = require_team_permission(request, team_id, SettingsPermission.TEAM_SETTING_MANAGE)
    try:
        delete_team_setting(team, key)
    except (DefaultSetting.DoesNotExist, TeamSetting.DoesNotExist) as exc:
        raise HttpError(404, "覆盖设置不存在") from exc
    return Status(200, {})


# ---------------------------------------------------------------------------
# User settings
# ---------------------------------------------------------------------------


@user_router.get("/", response=list[UserSettingOut], summary="获取个人设置列表")
def list_user_settings(request):
    """返回当前用户的个人偏好设置列表。"""
    require_authenticated(request)
    return get_all_user_settings(request.user)


@user_router.get("/{key}/", response=UserSettingOut, summary="获取单个个人设置")
def get_user_setting_view(request, key: str = Path(..., description="个人设置 key。")):
    """返回当前用户指定偏好设置的值。"""
    require_authenticated(request)
    value = get_user_setting(request.user, key)
    if value is None:
        raise HttpError(404, "偏好设置不存在")
    return {"key": key, "value": value}


@user_router.put("/{key}/", response=UserSettingOut, summary="更新个人设置")
def put_user_setting(request, key: str = Path(..., description="个人设置 key。"), payload: SetSettingIn = ...):
    """更新当前用户某个偏好设置的值。"""
    require_authenticated(request)
    set_user_setting(request.user, key, payload.value)
    value = get_user_setting(request.user, key)
    return {"key": key, "value": value}


@user_router.delete("/{key}/", response={200: dict}, summary="删除个人设置")
def delete_user_setting_view(request, key: str = Path(..., description="个人设置 key。")):
    """删除当前用户某个偏好设置。"""
    require_authenticated(request)
    delete_user_setting(request.user, key)
    return Status(200, {})
