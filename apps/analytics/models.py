from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.analytics.constants import AnalyticsSource


class AnalyticsEvent(models.Model):
    """不可变的通用业务行为事件。"""

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="analytics_events",
        verbose_name="所属组织",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
        verbose_name="操作人",
    )
    event_name = models.CharField(max_length=96, verbose_name="事件名称")
    target_type = models.CharField(max_length=64, verbose_name="目标类型")
    target_id = models.CharField(max_length=64, verbose_name="目标标识")
    source = models.CharField(max_length=32, choices=AnalyticsSource.choices, verbose_name="来源")
    anonymous_id_hash = models.CharField(max_length=64, blank=True, verbose_name="匿名用户标识哈希")
    session_id_hash = models.CharField(max_length=64, blank=True, verbose_name="会话标识哈希")
    visitor_key = models.CharField(max_length=80, blank=True, verbose_name="访客标识")
    properties = models.JSONField(default=dict, blank=True, verbose_name="事件属性")
    idempotency_key = models.CharField(max_length=128, blank=True, verbose_name="幂等键")
    occurred_at = models.DateTimeField(verbose_name="发生时间")
    received_at = models.DateTimeField(auto_now_add=True, verbose_name="接收时间")

    class Meta:
        verbose_name = "分析事件"
        verbose_name_plural = "分析事件"
        ordering = ("-occurred_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "source", "idempotency_key"),
                condition=~Q(idempotency_key=""),
                name="analytics_event_idempotency_uniq",
            ),
            models.CheckConstraint(
                condition=Q(source__in=AnalyticsSource.values),
                name="analytics_event_source_valid",
            ),
        ]
        indexes = [
            models.Index(fields=("organization", "event_name", "occurred_at"), name="ana_org_event_time_idx"),
            models.Index(fields=("organization", "target_type", "target_id", "occurred_at"), name="ana_org_target_time_idx"),
            models.Index(fields=("organization", "source", "occurred_at"), name="ana_org_source_time_idx"),
            models.Index(fields=("organization", "visitor_key", "occurred_at"), name="ana_org_visitor_time_idx"),
        ]

    def __str__(self):
        """返回事件与分析目标的可读标识。"""
        return f"{self.event_name}: {self.target_type}/{self.target_id}"


class AnalyticsDailyMetric(models.Model):
    """按系统时区汇总的历史行为指标。"""

    ALL_SOURCE = ""
    SCOPE_ALL = "all"
    SCOPE_EVENT = "event"
    SCOPE_TARGET = "target"
    SCOPE_TARGET_EVENT = "target_event"

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="analytics_daily_metrics",
        verbose_name="所属组织",
    )
    date = models.DateField(verbose_name="日期")
    source = models.CharField(max_length=32, choices=AnalyticsSource.choices, blank=True, verbose_name="来源")
    scope = models.CharField(max_length=16, verbose_name="作用域")
    event_name = models.CharField(max_length=96, blank=True, verbose_name="事件名称")
    target_type = models.CharField(max_length=64, blank=True, verbose_name="目标类型")
    target_id = models.CharField(max_length=64, blank=True, verbose_name="目标标识")
    event_count = models.PositiveBigIntegerField(verbose_name="事件数量")
    unique_visitors = models.PositiveBigIntegerField(verbose_name="独立访客数")

    class Meta:
        verbose_name = "每日分析指标"
        verbose_name_plural = "每日分析指标"
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "source", "scope", "date", "event_name", "target_type", "target_id"),
                name="analytics_daily_metric_uniq",
            ),
            models.CheckConstraint(
                condition=Q(source="") | Q(source__in=AnalyticsSource.values),
                name="analytics_daily_source_valid",
            ),
        ]

    def __str__(self):
        """返回每日指标的可读标识。"""
        return f"{self.date}: {self.scope}"
