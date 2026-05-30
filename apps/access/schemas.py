from datetime import datetime

from ninja import Schema
from pydantic import Field


class AccessRoleOut(Schema):
    id: int
    code: str
    name: str
    scope: str
    is_system: bool
    is_active: bool
    organization_id: int | None = None
    permission_keys: list[str]

    @staticmethod
    def resolve_organization_id(obj) -> int | None:
        return obj.organization_id

    @staticmethod
    def resolve_permission_keys(obj) -> list[str]:
        return [
            f"{permission.content_type.app_label}.{permission.codename}"
            for permission in obj.group.permissions.select_related("content_type").order_by(
                "content_type__app_label", "codename"
            )
        ]


class PermissionOut(Schema):
    key: str
    name: str
    app_label: str
    codename: str


class CustomRoleCreateIn(Schema):
    code: str = Field(..., description="角色编码，需在当前作用域内唯一。")
    name: str = Field(..., description="角色显示名称。")
    permission_keys: list[str] | None = Field(None, description="角色拥有的权限 key 列表。")
    copy_from: int | None = Field(None, description="可选，基于现有角色复制权限配置的角色 ID。")


class CustomRolePatchIn(Schema):
    code: str | None = Field(None, description="新的角色编码。")
    name: str | None = Field(None, description="新的角色显示名称。")
    permission_keys: list[str] | None = Field(None, description="新的权限 key 列表。")
    is_active: bool | None = Field(None, description="角色是否启用。")


class AccessUserOut(Schema):
    id: int
    username: str
    first_name: str = ""
    last_name: str = ""
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
    created: datetime
    modified: datetime

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
    created: datetime
    modified: datetime

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
            avatar_url=user.avatar_url,
        )

    @staticmethod
    def resolve_role(obj) -> AccessRoleSummaryOut:
        role = obj.group.access_role
        return AccessRoleSummaryOut(id=role.pk, code=role.code, name=role.name, scope=role.scope)


class RoleBindingIn(Schema):
    user: int = Field(..., description="要授权的用户 ID。")
    role: int = Field(..., description="要绑定的角色 ID。")
