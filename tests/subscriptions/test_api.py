import json

from django.test import TestCase, override_settings

from model_bakery import baker

from apps.accounts.models import User
from apps.subscriptions.constants import BillingCycle, OrderStatus, PaymentMode
from apps.subscriptions.models import Plan, PlanEntitlement, PlanPrice
from tests.api_helpers import api_data


class SubscriptionAPITest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="subscription-owner", password="secret", phone_verified=True)  # noqa: S106
        self.organization = baker.make("organizations.Organization", created_by=self.user)
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.user, is_owner=True)
        free = Plan.objects.create(code="free", name="免费版", display_order=10)
        professional = Plan.objects.create(code="professional", name="专业版", display_order=30)
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

    def test_owner_can_read_current_free_entitlement(self):
        response = self.client.get("/api/subscriptions/current/")

        self.assertEqual(response.status_code, 200)
        data = api_data(response)
        self.assertEqual(data["plan"]["code"], "free")
        self.assertEqual(data["entitlement"]["member_limit"], 3)
        self.assertIsNone(data["recommendation"])

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

    def test_order_list_only_includes_paid_orders(self):
        professional = Plan.objects.get(code="professional")
        paid_order = baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.PAID,
            plan_snapshot={"code": professional.code},
        )
        baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.PENDING_PAYMENT,
        )
        baker.make(
            "subscriptions.SaaSOrder",
            organization=self.organization,
            target_plan=professional,
            status=OrderStatus.CLOSED,
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
        self.assertEqual(data["total"], 1)
        self.assertEqual([item["id"] for item in data["items"]], [paid_order.pk])
        self.assertEqual(data["items"][0]["status"], OrderStatus.PAID)

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
