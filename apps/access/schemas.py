from datetime import datetime

from ninja import Schema


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
    code: str
    name: str
    permission_keys: list[str] | None = None
    copy_from: int | None = None


class CustomRolePatchIn(Schema):
    code: str | None = None
    name: str | None = None
    permission_keys: list[str] | None = None
    is_active: bool | None = None


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
    user: int
    role: int
