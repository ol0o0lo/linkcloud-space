from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal

from ninja import Field, Schema
from pydantic import ConfigDict

from apps.allocation.constants import AccrualEntryType, AllocationDistributionMethod, AllocationItemEffect, AllocationRequestStatus, AllocationRuleSource


class AllocationSigningTeamOut(Schema):
    id: int
    name: str


class AllocationCapabilitiesOut(Schema):
    submit: bool
    change_beneficiaries: bool
    view_scope: Literal["self", "organization"]
    review: bool
    adjust: bool
    void: bool
    signing_teams: list[AllocationSigningTeamOut]


class AllocationBeneficiaryOut(Schema):
    user_id: int
    name: str


class AllocationItemIn(Schema):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    effect: Literal[AllocationItemEffect.INCREASE, AllocationItemEffect.DECREASE]
    amount: Decimal = Field(gt=0)
    sort_order: int = Field(default=0, ge=0, le=32767)
    remark: str = Field(default="", max_length=255)


class AllocationShareIn(Schema):
    model_config = ConfigDict(extra="forbid")

    beneficiary_user_id: int
    weight_bp: int = Field(ge=1, le=10000, description="受益人权重，10000 表示 100%。")
    allocated_amount: Decimal | None = Field(default=None, ge=0, description="不填写时由服务端按权重计算；如填写，所有受益人都必须填写。")
    sort_order: int = Field(default=0, ge=0, le=32767)
    remark: str = Field(default="", max_length=255)


class AllocationPlanIn(Schema):
    model_config = ConfigDict(extra="forbid")

    distribution_method: Literal[AllocationDistributionMethod.PERCENTAGE, AllocationDistributionMethod.FIXED]
    distribution_rate_bp: int | None = Field(default=None, ge=0, le=10000, description="比例模式使用，10000 表示 100%。")
    distributable_amount: Decimal | None = Field(default=None, ge=0, description="固定模式使用；比例模式由服务端计算。")
    items: list[AllocationItemIn] = Field(min_length=1)
    shares: list[AllocationShareIn] = Field(min_length=1)


class AllocationItemOut(Schema):
    id: int
    name: str
    effect: str
    effect__mapping: str
    amount: Decimal
    sort_order: int
    remark: str

    @staticmethod
    def resolve_effect__mapping(obj):
        return AllocationItemEffect.get_choice_label(obj.effect)


class AllocationShareOut(Schema):
    id: int
    beneficiary_user_id: int
    beneficiary_name_snapshot: str
    weight_bp: int
    attributed_basis_amount: Decimal
    allocated_amount: Decimal
    sort_order: int
    remark: str


class AllocationRequestOut(Schema):
    id: int
    organization_id: int
    team_id: int | None
    team_name_snapshot: str
    rule_source: str
    rule_source__mapping: str
    status: str
    status__mapping: str
    basis_amount: Decimal
    distribution_method: str
    distribution_method__mapping: str
    distribution_rate_bp: int | None
    distributable_amount: Decimal
    currency: str
    source_snapshot: dict[str, Any]
    submitted_by_id: int
    submitted_by_name_snapshot: str
    submitted_at: datetime
    expires_at: datetime
    reviewed_by_id: int | None
    reviewed_by_name_snapshot: str
    reviewed_at: datetime | None
    rejection_reason: str
    voided_by_id: int | None
    voided_by_name_snapshot: str
    voided_at: datetime | None
    void_reason: str
    items: list[AllocationItemOut]
    shares: list[AllocationShareOut]
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_status__mapping(obj):
        return AllocationRequestStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_distribution_method__mapping(obj):
        return AllocationDistributionMethod.get_choice_label(obj.distribution_method)

    @staticmethod
    def resolve_rule_source__mapping(obj):
        return AllocationRuleSource.get_choice_label(obj.rule_source)

    @staticmethod
    def resolve_items(obj):
        return obj.items.all()

    @staticmethod
    def resolve_shares(obj):
        return obj.shares.all()


class ManualAccrualEntryIn(Schema):
    model_config = ConfigDict(extra="forbid")

    beneficiary_user_id: int
    entry_type: Literal[AccrualEntryType.MANUAL_INCREASE, AccrualEntryType.MANUAL_DECREASE]
    amount: Decimal = Field(gt=0)
    effective_month: date
    reason: str = Field(min_length=1, max_length=2000)


class AccrualEntryOut(Schema):
    id: int
    organization_id: int
    beneficiary_user_id: int
    beneficiary_name_snapshot: str
    entry_type: str
    entry_type__mapping: str
    amount: Decimal
    currency: str
    effective_at: datetime
    effective_month: date
    allocation_share_id: int | None
    allocation_request_id: int | None
    reversal_of_id: int | None
    reversal_entry_id: int | None
    reason: str
    created_by_id: int
    created_by_name: str
    created_at: datetime
    source_snapshot: dict[str, Any] | None

    @staticmethod
    def resolve_entry_type__mapping(obj):
        return AccrualEntryType.get_choice_label(obj.entry_type)

    @staticmethod
    def resolve_allocation_request_id(obj):
        if obj.allocation_share_id:
            return obj.allocation_share.allocation_request_id
        if obj.reversal_of_id and obj.reversal_of.allocation_share_id:
            return obj.reversal_of.allocation_share.allocation_request_id
        return None

    @staticmethod
    def resolve_source_snapshot(obj):
        if obj.allocation_share_id:
            return obj.allocation_share.allocation_request.source_snapshot
        if obj.reversal_of_id and obj.reversal_of.allocation_share_id:
            return obj.reversal_of.allocation_share.allocation_request.source_snapshot
        return None

    @staticmethod
    def resolve_reversal_entry_id(obj):
        reversal = getattr(obj, "reversal", None)
        return reversal.pk if reversal else None

    @staticmethod
    def resolve_created_by_name(obj):
        return (obj.created_by.get_full_name() or obj.created_by.username or f"用户{obj.created_by_id}").strip()


class MonthlyAccrualTotalOut(Schema):
    beneficiary_user_id: int
    beneficiary_name_snapshot: str
    effective_month: date
    allocation_amount: Decimal
    manual_increase_amount: Decimal
    manual_decrease_amount: Decimal
    reversal_amount: Decimal
    total_amount: Decimal
    entry_count: int
