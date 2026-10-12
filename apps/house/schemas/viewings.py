from __future__ import annotations

from datetime import datetime
from typing import Any

from django.utils import timezone

from ninja import Schema
from pydantic import ConfigDict, field_validator

from apps.house.constants import ViewingRecordStatus
from apps.house.schemas.common import ContactSummaryOut, HouseSummaryOut


class ViewingRecordIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    contact_id: int | None = None
    customer_name: str
    customer_phone: str
    scheduled_at: datetime
    assigned_to_id: int | None = None
    notes: str = ""

    @field_validator("scheduled_at")
    @classmethod
    def validate_scheduled_at(cls, value: datetime) -> datetime:
        if value <= timezone.now():
            raise ValueError("预约时间必须晚于当前时间")
        return value


class ViewingRecordPatchIn(Schema):
    house_id: int | None = None
    contact_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    scheduled_at: datetime | None = None
    viewed_at: datetime | None = None
    status: str | None = None
    assigned_to_id: int | None = None
    notes: str | None = None
    extra: dict[str, Any] | None = None
    is_active: bool | None = None


class ViewingRecordOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    contact_id: int | None
    contact: ContactSummaryOut | None
    customer_name: str
    customer_phone: str
    scheduled_at: datetime
    viewed_at: datetime | None
    status: str
    status__mapping: str
    assigned_to_id: int | None
    notes: str
    extra: dict[str, Any]
    is_active: bool
    signed_lease_id: int | None = None

    @staticmethod
    def resolve_status__mapping(obj):
        return ViewingRecordStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_signed_lease_id(obj):
        return getattr(obj, "signed_lease_id", None)
