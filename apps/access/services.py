import hashlib

from django.contrib.auth.models import Group, Permission
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q

from apps.access.constants import ACCESS_PERMISSION_MODEL, AccessScope
from apps.access.exceptions import RoleInUseException
from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding
from apps.organizations.models import OrganizationMember


def has_permission(user, org, permission_key: str, team=None) -> bool:
    if not getattr(user, "is_authenticated", False) or org is None:
        return False

    membership = OrganizationMember.objects.filter(organization=org, user=user).first()
    if membership is None:
        return False
    if membership.is_owner:
        return True

    if team is not None and team.organization_id != org.pk:
        return False

    return permission_key in get_user_permission_keys(user, org, team=team)


def get_user_permission_keys(user, org, team=None) -> set[str]:
    if not getattr(user, "is_authenticated", False) or org is None:
        return set()

    membership = OrganizationMember.objects.filter(organization=org, user=user).first()
    if membership is None:
        return set()
    if membership.is_owner:
        return {"*"}

    groups = Group.objects.filter(
        access_role__is_active=True,
        organizationgroupbinding__organization=org,
        organizationgroupbinding__user=user,
    )

    if team is not None:
        if team.organization_id != org.pk:
            return _permission_keys_for_groups(groups)
        groups = groups | Group.objects.filter(
            access_role__is_active=True,
            teamgroupbinding__team=team,
            teamgroupbinding__user=user,
        )

    return _permission_keys_for_groups(groups.distinct())


def _permission_keys_for_groups(groups) -> set[str]:
    permissions = groups.filter(access_role__is_active=True).values_list("permissions__content_type__app_label", "permissions__codename").exclude(permissions__isnull=True)
    keys = set()
    for app_label, codename in permissions:
        keys.add(f"{app_label}.{codename}")
    return keys


def is_group_scope(group: Group, scope: AccessScope) -> bool:
    try:
        return group.access_role.scope == scope
    except AccessRole.DoesNotExist:
        return False


def list_available_roles(org, scope: AccessScope, *, team=None):
    roles = AccessRole.objects.select_related("group", "organization", "team").prefetch_related("group__permissions__content_type").filter(is_active=True, scope=scope)
    if scope == AccessScope.TEAM:
        if team is None:
            return roles.filter(organization__isnull=True).order_by("-is_system", "name", "pk")
        return roles.filter(Q(organization__isnull=True) | Q(organization=org, team=team)).order_by("-is_system", "name", "pk")
    return roles.filter(Q(organization__isnull=True) | Q(organization=org, team__isnull=True)).order_by("-is_system", "name", "pk")


def list_permission_choices():
    return Permission.objects.select_related("content_type").filter(content_type__model=ACCESS_PERMISSION_MODEL).order_by("content_type__app_label", "codename")


def list_org_role_bindings(org):
    return (
        OrganizationGroupBinding.objects.select_related("user", "group__access_role")
        .filter(organization=org, group__access_role__is_active=True)
        .order_by("user__username", "group__access_role__name", "pk")
    )


def list_team_role_bindings(team):
    return (
        TeamGroupBinding.objects.select_related("user", "group__access_role")
        .filter(team=team, group__access_role__is_active=True)
        .order_by("user__username", "group__access_role__name", "pk")
    )


@transaction.atomic
def create_custom_role(
    org,
    scope: AccessScope,
    name: str,
    description: str = "",
    permission_keys: list[str] | None = None,
    copy_from: AccessRole | None = None,
    team=None,
) -> AccessRole:
    if copy_from is not None:
        _validate_copy_source(copy_from, org, scope, team=team)
    name = _normalize_role_name(name)
    permissions = _resolve_permissions(permission_keys) if permission_keys is not None else _copy_permissions(copy_from)
    description = description.strip() or (copy_from.description if copy_from is not None else "")
    code = _generate_custom_role_code(org, scope, name, team=team)
    group_name = _group_name(org, scope, code, team=team)
    _prepare_custom_role_identity(org, scope, name=name, code=code, group_name=group_name, team=team)
    group = Group.objects.create(name=group_name)
    role = AccessRole(
        group=group,
        organization=org,
        team=team,
        scope=scope,
        code=code,
        name=name,
        description=description,
        is_system=False,
        is_active=True,
    )
    role.full_clean()
    role.save()
    group.permissions.set(permissions)
    return role


@transaction.atomic
def update_custom_role(
    role: AccessRole,
    *,
    name: str | None = None,
    description: str | None = None,
    permission_keys: list[str] | None = None,
) -> AccessRole:
    _validate_custom_role(role)
    if name is not None:
        name = _normalize_role_name(name)
        _validate_unique_role_name(role.organization, role.scope, name, team=role.team, exclude_role=role)
        role.name = name
    if description is not None:
        role.description = description.strip()
    role.full_clean()
    role.save()
    if permission_keys is not None:
        role.group.permissions.set(_resolve_permissions(permission_keys))
    return role


def delete_custom_role(role: AccessRole) -> None:
    _validate_custom_role(role)
    if OrganizationGroupBinding.objects.filter(group=role.group).exists() or TeamGroupBinding.objects.filter(group=role.group).exists():
        raise RoleInUseException()
    role.group.delete()


def _prepare_custom_role_identity(org, scope: AccessScope, *, name: str, code: str, group_name: str, team=None) -> None:
    existing_name_roles = _roles_in_identity_scope(org, scope, team=team).select_related("group").filter(name=name)
    for role in existing_name_roles:
        _clear_or_reject_existing_role(role)
    _clear_or_reject_existing_role(_roles_in_identity_scope(org, scope, team=team).select_related("group").filter(code=code).first())

    if Group.objects.filter(name=group_name).exists():
        raise ValidationError({"code": "角色用户组名称已存在，请先清理残留用户组。"})


def _clear_or_reject_existing_role(role: AccessRole | None) -> None:
    if role is None:
        return
    if role.is_active:
        raise ValidationError({"name": "当前范围内已存在同名角色。"})
    delete_custom_role(role)


def _validate_unique_role_name(org, scope: AccessScope, name: str, *, team=None, exclude_role: AccessRole | None = None) -> None:
    qs = _roles_in_identity_scope(org, scope, team=team).filter(name=name)
    if exclude_role is not None:
        qs = qs.exclude(pk=exclude_role.pk)
    existing_role = qs.first()
    if existing_role is not None:
        if existing_role.is_active:
            raise ValidationError({"name": "当前范围内已存在同名角色。"})
        delete_custom_role(existing_role)


def _normalize_role_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise ValidationError({"name": "角色名称不能为空。"})
    return normalized


def _roles_in_identity_scope(org, scope: AccessScope, *, team=None):
    roles = AccessRole.objects.filter(scope=scope)
    if scope == AccessScope.TEAM:
        return roles.filter(Q(organization__isnull=True) | Q(organization=org, team=team))
    return roles.filter(Q(organization__isnull=True) | Q(organization=org, team__isnull=True))


def _generate_custom_role_code(org, scope: AccessScope, name: str, *, team=None) -> str:
    digest = hashlib.sha1(f"{org.pk}:{getattr(team, 'pk', '')}:{scope}:{name}".encode(), usedforsecurity=False).hexdigest()[:12]
    return f"custom_{digest}"


def assign_org_role(org, user_or_id, role: AccessRole):
    _validate_assignable_role(role, org, AccessScope.ORG)
    binding = OrganizationGroupBinding.objects.filter(
        organization=org,
        user_id=_as_user_id(user_or_id),
        group=role.group,
    ).first()
    if binding is not None:
        return binding
    binding = OrganizationGroupBinding(organization=org, user_id=_as_user_id(user_or_id), group=role.group)
    binding.save()
    return binding


def assign_team_role(team, user_or_id, role: AccessRole):
    _validate_assignable_role(role, team.organization, AccessScope.TEAM, team=team)
    binding = TeamGroupBinding.objects.filter(
        team=team,
        user_id=_as_user_id(user_or_id),
        group=role.group,
    ).first()
    if binding is not None:
        return binding
    binding = TeamGroupBinding(team=team, user_id=_as_user_id(user_or_id), group=role.group)
    binding.save()
    return binding


def remove_org_role(binding: OrganizationGroupBinding) -> None:
    binding.delete()


def remove_team_role(binding: TeamGroupBinding) -> None:
    binding.delete()


@transaction.atomic
def update_role_members(
    role: AccessRole,
    org,
    *,
    add_user_ids: list[int],
    remove_user_ids: list[int],
    team=None,
) -> int:
    add_ids = set(add_user_ids)
    remove_ids = set(remove_user_ids)
    overlap = add_ids & remove_ids
    if overlap:
        raise ValidationError({"user_ids": "同一用户不能在一次请求中同时添加和移除。"})

    if role.scope == AccessScope.ORG:
        _validate_assignable_role(role, org, AccessScope.ORG)
        eligible_ids = set(OrganizationMember.objects.filter(organization=org, user_id__in=add_ids).values_list("user_id", flat=True))
        missing_ids = add_ids - eligible_ids
        if missing_ids:
            raise ValidationError({"add_user_ids": [f"用户不是组织成员：{user_id}" for user_id in sorted(missing_ids)]})
        OrganizationGroupBinding.objects.filter(organization=org, group=role.group, user_id__in=remove_ids).delete()
        for user_id in sorted(add_ids):
            assign_org_role(org, user_id, role)
        return OrganizationGroupBinding.objects.filter(organization=org, group=role.group).values("user_id").distinct().count()

    if team is None:
        raise ValidationError({"team": "团队级角色分配必须指定团队。"})
    _validate_assignable_role(role, org, AccessScope.TEAM, team=team)
    eligible_ids = set(team.members.filter(pk__in=add_ids).values_list("pk", flat=True))
    missing_ids = add_ids - eligible_ids
    if missing_ids:
        raise ValidationError({"add_user_ids": [f"用户不是团队成员：{user_id}" for user_id in sorted(missing_ids)]})
    TeamGroupBinding.objects.filter(team=team, group=role.group, user_id__in=remove_ids).delete()
    for user_id in sorted(add_ids):
        assign_team_role(team, user_id, role)
    return TeamGroupBinding.objects.filter(team=team, group=role.group).values("user_id").distinct().count()


def _as_user_id(user_or_id) -> int:
    return getattr(user_or_id, "pk", user_or_id)


def _validate_assignable_role(role: AccessRole, org, scope: AccessScope, *, team=None) -> None:
    errors = {}
    if role.scope != scope:
        errors["role"] = "角色范围与目标绑定范围不匹配。"
    if not role.is_active:
        errors["role"] = "不能分配已停用角色。"
    if role.organization_id is not None and role.organization_id != org.pk:
        errors["role"] = "自定义角色只能在所属组织内分配。"
    if scope == AccessScope.TEAM and role.team_id is not None and (team is None or role.team_id != team.pk):
        errors["role"] = "自定义团队角色只能在所属团队内分配。"
    if errors:
        raise ValidationError(errors)


def _resolve_permissions(permission_keys: list[str]) -> list[Permission]:
    permissions = []
    missing = []
    for permission_key in permission_keys:
        if "." not in permission_key:
            missing.append(permission_key)
            continue
        app_label, codename = permission_key.split(".", 1)
        permission = Permission.objects.filter(content_type__app_label=app_label, codename=codename).first()
        if permission is None:
            missing.append(permission_key)
        else:
            permissions.append(permission)
    if missing:
        raise ValidationError({"permission_keys": [f"未知权限：{key}" for key in missing]})
    return permissions


def _copy_permissions(role: AccessRole | None) -> list[Permission]:
    if role is None:
        return []
    return list(role.group.permissions.all())


def _validate_copy_source(role: AccessRole, org, scope: AccessScope, *, team=None) -> None:
    if not role.is_active:
        raise ValidationError({"copy_from": "不能复制已停用角色。"})
    if role.scope != scope:
        raise ValidationError({"copy_from": "来源角色范围与目标范围不匹配。"})
    if role.organization_id is not None and role.organization_id != org.pk:
        raise ValidationError({"copy_from": "自定义角色只能在所属组织内复制。"})
    if scope == AccessScope.TEAM and role.team_id is not None and (team is None or role.team_id != team.pk):
        raise ValidationError({"copy_from": "自定义团队角色只能在所属团队内复制。"})


def _validate_custom_role(role: AccessRole) -> None:
    if role.is_system or role.organization_id is None:
        raise ValidationError({"role": "系统角色不能通过此接口修改。"})


def _group_name(org, scope: AccessScope, code: str, *, team=None) -> str:
    team_part = f":team:{team.pk}" if team is not None else ""
    return f"org:{org.pk}{team_part}:{scope}:{code}"
