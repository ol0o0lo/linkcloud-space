import time
from datetime import date

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils.crypto import salted_hmac

from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import AnalyticsPermission
from apps.access.permissions import require_org_permission
from apps.analytics.constants import ANALYTICS_SELECTABLE_SOURCES
from apps.analytics.registry import get_event_definitions
from apps.analytics.schemas import (
    AnalyticsCollectOut,
    AnalyticsEventDefinitionOut,
    AnalyticsEventIn,
    AnalyticsEventsIn,
    AnalyticsOverviewOut,
    AnalyticsSourceDefinitionOut,
    AnalyticsTargetMetricOut,
    AnalyticsTrendPointOut,
)
from apps.analytics.services import (
    AnalyticsTargetPage,
    AnalyticsValidationError,
    normalize_date_range,
    normalize_source_filter,
    overview_metrics,
    record_event,
    target_metrics,
    trend_metrics,
)
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected

router = Router(tags=["经营分析"])


class AnalyticsTargetPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **_params) -> dict:
        if isinstance(queryset, AnalyticsTargetPage):
            return {
                "items": queryset.items,
                "total": queryset.total,
                "page": queryset.page,
                "page_size": queryset.page_size,
            }
        return super().paginate_queryset(queryset, pagination, **_params)


def _event_names(value: str | None) -> list[str] | None:
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def _enforce_public_rate_limit(request, event_count: int) -> None:
    remote_addr = request.META.get("REMOTE_ADDR", "unknown")
    identity = salted_hmac("analytics.public-rate", remote_addr).hexdigest()[:24]
    cache_key = f"analytics:public-rate:{identity}:{int(time.time() // 60)}"
    if cache.add(cache_key, event_count, timeout=70):
        count = event_count
    else:
        try:
            count = cache.incr(cache_key, event_count)
        except ValueError:
            cache.set(cache_key, event_count, timeout=70)
            count = event_count
    if count > settings.ANALYTICS_PUBLIC_EVENT_RATE_LIMIT_PER_MINUTE:
        raise HttpError(429, "行为采集请求过于频繁。")


def _collect(events: list[AnalyticsEventIn], request) -> dict:
    actor = request.user if getattr(request.user, "is_authenticated", False) else None
    accepted = 0
    duplicates = 0
    event_ids = []
    errors = []
    with transaction.atomic():
        for index, payload in enumerate(events):
            try:
                event, created = record_event(
                    payload.event_name,
                    target_type=payload.target_type,
                    target_id=payload.target_id,
                    actor=actor,
                    source=payload.source,
                    anonymous_id=payload.anonymous_id,
                    session_id=payload.session_id,
                    occurred_at=payload.occurred_at,
                    properties=payload.properties,
                    idempotency_key=payload.idempotency_key,
                    public=True,
                    client=True,
                )
            except AnalyticsValidationError as exc:
                errors.append({"index": index, "event_name": payload.event_name, "message": str(exc)})
                continue
            event_ids.append(event.pk)
            if created:
                accepted += 1
            else:
                duplicates += 1
    return {"accepted": accepted, "duplicates": duplicates, "event_ids": event_ids, "errors": errors}


@router.get("/definitions/", response=list[AnalyticsEventDefinitionOut], summary="获取事件定义")
def list_definitions(request):
    require_org_selected(request)
    return [
        {
            "key": definition.key,
            "label": definition.label,
            "target_types": list(definition.target_types),
            "allow_anonymous": definition.allow_anonymous,
            "client_collectible": definition.client_collectible,
        }
        for definition in get_event_definitions()
    ]


@router.get("/sources/", response=list[AnalyticsSourceDefinitionOut], summary="获取分析来源")
def list_sources(request):
    require_org_permission(request, AnalyticsPermission.VIEW)
    return [{"value": source.value, "label": source.label} for source in ANALYTICS_SELECTABLE_SOURCES]


@router.post("/events/", auth=None, response=AnalyticsCollectOut, summary="批量采集行为事件")
def collect_events(request, payload: AnalyticsEventsIn):
    if not payload.events or len(payload.events) > 50:
        raise HttpError(422, "events 数量必须在 1 到 50 之间。")
    _enforce_public_rate_limit(request, len(payload.events))
    return _collect(payload.events, request)


@router.get("/overview/", response=AnalyticsOverviewOut, summary="获取经营分析概览")
def get_overview(request, start_date: date | None = Query(None), end_date: date | None = Query(None), source: str | None = Query(None)):
    org = require_org_permission(request, AnalyticsPermission.VIEW)
    try:
        start_date, end_date = normalize_date_range(start_date, end_date)
        source = normalize_source_filter(source)
    except AnalyticsValidationError as exc:
        raise HttpError(422, str(exc)) from exc
    return overview_metrics(org, start_date, end_date, source)


@router.get("/trends/", response=list[AnalyticsTrendPointOut], summary="获取经营指标趋势")
def get_trends(
    request,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    source: str | None = Query(None),
    event_names: str | None = Query(None, description="逗号分隔的事件名称。"),
):
    org = require_org_permission(request, AnalyticsPermission.VIEW)
    try:
        start_date, end_date = normalize_date_range(start_date, end_date)
        source = normalize_source_filter(source)
        return trend_metrics(org, start_date, end_date, source, _event_names(event_names))
    except AnalyticsValidationError as exc:
        raise HttpError(422, str(exc)) from exc


@router.get("/targets/", response=list[AnalyticsTargetMetricOut], summary="获取分析目标排行")
@paginate(AnalyticsTargetPagination, pass_parameter="pagination_info")  # noqa: S106 - 参数名，不是凭据
def get_targets(
    request,
    pagination_info: LegacyPagination.Input | None = None,
    target_type: str = Query(...),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    source: str | None = Query(None),
    event_names: str | None = Query(None, description="逗号分隔的事件名称。"),
):
    org = require_org_permission(request, AnalyticsPermission.VIEW)
    try:
        start_date, end_date = normalize_date_range(start_date, end_date)
        source = normalize_source_filter(source)
        pagination_info = pagination_info or LegacyPagination.Input()
        page = max(pagination_info.page, 1)
        page_size = pagination_info.page_size or AnalyticsTargetPagination.default_page_size
        page_size = max(1, min(page_size, AnalyticsTargetPagination.max_page_size))
        return target_metrics(
            org,
            start_date,
            end_date,
            target_type,
            source,
            _event_names(event_names),
            page=page,
            page_size=page_size,
        )
    except AnalyticsValidationError as exc:
        raise HttpError(422, str(exc)) from exc
