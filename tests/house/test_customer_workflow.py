import json
from datetime import datetime, time, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.allocation.constants import AllocationDistributionMethod
from apps.allocation.models import AllocationRequest
from apps.house.constants import ContactRole, CustomerStage, ViewingRecordStatus
from apps.house.models import Building, Contact, CustomerFollowUp, CustomerProfile, House, HouseInquiry, Lease, LeaseAllocation, ViewingRecord
from apps.house.queries.customers import customer_workbench
from apps.notifications.models import Notification
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data, api_error


class CustomerWorkflowTests(TestCase):
    def setUp(self):
        self.owner = baker.make("accounts.User", username="crm-owner", first_name="管理员")
        self.staff = baker.make("accounts.User", username="crm-staff", first_name="小李")
        self.other = baker.make("accounts.User", username="crm-other")
        self.tenant_user = baker.make("accounts.User", username="crm-tenant", first_name="咨询客户")
        self.org = baker.make("organizations.Organization", name="客户组织", slug="customer-org")
        for user in (self.owner, self.staff, self.other):
            baker.make("organizations.OrganizationMember", organization=self.org, user=user, is_owner=user == self.owner)
        self.building = Building.objects.create(organization=self.org, name="客户公寓", address="客户路一号", floors=5)
        self.landlord = Contact.objects.create(organization=self.org, name="房东", phone="13900139000", roles=[ContactRole.LANDLORD])
        self.house = House.objects.create(building=self.building, landlord=self.landlord, room_number="101")
        self.phone_index = 0
        self.login(self.staff)

    def login(self, user):
        self.client.force_login(user)
        self.client.defaults["HTTP_X_ORG_SLUG"] = self.org.slug

    def post(self, path, data):
        return self.client.post(path, data=json.dumps(data), content_type="application/json")

    def patch(self, path, data):
        return self.client.patch(path, data=json.dumps(data), content_type="application/json")

    def customer(self, assigned_to=None, **profile_fields):
        self.phone_index += 1
        contact = Contact.objects.create(organization=self.org, name=f"客户{self.phone_index}", phone=f"13800138{self.phone_index:03}", roles=[ContactRole.TENANT])
        CustomerProfile.objects.create(contact=contact, assigned_to=assigned_to or self.staff, **profile_fields)
        return contact

    def inquiry(self, **overrides):
        return Notification.objects.create(
            **{
                "organization": self.org,
                "recipient": self.staff,
                "actor": self.tenant_user,
                "target": self.house,
                "category": "house.contact",
                "title": "租客咨询",
                "data": {"house_id": self.house.pk, "phone": "+8613800138100", "wechat": "tenant-wechat"},
                **overrides,
            }
        )

    def test_create_customer_persists_structured_profile_and_defaults_to_actor(self):
        response = self.post(
            "/api/house/customers/",
            {"name": "张先生", "phone": "13800138001", "min_rent": "2000.00", "max_rent": "3500.00", "bedrooms": 1, "preferred_region": "南山", "wechat": "zhang"},
        )
        self.assertEqual(response.status_code, 201)
        customer = api_data(response)
        self.assertEqual(customer["assigned_to_id"], self.staff.pk)
        self.assertEqual(customer["stage_label"], "新客户")
        self.assertEqual(customer["min_rent"], "2000.00")
        detail = api_data(self.client.get(f"/api/house/customers/{customer['id']}/"))
        self.assertEqual(detail["preferred_region"], "南山")
        self.assertNotIn("follow_up_count", detail)
        self.assertEqual(Contact.objects.get(pk=customer["id"]).roles, [ContactRole.TENANT])

    def test_customer_list_and_legacy_contact_entry_respect_assignment(self):
        mine = self.customer()
        private = self.customer(assigned_to=self.other)
        shared = self.customer(assigned_to=self.other)
        shared.roles = [ContactRole.TENANT, ContactRole.LANDLORD]
        shared.save()
        response = self.client.get("/api/house/customers/", {"scope": "all", "page": 1, "page_size": 1})
        self.assertEqual(api_data(response)["total"], 1)
        self.assertEqual(api_data(response)["items"][0]["id"], mine.pk)
        contacts = api_data(self.client.get("/api/house/contacts/"))["items"]
        self.assertNotIn(private.pk, [item["id"] for item in contacts])
        self.assertIn(shared.pk, [item["id"] for item in contacts])
        self.assertEqual(self.client.get(f"/api/house/contacts/{private.pk}/").status_code, 404)
        self.assertEqual(self.patch(f"/api/house/contacts/{private.pk}/", {"notes": "越权"}).status_code, 404)
        self.assertEqual(self.patch(f"/api/house/contacts/{shared.pk}/", {"phone": "13800138999", "notes": "双角色越权"}).status_code, 403)
        shared.refresh_from_db()
        self.assertEqual(shared.notes, "")
        self.assertEqual(self.client.get(f"/api/house/customers/{private.pk}/").status_code, 404)
        self.assertEqual(self.patch(f"/api/house/customers/{private.pk}/", {"notes": "越权"}).status_code, 403)

    def test_capabilities_and_member_manage_role_allow_customer_assignment(self):
        private = self.customer(assigned_to=self.other)
        self.assertFalse(api_data(self.client.get("/api/house/customer-capabilities/"))["can_manage"])
        group = make_access_group("crm-manager", AccessScope.ORG, [("organizations", "member_manage")], organization=self.org)
        bind_org_role(self.org, self.staff, group)
        self.assertTrue(api_data(self.client.get("/api/house/customer-capabilities/"))["can_manage"])
        response = self.patch(f"/api/house/customers/{private.pk}/", {"assigned_to_id": self.staff.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["assigned_to_id"], self.staff.pk)

    def test_employee_cannot_reassign_and_admin_cannot_assign_foreign_member(self):
        contact = self.customer()
        self.assertEqual(self.patch(f"/api/house/customers/{contact.pk}/", {"assigned_to_id": self.other.pk}).status_code, 403)
        foreign = baker.make("organizations.OrganizationMember")
        self.login(self.owner)
        response = self.patch(f"/api/house/customers/{contact.pk}/", {"assigned_to_id": foreign.user_id})
        self.assertEqual(response.status_code, 422)
        contact.customer_profile.refresh_from_db()
        self.assertEqual(contact.customer_profile.assigned_to_id, self.staff.pk)

    def test_follow_up_endpoints_are_disabled_and_history_is_preserved(self):
        contact = self.customer()
        record = CustomerFollowUp.objects.create(customer=contact.customer_profile, created_by=self.staff, content="历史跟进", stage="new")
        path = f"/api/house/customers/{contact.pk}/follow-ups/"
        self.assertEqual(self.post(path, {"content": "新跟进"}).status_code, 404)
        self.assertEqual(self.client.get(path).status_code, 404)
        self.assertEqual(self.patch(f"/api/house/customers/{contact.pk}/", {"next_follow_up_at": timezone.now().isoformat()}).status_code, 400)
        detail = api_data(self.client.get(f"/api/house/customers/{contact.pk}/"))
        self.assertNotIn("next_follow_up_at", detail)
        self.assertNotIn("last_follow_up_at", detail)
        self.assertNotIn("follow_up_count", detail)
        self.assertEqual(CustomerFollowUp.objects.get(pk=record.pk).content, "历史跟进")

    def test_legacy_tenant_can_be_enriched_by_manager_and_contact_create_gets_profile(self):
        old = Contact.objects.create(organization=self.org, name="历史租客", phone="13800138001", roles=[ContactRole.TENANT])
        self.assertEqual(self.patch(f"/api/house/contacts/{old.pk}/", {"notes": "认领"}).status_code, 403)
        self.login(self.owner)
        response = self.patch(f"/api/house/customers/{old.pk}/", {"stage": "contacted", "assigned_to_id": self.staff.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["stage"], "contacted")
        self.login(self.staff)
        response = self.post("/api/house/contacts/", {"name": "旧入口新客户", "phone": "13800138002", "roles": ["tenant"]})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(CustomerProfile.objects.get(contact_id=api_data(response)["id"]).assigned_to_id, self.staff.pk)

    def test_inquiry_conversion_reuses_normalized_phone_and_is_idempotent(self):
        existing = self.customer()
        notification = self.inquiry(data={"house_id": self.house.pk, "phone": f"+86{existing.phone}", "wechat": "inquiry-wechat"})
        path = f"/api/house/customer-inquiries/{notification.pk}/convert/"
        first = self.post(path, {})
        second = self.post(path, {"name": "忽略重复提交的新名称", "phone": "13800138999"})
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(api_data(first)["id"], existing.pk)
        self.assertEqual(api_data(second)["id"], existing.pk)
        self.assertEqual(CustomerProfile.objects.count(), 1)
        notification.refresh_from_db()
        self.assertEqual(notification.data["customer_contact_id"], existing.pk)
        self.assertEqual(api_data(first)["wechat"], "inquiry-wechat")

    def test_wechat_only_inquiry_requires_phone_and_then_creates_customer(self):
        notification = self.inquiry(data={"house_id": self.house.pk, "channels": ["wechat"], "phone": "", "wechat": "we-only"})
        path = f"/api/house/customer-inquiries/{notification.pk}/convert/"
        denied = self.post(path, {})
        self.assertEqual(denied.status_code, 422)
        self.assertIn("补录", api_error(denied)["message"])
        self.assertEqual(CustomerProfile.objects.count(), 0)
        created = self.post(path, {"name": "微信客户", "phone": "13800138001"})
        self.assertEqual(created.status_code, 200)
        self.assertEqual(api_data(created)["wechat"], "we-only")
        profile = CustomerProfile.objects.get(contact_id=api_data(created)["id"])
        self.assertEqual(profile.source, "inquiry")
        self.assertEqual(profile.assigned_to_id, self.staff.pk)

    def test_inquiry_checks_recipient_category_house_target_and_organization(self):
        cases = [
            (self.inquiry(recipient=self.other), 403),
            (self.inquiry(category="other.category"), 422),
            (self.inquiry(data={"house_id": self.house.pk + 999, "phone": "13800138001"}), 422),
            (self.inquiry(organization=baker.make("organizations.Organization")), 404),
        ]
        foreign_building = baker.make(Building, organization=baker.make("organizations.Organization"), location=None, address="异组织地址")
        foreign_house = House.objects.create(building=foreign_building, room_number="foreign")
        cases.append((self.inquiry(target=foreign_house, data={"house_id": foreign_house.pk, "phone": "13800138001"}), 422))
        for notification, expected in cases:
            with self.subTest(notification=notification.pk):
                response = self.post(f"/api/house/customer-inquiries/{notification.pk}/convert/", {})
                self.assertEqual(response.status_code, expected)
        self.assertEqual(CustomerProfile.objects.count(), 0)

    def test_inquiry_reuses_other_owners_contact_without_transferring_profile_and_rejects_ambiguous_phone(self):
        private = self.customer(assigned_to=self.other)
        notification = self.inquiry(data={"house_id": self.house.pk, "phone": private.phone})
        response = self.post(f"/api/house/customer-inquiries/{notification.pk}/convert/", {})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["id"], private.pk)
        private.customer_profile.refresh_from_db()
        self.assertEqual(private.customer_profile.assigned_to_id, self.other.pk)
        self.assertEqual(self.client.get(f"/api/house/customers/{private.pk}/").status_code, 404)
        Contact.objects.create(organization=self.org, name="重号客户", phone="13800138999", roles=[ContactRole.TENANT])
        Contact.objects.create(organization=self.org, name="另一个重号客户", phone="+8613800138999", roles=[ContactRole.TENANT])
        unconfirmed = self.inquiry(actor=baker.make("accounts.User"), data={"house_id": self.house.pk, "phone": "13800138999"})
        response = self.post(f"/api/house/customer-inquiries/{unconfirmed.pk}/convert/", {})
        self.assertEqual(response.status_code, 409)
        self.assertIn("多条", api_error(response)["message"])
        unconfirmed.refresh_from_db()
        self.assertNotIn("customer_contact_id", unconfirmed.data)

    def test_invalid_customer_changes_roll_back_and_cross_org_customer_is_hidden(self):
        contact = self.customer()
        response = self.patch(f"/api/house/customers/{contact.pk}/", {"name": "错误姓名", "min_rent": "5000", "max_rent": "2000"})
        self.assertEqual(response.status_code, 400)
        contact.refresh_from_db()
        self.assertNotEqual(contact.name, "错误姓名")
        foreign = Contact.objects.create(organization=baker.make("organizations.Organization"), name="异组织客户", phone="13800138002", roles=[ContactRole.TENANT])
        self.assertEqual(self.client.get(f"/api/house/customers/{foreign.pk}/").status_code, 404)
        self.assertEqual(self.patch(f"/api/house/customers/{contact.pk}/", {"name": "  "}).status_code, 422)

    def test_viewing_new_and_existing_contact_cannot_bypass_customer_owner(self):
        private = self.customer(assigned_to=self.other)
        response = self.post(
            "/api/house/viewing-records/",
            {
                "house_id": self.house.pk,
                "contact_id": private.pk,
                "customer_name": private.name,
                "customer_phone": private.phone,
                "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat(),
            },
        )
        self.assertEqual(response.status_code, 403)
        record = ViewingRecord.objects.create(
            organization=self.org, house=self.house, contact=private, customer_name=private.name, customer_phone=private.phone, scheduled_at=timezone.now() + timedelta(days=1)
        )
        self.assertEqual(self.patch(f"/api/house/viewing-records/{record.pk}/", {"notes": "越权"}).status_code, 404)

    def pending_allocation(self, contact, submitter):
        lease = Lease.objects.create(
            organization=self.org,
            house=self.house,
            tenant=contact,
            start_date=timezone.localdate(),
            end_date=timezone.localdate() + timedelta(days=365),
            monthly_rent="3000.00",
        )
        now = timezone.now()
        allocation = AllocationRequest.objects.create(
            organization=self.org,
            basis_amount="100.00",
            distribution_method=AllocationDistributionMethod.FIXED,
            distributable_amount="100.00",
            submitted_by=submitter,
            submitted_by_name_snapshot=submitter.username,
            submitted_at=now,
            expires_at=now + timedelta(days=7),
        )
        LeaseAllocation.objects.create(lease=lease, allocation_request=allocation)

    def test_workbench_counts_timezone_assignment_and_pending_allocation_permissions(self):
        with timezone.override(ZoneInfo("Asia/Shanghai")):
            now = timezone.now()
            mine = self.customer(next_follow_up_at=now - timedelta(hours=1))
            other = self.customer(assigned_to=self.other, next_follow_up_at=now - timedelta(hours=2))
            self.customer(stage=CustomerStage.WON, next_follow_up_at=now - timedelta(hours=3))
            inactive = self.customer(next_follow_up_at=now - timedelta(hours=4))
            inactive.is_active = False
            inactive.save()
            start = timezone.make_aware(datetime.combine(timezone.localdate(), time.min))
            for assignee, scheduled_at in [
                (self.staff, start),
                (self.other, start + timedelta(hours=2)),
                (None, start + timedelta(hours=3)),
                (self.staff, start + timedelta(days=1)),
            ]:
                ViewingRecord.objects.create(
                    organization=self.org, house=self.house, customer_name="看房客户", customer_phone="13800138000", assigned_to=assignee, scheduled_at=scheduled_at
                )
            ViewingRecord.objects.create(
                organization=self.org,
                house=self.house,
                customer_name="取消客户",
                customer_phone="13800138000",
                assigned_to=self.staff,
                scheduled_at=start,
                status=ViewingRecordStatus.CANCELED,
            )
            self.pending_allocation(mine, self.staff)
            self.pending_allocation(other, self.other)
            mine_inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, contact=mine, assigned_to=self.staff)
            other_inquiry = HouseInquiry.objects.create(organization=self.org, house=self.house, contact=other, assigned_to=self.other)
            staff = api_data(self.client.get("/api/house/customer-workbench/"))
            self.assertEqual((staff["new_customers"], staff["new_inquiries"], staff["today_viewings"], staff["unassigned_viewings"], staff["pending_allocations"]), (1, 1, 1, 0, 1))
            self.assertEqual([item["inquiry_id"] for item in staff["items"]], [mine_inquiry.pk])
            self.assertEqual(api_data(self.client.get("/api/house/customers/", {"stage": "new"}))["total"], staff["new_customers"])
            self.assertIn(inactive.pk, [item["id"] for item in api_data(self.client.get("/api/house/customers/"))["items"]])
            self.assertNotIn("due_follow_ups", staff)
            self.login(self.owner)
            owner = api_data(self.client.get("/api/house/customer-workbench/"))
            self.assertEqual((owner["new_customers"], owner["new_inquiries"], owner["today_viewings"], owner["unassigned_viewings"], owner["pending_allocations"]), (2, 2, 3, 1, 2))
            self.assertEqual([item["inquiry_id"] for item in owner["items"]], [mine_inquiry.pk, other_inquiry.pk])

    def test_workbench_uses_actor_timezone_even_without_session_timezone_activation(self):
        utc = ZoneInfo("UTC")
        now = datetime(2026, 1, 1, 17, 30, tzinfo=utc)
        for scheduled_at in [datetime(2026, 1, 1, 17, tzinfo=utc), datetime(2026, 1, 1, 7, tzinfo=utc), datetime(2026, 1, 2, 16, tzinfo=utc)]:
            ViewingRecord.objects.create(
                organization=self.org, house=self.house, customer_name="跨日客户", customer_phone="13800138000", assigned_to=self.staff, scheduled_at=scheduled_at
            )
        with timezone.override(utc), patch("apps.house.queries.customers.timezone.now", return_value=now):
            summary = customer_workbench(organization=self.org, actor=self.staff)
        self.assertEqual(summary["today_viewings"], 1)
