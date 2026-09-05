from datetime import datetime

from ninja import Schema
from pydantic import Field

from apps.access.constants import PERMISSION_MODULES


class PermissionModuleSummaryOut(Schema):
    key: str
    name: str
    count: int


class AccessRoleOut(Schema):
    id: int
    code: str
    name: str
    scope: str
    is_system: bool
    is_active: bool
    organization_id: int | None = None
    team_id: int | None = None
    description: str = ""
    permission_keys: list[str]
    permission_count: int
    permission_modules: list[PermissionModuleSummaryOut]
    assigned_member_count: int = 0
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_organization_id(obj) -> int | None:
        return obj.organization_id

    @staticmethod
    def resolve_team_id(obj) -> int | None:
        return obj.team_id

    @staticmethod
    def resolve_permission_keys(obj) -> list[str]:
        permissions = sorted(
            obj.group.permissions.all(),
            key=lambda permission: (permission.content_type.app_label, permission.codename),
        )
        return [f"{permission.content_type.app_label}.{permission.codename}" for permission in permissions]

    @staticmethod
    def resolve_permission_count(obj) -> int:
        return len(AccessRoleOut.resolve_permission_keys(obj))

    @staticmethod
    def resolve_permission_modules(obj) -> list[PermissionModuleSummaryOut]:
        counts: dict[str, int] = {}
        names: dict[str, str] = {}
        for permission in obj.group.permissions.all():
            module_key, module_name = PERMISSION_MODULES.get(
                permission.content_type.app_label,
                (permission.content_type.app_label, permission.content_type.app_label),
            )
            counts[module_key] = counts.get(module_key, 0) + 1
            names[module_key] = module_name
        return [PermissionModuleSummaryOut(key=key, name=names[key], count=count) for key, count in sorted(counts.items(), key=lambda item: names[item[0]])]

    @staticmethod
    def resolve_assigned_member_count(obj) -> int:
        return getattr(obj, "assigned_member_count", 0)


class PermissionOut(Schema):
    key: str
    name: str
    app_label: str
    codename: str
    module_key: str
    module_name: str


class CustomRoleCreateIn(Schema):
    name: str = Field(..., description="角色显示名称，需在当前作用域内唯一。")
    description: str = Field("", description="角色用途说明。")
    permission_keys: list[str] | None = Field(None, description="角色拥有的权限 key 列表。")
    copy_from: int | None = Field(None, description="可选，基于现有角色复制权限配置的角色 ID。")


class CustomRolePatchIn(Schema):
    name: str | None = Field(None, description="新的角色显示名称，需在当前作用域内唯一。")
    description: str | None = Field(None, description="新的角色用途说明。")
    permission_keys: list[str] | None = Field(None, description="新的权限 key 列表。")


class AccessUserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
    email: str = ""
    avatar_url: str | None = None


class AccessRoleSummaryOut(Schema):
    id: int
    code: str
    name: str
    scope: str


class OrganizationBindingOut(Schema):
    id: int
    organization_id: int
    user: AccessUserOut
    role: AccessRoleSummaryOut
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_organization_id(obj) -> int:
        return obj.organization_id

    @staticmethod
    def resolve_user(obj) -> AccessUserOut:
        user = obj.user
        return AccessUserOut(
            id=user.pk,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=user.avatar_url,
        )

    @staticmethod
    def resolve_role(obj) -> AccessRoleSummaryOut:
        role = obj.group.access_role
        return AccessRoleSummaryOut(id=role.pk, code=role.code, name=role.name, scope=role.scope)


class TeamBindingOut(Schema):
    id: int
    team_id: int
    user: AccessUserOut
    role: AccessRoleSummaryOut
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_team_id(obj) -> int:
        return obj.team_id

    @staticmethod
    def resolve_user(obj) -> AccessUserOut:
        user = obj.user
        return AccessUserOut(
            id=user.pk,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=user.avatar_url,
        )

    @staticmethod
    def resolve_role(obj) -> AccessRoleSummaryOut:
        role = obj.group.access_role
        return AccessRoleSummaryOut(id=role.pk, code=role.code, name=role.name, scope=role.scope)


class RoleBindingIn(Schema):
    user: int = Field(..., description="要授权的用户 ID。")
    role: int = Field(..., description="要绑定的角色 ID。")


class RoleManagementTeamOut(Schema):
    id: int
    name: str
    role_count: int
    assigned_member_count: int


class RoleManagementCapabilitiesOut(Schema):
    role_view: bool
    role_manage: bool
    team_role_view_ids: list[int]
    team_role_manage_ids: list[int]


class RoleManagementNavigationOut(Schema):
    space_role_count: int
    space_assigned_member_count: int
    teams: list[RoleManagementTeamOut]
    capabilities: RoleManagementCapabilitiesOut


class NavigationAccessCapabilitiesOut(Schema):
    role_management: bool
    organization_settings: bool
    team_settings: bool
    subscriptions: bool
    analytics: bool
    allocation: bool
    notification_dispatches: bool


class RoleMemberOptionOut(Schema):
    member_id: int
    user: AccessUserOut
    assigned: bool

    @staticmethod
    def resolve_member_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_user(obj) -> AccessUserOut:
        user = obj.user
        return AccessUserOut(
            id=user.pk,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            avatar_url=user.avatar_url,
        )

    @staticmethod
    def resolve_assigned(obj) -> bool:
        return bool(getattr(obj, "assigned", False))


class RoleMemberAssignmentIn(Schema):
    add_user_ids: list[int] = Field(default_factory=list)
    remove_user_ids: list[int] = Field(default_factory=list)


class RoleMemberAssignmentOut(Schema):
    assigned_member_count: int
