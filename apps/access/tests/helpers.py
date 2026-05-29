from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType

from apps.access.constants import ACCESS_PERMISSION_MODEL
from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding


def make_permission(app_label: str, codename: str) -> Permission:
    content_type, _ = ContentType.objects.get_or_create(app_label=app_label, model=ACCESS_PERMISSION_MODEL)
    permission, _ = Permission.objects.get_or_create(
        content_type=content_type,
        codename=codename,
        defaults={"name": codename},
    )
    return permission


def make_access_group(code: str, scope: str, permissions: list[tuple[str, str]], organization=None) -> Group:
    group = Group.objects.create(name=code)
    group.permissions.set([make_permission(app_label, codename) for app_label, codename in permissions])
    AccessRole.objects.create(
        group=group,
        organization=organization,
        scope=scope,
        code=code,
        name=code,
        is_system=organization is None,
    )
    return group


def bind_org_role(organization, user, group):
    return OrganizationGroupBinding.objects.create(organization=organization, user=user, group=group)


def bind_team_role(team, user, group):
    return TeamGroupBinding.objects.create(team=team, user=user, group=group)
