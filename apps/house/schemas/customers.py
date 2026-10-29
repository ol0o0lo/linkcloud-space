from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from django.utils import timezone

from ninja import Schema
from pydantic import ConfigDict, Field, field_validator

CustomerStageValue = Literal["new", "contacted", "viewing", "negotiating", "won", "lost"]


class CustomerPatchIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=32)
    email: str | None = None
    notes: str | None = None
    is_active: bool | None = None
    stage: CustomerStageValue | None = None
    assigned_to_id: int | None = None
    source: str | None = Field(None, max_length=100)
    wechat: str | None = Field(None, max_length=100)
    min_rent: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)
    max_rent: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)
    preferred_region: str | None = Field(None, max_length=255)
    bedrooms: int | None = Field(None, ge=0, le=32767)
    move_in_date: date | None = None


class CustomerIn(CustomerPatchIn):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=1, max_length=32)


class CustomerOut(Schema):
    id: int
    name: str
    phone: str
    email: str
    notes: str
    is_active: bool
    stage: str
    stage_label: str
    assigned_to_id: int | None
    assigned_to_name: str
    source: str
    wechat: str
    min_rent: str | None
    max_rent: str | None
    preferred_region: str
    bedrooms: int | None
    move_in_date: date | None


class CustomerFollowUpIn(Schema):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(..., min_length=1, max_length=10000)
    stage: CustomerStageValue | None = None
    next_follow_up_at: datetime | None = None

    @field_validator("next_follow_up_at")
    @classmethod
    def aware_follow_up_at(cls, value):
        return timezone.make_aware(value) if value and timezone.is_naive(value) else value


class CustomerFollowUpOut(Schema):
    id: int
    content: str
    created_at: datetime
    created_by_name: str
    stage: str
    next_follow_up_at: datetime | None

    @staticmethod
    def resolve_created_by_name(obj):
        return (obj.created_by.get_full_name() or obj.created_by.username) if obj.created_by_id else ""


class CustomerInquiryConvertIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(None, max_length=100)
    phone: str | None = Field(None, max_length=32)


class CustomerWorkbenchItemOut(Schema):
    inquiry_id: int
    house_id: int
    customer_name: str
    phone: str
    status: str


class CustomerWorkbenchOut(Schema):
    new_customers: int
    new_inquiries: int
    today_viewings: int
    unassigned_viewings: int
    pending_allocations: int
    items: list[CustomerWorkbenchItemOut]
