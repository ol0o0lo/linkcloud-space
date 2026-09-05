from django.conf import settings
from django.db import models

from apps.base.mixins import BaseModelMixin
from apps.teams.managers import TeamQuerySet


class Team(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, verbose_name="所属组织")
    name = models.CharField(max_length=100, verbose_name="团队名称")
    phone = models.CharField(max_length=32, blank=True, default="", verbose_name="手机号")
    wechat = models.CharField(max_length=64, blank=True, default="", verbose_name="微信号")
    address = models.CharField(max_length=255, blank=True, default="", verbose_name="地址")
    business_hours = models.CharField(max_length=255, blank=True, default="", verbose_name="营业时间")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="teams", verbose_name="团队成员")
    objects = TeamQuerySet.as_manager()

    class Meta:
        verbose_name = "团队"
        verbose_name_plural = "团队"
        constraints = [models.UniqueConstraint(fields=("organization", "name"), name="teams_org_name_unique")]

    def __str__(self):  # noqa: D105
        return self.name
