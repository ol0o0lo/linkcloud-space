from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404

from ninja import Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_superuser
from apps.wallet.models import WalletLedger, WithdrawalRequest
from apps.wallet.schemas import PayoutCallbackIn, PayoutCreateIn, WalletAdjustmentIn, WalletLedgerOut, WalletSummaryOut, WithdrawalIn, WithdrawalOut, WithdrawalReviewIn
from apps.wallet.services import (
    apply_wallet_adjustment,
    cancel_withdrawal,
    create_withdrawal_payout,
    ensure_wallet_account,
    handle_payout_callback,
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


@router.post("/payout/callback/{provider}/", auth=None, summary="处理代付回调")
def payout_callback(request, provider: str, payload: PayoutCallbackIn):
    try:
        return handle_payout_callback(provider=provider, **payload.dict())
    except ValueError as exc:
        raise HttpError(400, str(exc)) from exc
