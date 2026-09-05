import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.accounts.models import User
from apps.allocation.constants import AccrualEntryType, AllocationRequestStatus, AllocationRuleSource
from apps.allocation.models import AccrualEntry
from apps.house.allocation_rules import resolve_lease_allocation_rule
from apps.house.constants import ContactRole, EstatePropertyType, HouseStatus
from apps.house.models import Building, Contact, Estate, House, Lease
from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting
from apps.teams.models import Team
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data


class AllocationApiTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="allocation-owner", password="secret", first_name="负责人")  # noqa: S106
        self.beneficiary = User.objects.create_user(username="allocation-staff", password="secret", first_name="员工")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="分配 API 组织", slug="allocation-api-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.beneficiary)
        self.allocation_rule_setting = DefaultSetting.objects.create(
            key="property_rental.lease_allocation_rule",
            value={"method": "percentage", "rate_bp": 9000, "fixed_amount": None},
            value_type="json",
            widget="json_editor",
            label="签约员工收益规则",
            description="登记签约时使用的员工收益规则。",
            category="property_rental",
            ui={"scopes": ["organization", "team"], "inherit_org": True, "control": "lease_allocation_rule"},
        )
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()
        estate = Estate.objects.create(
            organization=self.org,
            name="云岸",
            display_name="云岸",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="科技园",
        )
        building = Building.objects.create(organization=self.org, estate=estate, name="1 栋", address="科技园 1 栋", floors=20)
        landlord = Contact.objects.create(organization=self.org, name="房东", phone="13800138000", roles=[ContactRole.LANDLORD])
        self.tenant = Contact.objects.create(organization=self.org, name="租客", phone="13900139000", roles=[ContactRole.TENANT])
        self.house = House.objects.create(building=building, landlord=landlord, room_number="1201")

    def create_payload(self):
        return {
            "lease": {
                "house_id": self.house.pk,
                "tenant_id": self.tenant.pk,
                "start_date": "2026-01-01",
                "end_date": "2026-12-31",
                "monthly_rent": "5000.00",
            },
            "beneficiary_user_ids": [self.beneficiary.pk],
        }

    def create_deal_signing_payload(self, *, name="租客", phone="13900139000"):
        payload = self.create_payload()
        payload["lease"].pop("tenant_id")
        payload["lease"]["tenant_identity"] = {"name": name, "phone": phone}
        return payload

    def test_deal_signing_identity_reuses_exact_existing_tenant(self):
        response = self.client.post(
            "/api/house/leases/deal-signing/",
            data=self.create_deal_signing_payload(),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        created = api_data(response)
        self.assertEqual(created["lease"]["tenant_id"], self.tenant.pk)
        self.assertEqual(Contact.objects.filter(organization=self.org, name="租客", phone="13900139000").count(), 1)
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.RENTED)

    def test_deal_signing_identity_allows_same_phone_for_different_name(self):
        response = self.client.post(
            "/api/house/leases/deal-signing/",
            data=self.create_deal_signing_payload(name="租客家属"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        created = api_data(response)
        tenant = Contact.objects.get(pk=created["lease"]["tenant_id"])
        self.assertEqual(tenant.name, "租客家属")
        self.assertEqual(tenant.phone, self.tenant.phone)
        self.assertNotEqual(tenant.pk, self.tenant.pk)

    def test_deal_signing_rolls_back_new_tenant_with_failed_allocation(self):
        payload = self.create_deal_signing_payload(name="事务租客", phone="13900139999")

        with (
            patch("apps.house.allocation_services.create_allocation_request", side_effect=RuntimeError("分配失败")),
            self.assertRaises(RuntimeError),
        ):
            self.client.post(
                "/api/house/leases/deal-signing/",
                data=payload,
                content_type="application/json",
            )

        self.assertFalse(Contact.objects.filter(organization=self.org, name="事务租客", phone="13900139999").exists())
        self.assertFalse(Lease.objects.filter(house=self.house).exists())
        self.house.refresh_from_db()
        self.assertEqual(self.house.status, HouseStatus.VACANT)

    def test_create_review_and_query_allocation(self):
        create_response = self.client.post("/api/house/leases/with-allocation/", data=self.create_payload(), content_type="application/json")

        self.assertEqual(create_response.status_code, 201)
        created = api_data(create_response)
        lease_id = created["lease"]["id"]
        allocation_request_id = created["allocation_request"]["id"]
        self.assertEqual(created["allocation_request"]["status"], AllocationRequestStatus.PENDING)
        self.assertEqual(created["allocation_request"]["basis_amount"], "5000.00")
        self.assertEqual(created["allocation_request"]["distribution_rate_bp"], 9000)
        self.assertEqual(created["allocation_request"]["distributable_amount"], "4500.00")

        review_response = self.client.post(
            f"/api/house/leases/{lease_id}/allocation/review/",
            data={"decision": "approve"},
            content_type="application/json",
        )
        detail_response = self.client.get(f"/api/allocation/requests/{allocation_request_id}/")
        entries_response = self.client.get("/api/allocation/entries/")

        self.assertEqual(review_response.status_code, 200)
        self.assertEqual(api_data(review_response)["status"], AllocationRequestStatus.APPROVED)
        self.assertEqual(detail_response.status_code, 200)
        self.assertEqual(api_data(detail_response)["shares"][0]["allocated_amount"], "4500.00")
        self.assertEqual(api_data(detail_response)["shares"][0]["attributed_basis_amount"], "5000.00")
        self.assertEqual(entries_response.status_code, 200)
        self.assertEqual(api_data(entries_response)["items"][0]["amount"], "4500.00")
        self.assertEqual(api_data(entries_response)["items"][0]["allocation_request_id"], allocation_request_id)

    def test_fixed_allocation_uses_distributable_amount_directly(self):
        OrganizationSetting.objects.create(
            organization=self.org,
            setting=self.allocation_rule_setting,
            value={"method": "fixed", "rate_bp": None, "fixed_amount": "88.00"},
        )

        response = self.client.post("/api/house/leases/with-allocation/", data=self.create_payload(), content_type="application/json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(api_data(response)["allocation_request"]["distributable_amount"], "88.00")

    def test_manual_adjustment_and_monthly_total(self):
        response = self.client.post(
            "/api/allocation/manual-entries/",
            data={
                "beneficiary_user_id": self.beneficiary.pk,
                "entry_type": AccrualEntryType.MANUAL_DECREASE,
                "amount": "25.50",
                "effective_month": date.today().replace(day=1).isoformat(),
                "reason": "人工扣减",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(api_data(response)["amount"], "-25.50")
        entry = AccrualEntry.objects.get()
        totals_response = self.client.get(f"/api/allocation/monthly-totals/?effective_month={date.today().isoformat()}")
        self.assertEqual(totals_response.status_code, 200)
        self.assertEqual(api_data(totals_response)["items"][0]["beneficiary_user_id"], self.beneficiary.pk)
        self.assertEqual(Decimal(api_data(totals_response)["items"][0]["manual_decrease_amount"]), entry.amount)
        self.assertEqual(Decimal(api_data(totals_response)["items"][0]["total_amount"]), entry.amount)

    def test_member_without_allocation_permission_cannot_submit(self):
        member = User.objects.create_user(username="plain-member", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=member)
        self.client.force_login(member)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False})
        session.save()

        response = self.client.post("/api/house/leases/with-allocation/", data=self.create_payload(), content_type="application/json")

        self.assertEqual(response.status_code, 403)

    def test_team_rule_inherits_organization_then_uses_team_override(self):
        team = Team.objects.create(organization=self.org, name="南山团队")
        team.members.add(self.user)
        OrganizationSetting.objects.create(
            organization=self.org,
            setting=self.allocation_rule_setting,
            value={"method": "fixed", "rate_bp": None, "fixed_amount": "75.00"},
        )

        inherited = resolve_lease_allocation_rule(self.org, team=team)

        self.assertEqual(inherited.source, AllocationRuleSource.ORGANIZATION)
        self.assertEqual(inherited.fixed_amount, Decimal("75.00"))

        TeamSetting.objects.create(
            team=team,
            setting=self.allocation_rule_setting,
            value={"method": "percentage", "rate_bp": 5000, "fixed_amount": None},
        )
        overridden = resolve_lease_allocation_rule(self.org, team=team)
        self.assertEqual(overridden.source, AllocationRuleSource.TEAM)
        self.assertEqual(overridden.rate_bp, 5000)

    def test_equal_shares_keep_cent_total_and_stable_remainder(self):
        second = User.objects.create_user(username="allocation-second", password="secret", first_name="乙")  # noqa: S106
        third = User.objects.create_user(username="allocation-third", password="secret", first_name="丙")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=second)
        baker.make("organizations.OrganizationMember", organization=self.org, user=third)
        payload = self.create_payload()
        payload["lease"]["monthly_rent"] = "100.01"
        payload["beneficiary_user_ids"] = [third.pk, self.beneficiary.pk, second.pk]

        response = self.client.post("/api/house/leases/with-allocation/", data=payload, content_type="application/json")

        self.assertEqual(response.status_code, 201)
        shares = api_data(response)["allocation_request"]["shares"]
        amounts = [Decimal(share["allocated_amount"]) for share in shares]
        self.assertEqual(sum(amounts), Decimal("90.01"))
        self.assertEqual(amounts, [Decimal("30.01"), Decimal("30.00"), Decimal("30.00")])

    def test_submitter_without_change_beneficiaries_must_use_self(self):
        member = User.objects.create_user(username="allocation-submitter", password="secret", first_name="提交人")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=member)
        group = make_access_group(
            "allocation-submit-only",
            AccessScope.ORG,
            [("allocation", "submit")],
            organization=self.org,
        )
        bind_org_role(self.org, member, group)
        self.client.force_login(member)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        response = self.client.post("/api/house/leases/with-allocation/", data=self.create_payload(), content_type="application/json")

        self.assertEqual(response.status_code, 403)

    def test_manual_adjustment_rejects_future_month(self):
        today = date.today()
        next_month = date(today.year + (1 if today.month == 12 else 0), 1 if today.month == 12 else today.month + 1, 1)

        response = self.client.post(
            "/api/allocation/manual-entries/",
            data={
                "beneficiary_user_id": self.beneficiary.pk,
                "entry_type": AccrualEntryType.MANUAL_INCREASE,
                "amount": "10.00",
                "effective_month": next_month.isoformat(),
                "reason": "不允许归属未来月份",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
