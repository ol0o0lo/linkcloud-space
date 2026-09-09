import json
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.accounts.models import User
from apps.notifications.models import Notification
from apps.subscriptions.api import _serialize_order
from apps.subscriptions.constants import BillingCycle, InvoiceStatus, OrderCloseReason, OrderStatus, PaymentMode
from apps.subscriptions.models import InvoiceRequest, OrganizationInvoiceProfile, Plan, PlanEntitlement, PlanPrice, SaaSOrder, SubscriptionAuditLog
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data


class SubscriptionAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="subscription-owner", password="secret", phone_verified=True)  # noqa: S106
        self.organization = baker.make("organizations.Organization", created_by=self.user)
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.user, is_owner=True)
        free = Plan.objects.create(code="free", name="免费版", display_order=10)
        professional = Plan.objects.create(code="professional", name="专业版", display_order=30)
        self.professional = professional
        PlanEntitlement.objects.create(plan=free, version=1, is_current=True, member_limit=3, team_limit=1, house_limit=50)
        PlanEntitlement.objects.create(plan=professional, version=1, is_current=True, member_limit=30, team_limit=10, house_limit=3000)
        PlanPrice.objects.create(plan=professional, billing_cycle=BillingCycle.MONTH, version=1, is_current=True, amount=29900)
        PlanPrice.objects.create(plan=professional, billing_cycle=BillingCycle.YEAR, version=1, is_current=True, amount=299900)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.organization.pk, "id": self.organization.pk, "name": self.organization.name, "slug": self.organization.slug, "is_owner": True}
        )
        session.save()

    def select_user(self, user, *, is_owner: bool):
        self.client.force_login(user)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {
                "pk": self.organization.pk,
                "id": self.organization.pk,
                "name": self.organization.name,
                "slug": self.organization.slug,
                "is_owner": is_owner,
            }
        )
        session.save()

    def test_owner_can_read_current_free_entitlement(self):
        response = self.client.get("/api/subscriptions/current/")

        self.assertEqual(response.status_code, 200)
        data = api_data(response)
        self.assertEqual(data["plan"]["code"], "free")
        self.assertEqual(data["entitlement"]["member_limit"], 3)
        self.assertIsNone(data["recommendation"])

    def test_view_only_member_can_see_invoice_progress_but_not_sensitive_profile(self):
        member = User.objects.create_user(username="subscription-viewer", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.organization, user=member, is_owner=False)
        group = make_access_group(
            "subscription-view-only",
            AccessScope.ORG,
            [("subscriptions", "subscription_view")],
            organization=self.organization,
        )
        bind_org_role(self.organization, member, group)
        profile = OrganizationInvoiceProfile.objects.create(
            organization=self.organization,
            invoice_type="company",
            title="链云测试科技有限公司",
            tax_number="91440000123456789X",
            recipient_email="finance@example.com",
            bank_account="6222000000000000",
        )
        order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=self.professional,
            status=OrderStatus.PAID,
            plan_snapshot={"code": "professional", "name": "专业版"},
        )
        InvoiceRequest.objects.create(order=order, profile_snapshot={"title": profile.title, "tax_number": profile.tax_number, "bank_account": profile.bank_account})
        self.select_user(member, is_owner=False)

        profile_response = self.client.get("/api/subscriptions/invoice-profile/")
        requests_response = self.client.get("/api/subscriptions/invoice-requests/?page=1&page_size=10")

        self.assertEqual(profile_response.status_code, 403)
        self.assertEqual(requests_response.status_code, 200)
        self.assertEqual(api_data(requests_response)["items"][0]["profile_snapshot"], {})

    def test_manage_only_member_can_read_subscription_resources(self):
        member = User.objects.create_user(username="subscription-manager", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.organization, user=member, is_owner=False)
        group = make_access_group(
            "subscription-manage-only",
            AccessScope.ORG,
            [("subscriptions", "subscription_manage")],
            organization=self.organization,
        )
        bind_org_role(self.organization, member, group)
        OrganizationInvoiceProfile.objects.create(
            organization=self.organization,
            invoice_type="company",
            title="链云管理测试科技有限公司",
            recipient_email="manager@example.com",
        )
        order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=self.professional,
            order_no="LC-MANAGE-READ-001",
            status=OrderStatus.PAID,
            plan_snapshot={"code": "professional", "name": "专业版"},
        )
        InvoiceRequest.objects.create(order=order, profile_snapshot={"title": "链云管理测试科技有限公司"})
        self.select_user(member, is_owner=False)

        responses = [
            self.client.get("/api/subscriptions/current/"),
            self.client.get("/api/subscriptions/orders/?page=1&page_size=10"),
            self.client.get(f"/api/subscriptions/orders/{order.order_no}/"),
            self.client.get("/api/subscriptions/invoice-requests/?page=1&page_size=10"),
            self.client.get("/api/subscriptions/invoice-profile/"),
        ]

        self.assertEqual([response.status_code for response in responses], [200, 200, 200, 200, 200])

    def test_current_subscription_recommends_upgrade_when_usage_exceeds_threshold(self):
        baker.make("teams.Team", organization=self.organization)

        response = self.client.get("/api/subscriptions/current/")

        self.assertEqual(response.status_code, 200)
        recommendation = api_data(response)["recommendation"]
        self.assertEqual(recommendation["reason"], "usage_threshold_exceeded")
        self.assertEqual(recommendation["threshold_percent"], 60)
        self.assertEqual(recommendation["target_plan_code"], "professional")
        self.assertEqual(recommendation["target_plan_name"], "专业版")
        self.assertEqual(
            recommendation["triggered_resources"],
            [{"resource": "team", "current": 1, "limit": 1, "usage_percent": 100}],
        )

    def test_owner_creates_order_using_server_price(self):
        response = self.client.post(
            "/api/subscriptions/orders/",
            data=json.dumps(
                {
                    "target_plan_code": "professional",
                    "billing_cycle": BillingCycle.MONTH,
                    "payment_mode": PaymentMode.NATIVE,
                    "payable_amount": 1,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        data = api_data(response)
        self.assertEqual(data["payable_amount"], 29900)
        self.assertEqual(data["status"], "pending_payment")

    @override_settings(PAYMENTS_WECHAT_PAY_ENABLED=True)
    def test_replaying_paid_idempotent_order_does_not_restart_checkout(self):
        professional = Plan.objects.get(code="professional")
        order = baker.make(
            SaaSOrder,
            organization=self.organization,
            target_plan=professional,
            order_no="LC-IDEMPOTENT-PAID-001",
            idempotency_key="frontend-attempt-001",
            status=OrderStatus.PAID,
            plan_snapshot={"code": professional.code, "name": professional.name},
            billing_cycle=BillingCycle.MONTH,
        )
        baker.make(
            "payments.PaymentTransaction",
            biz_type="subscriptions.saas_order",
            biz_id=str(order.pk),
            payment_mode=PaymentMode.NATIVE,
            status="succeeded",
            expires_at=order.expires_at,
        )

        with patch("apps.subscriptions.api.initiate_wechat_payment", return_value={"code_url": "unexpected"}) as initiate:
            response = self.client.post(
                "/api/subscriptions/orders/",
                data=json.dumps(
                    {
                        "target_plan_code": professional.code,
                        "billing_cycle": BillingCycle.MONTH,
                        "payment_mode": PaymentMode.NATIVE,
                        "idempotency_key": "frontend-attempt-001",
                    }
                ),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(api_data(response)["status"], OrderStatus.PAID)
        initiate.assert_not_called()

    def test_order_list_includes_all_states_and_resumable_native_checkout(self):
        professional = Plan.objects.get(code="professional")
        paid_order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.PAID,
            plan_snapshot={"code": professional.code},
        )
        pending_order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.PENDING_PAYMENT,
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        closed_order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.CLOSED,
        )
        pending_payment = baker.make(
            "payments.PaymentTransaction",
            biz_type="subscriptions.saas_order",
            biz_id=str(pending_order.pk),
            payment_mode=PaymentMode.NATIVE,
            status="pending",
            expires_at=pending_order.expires_at,
            response_snapshot={"code_url": "weixin://wxpay/bizpayurl?pr=resume"},
        )
        other_organization = baker.make("organizations.Organization")
        baker.make(
            "subscriptions.SaaSOrder",
            organization=other_organization,
            target_plan=professional,
            status=OrderStatus.PAID,
        )

        response = self.client.get("/api/subscriptions/orders/?page=1&page_size=10")

        self.assertEqual(response.status_code, 200)
        data = api_data(response)
        self.assertEqual(data["total"], 3)
        items = {item["id"]: item for item in data["items"]}
        self.assertEqual(set(items), {paid_order.pk, pending_order.pk, closed_order.pk})
        self.assertEqual(items[pending_order.pk]["payment"]["transaction_no"], pending_payment.transaction_no)
        self.assertEqual(items[pending_order.pk]["payment"]["checkout"]["code_url"], "weixin://wxpay/bizpayurl?pr=resume")
        self.assertEqual(items[pending_order.pk]["payment"]["expires_at"], pending_order.expires_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"))

    def test_order_list_only_serializes_the_requested_page(self):
        professional = Plan.objects.get(code="professional")
        baker.make(
            "subscriptions.SaaSOrder",
            _quantity=2,
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.PAID,
            plan_snapshot={"code": professional.code},
        )

        with patch("apps.subscriptions.api._serialize_order", wraps=_serialize_order) as serialize_order:
            response = self.client.get("/api/subscriptions/orders/?page=1&page_size=1")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["total"], 2)
        self.assertEqual(serialize_order.call_count, 1)

    def test_owner_can_cancel_pending_order_and_schedule_wechat_close(self):
        professional = Plan.objects.get(code="professional")
        order = baker.make(
            SaaSOrder,
            organization=self.organization,
            target_plan=professional,
            order_no="LC-CANCEL-001",
            status=OrderStatus.PENDING_PAYMENT,
        )

        with (
            patch("apps.subscriptions.tasks.close_saas_order_in_wechat_task.delay") as close_payment_task,
            self.captureOnCommitCallbacks(execute=True),
        ):
            response = self.client.post(f"/api/subscriptions/orders/{order.order_no}/cancel/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["status"], OrderStatus.CLOSED)
        self.assertEqual(api_data(response)["close_reason"], OrderCloseReason.USER_CANCELLED)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.CLOSED)
        self.assertEqual(order.close_reason, OrderCloseReason.USER_CANCELLED)
        self.assertIsNotNone(order.closed_at)
        close_payment_task.assert_called_once_with(order.pk)
        self.assertTrue(
            SubscriptionAuditLog.objects.filter(
                action="order_cancelled",
                actor=self.user,
                organization=self.organization,
                target_id=order.pk,
                after={"close_reason": OrderCloseReason.USER_CANCELLED},
            ).exists()
        )

    def test_owner_can_refresh_pending_payment_state(self):
        professional = Plan.objects.get(code="professional")
        order = baker.make(
            SaaSOrder,
            organization=self.organization,
            target_plan=professional,
            order_no="LC-REFRESH-001",
            status=OrderStatus.PENDING_PAYMENT,
        )
        payment = baker.make(
            "payments.PaymentTransaction",
            biz_type="subscriptions.saas_order",
            biz_id=str(order.pk),
            payment_mode=PaymentMode.NATIVE,
            status="pending",
            expires_at=order.expires_at,
        )

        with patch("apps.subscriptions.api.reconcile_saas_order_payment", return_value=(order, payment)) as reconcile:
            response = self.client.post(f"/api/subscriptions/orders/{order.order_no}/refresh-payment/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["payment"]["status"], "pending")
        reconcile.assert_called_once_with(order=order, payment=payment)

    @override_settings(PAYMENTS_WECHAT_PAY_ENABLED=True)
    def test_owner_can_resume_pending_native_checkout(self):
        professional = Plan.objects.get(code="professional")
        order = baker.make(
            SaaSOrder,
            organization=self.organization,
            target_plan=professional,
            order_no="LC-CHECKOUT-001",
            status=OrderStatus.PENDING_PAYMENT,
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        payment = baker.make(
            "payments.PaymentTransaction",
            biz_type="subscriptions.saas_order",
            biz_id=str(order.pk),
            payment_mode=PaymentMode.NATIVE,
            status="pending",
            expires_at=order.expires_at,
            response_snapshot={},
        )

        with patch(
            "apps.subscriptions.api.initiate_wechat_payment",
            return_value={"code_url": "weixin://wxpay/bizpayurl?pr=continued"},
        ) as initiate:
            response = self.client.post(f"/api/subscriptions/orders/{order.order_no}/checkout/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["payment"]["checkout"]["code_url"], "weixin://wxpay/bizpayurl?pr=continued")
        initiate.assert_called_once_with(order=order, payment=payment, user=self.user)

    def test_paid_order_cannot_be_cancelled(self):
        professional = Plan.objects.get(code="professional")
        order = baker.make(
            SaaSOrder,
            organization=self.organization,
            target_plan=professional,
            order_no="LC-CANCEL-PAID",
            status=OrderStatus.PAID,
        )

        response = self.client.post(f"/api/subscriptions/orders/{order.order_no}/cancel/")

        self.assertEqual(response.status_code, 400)
        order.refresh_from_db()
        self.assertEqual(order.status, OrderStatus.PAID)

    @override_settings(PAYMENTS_TEST_AMOUNT_CENTS=1)
    def test_test_amount_only_overrides_order_amount(self):
        catalog = api_data(self.client.get("/api/subscriptions/plans/"))
        professional = next(plan for plan in catalog if plan["code"] == "professional")
        self.assertEqual([price["amount"] for price in professional["prices"]], [29900, 299900])

        response = self.client.post(
            "/api/subscriptions/orders/",
            data=json.dumps(
                {
                    "target_plan_code": "professional",
                    "billing_cycle": BillingCycle.MONTH,
                    "payment_mode": PaymentMode.NATIVE,
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(api_data(response)["payable_amount"], 1)


class SubscriptionAdminAPITest(TestCase):
    def setUp(self):
        self.admin = baker.make(User, is_superuser=True, is_staff=True)
        self.invoice_requester = baker.make(User)
        self.organization = baker.make(
            "organizations.Organization",
            name="链云测试空间",
            slug="linkcloud-test-space",
        )
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.invoice_requester, is_owner=True)
        self.plan = Plan.objects.create(code="professional", name="专业版", display_order=30)
        self.order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=self.plan,
            order_no="LC202608300001",
            status=OrderStatus.PAID,
            plan_snapshot={"code": self.plan.code, "name": self.plan.name},
        )
        self.invoice_request = InvoiceRequest.objects.create(
            order=self.order,
            profile_snapshot={"title": "链云测试科技有限公司"},
            created_by=self.invoice_requester,
        )
        self.client.force_login(self.admin)

    def test_admin_order_rows_include_organization_and_plan_identity(self):
        response = self.client.get("/api/admin/subscriptions/orders/?page=1&page_size=10")

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["organization_id"], self.organization.pk)
        self.assertEqual(item["organization_name"], "链云测试空间")
        self.assertEqual(item["organization_slug"], "linkcloud-test-space")
        self.assertEqual(item["order_no"], "LC202608300001")
        self.assertEqual(item["target_plan_code"], "professional")
        self.assertEqual(item["target_plan_name"], "专业版")

    def test_admin_invoice_rows_include_organization_and_order_identity(self):
        response = self.client.get("/api/admin/subscriptions/invoice-requests/?page=1&page_size=10")

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["id"], self.invoice_request.pk)
        self.assertEqual(item["organization_id"], self.organization.pk)
        self.assertEqual(item["organization_name"], "链云测试空间")
        self.assertEqual(item["organization_slug"], "linkcloud-test-space")
        self.assertEqual(item["order_no"], "LC202608300001")
        self.assertEqual(item["target_plan_code"], "professional")
        self.assertEqual(item["target_plan_name"], "专业版")
        self.assertEqual(item["profile_snapshot"]["title"], "链云测试科技有限公司")

    def test_invoice_result_notifies_requester(self):
        response = self.client.patch(
            f"/api/admin/subscriptions/invoice-requests/{self.invoice_request.pk}/",
            data=json.dumps(
                {
                    "status": InvoiceStatus.ISSUED,
                    "invoice_number": "FP-20260906-001",
                    "file_url": "https://example.com/invoices/FP-20260906-001.pdf",
                    "admin_note": "电子发票已开具",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        notification = Notification.objects.get(recipient=self.invoice_requester, data__event="invoice_issued")
        self.assertEqual(notification.title, "订阅发票已开具")
        self.assertEqual(notification.data["order_no"], self.order.order_no)

    def test_admin_can_see_and_refund_late_payment_exception(self):
        self.order.status = OrderStatus.CLOSED
        self.order.close_reason = OrderCloseReason.USER_CANCELLED
        self.order.save(update_fields=["status", "close_reason", "updated_at"])
        payment = baker.make(
            "payments.PaymentTransaction",
            biz_type="subscriptions.saas_order",
            biz_id=str(self.order.pk),
            status="exception",
            payment_mode=PaymentMode.NATIVE,
            provider_trade_no="WX-LATE-001",
            amount=self.order.payable_amount,
        )

        response = self.client.get("/api/admin/subscriptions/orders/?page=1&page_size=10")

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["close_reason"], OrderCloseReason.USER_CANCELLED)
        self.assertEqual(item["payment"]["status"], "exception")
        self.assertEqual(item["payment"]["provider_trade_no"], "WX-LATE-001")

        response = self.client.post(
            f"/api/admin/subscriptions/orders/{self.order.pk}/refund/",
            data=json.dumps(
                {
                    "amount": payment.amount,
                    "reason": "迟到付款已退回",
                    "proof": "WX-REFUND-LATE-001",
                    "subscription_action": "keep",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["refund_status"], "full")
