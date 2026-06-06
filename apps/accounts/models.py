import logging
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from apps.accounts.constants import RealNameProvider, RealNameSource, RealNameStatus, RealNameLogAction

logger = logging.getLogger(__name__)


def avatar_original_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower()
    return f"avatars/originals/{instance.pk}/{uuid4().hex}.{ext}"


def avatar_thumbnail_path(instance, filename):
    return f"avatars/thumbnails/{instance.pk}/{uuid4().hex}.jpg"


class User(AbstractUser):
    timezone = models.CharField(max_length=63, default="Asia/Shanghai")
    avatar_original = models.ImageField(upload_to=avatar_original_path, blank=True)
    avatar_thumbnail = models.ImageField(upload_to=avatar_thumbnail_path, blank=True)
    avatar_crop_data = models.JSONField(blank=True, null=True)
    phone = models.CharField(max_length=20, unique=True, null=True, blank=True)
    phone_verified = models.BooleanField(default=False)
    real_name_status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.UNVERIFIED, db_index=True)
    real_name_verified_at = models.DateTimeField(null=True, blank=True)
    real_name_masked = models.CharField(max_length=64, blank=True, default="")
    id_number_masked = models.CharField(max_length=32, blank=True, default="")

    def clean(self):
        super().clean()
        if self.timezone:
            try:
                ZoneInfo(self.timezone)
            except (ZoneInfoNotFoundError, KeyError) as err:
                raise ValidationError({"timezone": f"Invalid timezone: {self.timezone}"}) from err

    @property
    def avatar_url(self):
        if self.avatar_thumbnail:
            return self.avatar_thumbnail.url
        return None


class RealNameVerification(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="real_name_verifications")
    status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.PENDING, db_index=True)
    source = models.CharField(max_length=32, choices=RealNameSource.choices, default=RealNameSource.USER_SUBMIT)
    provider = models.CharField(max_length=32, choices=RealNameProvider.choices, default=RealNameProvider.MOCK_AUTO)
    real_name_encrypted = models.TextField()
    id_number_encrypted = models.TextField()
    real_name_masked = models.CharField(max_length=64)
    id_number_masked = models.CharField(max_length=32)
    id_number_last4 = models.CharField(max_length=4, blank=True, default="", db_index=True)
    id_number_hash = models.CharField(max_length=64, db_index=True)
    failure_reason = models.CharField(max_length=255, blank=True, default="")
    review_note = models.TextField(blank=True, default="")
    provider_request_id = models.CharField(max_length=128, blank=True, default="")
    provider_result = models.JSONField(blank=True, default=dict)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_real_name_verifications")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_current = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class RealNameVerificationLog(models.Model):
    verification = models.ForeignKey(RealNameVerification, on_delete=models.CASCADE, related_name="logs")
    action = models.CharField(max_length=32, choices=RealNameLogAction.choices)
    from_status = models.CharField(max_length=32, choices=RealNameStatus.choices, blank=True, default="")
    to_status = models.CharField(max_length=32, choices=RealNameStatus.choices, blank=True, default="")
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="real_name_log_entries")
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
