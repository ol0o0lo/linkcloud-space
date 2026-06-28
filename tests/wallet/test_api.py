import json
from unittest.mock import patch

from django.test import TestCase

from allauth.socialaccount.models import SocialAccount
from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.constants import PayoutStatus, WalletEntryType, WithdrawalPayChannel, WithdrawalStatus
from apps.wallet.exceptions import UnsupportedWithdrawalChannelException, WechatBindingRequiredException
from apps.wallet.providers.base import ProviderTransferResult
from apps.wallet.services import apply_wallet_credit, submit_withdrawal
from tests.api_helpers import api_data, api_error


class WalletUserAPITests(TestCase):
    def setUp(self):
        self.user = baker.make(User)
        self.client.force_login(self.user)

    def test_summary_returns_wallet_balances(self):
        apply_wallet_credit(
            user=self.user,
            amount=1200,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-10",
            idempotency_key="reward-10",
        )

        resp = self.client.get("/api/wallet/me/summary/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertEqual(data["available_balance"], 1200)
        self.assertEqual(data["frozen_balance"], 0)

        ledger_resp = self.client.get("/api/wallet/me/ledger/")

        self.assertEqual(ledger_resp.status_code, 200)
        ledger_item = api_data(ledger_resp)["items"][0]
        self.assertEqual(ledger_item["entry_type__mapping"], WalletEntryType.get_choice_label(ledger_item["entry_type"]))

    def test_create_withdrawal_freezes_balance(self):
        baker.make(SocialAccount, user=self.user, provider="weixin", uid="wx-api-user-1")
        apply_wallet_credit(
            user=self.user,
            amount=2000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-11",
            idempotency_key="reward-11",
        )

        resp = self.client.post(
            "/api/wallet/me/withdrawals/",
            data=json.dumps(
                {
                    "amount": 1000,
                    "fee_amount": 100,
                    "pay_channel": WithdrawalPayChannel.WECHAT,
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "withdraw-api-1",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        data = api_data(resp)
        self.assertEqual(data["status"], "pending_review")
        self.assertEqual(data["status__mapping"], WithdrawalStatus.get_choice_label(data["status"]))
        self.assertEqual(data["pay_channel__mapping"], WithdrawalPayChannel.get_choice_label(data["pay_channel"]))

    def test_create_withdrawal_requires_non_empty_client_request_id(self):
        baker.make(SocialAccount, user=self.user, provider="weixin", uid="wx-api-user-2")
        apply_wallet_credit(
            user=self.user,
            amount=2000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-11b",
            idempotency_key="reward-11b",
        )

        resp = self.client.post(
            "/api/wallet/me/withdrawals/",
            data=json.dumps(
                {
                    "amount": 1000,
                    "fee_amount": 100,
                    "pay_channel": WithdrawalPayChannel.WECHAT,
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "   ",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)

    def test_create_withdrawal_rejects_unsupported_pay_channel_with_business_code(self):
        apply_wallet_credit(
            user=self.user,
            amount=2000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-unsupported-channel-api",
            idempotency_key="reward-unsupported-channel-api",
        )

        resp = self.client.post(
            "/api/wallet/me/withdrawals/",
            data=json.dumps(
                {
                    "amount": 1000,
                    "fee_amount": 100,
                    "pay_channel": "alipay",
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "withdraw-api-unsupported-channel",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        error = api_error(resp)
        self.assertEqual(error["message"], str(UnsupportedWithdrawalChannelException.message))
        self.assertEqual(error["code"], 400)
        self.assertEqual(error["error"], UnsupportedWithdrawalChannelException.error)

    def test_create_withdrawal_requires_wechat_binding_with_business_code(self):
        apply_wallet_credit(
            user=self.user,
            amount=2000,
            entry_type="promotion_reward",
            biz_type="promotion.reward",
            biz_id="reward-wechat-not-bound-api",
            idempotency_key="reward-wechat-not-bound-api",
        )

        resp = self.client.post(
            "/api/wallet/me/withdrawals/",
            data=json.dumps(
                {
                    "amount": 1000,
                    "fee_amount": 100,
                    "pay_channel": WithdrawalPayChannel.WECHAT,
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "withdraw-api-wechat-not-bound",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        error = api_error(resp)
        self.assertEqual(error["message"], str(WechatBindingRequiredException.message))
        self.assertEqual(error["code"], 400)
        self.assertEqual(error["error"], WechatBindingRequiredException.error)

    def test_cancel_withdrawal_only_works_for_current_user(self):
        other = baker.make(User)
        baker.make(SocialAccount, user=other, provider="weixin", uid="wx-api-other-user")
        apply_wallet_credit(user=other, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-12", idempotency_key="reward-12")
        withdrawal = submit_withdrawal(
            user=other,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "李四", "account": "13900139000"},
            client_request_id="withdraw-api-2",
        )

        resp = self.client.post(f"/api/wallet/me/withdrawals/{withdrawal.pk}/cancel/")

        self.assertEqual(resp.status_code, 404)


class WalletAdminAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.user = baker.make(User)
        self.client.force_login(self.admin)

    def test_admin_can_adjust_wallet_balance(self):
        resp = self.client.post(
            "/api/admin/wallet/adjustments/",
            data=json.dumps(
                {
                    "user_id": self.user.pk,
                    "amount": 500,
                    "idempotency_key": "admin-adjust-api-1",
                    "remark": "manual bonus",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["available_balance_after"], 500)

    @patch("apps.wallet.services.get_payout_provider")
    def test_admin_can_review_and_start_payout(self, mock_get_provider):
        apply_wallet_credit(user=self.user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-20", idempotency_key="reward-20")
        baker.make(SocialAccount, user=self.user, provider="weixin", uid="wx-admin-api-user", extra_data={"openid": "openid-admin-api-user"})
        withdrawal = submit_withdrawal(
            user=self.user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-api-20",
        )
        provider = mock_get_provider.return_value
        provider.create_transfer.return_value = ProviderTransferResult(
            provider="wechat",
            out_trade_no="out-api-1",
            accepted=True,
            status="processing",
            request_payload={"amount": 900},
            response_payload={"mocked": True},
        )

        review_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-1"}),
            content_type="application/json",
        )
        payout_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "wechat", "out_trade_no": "out-api-1", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-1"}),
            content_type="application/json",
        )

        self.assertEqual(review_resp.status_code, 200)
        review_data = api_data(review_resp)
        self.assertEqual(review_data["status"], "approved")
        self.assertEqual(review_data["status__mapping"], WithdrawalStatus.get_choice_label(review_data["status"]))
        self.assertEqual(payout_resp.status_code, 200)
        payout_data = api_data(payout_resp)
        self.assertEqual(payout_data["status"], "processing")
        self.assertEqual(payout_data["status__mapping"], PayoutStatus.get_choice_label(payout_data["status"]))


class WalletInternalAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.client.force_login(self.admin)

    def test_internal_reconcile_endpoint_returns_diff_summary(self):
        resp = self.client.post("/api/internal/wallet/reconcile/", content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("diff_count", api_data(resp))

    @patch("apps.wallet.api.get_payout_provider")
    @patch("apps.wallet.services.get_payout_provider")
    def test_internal_retry_refreezes_failed_withdrawal_and_restarts_payout(self, mock_get_provider, mock_api_get_provider):
        user = baker.make(User)
        baker.make(SocialAccount, user=user, provider="weixin", uid="wx-internal-api-user", extra_data={"openid": "openid-internal-api-user"})
        apply_wallet_credit(user=user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-30", idempotency_key="reward-30")
        withdrawal = submit_withdrawal(
            user=user,
            amount=1000,
            fee_amount=100,
            pay_channel=WithdrawalPayChannel.WECHAT,
            payee_account={"name": "张三", "account": "13800138000"},
            client_request_id="withdraw-api-30",
        )
        provider = mock_get_provider.return_value
        mock_api_get_provider.return_value = provider
        provider.create_transfer.side_effect = [
            ProviderTransferResult(
                provider="wechat",
                out_trade_no="out-api-30",
                accepted=True,
                status="processing",
                request_payload={"amount": 900},
                response_payload={"mocked": True},
            ),
            ProviderTransferResult(
                provider="wechat",
                out_trade_no="out-api-31",
                accepted=True,
                status="processing",
                request_payload={"amount": 900},
                response_payload={"mocked": True, "retry": True},
            ),
        ]
        admin = self.admin
        self.client.force_login(admin)
        self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-30"}),
            content_type="application/json",
        )
        self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "wechat", "out_trade_no": "out-api-30", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-30"}),
            content_type="application/json",
        )
        provider.verify_callback.return_value = True
        provider.parse_callback.return_value = {
            "out_trade_no": "out-api-30",
            "provider_trade_no": "trade-30",
            "callback_status": "failed",
            "response_payload": {"trade_status": "FAILED"},
        }
        self.client.post(
            "/api/wallet/payout/callback/wechat/",
            data=json.dumps({"id": "notify-30"}),
            content_type="application/json",
            HTTP_WECHATPAY_SIGNATURE="sig",
            HTTP_WECHATPAY_TIMESTAMP="1710000000",
            HTTP_WECHATPAY_NONCE="nonce-30",
            HTTP_WECHATPAY_SERIAL="serial-30",
        )

        retry_resp = self.client.post(
            f"/api/internal/wallet/withdrawals/{withdrawal.pk}/retry/",
            data=json.dumps({"provider": "wechat", "out_trade_no": "out-api-31", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-31"}),
            content_type="application/json",
        )

        self.assertEqual(retry_resp.status_code, 200)
        self.assertEqual(api_data(retry_resp)["status"], "processing")


class WalletCallbackAPITests(TestCase):
    @patch("apps.wallet.api.get_payout_provider")
    @patch("apps.wallet.api.handle_payout_callback")
    def test_payout_callback_uses_provider_verification_and_parse(self, mock_handle_callback, mock_get_provider):
        provider = mock_get_provider.return_value
        provider.verify_callback.return_value = True
        provider.parse_callback.return_value = {
            "out_trade_no": "out-cb-1",
            "provider_trade_no": "wx-cb-1",
            "callback_status": "success",
            "response_payload": {"state": "SUCCESS"},
        }
        mock_handle_callback.return_value = baker.make("wallet.WithdrawalPayout", provider="wechat", out_trade_no="out-cb-1")

        resp = self.client.post(
            "/api/wallet/payout/callback/wechat/",
            data=json.dumps({"id": "notify-1"}),
            content_type="application/json",
            HTTP_WECHATPAY_SIGNATURE="sig",
            HTTP_WECHATPAY_TIMESTAMP="1710000000",
            HTTP_WECHATPAY_NONCE="nonce-1",
            HTTP_WECHATPAY_SERIAL="serial-1",
        )

        self.assertEqual(resp.status_code, 200)
        provider.verify_callback.assert_called_once()
        provider.parse_callback.assert_called_once()
        mock_handle_callback.assert_called_once_with(
            provider="wechat",
            out_trade_no="out-cb-1",
            provider_trade_no="wx-cb-1",
            callback_status="success",
            response_payload={"state": "SUCCESS"},
        )
