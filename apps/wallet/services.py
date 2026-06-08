from django.db import transaction

from apps.wallet.constants import WalletEntryType
from apps.wallet.models import WalletAccount, WalletLedger


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
