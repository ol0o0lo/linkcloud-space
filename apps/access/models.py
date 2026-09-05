from django.conf import settings
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import models

from apps.access.constants import AccessScope
from apps.base.mixins import BaseModelMixin


class AccessRole(BaseModelMixin):
    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name="access_role", verbose_name="权限组")
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="access_roles",
        verbose_name="所属组织",
    )
    team = models.ForeignKey(
        "teams.Team",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="access_roles",
        verbose_name="团队",
    )
    scope = models.CharField(max_length=20, choices=AccessScope.choices, verbose_name="作用域")
    code = models.SlugField(max_length=80, verbose_name="编码")
    name = models.CharField(max_length=80, verbose_name="名称")
    description = models.TextField(blank=True, default="", verbose_name="描述")
    is_system = models.BooleanField(default=False, verbose_name="是否系统内置")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        verbose_name = "访问角色"
        verbose_name_plural = "访问角色"
        constraints = [
            models.UniqueConstraint(
                fields=["scope", "code"],
                condition=models.Q(organization__isnull=True),
                name="unique_system_access_role_code",
            ),
            models.UniqueConstraint(
                fields=["organization", "scope", "code"],
                condition=models.Q(organization__isnull=False, team__isnull=True),
                name="unique_org_access_role_code",
            ),
            models.UniqueConstraint(
                fields=["organization", "team", "scope", "code"],
                condition=models.Q(team__isnull=False),
                name="unique_team_access_role_code",
            ),
        ]

    def clean(self):
        super().clean()
        if self.is_system and self.organization_id is not None:
            raise ValidationError({"organization": "系统角色不能归属于组织。"})
        if self.is_system and self.team_id is not None:
            raise ValidationError({"team": "系统角色不能归属于团队。"})
        if not self.is_system and self.organization_id is None:
            raise ValidationError({"organization": "自定义角色必须归属于组织。"})
        if self.scope == AccessScope.ORG and self.team_id is not None:
            raise ValidationError({"team": "组织角色不能绑定团队。"})
        if not self.is_system and self.scope == AccessScope.TEAM and self.team_id is None:
            raise ValidationError({"team": "自定义团队角色必须归属于团队。"})
        if self.team_id is not None and self.organization_id is not None and self.team.organization_id != self.organization_id:
            raise ValidationError({"team": "角色所属团队必须与角色所属组织一致。"})

    def __str__(self):
        """Return the role display name."""
        return self.name


class OrganizationGroupBinding(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, verbose_name="所属组织")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="用户")
    group = models.ForeignKey(Group, on_delete=models.CASCADE, verbose_name="权限组")

    class Meta:
        verbose_name = "组织用户组绑定"
        verbose_name_plural = "组织用户组绑定"
        constraints = [
            models.UniqueConstraint(fields=("organization", "user", "group"), name="access_org_user_group_unique"),
        ]

    def clean(self):
        super().clean()
        from apps.organizations.models import OrganizationMember

        role = _get_access_role(self.group)
        errors = {}
        if role.scope != AccessScope.ORG:
            errors["group"] = "组织角色绑定只能使用组织级角色。"
        if role.organization_id is not None and role.organization_id != self.organization_id:
            errors["group"] = "自定义角色只能在所属组织内绑定。"
        if self.organization_id and self.user_id and not OrganizationMember.objects.filter(organization_id=self.organization_id, user_id=self.user_id).exists():
            errors["user"] = "用户必须是该组织成员。"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        """Return a readable binding label."""
        return f"{self.organization} / {self.user} / {self.group}"


class TeamGroupBinding(BaseModelMixin):
    team = models.ForeignKey("teams.Team", on_delete=models.CASCADE, verbose_name="团队")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name="用户")
    group = models.ForeignKey(Group, on_delete=models.CASCADE, verbose_name="权限组")

    class Meta:
        verbose_name = "团队用户组绑定"
        verbose_name_plural = "团队用户组绑定"
        constraints = [
            models.UniqueConstraint(fields=("team", "user", "group"), name="access_team_user_group_unique"),
        ]

    def clean(self):
        super().clean()
        role = _get_access_role(self.group)
        errors = {}
        if role.scope != AccessScope.TEAM:
            errors["group"] = "团队角色绑定只能使用团队级角色。"
        if self.team_id and role.organization_id is not None and role.organization_id != self.team.organization_id:
            errors["group"] = "自定义角色只能在所属组织内绑定。"
        if self.team_id and role.team_id is not None and role.team_id != self.team_id:
            errors["group"] = "自定义团队角色只能在所属团队内绑定。"
        if self.team_id and self.user_id and not self.team.members.filter(pk=self.user_id).exists():
            errors["user"] = "用户必须是该团队成员。"
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        """Return a readable binding label."""
        return f"{self.team} / {self.user} / {self.group}"


def _get_access_role(group: Group) -> AccessRole:
    try:
        return group.access_role
    except AccessRole.DoesNotExist as exc:
        raise ValidationError({"group": "该用户组未配置为访问角色。"}) from exc
