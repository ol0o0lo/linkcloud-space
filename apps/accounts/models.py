import logging
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models

import phonenumbers
from phonenumbers.phonenumberutil import NumberParseException

from apps.accounts.constants import RealNameLogAction, RealNameProvider, RealNameSource, RealNameStatus
from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField

logger = logging.getLogger(__name__)


# Kept for historical migrations that reference these upload_to callables.
def avatar_original_path(instance, filename):
    ext = filename.rsplit(".", 1)[-1].lower()
    return f"avatars/originals/{instance.pk}/{uuid4().hex}.{ext}"


def avatar_thumbnail_path(instance, filename):
    return f"avatars/thumbnails/{instance.pk}/{uuid4().hex}.jpg"


class User(AbstractUser):
    timezone = models.CharField(max_length=63, default="Asia/Shanghai", verbose_name="时区")
    avatar = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.AVATAR],
        business_validators=["apps.accounts.services.validate_avatar_media_owner"],
        verbose_name="头像",
    )
    phone_country_code = models.CharField(max_length=8, blank=True, default="", verbose_name="手机号国家代码")
    phone_national_number = models.CharField(max_length=32, blank=True, default="", verbose_name="手机号本地号码")
    phone_verified = models.BooleanField(default=False, verbose_name="手机号是否已验证")
    real_name_status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.UNVERIFIED, db_index=True, verbose_name="实名认证状态")
    real_name_verified_at = models.DateTimeField(null=True, blank=True, verbose_name="实名认证时间")
    real_name_masked = models.CharField(max_length=64, blank=True, default="", verbose_name="脱敏实名姓名")
    id_number_masked = models.CharField(max_length=32, blank=True, default="", verbose_name="脱敏身份证号")

    class Meta(AbstractUser.Meta):
        verbose_name = "用户"
        verbose_name_plural = "用户"
        constraints = [
            models.UniqueConstraint(
                condition=~models.Q(phone_national_number=""),
                fields=("phone_country_code", "phone_national_number"),
                name="accounts_user_phone_parts_unique",
            )
        ]

    def clean(self):
        # 校验时区并顺手规范化手机号字段。
        super().clean()
        if self.timezone:
            try:
                ZoneInfo(self.timezone)
            except (ZoneInfoNotFoundError, KeyError) as err:
                raise ValidationError({"timezone": f"无效的时区：{self.timezone}"}) from err
        self._normalize_phone_parts()

    def save(self, *args, **kwargs):
        # 保存前确保手机号拆分字段保持一致。
        changed_fields = self._normalize_phone_parts()
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and changed_fields:
            kwargs["update_fields"] = set(update_fields) | changed_fields
        super().save(*args, **kwargs)

    def set_phone_number(self, phone: str | None, verified: bool | None = None) -> None:
        # 用统一入口写入手机号，避免散落修改拆分字段。
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
        # media 平台补齐缩略图后，调用方无需再改头像读取逻辑。
        if not self.avatar_resolved:
            return None
        return self.avatar_resolved[0].get("thumbnail") or self.avatar_resolved[0].get("url")

    def _normalize_phone_parts(self) -> set[str]:
        # 去空格、去短横线，并在无号码时清空区号。
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
    composed = compose_phone(country_code, national_number)
    if not composed or not country_code:
        return composed
    try:
        parsed = phonenumbers.parse(composed, None)
    except NumberParseException:
        return composed
    return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)


def split_phone(phone: str | None) -> tuple[str, str]:
    """按国际号码规则拆分区号；无区号时仅自动识别有效的中国大陆手机号。"""
    if not phone:
        return "", ""
    compact = str(phone).strip().replace(" ", "").replace("-", "")
    if not compact:
        return "", ""

    if compact.startswith("+"):
        try:
            parsed = phonenumbers.parse(compact, None)
        except NumberParseException:
            return "", compact
        return _split_parsed_phone(parsed)

    try:
        parsed = phonenumbers.parse(compact, "CN", keep_raw_input=True)
    except NumberParseException:
        return "", compact
    if parsed.country_code_source == phonenumbers.CountryCodeSource.FROM_DEFAULT_COUNTRY and phonenumbers.is_valid_number_for_region(parsed, "CN"):
        return _split_parsed_phone(parsed)
    return "", compact


def _split_parsed_phone(phone_number) -> tuple[str, str]:
    return f"+{phone_number.country_code}", phonenumbers.national_significant_number(phone_number)


def compose_phone(country_code: str, national_number: str) -> str | None:
    national_number = (national_number or "").strip().replace(" ", "").replace("-", "")
    if not national_number:
        return None
    country_code = (country_code or "").strip().replace(" ", "")
    return f"{country_code}{national_number}" if country_code else national_number


class RealNameVerification(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="real_name_verifications", verbose_name="用户")
    status = models.CharField(max_length=32, choices=RealNameStatus.choices, default=RealNameStatus.PENDING, db_index=True, verbose_name="状态")
    source = models.CharField(max_length=32, choices=RealNameSource.choices, default=RealNameSource.USER_SUBMIT, verbose_name="来源")
    provider = models.CharField(max_length=32, choices=RealNameProvider.choices, default=RealNameProvider.MOCK_AUTO, verbose_name="服务提供方")
    real_name_encrypted = models.TextField(verbose_name="实名姓名密文")
    id_number_encrypted = models.TextField(verbose_name="身份证号密文")
    real_name_masked = models.CharField(max_length=64, verbose_name="脱敏实名姓名")
    id_number_masked = models.CharField(max_length=32, verbose_name="脱敏身份证号")
    id_number_hash = models.CharField(max_length=64, db_index=True, verbose_name="身份证号哈希")
    failure_reason = models.CharField(max_length=255, blank=True, default="", verbose_name="失败原因")
    review_note = models.TextField(blank=True, default="", verbose_name="审核备注")
    provider_request_id = models.CharField(max_length=128, blank=True, default="", verbose_name="服务方请求标识")
    provider_result = models.JSONField(blank=True, default=dict, verbose_name="服务方结果")
    id_card_media = MediaRefsField(
        blank=True,
        default=list,
        min_items=2,
        max_items=2,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.REAL_NAME_ID_CARD],
        business_validators=["apps.accounts.services.validate_id_card_media_owner"],
        verbose_name="身份证图片",
    )
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="reviewed_real_name_verifications", verbose_name="审核人")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="审核时间")
    is_current = models.BooleanField(default=True, db_index=True, verbose_name="是否当前记录")

    class Meta:
        verbose_name = "实名认证记录"
        verbose_name_plural = "实名认证记录"
        ordering = ["-created_at", "-id"]


class RealNameVerificationLog(models.Model):
    verification = models.ForeignKey(RealNameVerification, on_delete=models.CASCADE, related_name="logs", verbose_name="实名认证记录")
    action = models.CharField(max_length=32, choices=RealNameLogAction.choices, verbose_name="操作")
    from_status = models.CharField(max_length=32, choices=RealNameStatus.choices, blank=True, default="", verbose_name="原状态")
    to_status = models.CharField(max_length=32, choices=RealNameStatus.choices, blank=True, default="", verbose_name="新状态")
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="real_name_log_entries", verbose_name="操作人")
    note = models.TextField(blank=True, default="", verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")

    class Meta:
        verbose_name = "实名认证操作日志"
        verbose_name_plural = "实名认证操作日志"
        ordering = ["created_at", "id"]
