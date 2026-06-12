from unittest.mock import patch

from django.test import TestCase

from model_bakery import baker
from allauth.socialaccount.models import SocialAccount

from apps.accounts.models import User
from apps.wallet.constants import PayoutStatus, WithdrawalPayChannel, WithdrawalStatus
from apps.wallet.exceptions import UnsupportedWithdrawalChannelException, WalletPayoutProviderRejectedException, WechatBindingRequiredException
from apps.wallet.providers.base import ProviderQueryResult, ProviderTransferResult
from apps.wallet.models import WithdrawalPayout
from apps.wallet.services import apply_wallet_adjustment, apply_wallet_credit, ensure_wallet_account
from apps.wallet.services import approve_withdrawal, cancel_withdrawal, create_withdrawal_payout, handle_payout_callback, submit_withdrawal, sync_processing_withdrawals


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
    def test_submit_withdrawal_freezes_amount_and_snapshots_wechat_account(self):
        user = baker.make(User, first_name="三")
        baker.make(
            SocialAccount,
            user=user,
            provider="weixin",
            uid="wx-user-1",
            extra_data={"openid": "openid-1", "unionid": "unionid-1"},
        )
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
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-1",
        )

        wallet = ensure_wallet_account(user)
        self.assertEqual(withdrawal.net_amount, 900)
        self.assertEqual(withdrawal.status, WithdrawalStatus.PENDING_REVIEW)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 1000)
        self.assertEqual(withdrawal.payee_account_snapshot["channel"], "wechat")
        self.assertEqual(withdrawal.payee_account_snapshot["social_provider"], "weixin")
        self.assertEqual(withdrawal.payee_account_snapshot["social_uid"], "wx-user-1")
        self.assertEqual(withdrawal.payee_account_snapshot["openid"], "openid-1")
        self.assertEqual(withdrawal.payee_account_snapshot["unionid"], "unionid-1")

    def test_submit_withdrawal_rejects_unsupported_pay_channel(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-unsupported-channel",
            idempotency_key="reward-unsupported-channel",
        )

        with self.assertRaises(UnsupportedWithdrawalChannelException):
            submit_withdrawal(
                user=user,
                amount=1000,
                fee_amount=100,
                pay_channel="alipay",
                payee_account={"name": "张三", "account": "13800138000"},
                client_request_id="withdraw-unsupported-channel",
            )

    def test_submit_withdrawal_requires_wechat_binding(self):
        user = baker.make(User)
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-no-wechat",
            idempotency_key="reward-no-wechat",
        )

        with self.assertRaises(WechatBindingRequiredException):
            submit_withdrawal(
                user=user,
                amount=1000,
                fee_amount=100,
                pay_channel=WithdrawalPayChannel.WECHAT,
                payee_account={"name": "张三", "account": "13800138000"},
                client_request_id="withdraw-no-wechat",
            )

    def test_cancel_withdrawal_returns_frozen_balance(self):
        user = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-user-2")
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
            pay_channel=WithdrawalPayChannel.WECHAT,
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
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-user-3", extra_data={"openid": "openid-3"})
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
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-3",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-1")
        with patch("apps.wallet.services.get_payout_provider") as mock_get_provider:
            provider = mock_get_provider.return_value
            provider.create_transfer.return_value = ProviderTransferResult(
                provider="wechat",
                out_trade_no="out-2",
                accepted=True,
                status="processing",
                request_payload={"amount": 900},
                response_payload={"mocked": True},
            )
            create_withdrawal_payout(withdrawal=withdrawal, provider="wechat", out_trade_no="out-2", request_payload={"amount": 900}, idempotency_key="payout-2")

        handle_payout_callback(
            provider="wechat",
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

    @patch("apps.wallet.services.get_payout_provider")
    def test_create_withdrawal_payout_enters_paying_only_after_provider_accepts(self, mock_get_provider):
        user = baker.make(User)
        admin = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-user-4", extra_data={"openid": "openid-4"})
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-5",
            idempotency_key="reward-5",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-4",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-2")

        provider = mock_get_provider.return_value
        provider.create_transfer.return_value = ProviderTransferResult(
            provider="wechat",
            out_trade_no="wx-out-1",
            accepted=True,
            status="processing",
            request_payload={"out_bill_no": "wx-out-1"},
            response_payload={"mocked": True},
        )

        payout = create_withdrawal_payout(
            withdrawal=withdrawal,
            provider="wechat",
            out_trade_no="wx-out-1",
            request_payload={},
            idempotency_key="payout-wechat-1",
        )

        withdrawal.refresh_from_db()
        self.assertEqual(payout.provider, "wechat")
        self.assertEqual(withdrawal.status, WithdrawalStatus.PAYING)

    @patch("apps.wallet.services.get_payout_provider")
    def test_create_withdrawal_payout_marks_failed_and_refunds_when_provider_rejects(self, mock_get_provider):
        user = baker.make(User)
        admin = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-user-5", extra_data={"openid": "openid-5"})
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-6",
            idempotency_key="reward-6",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-5",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-3")

        provider = mock_get_provider.return_value
        provider.create_transfer.return_value = ProviderTransferResult(
            provider="wechat",
            out_trade_no="wx-out-2",
            accepted=False,
            status="failed",
            request_payload={"out_bill_no": "wx-out-2"},
            response_payload={"mocked": True},
            error_code="LOCAL_REJECT",
            error_message="config invalid",
        )

        with self.assertRaises(WalletPayoutProviderRejectedException):
            create_withdrawal_payout(
                withdrawal=withdrawal,
                provider="wechat",
                out_trade_no="wx-out-2",
                request_payload={},
                idempotency_key="payout-wechat-2",
            )

        wallet = ensure_wallet_account(user)
        withdrawal.refresh_from_db()
        failed_payout = WithdrawalPayout.objects.get(idempotency_key="payout-wechat-2")
        self.assertEqual(withdrawal.status, WithdrawalStatus.FAILED)
        self.assertEqual(wallet.available_balance, 3000)
        self.assertEqual(wallet.frozen_balance, 0)
        self.assertEqual(failed_payout.status, PayoutStatus.FAILED)
        self.assertEqual(failed_payout.error_code, "LOCAL_REJECT")

    @patch("apps.wallet.services.get_payout_provider")
    def test_sync_processing_withdrawals_marks_paid_when_query_confirms_success(self, mock_get_provider):
        user = baker.make(User)
        admin = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-sync-user", extra_data={"openid": "openid-sync"})
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-sync",
            idempotency_key="reward-sync",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-sync-1",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-sync-1")

        provider = mock_get_provider.return_value
        provider.create_transfer.return_value = ProviderTransferResult(
            provider="wechat",
            out_trade_no="out-sync-1",
            accepted=True,
            status="processing",
            request_payload={},
            response_payload={},
        )
        create_withdrawal_payout(
            withdrawal=withdrawal,
            provider="wechat",
            out_trade_no="out-sync-1",
            request_payload={},
            idempotency_key="payout-sync-1",
        )
        provider.query_transfer.return_value = ProviderQueryResult(
            out_trade_no="out-sync-1",
            provider_trade_no="wx-sync-1",
            payout_status="succeeded",
            response_payload={"state": "SUCCESS"},
        )

        sync_processing_withdrawals()

        wallet = ensure_wallet_account(user)
        withdrawal.refresh_from_db()
        self.assertEqual(withdrawal.status, WithdrawalStatus.PAID)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 0)

    @patch("apps.wallet.services.get_payout_provider")
    def test_create_withdrawal_payout_keeps_approved_when_transport_error_occurs(self, mock_get_provider):
        user = baker.make(User)
        admin = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-network-user", extra_data={"openid": "openid-network"})
        apply_wallet_credit(
            user=user,
            amount=3000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-network",
            idempotency_key="reward-network",
        )
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-network-1",
        )
        approve_withdrawal(withdrawal=withdrawal, operator=admin, approved=True, reason="ok", idempotency_key="review-network-1")
        mock_get_provider.return_value.create_transfer.side_effect = TimeoutError("wechat timeout")

        with self.assertRaises(TimeoutError):
            create_withdrawal_payout(
                withdrawal=withdrawal,
                provider="wechat",
                out_trade_no="out-network-1",
                request_payload={},
                idempotency_key="payout-network-1",
            )

        withdrawal.refresh_from_db()
        wallet = ensure_wallet_account(user)
        self.assertEqual(withdrawal.status, WithdrawalStatus.APPROVED)
        self.assertEqual(wallet.available_balance, 2000)
        self.assertEqual(wallet.frozen_balance, 1000)
