from datetime import datetime

from ninja import Schema
from pydantic import Field


class PlanOut(Schema):
    code: str
    name: str
    description: str
    purchase_mode: str
    display_order: int
    is_active: bool
    prices: list[dict]
    entitlement: dict | None


class UpgradeRecommendationResourceOut(Schema):
    resource: str
    current: int
    limit: int
    usage_percent: int


class UpgradeRecommendationOut(Schema):
    reason: str
    threshold_percent: int
    target_plan_code: str
    target_plan_name: str
    triggered_resources: list[UpgradeRecommendationResourceOut]


class CurrentSubscriptionOut(Schema):
    plan: dict
    entitlement: dict
    usage: dict
    subscription: dict | None
    recommendation: UpgradeRecommendationOut | None


class OnboardingTaskOut(Schema):
    key: str
    title: str
    description: str
    completed: bool
    completed_at: datetime | None = None
    deadline_at: datetime | None = None
    action: str


class OnboardingProgressOut(Schema):
    completed_count: int
    total_count: int
    completion_percent: int
    activated: bool
    show_guide: bool
    guide_expires_at: datetime
    trial_ends_at: datetime | None = None
    trial_days_remaining: int | None = None
    tasks: list[OnboardingTaskOut]


class SalesLeadCreateIn(Schema):
    contact_name: str = Field(..., min_length=1, max_length=64)
    contact_phone: str = Field(..., min_length=6, max_length=32)
    company_name: str = Field("", max_length=128)
    city_name: str = Field("", max_length=64)
    team_size: str = Field("", max_length=32)
    house_scale: str = Field("", max_length=32)
    needs: str = Field("", max_length=2000)
    source: str = Field("miniprogram", max_length=32)


class SalesLeadOut(Schema):
    id: int
    user_id: int | None
    organization_id: int | None
    organization_name: str
    contact_name: str
    contact_phone: str
    company_name: str
    city_name: str
    team_size: str
    house_scale: str
    needs: str
    source: str
    status: str
    admin_note: str
    assigned_to_id: int | None
    assigned_to_name: str
    last_contacted_at: datetime | None
    created_at: datetime
    updated_at: datetime


class SalesLeadPatchIn(Schema):
    status: str | None = None
    admin_note: str | None = Field(None, max_length=4000)
    assigned_to_id: int | None = None
    last_contacted_at: datetime | None = None


class PurchaseOrderIn(Schema):
    target_plan_code: str = Field(..., max_length=32)
    billing_cycle: str
    payment_mode: str
    idempotency_key: str = Field("", max_length=64)


class SaaSOrderOut(Schema):
    id: int
    organization_id: int
    organization_name: str
    organization_slug: str
    order_no: str
    order_type: str
    status: str
    close_reason: str
    target_plan_code: str
    target_plan_name: str
    billing_cycle: str
    list_amount: int
    credit_amount: int
    payable_amount: int
    expires_at: datetime
    paid_at: datetime | None
    refund_status: str
    refunded_amount: int
    refund_reason: str
    refund_proof: str
    refund_subscription_action: str
    refunded_at: datetime | None
    created_at: datetime
    payment: dict | None = None
    invoice: dict | None = None


class InvoiceProfileIn(Schema):
    invoice_type: str
    title: str = Field(..., max_length=128)
    tax_number: str = Field("", max_length=64)
    recipient_email: str
    registered_address: str = Field("", max_length=255)
    registered_phone: str = Field("", max_length=32)
    bank_name: str = Field("", max_length=128)
    bank_account: str = Field("", max_length=128)


class InvoiceProfileOut(InvoiceProfileIn):
    organization_id: int


class InvoiceRequestIn(Schema):
    order_id: int


class InvoiceRequestOut(Schema):
    id: int
    organization_id: int
    organization_name: str
    organization_slug: str
    order_id: int
    order_no: str
    target_plan_code: str
    target_plan_name: str
    status: str
    profile_snapshot: dict
    invoice_number: str
    issued_at: datetime | None
    file_url: str
    admin_note: str
    created_at: datetime


class RefundIn(Schema):
    amount: int = Field(..., gt=0)
    reason: str = Field(..., min_length=1)
    proof: str = ""
    subscription_action: str


class InvoiceProcessIn(Schema):
    status: str
    invoice_number: str = ""
    file_url: str = ""
    admin_note: str = ""
