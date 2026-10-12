from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from ninja import Schema
from pydantic import ConfigDict, Field, model_validator

from apps.allocation.schemas import AllocationRequestOut
from apps.house.constants import LeaseStatus
from apps.house.schemas.common import ContactSummaryOut, HouseSummaryOut, ViewingRecordSummaryOut


class LeaseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    tenant_id: int
    source_viewing_record_id: int | None = None
    sign_at: datetime | None = None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None = None
    payment_day: int = 1
    contract_files: list[dict[str, Any]] = Field(default_factory=list)
    notes: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)


class LeasePatchIn(Schema):
    house_id: int | None = None
    tenant_id: int | None = None
    source_viewing_record_id: int | None = None
    sign_at: datetime | None = None
    start_date: date | None = None
    end_date: date | None = None
    monthly_rent: Decimal | None = None
    deposit: Decimal | None = None
    payment_day: int | None = None
    status: str | None = None
    contract_files: list[dict[str, Any]] | None = None
    notes: str | None = None
    extra: dict[str, Any] | None = None


class LeaseOut(Schema):
    id: int
    house_id: int
    house: HouseSummaryOut
    tenant_id: int
    tenant: ContactSummaryOut
    source_viewing_record_id: int | None
    source_viewing_record: ViewingRecordSummaryOut | None
    sign_at: datetime | None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None
    payment_day: int
    status: str
    status__mapping: str
    contract_files: list[dict[str, Any]]
    notes: str
    extra: dict[str, Any]

    @staticmethod
    def resolve_status__mapping(obj):
        return LeaseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_contract_files(obj):
        return obj.contract_files_resolved


class DealSigningTenantIdentityIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=32)


class DealSigningLeaseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    tenant_id: int | None = None
    tenant_identity: DealSigningTenantIdentityIn | None = None
    source_viewing_record_id: int | None = None
    sign_at: datetime | None = None
    start_date: date
    end_date: date
    monthly_rent: Decimal
    deposit: Decimal | None = None
    payment_day: int = 1
    contract_files: list[dict[str, Any]] = Field(default_factory=list)
    notes: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_tenant_input(self):
        if (self.tenant_id is None) == (self.tenant_identity is None):
            raise ValueError("tenant_id 和 tenant_identity 必须且只能提供一个。")
        return self


class DealSigningWithAllocationIn(Schema):
    model_config = ConfigDict(extra="forbid")

    lease: DealSigningLeaseIn
    team_id: int | None = None
    beneficiary_user_ids: list[int] = Field(min_length=1)


class LeaseAllocationOut(Schema):
    id: int
    lease: LeaseOut
    allocation_request: AllocationRequestOut
    created_at: datetime


class LeaseAllocationReviewIn(Schema):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "reject"]
    reason: str = Field(default="", max_length=2000)


class LeaseAllocationVoidIn(Schema):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=2000)
