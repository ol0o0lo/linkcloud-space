from django.contrib.auth.models import Group, Permission
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q

from apps.access.constants import ACCESS_PERMISSION_MODEL
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
    code: str,
    name: str,
    permission_keys: list[str] | None = None,
    copy_from: AccessRole | None = None,
) -> AccessRole:
    if copy_from is not None:
        _validate_copy_source(copy_from, org, scope)
    permissions = _resolve_permissions(permission_keys) if permission_keys is not None else _copy_permissions(copy_from)
    group = Group.objects.create(name=_group_name(org, scope, code))
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
    code: str | None = None,
    name: str | None = None,
    permission_keys: list[str] | None = None,
    is_active: bool | None = None,
) -> AccessRole:
    _validate_custom_role(role)
    if code is not None:
        role.code = code
        role.group.name = _group_name(role.organization, role.scope, code)
    if name is not None:
        role.name = name
    if is_active is not None:
        role.is_active = is_active
    role.full_clean()
    role.group.save(update_fields=["name"])
    role.save()
    if permission_keys is not None:
        role.group.permissions.set(_resolve_permissions(permission_keys))
    return role


def deactivate_custom_role(role: AccessRole) -> AccessRole:
    _validate_custom_role(role)
    role.is_active = False
    role.save(update_fields=["is_active", "updated_at"])
    return role


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
