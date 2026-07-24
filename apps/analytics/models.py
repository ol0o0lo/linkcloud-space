from django.conf import settings
from django.db import models
from django.db.models import Q


class AnalyticsEvent(models.Model):
    """不可变的通用业务行为事件。"""

    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="analytics_events",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
    )
    event_name = models.CharField(max_length=96)
    target_type = models.CharField(max_length=64)
    target_id = models.CharField(max_length=64)
    source = models.CharField(max_length=32)
    anonymous_id_hash = models.CharField(max_length=64, blank=True)
    session_id_hash = models.CharField(max_length=64, blank=True)
    visitor_key = models.CharField(max_length=80, blank=True)
    properties = models.JSONField(default=dict, blank=True)
    idempotency_key = models.CharField(max_length=128, blank=True)
    occurred_at = models.DateTimeField()
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-occurred_at", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "source", "idempotency_key"),
                condition=~Q(idempotency_key=""),
                name="analytics_event_idempotency_uniq",
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
