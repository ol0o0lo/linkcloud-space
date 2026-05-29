from django.conf import settings
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError
from django.db import models

from apps.access.constants import AccessScope
from apps.base.mixins import TimeStampModelMixin


class AccessRole(TimeStampModelMixin):
    Scope = AccessScope

    group = models.OneToOneField(Group, on_delete=models.CASCADE, related_name="access_role")
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="access_roles",
    )
    scope = models.CharField(max_length=20, choices=AccessScope.choices)
    code = models.SlugField(max_length=80)
    name = models.CharField(max_length=80)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["scope", "code"],
                condition=models.Q(organization__isnull=True),
                name="unique_system_access_role_code",
            ),
            models.UniqueConstraint(
                fields=["organization", "scope", "code"],
                condition=models.Q(organization__isnull=False),
                name="unique_org_access_role_code",
            ),
        ]

    def clean(self):
        super().clean()
        if self.is_system and self.organization_id is not None:
            raise ValidationError({"organization": "System roles cannot belong to an organization."})
        if not self.is_system and self.organization_id is None:
            raise ValidationError({"organization": "Custom roles must belong to an organization."})

    def __str__(self):
        """Return the role display name."""
        return self.name


class OrganizationGroupBinding(TimeStampModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("organization", "user", "group")

    def clean(self):
        super().clean()
        from apps.organizations.models import OrganizationMember

        role = _get_access_role(self.group)
        errors = {}
        if role.scope != AccessRole.Scope.ORG:
            errors["group"] = "Organization bindings only accept org-scoped roles."
        if role.organization_id is not None and role.organization_id != self.organization_id:
            errors["group"] = "Custom roles can only be bound inside their organization."
        if (
            self.organization_id
            and self.user_id
            and not OrganizationMember.objects.filter(organization_id=self.organization_id, user_id=self.user_id).exists()
        ):
            errors["user"] = "User must be a member of the organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        """Return a readable binding label."""
        return f"{self.organization} / {self.user} / {self.group}"


class TeamGroupBinding(TimeStampModelMixin):
    team = models.ForeignKey("teams.Team", on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)

    class Meta:
        unique_together = ("team", "user", "group")

    def clean(self):
        super().clean()
        role = _get_access_role(self.group)
        errors = {}
        if role.scope != AccessRole.Scope.TEAM:
            errors["group"] = "Team bindings only accept team-scoped roles."
        if self.team_id and role.organization_id is not None and role.organization_id != self.team.organization_id:
            errors["group"] = "Custom roles can only be bound inside their organization."
        if self.team_id and self.user_id and not self.team.members.filter(pk=self.user_id).exists():
            errors["user"] = "User must be a member of the team."
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
        raise ValidationError({"group": "Group is not configured as an access role."}) from exc
