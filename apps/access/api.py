from django.core.exceptions import PermissionDenied
from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import (
    PERMISSION_MODULES,
    AccessPermission,
    AccessScope,
    AllocationPermission,
    AnalyticsPermission,
    SettingsPermission,
    SubscriptionPermission,
)
from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding
from apps.access.permissions import require_org_permission, require_team_permission
from apps.access.schemas import (
    AccessRoleOut,
    CustomRoleCreateIn,
    CustomRolePatchIn,
    NavigationAccessCapabilitiesOut,
    OrganizationBindingOut,
    PermissionOut,
    RoleBindingIn,
    RoleManagementNavigationOut,
    RoleMemberAssignmentIn,
    RoleMemberAssignmentOut,
    RoleMemberOptionOut,
    TeamBindingOut,
)
from apps.access.services import (
    assign_org_role,
    assign_team_role,
    create_custom_role,
    delete_custom_role,
    has_permission,
    list_available_roles,
    list_org_role_bindings,
    list_permission_choices,
    list_team_role_bindings,
    remove_org_role,
    remove_team_role,
    update_custom_role,
    update_role_members,
)
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.organizations.models import OrganizationMember
from apps.teams.services import visible_teams_for_request

permissions_router = Router(tags=["权限/权限清单"])
org_roles_router = Router(tags=["权限/租户角色"])
org_bindings_router = Router(tags=["权限/租户授权"])
team_roles_router = Router(tags=["权限/团队角色"])
team_bindings_router = Router(tags=["权限/团队授权"])
role_management_router = Router(tags=["权限/角色管理工作台"])
navigation_router = Router(tags=["权限/导航能力"])


def _teams_with_user_bindings(request, organization):
    visible_teams = list(visible_teams_for_request(request, organization))
    visible_team_ids = {team.pk for team in visible_teams}
    bound_teams = (
        TeamGroupBinding.objects.filter(
            team__organization=organization,
            user=request.user,
            group__access_role__is_active=True,
        )
        .exclude(team_id__in=visible_team_ids)
        .select_related("team")
    )
    return [*visible_teams, *(binding.team for binding in bound_teams)]


@navigation_router.get("/", response=NavigationAccessCapabilitiesOut, summary="获取当前组织导航能力")
def get_navigation_access_capabilities(request):
    organization = require_org_selected(request)
    teams = _teams_with_user_bindings(request, organization)

    return {
        "role_management": has_permission(request.user, organization, AccessPermission.ROLE_VIEW)
        or any(has_permission(request.user, organization, AccessPermission.TEAM_ROLE_VIEW, team=team) for team in teams),
        "organization_settings": has_permission(request.user, organization, SettingsPermission.ORG_SETTING_VIEW),
        "team_settings": has_permission(request.user, organization, SettingsPermission.TEAM_SETTING_VIEW)
        or any(has_permission(request.user, organization, SettingsPermission.TEAM_SETTING_VIEW, team=team) for team in teams),
        "subscriptions": has_permission(request.user, organization, SubscriptionPermission.VIEW),
        "analytics": has_permission(request.user, organization, AnalyticsPermission.VIEW),
        "allocation": has_permission(request.user, organization, AllocationPermission.VIEW),
        "notification_dispatches": request.user.is_superuser or organization.is_owner(request.user),
    }


def _with_assignment_count(roles, *, organization=None, team=None):
    if team is not None:
        return roles.annotate(
            assigned_member_count=Count(
                "group__teamgroupbinding__user",
                filter=Q(group__teamgroupbinding__team=team),
                distinct=True,
            )
        )
    return roles.annotate(
        assigned_member_count=Count(
            "group__organizationgroupbinding__user",
            filter=Q(group__organizationgroupbinding__organization=organization),
            distinct=True,
        )
    )


def _resolve_role_context(request, role_id: int, team_id: int | None, *, manage: bool):
    role = get_object_or_404(
        AccessRole.objects.select_related("group", "organization", "team").prefetch_related("group__permissions__content_type"),
        pk=role_id,
        is_active=True,
    )
    if role.scope == AccessScope.ORG:
        permission = AccessPermission.ROLE_MANAGE if manage else AccessPermission.ROLE_VIEW
        organization = require_org_permission(request, permission)
        if role.organization_id not in (None, organization.pk) or role.team_id is not None:
            raise HttpError(404, "当前空间中不存在该角色。")
        return organization, None, role

    if team_id is None:
        raise HttpError(400, "团队角色必须提供 team_id。")
    permission = AccessPermission.TEAM_ROLE_MANAGE if manage else AccessPermission.TEAM_ROLE_VIEW
    team = require_team_permission(request, team_id, permission)
    if role.organization_id is not None and role.team_id != team.pk:
        raise HttpError(404, "当前团队中不存在该角色。")
    return team.organization, team, role


@permissions_router.get("/", response=list[PermissionOut], summary="获取可分配权限列表")
def list_permissions(request):
    """返回当前系统可用于角色配置的权限点清单，前端可用于角色创建和编辑时展示权限选项。"""
    organization = require_org_selected(request)
    can_view = has_permission(request.user, organization, AccessPermission.ROLE_VIEW)
    if not can_view:
        can_view = any(has_permission(request.user, organization, AccessPermission.TEAM_ROLE_VIEW, team=team) for team in visible_teams_for_request(request, organization))
    if not can_view:
        raise PermissionDenied("你没有查看角色权限的权限。")
    return [
        {
            "key": f"{permission.content_type.app_label}.{permission.codename}",
            "name": permission.name,
            "app_label": permission.content_type.app_label,
            "codename": permission.codename,
            "module_key": PERMISSION_MODULES.get(
                permission.content_type.app_label,
                (permission.content_type.app_label, permission.content_type.app_label),
            )[0],
            "module_name": PERMISSION_MODULES.get(
                permission.content_type.app_label,
                (permission.content_type.app_label, permission.content_type.app_label),
            )[1],
        }
        for permission in list_permission_choices()
    ]


@org_roles_router.get("/", response=list[AccessRoleOut], summary="获取租户级角色列表")
def list_org_roles(request):
    """返回当前组织下可用的 org 级角色，包含系统预置角色和当前组织自定义角色。"""
    org = require_org_permission(request, AccessPermission.ROLE_VIEW)
    return _with_assignment_count(list_available_roles(org, AccessScope.ORG), organization=org)


@org_roles_router.post("/", response={201: AccessRoleOut}, summary="创建租户级自定义角色")
def create_org_role(request, payload: CustomRoleCreateIn):
    """在当前组织下创建 org 级自定义角色，可直接传入权限列表，或基于现有角色复制权限配置。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    source = get_object_or_404(list_available_roles(org, AccessScope.ORG), pk=payload.copy_from) if payload.copy_from else None
    role = create_custom_role(
        org,
        AccessScope.ORG,
        name=payload.name,
        description=payload.description,
        permission_keys=payload.permission_keys,
        copy_from=source,
    )
    return Status(201, role)


@org_roles_router.patch("/{role_id}/", response=AccessRoleOut, summary="更新租户级自定义角色")
def patch_org_role(request, role_id: int, payload: CustomRolePatchIn):
    """修改当前组织下的 org 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessScope.ORG), pk=role_id)
    return update_custom_role(
        role,
        name=payload.name,
        description=payload.description,
        permission_keys=payload.permission_keys,
    )


@org_roles_router.delete("/{role_id}/", response={200: dict}, summary="删除租户级自定义角色")
def delete_org_role(request, role_id: int):
    """删除当前组织下未被授权绑定引用的 org 级自定义角色。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessScope.ORG), pk=role_id)
    delete_custom_role(role)
    return Status(200, {})


@org_bindings_router.get("/", response=list[OrganizationBindingOut], summary="获取租户级角色绑定列表")
def list_organization_bindings(request):
    """返回当前组织内用户与 org 级角色的绑定关系，用于展示谁拥有哪些租户级权限。"""
    org = require_org_permission(request, AccessPermission.ROLE_VIEW)
    return list_org_role_bindings(org)


@org_bindings_router.post("/", response={201: OrganizationBindingOut}, summary="分配租户级角色")
def create_organization_binding(request, payload: RoleBindingIn):
    """给当前组织内某个成员绑定一个 org 级角色，角色生效范围覆盖整个组织。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    role = get_object_or_404(list_available_roles(org, AccessScope.ORG), pk=payload.role)
    binding = assign_org_role(org, payload.user, role)
    return Status(201, binding)


@org_bindings_router.delete("/{binding_id}/", response={200: dict}, summary="移除租户级角色绑定")
def delete_organization_binding(request, binding_id: int):
    """删除当前组织内某个用户的 org 级角色绑定。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    binding = get_object_or_404(list_org_role_bindings(org), pk=binding_id)
    remove_org_role(binding)
    return Status(200, {})


@team_roles_router.get("/{team_id}/roles/", response=list[AccessRoleOut], summary="获取团队级角色列表")
def list_team_roles(request, team_id: int):
    """返回当前组织可用的 team 级角色，供指定 team 的授权配置使用。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_VIEW)
    return _with_assignment_count(list_available_roles(team.organization, AccessScope.TEAM, team=team), team=team)


@team_roles_router.post("/{team_id}/roles/", response={201: AccessRoleOut}, summary="创建团队级自定义角色")
def create_team_role(request, team_id: int, payload: CustomRoleCreateIn):
    """在当前组织下创建 team 级自定义角色，用于后续绑定到具体 team 成员。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    source = get_object_or_404(list_available_roles(team.organization, AccessScope.TEAM, team=team), pk=payload.copy_from) if payload.copy_from else None
    role = create_custom_role(
        team.organization,
        AccessScope.TEAM,
        name=payload.name,
        description=payload.description,
        permission_keys=payload.permission_keys,
        copy_from=source,
        team=team,
    )
    return Status(201, role)


@team_roles_router.patch("/{team_id}/roles/{role_id}/", response=AccessRoleOut, summary="更新团队级自定义角色")
def patch_team_role(request, team_id: int, role_id: int, payload: CustomRolePatchIn):
    """修改当前组织下的 team 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=team.organization, team=team, scope=AccessScope.TEAM), pk=role_id)
    return update_custom_role(
        role,
        name=payload.name,
        description=payload.description,
        permission_keys=payload.permission_keys,
    )


@team_roles_router.delete("/{team_id}/roles/{role_id}/", response={200: dict}, summary="删除团队级自定义角色")
def delete_team_role(request, team_id: int, role_id: int):
    """删除当前组织下未被授权绑定引用的 team 级自定义角色。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=team.organization, team=team, scope=AccessScope.TEAM), pk=role_id)
    delete_custom_role(role)
    return Status(200, {})


@team_bindings_router.get("/{team_id}/bindings/", response=list[TeamBindingOut], summary="获取团队级角色绑定列表")
def list_team_bindings_view(request, team_id: int):
    """返回指定 team 下用户与 team 级角色的绑定关系，用于展示团队内实际授权结果。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_VIEW)
    return list_team_role_bindings(team)


@team_bindings_router.post("/{team_id}/bindings/", response={201: TeamBindingOut}, summary="分配团队级角色")
def create_team_binding(request, team_id: int, payload: RoleBindingIn):
    """给指定 team 的成员绑定一个 team 级角色，角色仅在该 team 范围内生效。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    role = get_object_or_404(list_available_roles(team.organization, AccessScope.TEAM, team=team), pk=payload.role)
    binding = assign_team_role(team, payload.user, role)
    return Status(201, binding)


@team_bindings_router.delete("/{team_id}/bindings/{binding_id}/", response={200: dict}, summary="移除团队级角色绑定")
def delete_team_binding(request, team_id: int, binding_id: int):
    """删除指定 team 下某个用户的 team 级角色绑定。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    binding = get_object_or_404(list_team_role_bindings(team), pk=binding_id)
    remove_team_role(binding)
    return Status(200, {})


@role_management_router.get("/navigation/", response=RoleManagementNavigationOut, summary="获取角色管理作用范围导航")
def get_role_management_navigation(request):
    organization = require_org_selected(request)
    teams = list(visible_teams_for_request(request, organization).order_by("name", "pk"))
    visible_team_ids = [team.pk for team in teams if has_permission(request.user, organization, AccessPermission.TEAM_ROLE_VIEW, team=team)]
    manageable_team_ids = [team.pk for team in teams if has_permission(request.user, organization, AccessPermission.TEAM_ROLE_MANAGE, team=team)]
    system_team_role_count = AccessRole.objects.filter(is_active=True, is_system=True, scope=AccessScope.TEAM).count()
    custom_counts = dict(AccessRole.objects.filter(is_active=True, scope=AccessScope.TEAM, team_id__in=visible_team_ids).values_list("team_id").annotate(total=Count("pk")))
    team_assigned_counts = dict(
        TeamGroupBinding.objects.filter(
            team_id__in=visible_team_ids,
            group__access_role__is_active=True,
            group__access_role__scope=AccessScope.TEAM,
        )
        .values_list("team_id")
        .annotate(total=Count("user_id", distinct=True))
    )
    return {
        "space_role_count": list_available_roles(organization, AccessScope.ORG).count(),
        "space_assigned_member_count": OrganizationGroupBinding.objects.filter(
            organization=organization,
            group__access_role__is_active=True,
            group__access_role__scope=AccessScope.ORG,
        )
        .values("user_id")
        .distinct()
        .count(),
        "teams": [
            {
                "id": team.pk,
                "name": team.name,
                "role_count": system_team_role_count + custom_counts.get(team.pk, 0),
                "assigned_member_count": team_assigned_counts.get(team.pk, 0),
            }
            for team in teams
            if team.pk in visible_team_ids
        ],
        "capabilities": {
            "role_view": has_permission(request.user, organization, AccessPermission.ROLE_VIEW),
            "role_manage": has_permission(request.user, organization, AccessPermission.ROLE_MANAGE),
            "team_role_view_ids": visible_team_ids,
            "team_role_manage_ids": manageable_team_ids,
        },
    }


@role_management_router.get("/roles/{role_id}/members/", response=list[RoleMemberOptionOut], summary="分页获取角色候选及授权成员")
@paginate(LegacyPagination)
def list_role_members(
    request,
    role_id: int,
    team_id: int | None = Query(None),
    keyword: str | None = Query(None),
    assignment: str = Query("all"),
):
    organization, team, role = _resolve_role_context(request, role_id, team_id, manage=False)
    if role.scope == AccessScope.ORG:
        assigned_query = OrganizationGroupBinding.objects.filter(
            organization=organization,
            group=role.group,
            user_id=OuterRef("user_id"),
        )
        members = OrganizationMember.objects.filter(organization=organization)
    else:
        assigned_query = TeamGroupBinding.objects.filter(team=team, group=role.group, user_id=OuterRef("user_id"))
        members = OrganizationMember.objects.filter(organization=organization, user__teams=team)

    members = members.select_related("user").annotate(assigned=Exists(assigned_query))
    if keyword:
        normalized = keyword.strip()
        members = members.filter(
            Q(user__first_name__icontains=normalized) | Q(user__last_name__icontains=normalized) | Q(user__username__icontains=normalized) | Q(user__email__icontains=normalized)
        )
    if assignment == "assigned":
        members = members.filter(assigned=True)
    elif assignment == "unassigned":
        members = members.filter(assigned=False)
    elif assignment != "all":
        raise HttpError(400, "assignment 只能是 all、assigned 或 unassigned。")
    return members.order_by("user__first_name", "user__last_name", "user__username", "pk").distinct()


@role_management_router.patch(
    "/roles/{role_id}/members/",
    response=RoleMemberAssignmentOut,
    summary="批量调整角色成员授权",
)
def patch_role_members(
    request,
    role_id: int,
    payload: RoleMemberAssignmentIn,
    team_id: int | None = Query(None),
):
    organization, team, role = _resolve_role_context(request, role_id, team_id, manage=True)
    assigned_member_count = update_role_members(
        role,
        organization,
        add_user_ids=payload.add_user_ids,
        remove_user_ids=payload.remove_user_ids,
        team=team,
    )
    return {"assigned_member_count": assigned_member_count}
