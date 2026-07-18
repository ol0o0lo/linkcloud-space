import json

from django.contrib.auth import user_logged_in
from django.core.exceptions import ValidationError
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole
from apps.house.models import Building, Contact, Estate, House, PropertyResponsibility
from apps.organizations.signals import user_logged_in_receiver
from tests.api_helpers import api_data


class PropertyResponsibilityApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.owner = User.objects.create_user(username="responsibility-owner", password="secret")  # noqa: S106
        self.employee = User.objects.create_user(username="maintenance-staff", first_name="维修", last_name="员工", password="secret")  # noqa: S106
        self.building_employee = User.objects.create_user(username="building-staff", first_name="楼栋", last_name="员工", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="职责测试组织", slug="responsibility-org")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.owner, is_owner=True)
        self.member = baker.make("organizations.OrganizationMember", organization=self.org, user=self.employee)
        self.building_member = baker.make("organizations.OrganizationMember", organization=self.org, user=self.building_employee)
        self.client.force_login(self.owner)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()

        self.estate = Estate.objects.create(
            organization=self.org,
            name="云岸",
            display_name="云岸花园",
            province="广东",
            city="深圳",
            district="南山",
        )
        self.other_estate = Estate.objects.create(
            organization=self.org,
            name="海景",
            display_name="海景公寓",
            province="广东",
            city="深圳",
            district="南山",
        )
        self.building = Building.objects.create(organization=self.org, estate=self.estate, name="1栋", address="云岸 1 栋", floors=20)
        self.estate_only_building = Building.objects.create(organization=self.org, estate=self.estate, name="3栋", address="云岸 3 栋", floors=20)
        self.other_building = Building.objects.create(organization=self.org, estate=self.other_estate, name="2栋", address="海景 2 栋", floors=20)
        self.landlord = Contact.objects.create(organization=self.org, name="张房东", phone="13800138001", roles=[ContactRole.LANDLORD])
        self.overlap_house = House.objects.create(building=self.building, landlord=self.landlord, room_number="101")
        self.estate_house = House.objects.create(building=self.building, room_number="102")
        self.estate_only_house = House.objects.create(building=self.estate_only_building, room_number="301")
        self.landlord_house = House.objects.create(building=self.other_building, landlord=self.landlord, room_number="201")
        self.unassigned_house = House.objects.create(building=self.other_building, room_number="202")

    def test_replace_list_and_filter_responsible_houses(self):
        building_update_response = self.client.put(
            f"/api/house/staff-responsibilities/{self.building_member.pk}/",
            data=json.dumps({"landlord_ids": [], "building_ids": [self.building.pk], "estate_ids": []}),
            content_type="application/json",
        )
        self.assertEqual(building_update_response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(building_update_response)["buildings"]], [self.building.pk])

        update_response = self.client.put(
            f"/api/house/staff-responsibilities/{self.member.pk}/",
            data=json.dumps({"landlord_ids": [self.landlord.pk], "building_ids": [], "estate_ids": [self.estate.pk]}),
            content_type="application/json",
        )

        self.assertEqual(update_response.status_code, 200)
        updated = api_data(update_response)
        self.assertEqual(updated["member_id"], self.member.pk)
        self.assertEqual([item["id"] for item in updated["landlords"]], [self.landlord.pk])
        self.assertEqual(updated["buildings"], [])
        self.assertEqual([item["id"] for item in updated["estates"]], [self.estate.pk])
        self.assertEqual(updated["responsible_house_count"], 3)
        responsibility = PropertyResponsibility.objects.get(member=self.member, landlord=self.landlord)
        self.assertEqual(responsibility.created_by, self.owner.username)
        self.assertEqual(responsibility.updated_by, self.owner.username)

        list_response = self.client.get("/api/house/staff-responsibilities/", {"page": 1, "page_size": 20, "keyword": "维修"})
        listed = api_data(list_response)
        self.assertEqual(listed["total"], 1)
        self.assertEqual(listed["items"][0]["member_id"], self.member.pk)

        houses_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "responsible_member_id": self.member.pk})
        house_ids = {item["id"] for item in api_data(houses_response)["items"]}
        self.assertEqual(house_ids, {self.overlap_house.pk, self.estate_only_house.pk, self.landlord_house.pk})
        self.assertNotIn(self.estate_house.pk, house_ids)
        self.assertNotIn(self.unassigned_house.pk, house_ids)

        building_houses_response = self.client.get("/api/house/houses/", {"page": 1, "page_size": 20, "responsible_member_id": self.building_member.pk})
        building_house_ids = {item["id"] for item in api_data(building_houses_response)["items"]}
        self.assertEqual(building_house_ids, {self.estate_house.pk})
        self.assertNotIn(self.overlap_house.pk, building_house_ids)

    def test_invalid_cross_org_target_does_not_clear_existing_assignments(self):
        PropertyResponsibility.objects.create(organization=self.org, member=self.member, estate=self.estate)
        other_org = baker.make("organizations.Organization", name="其他组织", slug="responsibility-other-org")
        other_landlord = Contact.objects.create(organization=other_org, name="其他房东", phone="13800138002", roles=[ContactRole.LANDLORD])

        response = self.client.put(
            f"/api/house/staff-responsibilities/{self.member.pk}/",
            data=json.dumps({"landlord_ids": [other_landlord.pk], "building_ids": [], "estate_ids": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 422)
        self.assertTrue(PropertyResponsibility.objects.filter(member=self.member, estate=self.estate).exists())

    def test_model_rejects_non_landlord_contact_as_target(self):
        tenant = Contact.objects.create(organization=self.org, name="租客", phone="13800138003", roles=[ContactRole.TENANT])

        with self.assertRaises(ValidationError):
            PropertyResponsibility.objects.create(organization=self.org, member=self.member, landlord=tenant)

    def test_model_requires_exactly_one_of_landlord_building_or_estate(self):
        with self.assertRaises(ValidationError):
            PropertyResponsibility.objects.create(
                organization=self.org,
                member=self.member,
                landlord=self.landlord,
                building=self.building,
            )
