import json
from decimal import Decimal

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import HouseStatus
from apps.house.models import Building, Estate, House
from tests.api_helpers import api_data, api_error


class MerchantHouseFilterTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="merchant-filter", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", slug="merchant-filter")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
        session.save()
        estate = baker.make(Estate, organization=self.org, name="南山项目", display_name="南山项目", district="南山区")
        self.building = baker.make(Building, organization=self.org, estate=estate, name="1栋", address="科技园 1 号", floors=8)

    def make_house(self, room_number, *, building=None, rent="3000", bedrooms=1):
        return baker.make(House, building=building or self.building, room_number=room_number, asking_rent=Decimal(rent), bedrooms=bedrooms, status=HouseStatus.LISTED)

    def test_combined_filters_apply_before_pagination_and_stay_in_organization(self):
        expected = self.make_house("101")
        self.make_house("102", rent="4000")
        self.make_house("103", bedrooms=2)
        self.make_house("104", rent="2000")
        other_org = baker.make("organizations.Organization", slug="merchant-other")
        other_building = baker.make(Building, organization=other_org, estate=None, name="其他组织", district="南山区", address="科技园 2 号", floors=8)
        self.make_house("105", building=other_building)

        response = self.client.get("/api/house/houses/", {"min_rent": "2500", "max_rent": "3500", "bedrooms": "1", "district": " 南山区 ", "page_size": 1})

        self.assertEqual(response.status_code, 200)
        result = api_data(response)
        self.assertEqual(result["total"], 1)
        self.assertEqual([item["id"] for item in result["items"]], [expected.pk])

    def test_standalone_building_region_and_zero_values_are_supported(self):
        building = baker.make(Building, organization=self.org, estate=None, name="独立公寓", district="福田区", address="车公庙 1 号", floors=8)
        expected = self.make_house("201", building=building, rent="0", bedrooms=0)

        response = self.client.get("/api/house/houses/", {"min_rent": "0", "max_rent": "0", "bedrooms": "0", "district": "福田区"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [expected.pk])

    def test_invalid_filter_values_are_rejected_at_api_boundary(self):
        invalid_cases = (
            ({"min_rent": "-1"}, "min_rent", "greater than or equal to 0"),
            ({"max_rent": "NaN"}, "max_rent", "finite number"),
            ({"bedrooms": "-1"}, "bedrooms", "greater than or equal to 0"),
            ({"bedrooms": "1.5"}, "bedrooms", "valid integer"),
            ({"district": "区" * 65}, "district", "at most 64 characters"),
        )
        for params, field, reason in invalid_cases:
            with self.subTest(params=params):
                response = self.client.get("/api/house/houses/", params)
                self.assertEqual(response.status_code, 400)
                error = api_error(response)
                self.assertEqual(error["error"], "VALIDATION_ERROR")
                self.assertIn(field, error["data"]["fields"])
                self.assertIn(reason, error["data"]["fields"][field][0])
                self.assertEqual(error["message"], error["data"]["fields"][field][0])

        response = self.client.get("/api/house/houses/", {"min_rent": "5000", "max_rent": "3000"})
        self.assertEqual(response.status_code, 422)
        self.assertIn("最低租金不能高于最高租金", str(api_error(response)))
