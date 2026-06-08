import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.wallet.security import build_callback_signature
from apps.wallet.services import apply_wallet_credit, submit_withdrawal


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
        self.assertEqual(resp.json()["available_balance"], 1200)
        self.assertEqual(resp.json()["frozen_balance"], 0)

    def test_create_withdrawal_freezes_balance(self):
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
                    "pay_channel": "alipay",
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "withdraw-api-1",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "pending_review")

    def test_create_withdrawal_requires_non_empty_client_request_id(self):
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
                    "pay_channel": "alipay",
                    "payee_account": {"name": "张三", "account": "13800138000"},
                    "client_request_id": "   ",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)

    def test_cancel_withdrawal_only_works_for_current_user(self):
        other = baker.make(User)
        apply_wallet_credit(user=other, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-12", idempotency_key="reward-12")
        withdrawal = submit_withdrawal(user=other, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "李四", "account": "13900139000"}, client_request_id="withdraw-api-2")

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
        self.assertEqual(resp.json()["available_balance_after"], 500)

    def test_admin_can_review_and_start_payout(self):
        apply_wallet_credit(user=self.user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-20", idempotency_key="reward-20")
        withdrawal = submit_withdrawal(user=self.user, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-api-20")

        review_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-1"}),
            content_type="application/json",
        )
        payout_resp = self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "mock_provider", "out_trade_no": "out-api-1", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-1"}),
            content_type="application/json",
        )

        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.json()["status"], "approved")
        self.assertEqual(payout_resp.status_code, 200)
        self.assertEqual(payout_resp.json()["status"], "processing")


class WalletInternalAPITests(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.client.force_login(self.admin)

    def test_internal_reconcile_endpoint_returns_diff_summary(self):
        resp = self.client.post("/api/internal/wallet/reconcile/", content_type="application/json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("diff_count", resp.json())

    def test_internal_retry_refreezes_failed_withdrawal_and_restarts_payout(self):
        user = baker.make(User)
        apply_wallet_credit(user=user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-30", idempotency_key="reward-30")
        withdrawal = submit_withdrawal(user=user, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-api-30")
        admin = self.admin
        self.client.force_login(admin)
        self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-30"}),
            content_type="application/json",
        )
        self.client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "mock_provider", "out_trade_no": "out-api-30", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-30"}),
            content_type="application/json",
        )
        callback_payload = {
            "out_trade_no": "out-api-30",
            "provider_trade_no": "trade-30",
            "callback_status": "failed",
            "response_payload": {"trade_status": "FAILED"},
        }
        self.client.post(
            "/api/wallet/payout/callback/mock_provider/",
            data=json.dumps(callback_payload),
            content_type="application/json",
            HTTP_X_WALLET_CALLBACK_SIGNATURE=build_callback_signature(provider="mock_provider", payload=callback_payload),
        )

        retry_resp = self.client.post(
            f"/api/internal/wallet/withdrawals/{withdrawal.pk}/retry/",
            data=json.dumps({"provider": "mock_provider", "out_trade_no": "out-api-31", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-31"}),
            content_type="application/json",
        )

        self.assertEqual(retry_resp.status_code, 200)
        self.assertEqual(retry_resp.json()["status"], "processing")


class WalletCallbackAPITests(TestCase):
    def test_callback_requires_valid_signature(self):
        admin = baker.make(User, is_superuser=True, is_staff=True)
        user = baker.make(User)
        apply_wallet_credit(user=user, amount=2000, entry_type="promotion_reward", biz_type="promotion.reward", biz_id="reward-40", idempotency_key="reward-40")
        withdrawal = submit_withdrawal(user=user, amount=1000, fee_amount=100, pay_channel="alipay", payee_account={"name": "张三", "account": "13800138000"}, client_request_id="withdraw-api-40")
        client = self.client
        client.force_login(admin)
        client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/review/",
            data=json.dumps({"approved": True, "reason": "ok", "idempotency_key": "review-api-40"}),
            content_type="application/json",
        )
        client.post(
            f"/api/admin/wallet/withdrawals/{withdrawal.pk}/payout/",
            data=json.dumps({"provider": "mock_provider", "out_trade_no": "out-api-40", "request_payload": {"amount": 900}, "idempotency_key": "payout-api-40"}),
            content_type="application/json",
        )

        payload = {
            "out_trade_no": "out-api-40",
            "provider_trade_no": "trade-40",
            "callback_status": "success",
            "response_payload": {"trade_status": "SUCCESS"},
        }
        invalid_resp = client.post(
            "/api/wallet/payout/callback/mock_provider/",
            data=json.dumps(payload),
            content_type="application/json",
        )
        valid_resp = client.post(
            "/api/wallet/payout/callback/mock_provider/",
            data=json.dumps(payload),
            content_type="application/json",
            HTTP_X_WALLET_CALLBACK_SIGNATURE=build_callback_signature(provider="mock_provider", payload=payload),
        )

        self.assertEqual(invalid_resp.status_code, 403)
        self.assertEqual(valid_resp.status_code, 200)
