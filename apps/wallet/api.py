from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from ninja import Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.wallet.models import WalletLedger, WithdrawalRequest
from apps.wallet.models import WalletAccount
from apps.wallet.schemas import PayoutCallbackIn, PayoutCreateIn, ReconcileOut, WalletAccountAdminOut, WalletAdjustmentIn, WalletLedgerOut, WalletSummaryOut, WithdrawalIn, WithdrawalOut, WithdrawalPayoutOut, WithdrawalRetryIn, WithdrawalReviewIn
from apps.wallet.security import verify_callback_signature
from apps.wallet.services import (
    apply_wallet_adjustment,
    approve_withdrawal,
    cancel_withdrawal,
    create_withdrawal_payout,
    ensure_wallet_account,
    handle_payout_callback,
    reconcile_wallet_state,
    retry_withdrawal_payout,
    submit_withdrawal,
)

router = Router(tags=["钱包/用户"])
admin_router = Router(tags=["钱包/管理"])
internal_router = Router(tags=["钱包/内部"])


@router.get("/me/summary/", response=WalletSummaryOut, summary="获取我的钱包总览")
def wallet_summary(request):
    require_authenticated(request)
    return ensure_wallet_account(request.user)


@router.get("/me/ledger/", response=list[WalletLedgerOut], summary="获取我的钱包流水")
@paginate(LegacyPagination)
def wallet_ledger(request):
    require_authenticated(request)
    wallet = ensure_wallet_account(request.user)
    return WalletLedger.objects.filter(wallet=wallet).order_by("-created_at", "-pk")


@router.post("/me/withdrawals/", response={201: WithdrawalOut}, summary="提交提现申请")
def create_withdrawal(request, payload: WithdrawalIn):
    require_authenticated(request)
    try:
        withdrawal = submit_withdrawal(user=request.user, **payload.dict())
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
    return Status(201, withdrawal)


@router.get("/me/withdrawals/", response=list[WithdrawalOut], summary="获取我的提现申请")
@paginate(LegacyPagination)
def list_withdrawals(request):
    require_authenticated(request)
    return WithdrawalRequest.objects.filter(user=request.user).order_by("-created_at", "-pk")


@router.get("/me/withdrawals/{withdrawal_id}/", response=WithdrawalOut, summary="获取提现申请详情")
def get_withdrawal(request, withdrawal_id: int):
    require_authenticated(request)
    return get_object_or_404(WithdrawalRequest, pk=withdrawal_id, user=request.user)


@router.post("/me/withdrawals/{withdrawal_id}/cancel/", response=WithdrawalOut, summary="撤销提现申请")
def cancel_user_withdrawal(request, withdrawal_id: int):
    require_authenticated(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id, user=request.user)
    try:
        return cancel_withdrawal(withdrawal=withdrawal, user=request.user)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@admin_router.post("/adjustments/", response=WalletLedgerOut, summary="创建钱包调账")
def create_adjustment(request, payload: WalletAdjustmentIn):
    require_superuser(request)
    user = get_object_or_404(get_user_model(), pk=payload.user_id)
    try:
        return apply_wallet_adjustment(user=user, amount=payload.amount, idempotency_key=payload.idempotency_key, operator=request.user, remark=payload.remark)
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@admin_router.get("/accounts/", response=list[WalletAccountAdminOut], summary="获取钱包账户列表")
@paginate(LegacyPagination)
def list_wallet_accounts(request):
    require_superuser(request)
    return WalletAccount.objects.select_related("user").order_by("-created_at", "-pk")


@admin_router.get("/accounts/{user_id}/ledger/", response=list[WalletLedgerOut], summary="获取指定用户钱包流水")
@paginate(LegacyPagination)
def admin_wallet_ledger(request, user_id: int):
    require_superuser(request)
    wallet = get_object_or_404(WalletAccount, user_id=user_id)
    return WalletLedger.objects.filter(wallet=wallet).order_by("-created_at", "-pk")


@admin_router.get("/withdrawals/", response=list[WithdrawalOut], summary="获取提现申请列表")
@paginate(LegacyPagination)
def admin_withdrawals(request):
    require_superuser(request)
    return WithdrawalRequest.objects.select_related("user", "wallet").order_by("-created_at", "-pk")


@admin_router.post("/withdrawals/{withdrawal_id}/review/", response=WithdrawalOut, summary="审核提现申请")
def review_withdrawal(request, withdrawal_id: int, payload: WithdrawalReviewIn):
    require_superuser(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id)
    try:
        return approve_withdrawal(
            withdrawal=withdrawal,
            operator=request.user,
            approved=payload.approved,
            reason=payload.reason,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@admin_router.post("/withdrawals/{withdrawal_id}/payout/", response=WithdrawalPayoutOut, summary="发起提现代付")
def payout_withdrawal(request, withdrawal_id: int, payload: PayoutCreateIn):
    require_superuser(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id)
    try:
        return create_withdrawal_payout(
            withdrawal=withdrawal,
            provider=payload.provider,
            out_trade_no=payload.out_trade_no,
            request_payload=payload.request_payload,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@router.post("/payout/callback/{provider}/", auth=None, response=WithdrawalPayoutOut, summary="处理代付回调")
def payout_callback(request, provider: str, payload: PayoutCallbackIn):
    signature = request.headers.get("X-Wallet-Callback-Signature", "")
    if not verify_callback_signature(provider=provider, payload=payload.dict(), signature=signature):
        raise HttpError(403, "Invalid callback signature.")
    try:
        return handle_payout_callback(provider=provider, **payload.dict())
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@internal_router.post("/withdrawals/{withdrawal_id}/retry/", response=WithdrawalPayoutOut, summary="重试失败提现代付")
def retry_withdrawal(request, withdrawal_id: int, payload: WithdrawalRetryIn):
    require_superuser(request)
    withdrawal = get_object_or_404(WithdrawalRequest, pk=withdrawal_id)
    try:
        return retry_withdrawal_payout(
            withdrawal=withdrawal,
            provider=payload.provider,
            out_trade_no=payload.out_trade_no,
            request_payload=payload.request_payload,
            idempotency_key=payload.idempotency_key,
        )
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc


@internal_router.post("/reconcile/", response=ReconcileOut, summary="执行钱包对账")
def reconcile(request):
    require_superuser(request)
    return reconcile_wallet_state()
