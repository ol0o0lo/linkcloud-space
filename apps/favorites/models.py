from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin


class Favorite(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites", verbose_name="用户")
    target_type = models.CharField(max_length=64, verbose_name="目标类型")
    target_id = models.CharField(max_length=64, verbose_name="目标标识")

    class Meta:
        verbose_name = "收藏记录"
        verbose_name_plural = "收藏记录"
        ordering = ["-created_at", "-id"]
        constraints = [models.UniqueConstraint(fields=["user", "target_type", "target_id"], name="favorite_user_target_unique")]
        indexes = [models.Index(fields=["user", "target_type", "created_at"], name="favorite_user_type_created_idx")]

    def __str__(self):  # noqa: D105
        return f"{self.user} -> {self.target_type}/{self.target_id}"
