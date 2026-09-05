from django.conf import settings
from django.db import models

from apps.base.mixins import BaseModelMixin
from apps.settings.constants import SettingWidget, ValueType
from apps.settings.values import normalize_tag_list


class DefaultSetting(BaseModelMixin):
    """平台默认设置，超管维护，对普通用户透明。"""

    key = models.CharField(max_length=100, unique=True, verbose_name="设置键")
    value = models.JSONField(verbose_name="值")
    value_type = models.CharField(max_length=20, choices=ValueType.choices, default=ValueType.TEXT, verbose_name="值类型")
    description = models.TextField(blank=True, verbose_name="描述")
    label = models.CharField(max_length=100, blank=True, verbose_name="显示名称")
    widget = models.CharField(max_length=20, choices=SettingWidget.choices, blank=True, verbose_name="控件类型")
    ui = models.JSONField(default=dict, blank=True, verbose_name="界面配置")
    category = models.CharField(max_length=50, blank=True, verbose_name="分类")

    class Meta:
        db_table = "settings_default"
        verbose_name = "默认设置"
        verbose_name_plural = "默认设置"
        ordering = ["key"]

    def __str__(self):
        return self.key

    def clean(self):
        super().clean()
        if self.widget == SettingWidget.TAGS:
            self.value = normalize_tag_list(self.value)


class OrganizationSetting(BaseModelMixin):
    """租户覆盖设置，稀疏存储，只存与默认值不同的项。"""

    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="settings", verbose_name="所属组织")
    setting = models.ForeignKey(DefaultSetting, on_delete=models.PROTECT, related_name="org_overrides", verbose_name="设置项")
    value = models.JSONField(verbose_name="值")

    class Meta:
        db_table = "settings_organization"
        verbose_name = "组织设置"
        verbose_name_plural = "组织设置"
        constraints = [models.UniqueConstraint(fields=("organization", "setting"), name="settings_org_setting_unique")]

    def __str__(self):
        return f"{self.organization} / {self.setting.key}"


class TeamSetting(BaseModelMixin):
    """Team 覆盖设置，稀疏存储，fallback 到 DefaultSetting（不经过 Org）。"""

    team = models.ForeignKey("teams.Team", on_delete=models.CASCADE, related_name="settings", verbose_name="团队")
    setting = models.ForeignKey(DefaultSetting, on_delete=models.PROTECT, related_name="team_overrides", verbose_name="设置项")
    value = models.JSONField(verbose_name="值")

    class Meta:
        db_table = "settings_team"
        verbose_name = "团队设置"
        verbose_name_plural = "团队设置"
        constraints = [models.UniqueConstraint(fields=("team", "setting"), name="settings_team_setting_unique")]

    def __str__(self):
        return f"{self.team} / {self.setting.key}"


class UserSetting(BaseModelMixin):
    """用户偏好，独立存储，无 fallback 链，key 不需要在 DefaultSetting 中预定义。"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="preferences", verbose_name="用户")
    key = models.CharField(max_length=100, verbose_name="设置键")
    value = models.JSONField(verbose_name="值")

    class Meta:
        db_table = "settings_user"
        verbose_name = "用户设置"
        verbose_name_plural = "用户设置"
        constraints = [models.UniqueConstraint(fields=("user", "key"), name="settings_user_key_unique")]

    def __str__(self):
        return f"{self.user} / {self.key}"
