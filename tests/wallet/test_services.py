from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.constants import WithdrawalStatus
from apps.wallet.services import apply_wallet_adjustment, apply_wallet_credit, ensure_wallet_account
from apps.wallet.services import approve_withdrawal, cancel_withdrawal, create_withdrawal_payout, handle_payout_callback, submit_withdrawal


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


class WalletWithdrawalServiceTests(TestCase):
    def test_submit_withdrawal_freezes_amount_and_masks_snapshot(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-2",
            idempotency_key="reward-2",
        )

        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel="alipay",
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(withdrawal.net_amount, 900)
        self.assertEqual(withdrawal.status, WithdrawalStatus.PENDING_REVIEW)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 1000)
        self.assertEqual(withdrawal.payee_account_snapshot["masked_account"], "*******8000")

    def test_cancel_withdrawal_returns_frozen_balance(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-3",
            idempotency_key="reward-3",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel="alipay",
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-2",
        )

        cancel_withdrawal(withdrawal=withdrawal, user=user)
        wallet = ensure_wallet_account(user)
        self.assertEqual(wallet.available_balance, 3000)
        self.assertEqual(wallet.frozen_balance, 0)

    def test_successful_payout_moves_withdrawal_to_paid(self):
        user = baker.make(User)
        admin = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-4",
            idempotency_key="reward-4",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel="alipay",
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-3",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-1")
        create_withdrawal_payout(withdrawal=withdrawal, provider="mock_provider", out_trade_no="out-2", request_payload={"amount": 900}, idempotency_key="payout-2")

        handle_payout_callback(
            provider="mock_provider",
            out_trade_no="out-2",
            provider_trade_no="trade-2",
            callback_status="success",
            response_payload={"trade_status": "SUCCESS"},
        )

        wallet = ensure_wallet_account(user)
        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, WithdrawalStatus.PAID)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 0)
        self.assertEqual(wallet.total_withdrawn, 1000)
