from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from ninja import Schema
from pydantic import ConfigDict, Field, model_validator

from apps.allocation.schemas import AllocationRequestOut
from apps.house.constants import LeaseStatus
from apps.house.schemas.common import ContactSummaryOut, HouseSummaryOut, ViewingRecordSummaryOut


def _can_maintain_in_response(lease, context):
    from apps.house.services.leases import can_maintain_lease

    request = context.get("request") if context else None
    if request is None:
        return False
    permissions = context.setdefault("lease_maintenance", {})
    if lease.pk not in permissions:
        permissions[lease.pk] = can_maintain_lease(lease, actor=request.user, organization=lease.organization)
    return permissions[lease.pk]


class LeaseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    tenant_id: int
    source_inquiry_id: int | None = None
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
    model_config = ConfigDict(extra="forbid")
    deal_team_id: int | None = None
    source_inquiry_id: int | None = None
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
    source_inquiry_id: int | None
    registered_by_id: int | None
    deal_team_id: int | None
    deal_team_name_snapshot: str
    performance_month: date | None
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
    can_maintain: bool

    @staticmethod
    def resolve_status__mapping(obj):
        return LeaseStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_can_maintain(obj, context):
        return _can_maintain_in_response(obj, context)

    @staticmethod
    def resolve_contract_files(obj, context):
        return obj.contract_files_resolved if _can_maintain_in_response(obj, context) else []

    @staticmethod
    def resolve_notes(obj, context):
        return obj.notes if _can_maintain_in_response(obj, context) else ""

    @staticmethod
    def resolve_extra(obj, context):
        return obj.extra if _can_maintain_in_response(obj, context) else {}


class DealSigningTenantIdentityIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=1, max_length=32)


class DealSigningLeaseIn(Schema):
    model_config = ConfigDict(extra="forbid")

    house_id: int
    source_inquiry_id: int | None = None
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


class RegisterSigningIn(Schema):
    model_config = ConfigDict(extra="forbid")
    lease: DealSigningLeaseIn
    source_inquiry_id: int | None = None
    team_id: int | None = None
    client_request_id: str = Field(min_length=1, max_length=100)


class LeaseAllocationSubmitIn(Schema):
    model_config = ConfigDict(extra="forbid")
    beneficiary_user_ids: list[int] | None = None
    client_request_id: str = Field(min_length=1, max_length=100)
    mode: Literal["initial", "resubmit", "correction"] = "initial"
    previous_request_id: int | None = None
    reason: str = Field(default="", max_length=2000)
    preview_hash: str | None = Field(default=None, max_length=64, description="首次申请和纠错重提必须提交预览返回的确认标识；普通重提不需要。")


class LeaseAllocationPreviewIn(Schema):
    model_config = ConfigDict(extra="forbid")
    mode: Literal["initial", "correction"] = "initial"
    previous_request_id: int | None = None


class LeaseAllocationPreviewOut(Schema):
    basis_amount: Decimal
    distributable_amount: Decimal
    distribution_method: str
    distribution_rate_bp: int | None
    rule_source: str
    team_id: int | None
    team_name: str
    performance_month: date
    preview_hash: str


class LeaseAllocationOut(Schema):
    id: int
    lease: LeaseOut
    allocation_request: AllocationRequestOut
    created_at: datetime
    mode: str
    previous_request_id: int | None
    reason: str


class LeaseAllocationReviewIn(Schema):
    model_config = ConfigDict(extra="forbid")

    decision: Literal["approve", "reject"]
    reason: str = Field(default="", max_length=2000)
    request_id: int | None = None


class LeaseAllocationVoidIn(Schema):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=2000)
    request_id: int | None = None


class LeaseAllocationWithdrawIn(Schema):
    model_config = ConfigDict(extra="forbid")
    reason: str = Field(default="申请人撤回后修改成交信息。", min_length=1, max_length=2000)
