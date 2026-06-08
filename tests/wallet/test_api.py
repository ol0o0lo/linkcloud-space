import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
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
