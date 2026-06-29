from datetime import datetime

from ninja import Schema
from pydantic import Field

from apps.base.enum_registry import enum_field_mapping
from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus


class WalletSummaryOut(Schema):
    available_balance: int
    frozen_balance: int
    total_income: int
    total_withdrawn: int


class WalletAccountAdminOut(WalletSummaryOut):
    id: int
    user_id: int

    @staticmethod
    def resolve_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_user_id(obj) -> int:
        return obj.user_id


class WalletLedgerOut(Schema):
    id: int
    entry_type: str
    entry_type__mapping: str
    amount_delta: int
    available_balance_after: int
    frozen_balance_after: int
    biz_type: str
    biz_id: str
    remark: str
    created_at: datetime

    @staticmethod
    def resolve_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_entry_type__mapping(obj):
        return enum_field_mapping(WalletEntryType, obj, "entry_type")


class WithdrawalIn(Schema):
    amount: int
    fee_amount: int = 0
    pay_channel: str
    payee_account: dict
    client_request_id: str = Field(..., min_length=1)


class WithdrawalOut(Schema):
    id: int
    amount: int
    fee_amount: int
    net_amount: int
    status: str
    status__mapping: str
    pay_channel: str
    pay_channel__mapping: str
    payee_account_snapshot: dict
    reject_reason: str
    created_at: datetime
    reviewed_at: datetime | None = None

    @staticmethod
    def resolve_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_field_mapping(WithdrawalStatus, obj, "status")

    @staticmethod
    def resolve_pay_channel__mapping(obj):
        return enum_field_mapping(WithdrawalPayChannel, obj, "pay_channel")


class WalletAdjustmentIn(Schema):
    user_id: int = Field(..., description="待调账用户 ID。")
    amount: int = Field(..., description="调账金额，正数增加，负数扣减。")
    idempotency_key: str = Field(..., description="调账幂等键。")
    remark: str = Field("", description="调账原因备注。")


class WithdrawalReviewIn(Schema):
    approved: bool
    reason: str = ""
    idempotency_key: str


class PayoutCreateIn(Schema):
    provider: str
    out_trade_no: str
    request_payload: dict = {}
    idempotency_key: str


class WithdrawalRetryIn(PayoutCreateIn):
    pass


class PayoutCallbackIn(Schema):
    out_trade_no: str
    provider_trade_no: str = ""
    callback_status: str
    response_payload: dict = {}


class WithdrawalPayoutOut(Schema):
    id: int
    withdrawal_request_id: int
    provider: str
    out_trade_no: str
    provider_trade_no: str
    status: str
    status__mapping: str
    error_code: str
    error_message: str
    executed_at: datetime | None = None

    @staticmethod
    def resolve_id(obj) -> int:
        return obj.pk

    @staticmethod
    def resolve_withdrawal_request_id(obj) -> int:
        return obj.withdrawal_request_id

    @staticmethod
    def resolve_status__mapping(obj):
        return enum_field_mapping(PayoutStatus, obj, "status")


class ReconcileOut(Schema):
    diff_count: int
