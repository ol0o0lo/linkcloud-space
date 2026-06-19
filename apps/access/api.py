from django.shortcuts import get_object_or_404

from ninja import Router, Status

from apps.access.constants import AccessPermission
from apps.access.models import AccessRole
from apps.access.permissions import require_org_permission, require_team_permission
from apps.access.schemas import (
    AccessRoleOut,
    CustomRoleCreateIn,
    CustomRolePatchIn,
    OrganizationBindingOut,
    PermissionOut,
    RoleBindingIn,
    TeamBindingOut,
)
from apps.access.services import (
    assign_org_role,
    assign_team_role,
    create_custom_role,
    delete_custom_role,
    list_available_roles,
    list_org_role_bindings,
    list_permission_choices,
    list_team_role_bindings,
    remove_org_role,
    remove_team_role,
    update_custom_role,
)
from apps.teams.models import Team

permissions_router = Router(tags=["权限/权限清单"])
org_roles_router = Router(tags=["权限/租户角色"])
org_bindings_router = Router(tags=["权限/租户授权"])
team_roles_router = Router(tags=["权限/团队角色"])
team_bindings_router = Router(tags=["权限/团队授权"])


@permissions_router.get("/", response=list[PermissionOut], summary="获取可分配权限列表")
def list_permissions(request):
    """返回当前系统可用于角色配置的权限点清单，前端可用于角色创建和编辑时展示权限选项。"""
    require_org_permission(request, AccessPermission.ROLE_VIEW)
    return [
        {
            "key": f"{permission.content_type.app_label}.{permission.codename}",
            "name": permission.name,
            "app_label": permission.content_type.app_label,
            "codename": permission.codename,
        }
        for permission in list_permission_choices()
    ]


@org_roles_router.get("/", response=list[AccessRoleOut], summary="获取租户级角色列表")
def list_org_roles(request):
    """返回当前组织下可用的 org 级角色，包含系统预置角色和当前组织自定义角色。"""
    org = require_org_permission(request, AccessPermission.ROLE_VIEW)
    return list_available_roles(org, AccessRole.Scope.ORG)


@org_roles_router.post("/", response={201: AccessRoleOut}, summary="创建租户级自定义角色")
def create_org_role(request, payload: CustomRoleCreateIn):
    """在当前组织下创建 org 级自定义角色，可直接传入权限列表，或基于现有角色复制权限配置。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    source = get_object_or_404(list_available_roles(org, AccessRole.Scope.ORG), pk=payload.copy_from) if payload.copy_from else None
    role = create_custom_role(
        org,
        AccessRole.Scope.ORG,
        name=payload.name,
        permission_keys=payload.permission_keys,
        copy_from=source,
    )
    return Status(201, role)


@org_roles_router.patch("/{role_id}/", response=AccessRoleOut, summary="更新租户级自定义角色")
def patch_org_role(request, role_id: int, payload: CustomRolePatchIn):
    """修改当前组织下的 org 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessRole.Scope.ORG), pk=role_id)
    return update_custom_role(
        role,
        name=payload.name,
        permission_keys=payload.permission_keys,
    )


@org_roles_router.delete("/{role_id}/", response={200: dict}, summary="删除租户级自定义角色")
def delete_org_role(request, role_id: int):
    """删除当前组织下未被授权绑定引用的 org 级自定义角色。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessRole.Scope.ORG), pk=role_id)
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
    role = get_object_or_404(list_available_roles(org, AccessRole.Scope.ORG), pk=payload.role)
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
    return list_available_roles(team.organization, AccessRole.Scope.TEAM)


@team_roles_router.post("/{team_id}/roles/", response={201: AccessRoleOut}, summary="创建团队级自定义角色")
def create_team_role(request, team_id: int, payload: CustomRoleCreateIn):
    """在当前组织下创建 team 级自定义角色，用于后续绑定到具体 team 成员。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    team = get_object_or_404(Team, pk=team_id, organization=org)
    source = get_object_or_404(list_available_roles(org, AccessRole.Scope.TEAM), pk=payload.copy_from) if payload.copy_from else None
    role = create_custom_role(
        team.organization,
        AccessRole.Scope.TEAM,
        name=payload.name,
        permission_keys=payload.permission_keys,
        copy_from=source,
    )
    return Status(201, role)


@team_roles_router.patch("/{team_id}/roles/{role_id}/", response=AccessRoleOut, summary="更新团队级自定义角色")
def patch_team_role(request, team_id: int, role_id: int, payload: CustomRolePatchIn):
    """修改当前组织下的 team 级自定义角色名称或权限列表；系统预置角色不能通过该接口修改。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    get_object_or_404(Team, pk=team_id, organization=org)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessRole.Scope.TEAM), pk=role_id)
    return update_custom_role(
        role,
        name=payload.name,
        permission_keys=payload.permission_keys,
    )


@team_roles_router.delete("/{team_id}/roles/{role_id}/", response={200: dict}, summary="删除团队级自定义角色")
def delete_team_role(request, team_id: int, role_id: int):
    """删除当前组织下未被授权绑定引用的 team 级自定义角色。"""
    org = require_org_permission(request, AccessPermission.ROLE_MANAGE)
    get_object_or_404(Team, pk=team_id, organization=org)
    role = get_object_or_404(AccessRole.objects.filter(organization=org, scope=AccessRole.Scope.TEAM), pk=role_id)
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
    role = get_object_or_404(list_available_roles(team.organization, AccessRole.Scope.TEAM), pk=payload.role)
    binding = assign_team_role(team, payload.user, role)
    return Status(201, binding)


@team_bindings_router.delete("/{team_id}/bindings/{binding_id}/", response={200: dict}, summary="移除团队级角色绑定")
def delete_team_binding(request, team_id: int, binding_id: int):
    """删除指定 team 下某个用户的 team 级角色绑定。"""
    team = require_team_permission(request, team_id, AccessPermission.TEAM_ROLE_MANAGE)
    binding = get_object_or_404(list_team_role_bindings(team), pk=binding_id)
    remove_team_role(binding)
    return Status(200, {})
