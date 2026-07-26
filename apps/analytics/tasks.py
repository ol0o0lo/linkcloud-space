from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone

from celery import shared_task

from apps.analytics.models import AnalyticsDailyMetric, AnalyticsEvent
from apps.analytics.services import raw_start_date


def _events_for_day(day):
    tz = timezone.get_current_timezone()
    start_at = timezone.make_aware(datetime.combine(day, time.min), tz)
    end_at = start_at + timedelta(days=1)
    return AnalyticsEvent.objects.filter(occurred_at__gte=start_at, occurred_at__lt=end_at)


def rebuild_daily_metrics_for_date(day) -> None:
    """从仍存在的原始事件重建一个自然日的所有汇总维度。"""
    events = _events_for_day(day)
    AnalyticsDailyMetric.objects.filter(date=day).delete()
    rows = []

    def append_rows(scope, fields, *, all_sources=False):
        for row in events.values("organization_id", *fields).annotate(
            event_count=Count("id"),
            unique_visitors=Count("visitor_key", distinct=True, filter=~Q(visitor_key="")),
        ):
            rows.append(
                AnalyticsDailyMetric(
                    organization_id=row["organization_id"],
                    date=day,
                    source=AnalyticsDailyMetric.ALL_SOURCE if all_sources else row["source"],
                    scope=scope,
                    event_name=row.get("event_name", ""),
                    target_type=row.get("target_type", ""),
                    target_id=row.get("target_id", ""),
                    event_count=row["event_count"],
                    unique_visitors=row["unique_visitors"],
                )
            )

    append_rows(AnalyticsDailyMetric.SCOPE_ALL, ("source",))
    append_rows(AnalyticsDailyMetric.SCOPE_ALL, (), all_sources=True)
    append_rows(AnalyticsDailyMetric.SCOPE_EVENT, ("source", "event_name"))
    append_rows(AnalyticsDailyMetric.SCOPE_EVENT, ("event_name",), all_sources=True)
    append_rows(AnalyticsDailyMetric.SCOPE_TARGET, ("source", "target_type", "target_id"))
    append_rows(AnalyticsDailyMetric.SCOPE_TARGET, ("target_type", "target_id"), all_sources=True)
    append_rows(AnalyticsDailyMetric.SCOPE_TARGET_EVENT, ("source", "target_type", "target_id", "event_name"))
    append_rows(AnalyticsDailyMetric.SCOPE_TARGET_EVENT, ("target_type", "target_id", "event_name"), all_sources=True)
    AnalyticsDailyMetric.objects.bulk_create(rows, batch_size=1000)


def rollup_and_purge_analytics_events() -> int:
    """归档超过原始保留期的事件，并在同一事务内删除明细。"""
    tz = timezone.get_current_timezone()
    cutoff = timezone.make_aware(datetime.combine(raw_start_date(), time.min), tz)
    days = list(
        AnalyticsEvent.objects.filter(occurred_at__lt=cutoff)
        .annotate(day=TruncDate("occurred_at", tzinfo=tz))
        .order_by()
        .values_list("day", flat=True)
        .distinct()
    )
    deleted = 0
    for day in days:
        # ponytail: 单日事务保证汇总和清理原子；单日数据量大到超时后再加分区或进度表。
        with transaction.atomic():
            rebuild_daily_metrics_for_date(day)
            removed, _ = _events_for_day(day).delete()
            deleted += removed
    return deleted


@shared_task
def rollup_and_purge_analytics_events_task() -> int:
    """Celery 定时任务入口。"""
    return rollup_and_purge_analytics_events()
