import json

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.subscriptions.models import Plan, PlanEntitlement


class SubscriptionQuotaIntegrationTest(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="quota-owner", password="secret", phone_verified=True)  # noqa: S106
        self.organization = baker.make("organizations.Organization", created_by=self.owner)
        baker.make("organizations.OrganizationMember", organization=self.organization, user=self.owner, is_owner=True)
        free = Plan.objects.create(code="free", name="免费版", display_order=10)
        PlanEntitlement.objects.create(plan=free, version=1, is_current=True, member_limit=3, team_limit=1, house_limit=50)
        self.client.force_login(self.owner)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.organization.pk, "id": self.organization.pk, "name": self.organization.name, "slug": self.organization.slug, "is_owner": True}
        )
        session.save()

    def test_member_creation_stops_at_current_subscription_limit(self):
        first = baker.make("accounts.User")
        second = baker.make("accounts.User")
        blocked = baker.make("accounts.User")
        for user in (first, second):
            response = self.client.post("/api/organization-members/", data=json.dumps({"user": user.pk}), content_type="application/json")
            self.assertEqual(response.status_code, 201)

        response = self.client.post("/api/organization-members/", data=json.dumps({"user": blocked.pk}), content_type="application/json")

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"], "QUOTA_EXCEEDED")
