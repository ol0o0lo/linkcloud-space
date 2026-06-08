from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.services import apply_wallet_adjustment, apply_wallet_credit, ensure_wallet_account


class WalletLedgerServiceTests(TestCase):
    def test_apply_wallet_credit_creates_wallet_and_ledger(self):
        user = baker.make(User)

        ledger = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(wallet.available_balance, 500)
        self.assertEqual(wallet.frozen_balance, 0)
        self.assertEqual(wallet.total_income, 500)
        self.assertEqual(ledger.available_balance_after, 500)
        self.assertEqual(ledger.frozen_balance_after, 0)

    def test_apply_wallet_credit_is_idempotent(self):
        user = baker.make(User)

        first = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )
        second = apply_wallet_credit(
            user=user,
            amount=500,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-1",
            idempotency_key="reward-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(first.pk, second.pk)
        self.assertEqual(wallet.available_balance, 500)

    def test_apply_wallet_adjustment_decrease_rejects_if_balance_insufficient(self):
        user = baker.make(User)
        ensure_wallet_account(user)

        with self.assertRaisesMessage(ValueError, "Insufficient available balance."):
            apply_wallet_adjustment(
                user=user,
                amount=-1,
                idempotency_key="admin-adjust-1",
                operator=baker.make(User),
                remark="manual deduction",
            )
