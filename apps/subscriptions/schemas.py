from datetime import datetime

from ninja import Schema
from pydantic import Field


class PlanOut(Schema):
    code: str
    name: str
    description: str
    display_order: int
    is_active: bool
    prices: list[dict]
    entitlement: dict | None


class CurrentSubscriptionOut(Schema):
    plan: dict
    entitlement: dict
    usage: dict
    subscription: dict | None


class PurchaseOrderIn(Schema):
    target_plan_code: str = Field(..., max_length=32)
    billing_cycle: str
    payment_mode: str


class SaaSOrderOut(Schema):
    id: int
    order_no: str
    order_type: str
    status: str
    close_reason: str
    target_plan_code: str
    billing_cycle: str
    list_amount: int
    credit_amount: int
    payable_amount: int
    expires_at: datetime
    paid_at: datetime | None
    refund_status: str
    refunded_amount: int
    created_at: datetime
    payment: dict | None = None


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
    order_id: int
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
