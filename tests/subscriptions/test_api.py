import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.subscriptions.constants import BillingCycle, PaymentMode
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
