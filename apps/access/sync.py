from collections.abc import Mapping, Sequence

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.db import transaction

from apps.access.constants import (
    ACCESS_PERMISSION_MODEL,
    ALL_PERMISSION_ENUMS,
    SYSTEM_ROLE_DEFINITIONS,
)
from apps.access.models import AccessRole

PermissionRegistry = Mapping[str, Sequence[tuple[str, str]]]
RoleRegistry = Mapping[str, Mapping[str, object]]


@transaction.atomic
def sync_access_permissions(
    *,
    permission_registry: PermissionRegistry | None = None,
    role_registry: RoleRegistry | None = None,
) -> None:
    """
    同步 access 权限和系统角色到 auth/group 相关表。

    约定：
    - 仅当参数为 None 时才回落到默认定义；
    - 同步策略是新增/更新，不做删除；
    - 只处理系统角色，不触碰组织自定义角色。
    """
    effective_permission_registry = build_permission_registry() if permission_registry is None else permission_registry
    effective_role_registry = SYSTEM_ROLE_DEFINITIONS if role_registry is None else role_registry
    permissions_by_key = sync_permission_registry(effective_permission_registry)
    sync_system_role_registry(effective_role_registry, permissions_by_key)


def build_permission_registry() -> dict[str, list[tuple[str, str]]]:
    """把权限枚举转换成 {app_label: [(codename, name)]} 结构。"""
    registry: dict[str, list[tuple[str, str]]] = {}
    for permission_enum in ALL_PERMISSION_ENUMS:
        for permission in permission_enum:
            app_label, codename = permission.value.split(".", 1)
            registry.setdefault(app_label, []).append((codename, permission_enum.get_choice_label(permission.value)))
    return registry


def sync_permission_registry(permission_registry: PermissionRegistry) -> dict[str, Permission]:
    """写入/更新权限并返回 key -> Permission 的映射。"""
    permissions_by_key = {}
    for app_label, permissions in permission_registry.items():
        content_type, _ = ContentType.objects.get_or_create(app_label=app_label, model=ACCESS_PERMISSION_MODEL)
        for codename, name in permissions:
            permission, _ = Permission.objects.update_or_create(
                content_type=content_type,
                codename=codename,
                defaults={"name": name},
            )
            permissions_by_key[f"{app_label}.{codename}"] = permission
    return permissions_by_key


def sync_system_role_registry(role_registry: RoleRegistry, permissions_by_key: dict[str, Permission]) -> None:
    """写入/更新系统角色，并绑定对应权限。"""
    for code, role_data in role_registry.items():
        permission_keys = [str(permission_key) for permission_key in role_data.get("permissions", [])]
        unknown_keys = [key for key in permission_keys if key not in permissions_by_key]
        if unknown_keys:
            # 统一报出未知 key，避免部分角色静默丢权限。
            raise ValueError(f"Unknown access permission key(s): {', '.join(sorted(unknown_keys))}")
        permissions = [permissions_by_key[key] for key in permission_keys]
        group, _ = Group.objects.get_or_create(name=str(code))
        group.permissions.set(permissions)
        AccessRole.objects.update_or_create(
            group=group,
            defaults={
                "organization": None,
                "scope": role_data["scope"],
                "code": str(code),
                "name": role_data["name"],
                "is_system": True,
                "is_active": True,
            },
        )
