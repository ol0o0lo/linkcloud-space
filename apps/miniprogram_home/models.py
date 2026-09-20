from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import F, Q

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.media.constants import MediaType, ResourceType
from apps.media.fields import MediaRefsField
from apps.miniprogram_home.constants import ENTRY_TONES_BY_KIND, HomeBannerAction, HomeBannerTone, HomeEntryKind, HomeEntryTone


def generate_home_entry_slug() -> str:
    return uuid4().hex


def schedule_constraint(name: str) -> models.CheckConstraint:
    return models.CheckConstraint(
        condition=(Q(starts_at__isnull=True) & Q(ends_at__isnull=True))
        | (Q(starts_at__isnull=False) & Q(ends_at__isnull=False) & Q(ends_at__gt=F("starts_at"))),
        name=name,
    )


class ScheduledHomeItemMixin(models.Model):
    sort_order = models.PositiveIntegerField(default=100, db_index=True, verbose_name="排序")
    is_enabled = models.BooleanField(default=False, db_index=True, verbose_name="是否启用")
    starts_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="开始时间")
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="结束时间")

    class Meta:
        abstract = True

    def clean_schedule(self) -> None:
        if (self.starts_at is None) != (self.ends_at is None):
            raise ValidationError({"starts_at": ["开始时间和结束时间必须同时填写，或同时留空表示长期有效。"]})
        if self.starts_at is not None and self.ends_at is not None and self.ends_at <= self.starts_at:
            raise ValidationError({"ends_at": ["结束时间必须晚于开始时间。"]})


class MiniProgramHomeEntry(CreateUpdateTimeModelMixin, ScheduledHomeItemMixin):
    kind = models.CharField(max_length=20, choices=HomeEntryKind.choices, db_index=True, verbose_name="内容类型")
    slug = models.SlugField(max_length=40, unique=True, default=generate_home_entry_slug, editable=False, verbose_name="公开标识")
    eyebrow = models.CharField(max_length=40, blank=True, default="", verbose_name="眉标题")
    title = models.CharField(max_length=120, verbose_name="标题")
    summary = models.CharField(max_length=240, verbose_name="摘要")
    cover_image = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.MINIPROGRAM_HOME_IMAGE],
        verbose_name="封面图片",
    )
    body_markdown = models.TextField(blank=True, default="", verbose_name="Markdown 正文")
    tone = models.CharField(max_length=20, choices=HomeEntryTone.choices, verbose_name="色调")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="创建人")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="更新人")

    class Meta:
        verbose_name = "小程序首页专题或指南"
        verbose_name_plural = "小程序首页专题或指南"
        ordering = ("sort_order", "id")
        constraints = [schedule_constraint("miniprogram_home_entry_schedule_valid")]

    def clean(self):
        super().clean()
        self.clean_schedule()
        if self.kind in ENTRY_TONES_BY_KIND and self.tone not in ENTRY_TONES_BY_KIND[self.kind]:
            raise ValidationError({"tone": ["当前内容类型不支持该色调。"]})
        if self.pk and self.kind == HomeEntryKind.GUIDE and self.house_links.exists():
            raise ValidationError({"kind": ["请先移除专题关联房源，再把内容改为租房指南。"]})

    def __str__(self) -> str:
        return self.title


class MiniProgramHomeBanner(CreateUpdateTimeModelMixin, ScheduledHomeItemMixin):
    eyebrow = models.CharField(max_length=40, blank=True, default="", verbose_name="眉标题")
    title = models.CharField(max_length=120, verbose_name="标题")
    description = models.CharField(max_length=240, verbose_name="说明")
    button_text = models.CharField(max_length=20, default="查看详情", verbose_name="按钮文字")
    image = MediaRefsField(
        blank=True,
        default=list,
        max_items=1,
        allowed_media_types=[MediaType.IMAGE],
        allowed_resource_types=[ResourceType.MINIPROGRAM_HOME_IMAGE],
        verbose_name="配图",
    )
    tone = models.CharField(max_length=20, choices=HomeBannerTone.choices, verbose_name="色调")
    action_type = models.CharField(max_length=20, choices=HomeBannerAction.choices, verbose_name="动作类型")
    entry = models.ForeignKey(MiniProgramHomeEntry, null=True, blank=True, on_delete=models.PROTECT, related_name="banners", verbose_name="关联内容")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="创建人")
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="更新人")

    class Meta:
        verbose_name = "小程序首页 Banner"
        verbose_name_plural = "小程序首页 Banner"
        ordering = ("sort_order", "id")
        constraints = [schedule_constraint("miniprogram_home_banner_schedule_valid")]

    def clean(self):
        super().clean()
        self.clean_schedule()
        if self.action_type == HomeBannerAction.ENTRY and self.entry_id is None:
            raise ValidationError({"entry": ["动作类型为专题或指南时必须选择关联内容。"]})
        if self.action_type != HomeBannerAction.ENTRY and self.entry_id is not None:
            raise ValidationError({"entry": ["条件找房或地图找房不能关联专题或指南。"]})

    def __str__(self) -> str:
        return self.title


class MiniProgramHomeEntryHouse(CreateUpdateTimeModelMixin):
    entry = models.ForeignKey(MiniProgramHomeEntry, on_delete=models.CASCADE, related_name="house_links", verbose_name="专题")
    house = models.ForeignKey("house.House", on_delete=models.CASCADE, related_name="miniprogram_home_entry_links", verbose_name="房源")
    sort_order = models.PositiveIntegerField(default=100, verbose_name="排序")
    recommendation_reason = models.CharField(max_length=120, blank=True, default="", verbose_name="推荐理由")

    class Meta:
        verbose_name = "小程序首页专题房源"
        verbose_name_plural = "小程序首页专题房源"
        ordering = ("sort_order", "id")
        constraints = [
            models.UniqueConstraint(fields=("entry", "house"), name="miniprogram_home_entry_house_unique"),
        ]

    def clean(self):
        super().clean()
        if self.entry_id and self.entry.kind != HomeEntryKind.TOPIC:
            raise ValidationError({"entry": ["只有专题活动可以关联房源。"]})

    def __str__(self) -> str:
        return f"{self.entry_id}:{self.house_id}"
