import logging
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus

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
    phone_country_code = models.CharField(max_length=8, blank=True, default="")
    phone_national_number = models.CharField(max_length=32, blank=True, default="")
    phone_verified = models.BooleanField(default=False)
    real_name_status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.UNVERIFIED, db_index=True)
    real_name_verified_at = models.DateTimeField(null=True, blank=True)
    real_name_masked = models.CharField(max_length=64, blank=True, default="")
    id_number_masked = models.CharField(max_length=32, blank=True, default="")

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                condition=~models.Q(phone_national_number=""),
                fields=("phone_country_code", "phone_national_number"),
                name="accounts_user_phone_parts_unique",
            )
        ]

    def clean(self):
        super().clean()
        if self.timezone:
            try:
                ZoneInfo(self.timezone)
            except (ZoneInfoNotFoundError, KeyError) as err:
                raise ValidationError({"timezone": f"Invalid timezone: {self.timezone}"}) from err
        self._normalize_phone_parts()

    def save(self, *args, **kwargs):
        changed_fields = self._normalize_phone_parts()
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and changed_fields:
            kwargs["update_fields"] = set(update_fields) | changed_fields
        super().save(*args, **kwargs)

    def set_phone_number(self, phone: str | None, verified: bool | None = None) -> None:
        country_code, national_number = split_phone(phone)
        self.phone_country_code = country_code
        self.phone_national_number = national_number
        if verified is not None:
            self.phone_verified = verified
        self._normalize_phone_parts()

    @property
    def phone(self) -> str | None:
        return compose_phone(self.phone_country_code, self.phone_national_number)

    @phone.setter
    def phone(self, value: str | None) -> None:
        country_code, national_number = split_phone(value)
        self.phone_country_code = country_code
        self.phone_national_number = national_number

    @property
    def avatar_url(self):
        if self.avatar_thumbnail:
            return self.avatar_thumbnail.url
        return None

    def _normalize_phone_parts(self) -> set[str]:
        old_values = {
            "phone_country_code": self.phone_country_code,
            "phone_national_number": self.phone_national_number,
        }
        self.phone_country_code = (self.phone_country_code or "").strip().replace(" ", "")
        self.phone_national_number = (self.phone_national_number or "").strip().replace(" ", "").replace("-", "")
        if not self.phone_national_number:
            self.phone_country_code = ""
        return {field for field, old_value in old_values.items() if getattr(self, field) != old_value}


def normalize_phone(phone: str | None) -> str | None:
    country_code, national_number = split_phone(phone)
    return compose_phone(country_code, national_number)


def split_phone(phone: str | None) -> tuple[str, str]:
    if not phone:
        return "", ""
    value = str(phone).strip().replace(" ", "")
    if not value:
        return "", ""
    if value.startswith("+") and "-" in value:
        country_code, national_number = value.split("-", 1)
        return country_code, national_number.replace("-", "")

    compact = value.replace("-", "")
    if compact.startswith("+86") and len(compact) > 3:
        return "+86", compact[3:]
    if compact.startswith("86") and len(compact) > 2:
        return "+86", compact[2:]
    if compact.startswith("1") and len(compact) == 11:
        return "+86", compact
    return "", compact


def compose_phone(country_code: str, national_number: str) -> str | None:
    national_number = (national_number or "").strip().replace(" ", "").replace("-", "")
    if not national_number:
        return None
    country_code = (country_code or "").strip().replace(" ", "")
    return f"{country_code}{national_number}" if country_code else national_number


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
