from datetime import date, datetime
from typing import Any

from ninja import Schema
from pydantic import Field


class AnalyticsEventIn(Schema):
    event_name: str = Field(..., max_length=96)
    target_type: str = Field(..., max_length=64)
    target_id: str | int
    source: str = Field("h5", max_length=32)
    anonymous_id: str = Field("", max_length=256)
    session_id: str = Field("", max_length=256)
    occurred_at: datetime | None = None
    properties: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str = Field("", max_length=128)


class AnalyticsEventsIn(Schema):
    events: list[AnalyticsEventIn]


class AnalyticsCollectErrorOut(Schema):
    index: int
    event_name: str
    message: str


class AnalyticsCollectOut(Schema):
    accepted: int
    duplicates: int
    event_ids: list[int]
    errors: list[AnalyticsCollectErrorOut]


class AnalyticsEventDefinitionOut(Schema):
    key: str
    label: str
    target_types: list[str]
    allow_anonymous: bool
    client_collectible: bool


class AnalyticsMetricOut(Schema):
    event_name: str
    label: str
    count: int
    unique_visitors: int


class AnalyticsOverviewOut(Schema):
    start_date: date
    end_date: date
    total_events: int
    unique_visitors: int
    metrics: list[AnalyticsMetricOut]


class AnalyticsTrendPointOut(Schema):
    date: date
    event_name: str
    count: int
    unique_visitors: int


class AnalyticsTargetDisplayItemOut(Schema):
    target_type: str
    target_id: str
    label: str


class AnalyticsTargetMetricOut(Schema):
    target_id: str
    label: str
    display_items: list[AnalyticsTargetDisplayItemOut]
    total: int
    unique_visitors: int
    metrics: dict[str, int]
