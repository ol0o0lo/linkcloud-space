import json
import logging
import re
from datetime import date, datetime, timedelta
from typing import Any

from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist
from django.db import IntegrityError
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.analytics.models import AnalyticsEvent
from apps.analytics.registry import (
    AnalyticsEventDefinition,
    get_event_definition,
    get_event_definitions,
    get_target_definition,
    resolve_path,
)

KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_.-]*$")
logger = logging.getLogger(__name__)


class AnalyticsValidationError(ValueError):
    pass


def _hash_identifier(namespace: str, value: str) -> str:
    return salted_hmac(f"analytics.{namespace}", value).hexdigest()


def _visitor_values(actor, anonymous_id: str, session_id: str) -> tuple[str, str, str]:
    anonymous_hash = _hash_identifier("anonymous", anonymous_id) if anonymous_id else ""
    session_hash = _hash_identifier("session", session_id) if session_id else ""
    if actor is not None and getattr(actor, "is_authenticated", False):
        visitor_key = f"user:{actor.pk}"
    elif anonymous_hash:
        visitor_key = f"anonymous:{anonymous_hash}"
    elif session_hash:
        visitor_key = f"session:{session_hash}"
    else:
        visitor_key = ""
    return anonymous_hash, session_hash, visitor_key


def _validate_key(value: str, field: str, max_length: int) -> str:
    value = (value or "").strip().lower()
    if not value or len(value) > max_length or not KEY_PATTERN.fullmatch(value):
        raise AnalyticsValidationError(f"{field} 格式不正确。")
    return value


def _validate_properties(definition: AnalyticsEventDefinition, properties: dict[str, Any] | None) -> dict[str, Any]:
    properties = properties or {}
    if not isinstance(properties, dict):
        raise AnalyticsValidationError("properties 必须是对象。")
    unknown = sorted(set(properties) - set(definition.property_keys))
    if unknown:
        raise AnalyticsValidationError(f"事件 {definition.key} 不支持属性：{', '.join(unknown)}。")
    if len(json.dumps(properties, ensure_ascii=False, default=str).encode()) > settings.ANALYTICS_MAX_PROPERTIES_BYTES:
        raise AnalyticsValidationError("properties 数据过大。")
    return properties


def _normalize_occurred_at(value: datetime | None) -> datetime:
    now = timezone.now()
    value = value or now
    if timezone.is_naive(value):
        value = timezone.make_aware(value, timezone.get_current_timezone())
    if value > now + timedelta(minutes=5):
        raise AnalyticsValidationError("事件时间不能晚于当前时间。")
    if value < now - timedelta(days=settings.ANALYTICS_MAX_EVENT_AGE_DAYS):
        raise AnalyticsValidationError("事件时间超过允许补报范围。")
    return value


def resolve_target(*, target_type: str, target_id: str | int, public: bool):
    target_type = _validate_key(target_type, "target_type", 64)
    target_definition = get_target_definition(target_type)
    if target_definition is None:
        raise AnalyticsValidationError(f"未注册的目标类型：{target_type}。")
    filters: dict[str, Any] = {"pk": target_id}
    if public:
        filters.update(target_definition.public_filters)
    try:
        target = target_definition.model_class.objects.select_related().get(**filters)
    except (ObjectDoesNotExist, ValueError, TypeError) as exc:
        raise AnalyticsValidationError("分析目标不存在或不可采集。") from exc
    organization = resolve_path(target, target_definition.organization_path)
    return target_type, target_definition, target, organization


def record_event(
    event_name: str,
    *,
    target_type: str,
    target_id: str | int,
    organization=None,
    actor=None,
    source: str,
    anonymous_id: str = "",
    session_id: str = "",
    occurred_at: datetime | None = None,
    properties: dict[str, Any] | None = None,
    idempotency_key: str = "",
    public: bool = False,
    client: bool = False,
) -> tuple[AnalyticsEvent, bool]:
    """记录一个事件并返回 ``(event, created)``；调用方无需接触模型。"""
    event_name = _validate_key(event_name, "event_name", 96)
    source = _validate_key(source, "source", 32)
    definition = get_event_definition(event_name)
    if definition is None:
        raise AnalyticsValidationError(f"未注册的事件：{event_name}。")
    if client and not definition.client_collectible:
        raise AnalyticsValidationError(f"事件 {event_name} 只能由服务端业务产生。")
    if public and not definition.allow_anonymous:
        raise AnalyticsValidationError(f"事件 {event_name} 不允许匿名采集。")
    if public and source not in settings.ANALYTICS_PUBLIC_SOURCES:
        raise AnalyticsValidationError(f"公开采集不支持来源：{source}。")

    target_type, _target_definition, target, target_org = resolve_target(target_type=target_type, target_id=target_id, public=public)
    if target_type not in definition.target_types:
        raise AnalyticsValidationError(f"事件 {event_name} 不支持目标类型 {target_type}。")
    if organization is not None and target_org.pk != organization.pk:
        raise AnalyticsValidationError("分析目标不属于当前组织。")
    organization = target_org

    occurred_at = _normalize_occurred_at(occurred_at)
    properties = _validate_properties(definition, properties)
    anonymous_hash, session_hash, visitor_key = _visitor_values(actor, anonymous_id[:256], session_id[:256])
    idempotency_key = (idempotency_key or "").strip()[:128]

    if idempotency_key:
        existing = AnalyticsEvent.objects.filter(organization=organization, source=source, idempotency_key=idempotency_key).first()
        if existing is not None:
            return existing, False

    if definition.deduplicate_seconds and visitor_key:
        existing = (
            AnalyticsEvent.objects.filter(
                organization=organization,
                event_name=event_name,
                target_type=target_type,
                target_id=str(target.pk),
                source=source,
                visitor_key=visitor_key,
                received_at__gte=timezone.now() - timedelta(seconds=definition.deduplicate_seconds),
            )
            .order_by("-received_at")
            .first()
        )
        if existing is not None:
            return existing, False

    try:
        event = AnalyticsEvent.objects.create(
            organization=organization,
            actor=actor if actor is not None and getattr(actor, "is_authenticated", False) else None,
            event_name=event_name,
            target_type=target_type,
            target_id=str(target.pk),
            source=source,
            anonymous_id_hash=anonymous_hash,
            session_id_hash=session_hash,
            visitor_key=visitor_key,
            properties=properties,
            idempotency_key=idempotency_key,
            occurred_at=occurred_at,
        )
    except IntegrityError:
        if idempotency_key:
            existing = AnalyticsEvent.objects.get(organization=organization, source=source, idempotency_key=idempotency_key)
            return existing, False
        raise
    return event, True


def record_event_safely(event_name: str, **kwargs) -> tuple[AnalyticsEvent, bool] | None:
    """监听器尽力采集；分析故障不能影响业务事务。"""
    try:
        return record_event(event_name, **kwargs)
    except Exception:
        logger.exception("Failed to record analytics event %s", event_name)
        return None


def track_event(event_name: str, *, target, actor=None, source: str = "server", properties=None, idempotency_key: str = "") -> tuple[AnalyticsEvent, bool]:
    """供后端业务模块使用的最小采集接口。"""
    event_definition = get_event_definition(event_name)
    matching_target = None
    for target_type in event_definition.target_types if event_definition else ():
        definition = get_target_definition(target_type)
        if definition and isinstance(target, definition.model_class):
            matching_target = target_type
            break
    if matching_target is None:
        raise AnalyticsValidationError(f"事件 {event_name} 与目标模型不匹配。")
    organization = resolve_path(target, get_target_definition(matching_target).organization_path)
    return record_event(
        event_name,
        target_type=matching_target,
        target_id=target.pk,
        organization=organization,
        actor=actor,
        source=source,
        properties=properties,
        idempotency_key=idempotency_key,
    )


def track_event_safely(event_name: str, **kwargs) -> tuple[AnalyticsEvent, bool] | None:
    """业务侧尽力采集；分析故障不能阻断核心业务事务。"""
    try:
        return track_event(event_name, **kwargs)
    except Exception:
        logger.exception("Failed to track analytics event %s", event_name)
        return None


def normalize_date_range(start_date: date | None, end_date: date | None) -> tuple[date, date]:
    end_date = end_date or timezone.localdate()
    start_date = start_date or end_date - timedelta(days=29)
    if start_date > end_date:
        raise AnalyticsValidationError("开始日期不能晚于结束日期。")
    if (end_date - start_date).days > settings.ANALYTICS_MAX_QUERY_DAYS:
        raise AnalyticsValidationError(f"查询范围不能超过 {settings.ANALYTICS_MAX_QUERY_DAYS} 天。")
    return start_date, end_date


def event_queryset(organization, start_date: date, end_date: date, source: str | None = None):
    tz = timezone.get_current_timezone()
    start_at = timezone.make_aware(datetime.combine(start_date, datetime.min.time()), tz)
    end_at = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()), tz)
    qs = AnalyticsEvent.objects.filter(organization=organization, occurred_at__gte=start_at, occurred_at__lt=end_at)
    if source:
        qs = qs.filter(source=source)
    return qs


def overview_metrics(organization, start_date: date, end_date: date, source: str | None = None) -> dict:
    qs = event_queryset(organization, start_date, end_date, source)
    grouped = {
        row["event_name"]: row
        for row in qs.values("event_name").annotate(
            count=Count("id"),
            unique_visitors=Count("visitor_key", distinct=True, filter=~Q(visitor_key="")),
        )
    }
    metrics = [
        {
            "event_name": definition.key,
            "label": definition.label,
            "count": grouped.get(definition.key, {}).get("count", 0),
            "unique_visitors": grouped.get(definition.key, {}).get("unique_visitors", 0),
        }
        for definition in get_event_definitions()
    ]
    totals = qs.aggregate(count=Count("id"), unique_visitors=Count("visitor_key", distinct=True, filter=~Q(visitor_key="")))
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_events": totals["count"],
        "unique_visitors": totals["unique_visitors"],
        "metrics": metrics,
    }


def trend_metrics(organization, start_date: date, end_date: date, source: str | None = None, event_names: list[str] | None = None) -> list[dict]:
    definitions = get_event_definitions()
    selected = event_names or [definition.key for definition in definitions]
    allowed = {definition.key for definition in definitions}
    unknown = sorted(set(selected) - allowed)
    if unknown:
        raise AnalyticsValidationError(f"未注册的事件：{', '.join(unknown)}。")
    rows = (
        event_queryset(organization, start_date, end_date, source)
        .filter(event_name__in=selected)
        .annotate(date=TruncDate("occurred_at"))
        .values("date", "event_name")
        .annotate(count=Count("id"), unique_visitors=Count("visitor_key", distinct=True, filter=~Q(visitor_key="")))
    )
    values = {(row["date"], row["event_name"]): row for row in rows}
    result = []
    current = start_date
    while current <= end_date:
        for event_name in selected:
            row = values.get((current, event_name), {})
            result.append({"date": current, "event_name": event_name, "count": row.get("count", 0), "unique_visitors": row.get("unique_visitors", 0)})
        current += timedelta(days=1)
    return result


def target_metrics(organization, start_date: date, end_date: date, target_type: str, source: str | None = None, event_names: list[str] | None = None) -> list[dict]:
    target_definition = get_target_definition(target_type)
    if target_definition is None:
        raise AnalyticsValidationError(f"未注册的目标类型：{target_type}。")
    qs = event_queryset(organization, start_date, end_date, source).filter(target_type=target_type)
    if event_names:
        qs = qs.filter(event_name__in=event_names)
    totals = qs.values("target_id").annotate(total=Count("id"), unique_visitors=Count("visitor_key", distinct=True, filter=~Q(visitor_key="")))
    grouped = qs.values("target_id", "event_name").annotate(count=Count("id"))
    by_target: dict[str, dict] = {row["target_id"]: {"metrics": {}, "total": row["total"], "unique_visitors": row["unique_visitors"]} for row in totals}
    for row in grouped:
        item = by_target[row["target_id"]]
        item["metrics"][row["event_name"]] = row["count"]

    target_ids = list(by_target)
    targets = target_definition.model_class.objects.filter(pk__in=target_ids, **{target_definition.organization_filter: organization})
    if target_definition.ranking_select_related:
        targets = targets.select_related(*target_definition.ranking_select_related)
    labels = {}
    display_items = {}
    for target in targets:
        labels[str(target.pk)] = str(target)
        display_items[str(target.pk)] = [
            {
                "target_type": item.target_type,
                "target_id": str(target_id),
                "label": str(label),
            }
            for item in target_definition.ranking_display
            if (target_id := resolve_path(target, item.target_id_path)) is not None and (label := resolve_path(target, item.label_path)) is not None
        ]
    return sorted(
        (
            {
                "target_id": target_id,
                "label": labels.get(target_id, f"{target_definition.label} #{target_id}"),
                "display_items": display_items.get(target_id, []),
                **values,
            }
            for target_id, values in by_target.items()
        ),
        key=lambda item: (-item["total"], item["target_id"]),
    )
