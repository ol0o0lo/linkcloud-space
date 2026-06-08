from django.db import transaction
from django.utils import timezone

from apps.wallet.constants import PayoutStatus
from apps.wallet.constants import WithdrawalStatus
from apps.wallet.constants import WalletEntryType
from apps.wallet.models import WalletAccount, WalletLedger, WithdrawalPayout, WithdrawalRequest
from apps.wallet.security import build_payee_snapshot


def ensure_wallet_account(user):
    wallet, _created = WalletAccount.objects.get_or_create(user=user)
    return wallet


@transaction.atomic
def apply_wallet_credit(*, user, amount, entry_type, biz_type, biz_id, idempotency_key, operator=None, remark=""):
    existing = WalletLedger.objects.filter(idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing

    wallet = WalletAccount.objects.select_for_update().filter(user=user).first()
    if wallet is None:
        wallet = ensure_wallet_account(user)
    wallet = WalletAccount.objects.select_for_update().get(pk=wallet.pk)

    wallet.available_balance += amount
    wallet.total_income += amount
    wallet.save(update_fields=["available_balance", "total_income", "updated_at"])

    return WalletLedger.objects.create(
        wallet=wallet,
        entry_type=entry_type,
        amount_delta=amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type=biz_type,
        biz_id=biz_id,
        idempotency_key=idempotency_key,
        operator=operator,
        remark=remark,
    )


@transaction.atomic
def apply_wallet_adjustment(*, user, amount, idempotency_key, operator, remark):
    existing = WalletLedger.objects.filter(idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing

    wallet = WalletAccount.objects.select_for_update().filter(user=user).first()
    if wallet is None:
        wallet = ensure_wallet_account(user)
    wallet = WalletAccount.objects.select_for_update().get(pk=wallet.pk)

    if amount < 0 and wallet.available_balance < abs(amount):
        raise ValueError("Insufficient available balance.")

    wallet.available_balance += amount
    if amount > 0:
        wallet.total_income += amount
    wallet.save(update_fields=["available_balance", "total_income", "updated_at"])

    return WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.ADMIN_ADJUSTMENT_INCREASE if amount > 0 else WalletEntryType.ADMIN_ADJUSTMENT_DECREASE,
        amount_delta=amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.admin_adjustment",
        biz_id=str(user.pk),
        idempotency_key=idempotency_key,
        operator=operator,
        remark=remark,
    )


@transaction.atomic
def submit_withdrawal(*, user, amount, fee_amount, pay_channel, payee_account, client_request_id):
    client_request_id = client_request_id.strip()
    if not client_request_id:
        raise ValueError("client_request_id is required.")
    wallet = WalletAccount.objects.select_for_update().get(pk=ensure_wallet_account(user).pk)
    if amount <= 0 or fee_amount < 0 or amount <= fee_amount:
        raise ValueError("Invalid withdrawal amount.")
    if wallet.available_balance < amount:
        raise ValueError("Insufficient available balance.")

    existing = WithdrawalRequest.objects.filter(user=user, client_request_id=client_request_id).first()
    if existing is not None:
        return existing

    wallet.available_balance -= amount
    wallet.frozen_balance += amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])

    withdrawal = WithdrawalRequest.objects.create(
        user=user,
        wallet=wallet,
        amount=amount,
        fee_amount=fee_amount,
        net_amount=amount - fee_amount,
        client_request_id=client_request_id,
        status=WithdrawalStatus.PENDING_REVIEW,
        pay_channel=pay_channel,
        payee_account_snapshot=build_payee_snapshot(payee_account),
    )
    WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.WITHDRAW_FREEZE,
        amount_delta=-amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"withdraw-freeze:{withdrawal.pk}",
    )
    return withdrawal


@transaction.atomic
def cancel_withdrawal(*, withdrawal, user):
    withdrawal = WithdrawalRequest.objects.select_for_update().select_related("wallet").get(pk=withdrawal.pk)
    if withdrawal.user_id != user.pk:
        raise ValueError("Withdrawal does not belong to user.")
    if withdrawal.status == WithdrawalStatus.CANCELLED:
        return withdrawal
    if withdrawal.status != WithdrawalStatus.PENDING_REVIEW:
        raise ValueError("Only pending withdrawals can be cancelled.")

    wallet = WalletAccount.objects.select_for_update().get(pk=withdrawal.wallet_id)
    wallet.available_balance += withdrawal.amount
    wallet.frozen_balance -= withdrawal.amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])

    withdrawal.status = WithdrawalStatus.CANCELLED
    withdrawal.save(update_fields=["status", "updated_at"])

    WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.WITHDRAW_CANCEL,
        amount_delta=withdrawal.amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"withdraw-cancel:{withdrawal.pk}",
        operator=user,
    )
    return withdrawal


@transaction.atomic
def approve_withdrawal(*, withdrawal, operator, approved, reason, idempotency_key):
    withdrawal = WithdrawalRequest.objects.select_for_update().select_related("wallet").get(pk=withdrawal.pk)
    if withdrawal.status == WithdrawalStatus.APPROVED and approved:
        return withdrawal
    if withdrawal.status == WithdrawalStatus.REJECTED and not approved:
        return withdrawal
    if withdrawal.status != WithdrawalStatus.PENDING_REVIEW:
        raise ValueError("Only pending withdrawals can be reviewed.")

    wallet = WalletAccount.objects.select_for_update().get(pk=withdrawal.wallet_id)
    withdrawal.reviewed_by = operator
    withdrawal.reviewed_at = timezone.now()

    if approved:
        withdrawal.status = WithdrawalStatus.APPROVED
        withdrawal.reject_reason = ""
        withdrawal.save(update_fields=["status", "reviewed_by", "reviewed_at", "reject_reason", "updated_at"])
        return withdrawal

    wallet.available_balance += withdrawal.amount
    wallet.frozen_balance -= withdrawal.amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])
    withdrawal.status = WithdrawalStatus.REJECTED
    withdrawal.reject_reason = reason
    withdrawal.save(update_fields=["status", "reviewed_by", "reviewed_at", "reject_reason", "updated_at"])
    WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.WITHDRAW_UNFREEZE,
        amount_delta=withdrawal.amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"{idempotency_key}:reject",
        operator=operator,
        remark=reason,
    )
    return withdrawal


@transaction.atomic
def create_withdrawal_payout(*, withdrawal, provider, out_trade_no, request_payload, idempotency_key):
    existing = WithdrawalPayout.objects.filter(idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing

    withdrawal = WithdrawalRequest.objects.select_for_update().get(pk=withdrawal.pk)
    if withdrawal.status == WithdrawalStatus.PAYING:
        return withdrawal.payouts.order_by("-created_at", "-pk").first()
    if withdrawal.status != WithdrawalStatus.APPROVED:
        raise ValueError("Only approved withdrawals can start payout.")

    payout = WithdrawalPayout.objects.create(
        withdrawal_request=withdrawal,
        provider=provider,
        out_trade_no=out_trade_no,
        idempotency_key=idempotency_key,
        request_payload=request_payload,
        status=PayoutStatus.PROCESSING,
        executed_at=timezone.now(),
    )
    withdrawal.status = WithdrawalStatus.PAYING
    withdrawal.save(update_fields=["status", "updated_at"])
    return payout


@transaction.atomic
def retry_withdrawal_payout(*, withdrawal, provider, out_trade_no, request_payload, idempotency_key):
    withdrawal = WithdrawalRequest.objects.select_for_update().get(pk=withdrawal.pk)
    if withdrawal.status != WithdrawalStatus.FAILED:
        raise ValueError("Only failed withdrawals can be retried.")

    wallet = WalletAccount.objects.select_for_update().get(pk=withdrawal.wallet_id)
    if wallet.available_balance < withdrawal.amount:
        raise ValueError("Insufficient available balance for retry.")

    wallet.available_balance -= withdrawal.amount
    wallet.frozen_balance += withdrawal.amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])
    withdrawal.status = WithdrawalStatus.APPROVED
    withdrawal.save(update_fields=["status", "updated_at"])
    WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.WITHDRAW_FREEZE,
        amount_delta=-withdrawal.amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal.retry",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"withdraw-retry-freeze:{withdrawal.pk}:{idempotency_key}",
    )
    return create_withdrawal_payout(
        withdrawal=withdrawal,
        provider=provider,
        out_trade_no=out_trade_no,
        request_payload=request_payload,
        idempotency_key=idempotency_key,
    )


@transaction.atomic
def handle_payout_callback(*, provider, out_trade_no, provider_trade_no, callback_status, response_payload):
    payout = WithdrawalPayout.objects.select_for_update().select_related("withdrawal_request__wallet").get(provider=provider, out_trade_no=out_trade_no)
    withdrawal = WithdrawalRequest.objects.select_for_update().get(pk=payout.withdrawal_request_id)
    wallet = WalletAccount.objects.select_for_update().get(pk=withdrawal.wallet_id)

    if callback_status == "success" and withdrawal.status == WithdrawalStatus.PAID:
        return payout
    if callback_status != "success" and withdrawal.status == WithdrawalStatus.FAILED:
        return payout
    if withdrawal.status != WithdrawalStatus.PAYING:
        raise ValueError("Only paying withdrawals can accept callbacks.")

    payout.provider_trade_no = provider_trade_no
    payout.response_payload = response_payload

    if callback_status == "success":
        payout.status = PayoutStatus.SUCCEEDED
        payout.save(update_fields=["provider_trade_no", "response_payload", "status", "updated_at"])

        wallet.frozen_balance -= withdrawal.amount
        wallet.total_withdrawn += withdrawal.amount
        wallet.save(update_fields=["frozen_balance", "total_withdrawn", "updated_at"])
        withdrawal.status = WithdrawalStatus.PAID
        withdrawal.save(update_fields=["status", "updated_at"])

        WalletLedger.objects.create(
            wallet=wallet,
            entry_type=WalletEntryType.WITHDRAW_SETTLE,
            amount_delta=0,
            available_balance_after=wallet.available_balance,
            frozen_balance_after=wallet.frozen_balance,
            biz_type="wallet.withdrawal",
            biz_id=str(withdrawal.pk),
            idempotency_key=f"withdraw-settle:{withdrawal.pk}",
        )
        return payout

    payout.status = PayoutStatus.FAILED
    payout.save(update_fields=["provider_trade_no", "response_payload", "status", "updated_at"])

    wallet.available_balance += withdrawal.amount
    wallet.frozen_balance -= withdrawal.amount
    wallet.save(update_fields=["available_balance", "frozen_balance", "updated_at"])
    withdrawal.status = WithdrawalStatus.FAILED
    withdrawal.save(update_fields=["status", "updated_at"])
    WalletLedger.objects.create(
        wallet=wallet,
        entry_type=WalletEntryType.WITHDRAW_REFUND,
        amount_delta=withdrawal.amount,
        available_balance_after=wallet.available_balance,
        frozen_balance_after=wallet.frozen_balance,
        biz_type="wallet.withdrawal",
        biz_id=str(withdrawal.pk),
        idempotency_key=f"withdraw-refund:{withdrawal.pk}",
    )
    return payout


def reconcile_wallet_state():
    diff_count = 0
    for wallet in WalletAccount.objects.all():
        latest_ledger = wallet.ledgers.order_by("created_at", "pk").last()
        if latest_ledger is None:
            continue
        if latest_ledger.available_balance_after != wallet.available_balance or latest_ledger.frozen_balance_after != wallet.frozen_balance:
            diff_count += 1
    return {"diff_count": diff_count}
