"""Settings API — ninja Routers for org, team, and user settings."""

from typing import Any

from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from ninja import Router, Schema, Status
from ninja.errors import HttpError

from apps.base.permissions import require_authenticated
from apps.organizations.models import OrganizationMember
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
team_router = Router(tags=["settings-teams"])
user_router = Router(tags=["settings-user"])


# ---------------------------------------------------------------------------
# Org settings
# ---------------------------------------------------------------------------


def _is_org_owner(request) -> bool:
    org = request.org.instance
    return OrganizationMember.objects.filter(organization=org, user=request.user, is_owner=True).exists()


@org_router.get("/", response=list[SettingOut])
def list_org_settings(request):
    require_authenticated(request)
    return get_all_org_settings(request.org.instance)


@org_router.get("/{key}/", response=SettingOut)
def get_org_setting_view(request, key: str):
    require_authenticated(request)
    try:
        return get_org_setting(request.org.instance, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@org_router.put("/{key}/", response=SettingOut)
def put_org_setting(request, key: str, payload: SetSettingIn):
    require_authenticated(request)
    if not _is_org_owner(request):
        raise PermissionDenied("Only organization owners are allowed to perform this action.")
    try:
        set_org_setting(request.org.instance, key, payload.value)
        return get_org_setting(request.org.instance, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@org_router.delete("/{key}/", response={204: None})
def delete_org_setting_view(request, key: str):
    require_authenticated(request)
    if not _is_org_owner(request):
        raise PermissionDenied("Only organization owners are allowed to perform this action.")
    try:
        delete_org_setting(request.org.instance, key)
    except (DefaultSetting.DoesNotExist, OrganizationSetting.DoesNotExist):
        raise HttpError(404, "覆盖设置不存在")
    return Status(204, None)


# ---------------------------------------------------------------------------
# Team settings
# ---------------------------------------------------------------------------


def _is_team_admin_or_org_owner(request, team: Team) -> bool:
    is_member = team.members.filter(pk=request.user.pk).exists()
    is_org_owner = OrganizationMember.objects.filter(
        organization=team.organization, user=request.user, is_owner=True
    ).exists()
    return is_member or is_org_owner


@team_router.get("/{team_id}/", response=list[SettingOut])
def list_team_settings(request, team_id: int):
    require_authenticated(request)
    team = get_object_or_404(Team, pk=team_id)
    return get_all_team_settings(team)


@team_router.get("/{team_id}/{key}/", response=SettingOut)
def get_team_setting_view(request, team_id: int, key: str):
    require_authenticated(request)
    team = get_object_or_404(Team, pk=team_id)
    try:
        return get_team_setting(team, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@team_router.put("/{team_id}/{key}/", response=SettingOut)
def put_team_setting(request, team_id: int, key: str, payload: SetSettingIn):
    require_authenticated(request)
    team = get_object_or_404(Team, pk=team_id)
    if not _is_team_admin_or_org_owner(request, team):
        raise PermissionDenied("Only team members or org owners are allowed to perform this action.")
    try:
        set_team_setting(team, key, payload.value)
        return get_team_setting(team, key)
    except DefaultSetting.DoesNotExist:
        raise HttpError(404, "设置项不存在")


@team_router.delete("/{team_id}/{key}/", response={204: None})
def delete_team_setting_view(request, team_id: int, key: str):
    require_authenticated(request)
    team = get_object_or_404(Team, pk=team_id)
    if not _is_team_admin_or_org_owner(request, team):
        raise PermissionDenied("Only team members or org owners are allowed to perform this action.")
    try:
        delete_team_setting(team, key)
    except (DefaultSetting.DoesNotExist, TeamSetting.DoesNotExist):
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
