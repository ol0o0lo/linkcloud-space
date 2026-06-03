from django.conf import settings
from django.db import models

from apps.base.mixins import BaseModelMixin
from apps.settings.constants import ValueType


class DefaultSetting(BaseModelMixin):
    """平台默认设置，超管维护，对普通用户透明。"""

    key = models.CharField(max_length=100, unique=True)
    value = models.JSONField()
    value_type = models.CharField(max_length=20, choices=ValueType.choices, default=ValueType.TEXT)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "settings_default"
        ordering = ["key"]

    def __str__(self):
        return self.key


class OrganizationSetting(BaseModelMixin):
    """租户覆盖设置，稀疏存储，只存与默认值不同的项。"""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="settings")
    setting = models.ForeignKey(DefaultSetting, on_delete=models.PROTECT, related_name="org_overrides")
    value = models.JSONField()

    class Meta:
        db_table = "settings_organization"
        unique_together = ("organization", "setting")

    def __str__(self):
        return f"{self.organization} / {self.setting.key}"


class TeamSetting(BaseModelMixin):
    """Team 覆盖设置，稀疏存储，fallback 到 DefaultSetting（不经过 Org）。"""

    team = models.ForeignKey("teams.Team", on_delete=models.CASCADE, related_name="settings")
    setting = models.ForeignKey(DefaultSetting, on_delete=models.PROTECT, related_name="team_overrides")
    value = models.JSONField()

    class Meta:
        db_table = "settings_team"
        unique_together = ("team", "setting")

    def __str__(self):
        return f"{self.team} / {self.setting.key}"


class UserSetting(BaseModelMixin):
    """用户偏好，独立存储，无 fallback 链，key 不需要在 DefaultSetting 中预定义。"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="preferences")
    key = models.CharField(max_length=100)
    value = models.JSONField()

    class Meta:
        db_table = "settings_user"
        unique_together = ("user", "key")

    def __str__(self):
        return f"{self.user} / {self.key}"
