from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin


class Favorite(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    target_type = models.CharField(max_length=64)
    target_id = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [models.UniqueConstraint(fields=["user", "target_type", "target_id"], name="favorite_user_target_unique")]
        indexes = [models.Index(fields=["user", "target_type", "is_active", "updated_at"], name="favorite_user_type_active_idx")]

    def __str__(self):  # noqa: D105
        return f"{self.user} -> {self.target_type}/{self.target_id}"
