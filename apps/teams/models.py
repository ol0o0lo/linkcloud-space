from django.conf import settings
from django.db import models

from apps.base.mixins import BaseModelMixin
from apps.teams.managers import TeamQuerySet


class Team(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=32, blank=True, default="")
    wechat = models.CharField(max_length=64, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    business_hours = models.CharField(max_length=255, blank=True, default="")
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="teams")
    objects = TeamQuerySet.as_manager()

    class Meta:
        unique_together = ("organization", "name")

    def __str__(self):  # noqa: D105
        return self.name
