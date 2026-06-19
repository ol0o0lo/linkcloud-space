import hashlib

from django.contrib.auth.models import Group, Permission
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q

from apps.access.constants import ACCESS_PERMISSION_MODEL
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
    permissions = (
        groups.filter(access_role__is_active=True)
        .values_list("permissions__content_type__app_label", "permissions__codename")
        .exclude(permissions__isnull=True)
    )
    keys = set()
    for app_label, codename in permissions:
        keys.add(f"{app_label}.{codename}")
    return keys


def is_group_scope(group: Group, scope: AccessRole.Scope) -> bool:
    try:
        return group.access_role.scope == scope
    except AccessRole.DoesNotExist:
        return False


def list_available_roles(org, scope: AccessRole.Scope):
    return (
        AccessRole.objects.select_related("group", "organization")
        .filter(is_active=True, scope=scope)
        .filter(Q(organization__isnull=True) | Q(organization=org))
        .order_by("-is_system", "name", "pk")
    )


def list_permission_choices():
    return (
        Permission.objects.select_related("content_type")
        .filter(content_type__model=ACCESS_PERMISSION_MODEL)
        .order_by("content_type__app_label", "codename")
    )


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
    scope: AccessRole.Scope,
    name: str,
    permission_keys: list[str] | None = None,
    copy_from: AccessRole | None = None,
) -> AccessRole:
    if copy_from is not None:
        _validate_copy_source(copy_from, org, scope)
    name = _normalize_role_name(name)
    permissions = _resolve_permissions(permission_keys) if permission_keys is not None else _copy_permissions(copy_from)
    code = _generate_custom_role_code(org, scope, name)
    group_name = _group_name(org, scope, code)
    _prepare_custom_role_identity(org, scope, name=name, code=code, group_name=group_name)
    group = Group.objects.create(name=group_name)
    role = AccessRole(
        group=group,
        organization=org,
        scope=scope,
        code=code,
        name=name,
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
    permission_keys: list[str] | None = None,
) -> AccessRole:
    _validate_custom_role(role)
    if name is not None:
        name = _normalize_role_name(name)
        _validate_unique_role_name(role.organization, role.scope, name, exclude_role=role)
        role.name = name
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


def _prepare_custom_role_identity(org, scope: AccessRole.Scope, *, name: str, code: str, group_name: str) -> None:
    existing_name_roles = AccessRole.objects.select_related("group").filter(scope=scope, name=name).filter(Q(organization__isnull=True) | Q(organization=org))
    for role in existing_name_roles:
        _clear_or_reject_existing_role(role)
    _clear_or_reject_existing_role(AccessRole.objects.select_related("group").filter(organization=org, scope=scope, code=code).first())

    if Group.objects.filter(name=group_name).exists():
        raise ValidationError({"code": "Role group name already exists. Remove the stale group before creating this role."})


def _clear_or_reject_existing_role(role: AccessRole | None) -> None:
    if role is None:
        return
    if role.is_active:
        raise ValidationError({"name": "Role name already exists in this scope."})
    delete_custom_role(role)


def _validate_unique_role_name(org, scope: AccessRole.Scope, name: str, *, exclude_role: AccessRole | None = None) -> None:
    qs = AccessRole.objects.filter(scope=scope, name=name).filter(Q(organization__isnull=True) | Q(organization=org))
    if exclude_role is not None:
        qs = qs.exclude(pk=exclude_role.pk)
    existing_role = qs.first()
    if existing_role is not None:
        if existing_role.is_active:
            raise ValidationError({"name": "Role name already exists in this scope."})
        delete_custom_role(existing_role)


def _normalize_role_name(name: str) -> str:
    normalized = name.strip()
    if not normalized:
        raise ValidationError({"name": "Role name is required."})
    return normalized


def _generate_custom_role_code(org, scope: AccessRole.Scope, name: str) -> str:
    digest = hashlib.sha1(f"{org.pk}:{scope}:{name}".encode(), usedforsecurity=False).hexdigest()[:12]
    return f"custom_{digest}"


def assign_org_role(org, user_or_id, role: AccessRole):
    _validate_assignable_role(role, org, AccessRole.Scope.ORG)
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
    _validate_assignable_role(role, team.organization, AccessRole.Scope.TEAM)
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


def _as_user_id(user_or_id) -> int:
    return getattr(user_or_id, "pk", user_or_id)


def _validate_assignable_role(role: AccessRole, org, scope: AccessRole.Scope) -> None:
    errors = {}
    if role.scope != scope:
        errors["role"] = "Role scope does not match the target binding scope."
    if not role.is_active:
        errors["role"] = "Inactive roles cannot be assigned."
    if role.organization_id is not None and role.organization_id != org.pk:
        errors["role"] = "Custom roles can only be assigned inside their organization."
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
        raise ValidationError({"permission_keys": [f"Unknown permission: {key}" for key in missing]})
    return permissions


def _copy_permissions(role: AccessRole | None) -> list[Permission]:
    if role is None:
        return []
    return list(role.group.permissions.all())


def _validate_copy_source(role: AccessRole, org, scope: AccessRole.Scope) -> None:
    if not role.is_active:
        raise ValidationError({"copy_from": "Inactive roles cannot be copied."})
    if role.scope != scope:
        raise ValidationError({"copy_from": "Role scope does not match the target scope."})
    if role.organization_id is not None and role.organization_id != org.pk:
        raise ValidationError({"copy_from": "Custom roles can only be copied inside their organization."})


def _validate_custom_role(role: AccessRole) -> None:
    if role.is_system or role.organization_id is None:
        raise ValidationError({"role": "System roles cannot be modified through this API."})


def _group_name(org, scope: AccessRole.Scope, code: str) -> str:
    return f"org:{org.pk}:{scope}:{code}"
