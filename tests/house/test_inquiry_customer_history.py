from django.test import TestCase

from model_bakery import baker

from apps.house.constants import ContactRole
from apps.house.models import Building, Contact, House, HouseInquiry
from tests.api_helpers import api_data


class InquiryCustomerHistoryTests(TestCase):
    def setUp(self):
        self.owner = baker.make("accounts.User")
        self.staff = baker.make("accounts.User")
        self.org = baker.make("organizations.Organization", slug="customer-history")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.owner, is_owner=True)
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.staff)
        building = Building.objects.create(organization=self.org, name="业务记录公寓", address="测试路1号", floors=5)
        self.house = House.objects.create(building=building, room_number="101")
        self.customer = Contact.objects.create(organization=self.org, name="当前客户", phone="13800138001", roles=[ContactRole.TENANT])
        self.other = Contact.objects.create(organization=self.org, name="其他客户", phone="13800138002", roles=[ContactRole.TENANT])
        self.client.force_login(self.owner)
        self.client.defaults["HTTP_X_ORG_SLUG"] = self.org.slug

    def inquiry(self, contact, assignee):
        return HouseInquiry.objects.create(organization=self.org, house=self.house, contact=contact, customer_name=contact.name, assigned_to=assignee)

    def test_contact_filter_applies_before_pagination_and_excludes_other_customers(self):
        expected = self.inquiry(self.customer, self.staff)
        self.inquiry(self.other, self.owner)
        result = api_data(self.client.get("/api/house/inquiries/", {"contact_id": self.customer.pk, "page_size": 1}))
        self.assertEqual(result["total"], 1)
        self.assertEqual([item["id"] for item in result["items"]], [expected.pk])

    def test_contact_filter_preserves_assignee_and_organization_scope(self):
        expected = self.inquiry(self.customer, self.staff)
        self.inquiry(self.customer, self.owner)
        self.client.force_login(self.staff)
        result = api_data(self.client.get("/api/house/inquiries/", {"contact_id": self.customer.pk}))
        self.assertEqual([item["id"] for item in result["items"]], [expected.pk])
        foreign_customer = baker.make(Contact, roles=[ContactRole.TENANT])
        result = api_data(self.client.get("/api/house/inquiries/", {"contact_id": foreign_customer.pk}))
        self.assertEqual(result["total"], 0)

    def test_contact_filter_rejects_nonpositive_identifiers(self):
        self.assertEqual(self.client.get("/api/house/inquiries/", {"contact_id": 0}).status_code, 400)
