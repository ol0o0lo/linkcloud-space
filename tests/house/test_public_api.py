from decimal import Decimal

from django.test import TestCase

from model_bakery import baker

from apps.house.constants import ContactRole, EstatePropertyType, HouseStatus
from apps.house.models import Building, Contact, Estate, House
from tests.api_helpers import api_data


class PublicHouseApiTestCase(TestCase):
    def make_house(
        self,
        *,
        org_slug: str,
        org_name: str,
        room_number: str,
        status: str = HouseStatus.LISTED,
        asking_rent: Decimal = Decimal("2600.00"),
        org_active: bool = True,
    ) -> House:
        organization = baker.make(
            "organizations.Organization",
            name=org_name,
            slug=org_slug,
            description=f"{org_name}介绍",
            billing_email=f"billing@{org_slug}.example.com",
            is_active=org_active,
        )
        estate = Estate.objects.create(
            organization=organization,
            name=f"{org_name}小区",
            display_name=f"{org_name}小区",
            property_type=EstatePropertyType.RESIDENTIAL,
            province="广东",
            city="深圳",
            district="南山",
            address="科技园路",
        )
        building = Building.objects.create(
            organization=organization,
            estate=estate,
            name="1栋",
            address="科技园路 1 号",
            floors=20,
        )
        landlord = Contact.objects.create(
            organization=organization,
            name=f"{org_name}房东",
            phone="13800138000",
            roles=[ContactRole.LANDLORD],
        )
        return House.objects.create(
            building=building,
            landlord=landlord,
            room_number=room_number,
            status=status,
            asking_rent=asking_rent,
            bedrooms=1,
            living_rooms=0,
            public_description=f"{room_number}公开描述",
            internal_notes=f"{room_number}内部备注",
            extra={"internal_source": "private"},
        )

    def test_anonymous_user_can_search_listed_houses_across_organizations(self):
        first = self.make_house(org_slug="publisher-a", org_name="发布方甲", room_number="101")
        second = self.make_house(org_slug="publisher-b", org_name="发布方乙", room_number="101", asking_rent=Decimal("3200.00"))
        self.make_house(org_slug="publisher-c", org_name="发布方丙", room_number="303", status=HouseStatus.VACANT)
        self.make_house(org_slug="publisher-d", org_name="发布方丁", room_number="404", org_active=False)

        response = self.client.get("/api/public/houses/", {"page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual({item["id"] for item in payload["items"]}, {first.pk, second.pk})
        first_item = next(item for item in payload["items"] if item["id"] == first.pk)
        self.assertEqual(
            first_item["publisher"],
            {
                "slug": "publisher-a",
                "name": "发布方甲",
                "logo": [],
                "description": "发布方甲介绍",
            },
        )
        self.assertNotIn("landlord", first_item)
        self.assertNotIn("internal_notes", first_item)
        self.assertNotIn("extra", first_item)
        self.assertNotIn("billing_email", first_item["publisher"])

    def test_anonymous_user_can_read_public_house_detail_without_internal_fields(self):
        house = self.make_house(org_slug="detail-publisher", org_name="详情发布方", room_number="801")
        house.deposit_amount = Decimal("5200.00")
        house.interior_area = Decimal("36.50")
        house.kitchens = 1
        house.balconies = 1
        house.save()

        response = self.client.get(f"/api/public/houses/{house.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["id"], house.pk)
        self.assertEqual(payload["deposit_amount"], "5200.00")
        self.assertEqual(payload["interior_area"], "36.50")
        self.assertEqual(payload["publisher"]["slug"], "detail-publisher")
        self.assertNotIn("landlord", payload)
        self.assertNotIn("internal_notes", payload)
        self.assertNotIn("extra", payload)

    def test_public_house_search_filters_global_inventory(self):
        matching = self.make_house(org_slug="filter-a", org_name="筛选甲", room_number="101", asking_rent=Decimal("2600.00"))
        matching.tags = ["近地铁", "采光好"]
        matching.area = Decimal("42.00")
        matching.building.tags = ["有电梯"]
        matching.building.save(update_fields=["tags", "updated_at"])
        matching.save()

        expensive = self.make_house(org_slug="filter-b", org_name="筛选乙", room_number="202", asking_rent=Decimal("3600.00"))
        expensive.tags = ["近地铁"]
        expensive.area = Decimal("45.00")
        expensive.save()

        other_city = self.make_house(org_slug="filter-c", org_name="筛选丙", room_number="303", asking_rent=Decimal("2800.00"))
        other_city.tags = ["近地铁"]
        other_city.building.estate.city = "广州"
        other_city.building.estate.save(update_fields=["city", "updated_at"])

        response = self.client.get(
            "/api/public/houses/",
            {
                "city": "深圳",
                "district": "南山",
                "min_rent": "2500",
                "max_rent": "3000",
                "min_area": "40",
                "max_area": "43",
                "bedrooms": 1,
                "living_rooms": 0,
                "tags": ["近地铁", "有电梯"],
                "page": 1,
                "page_size": 20,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in api_data(response)["items"]], [matching.pk])

    def test_public_house_filter_options_only_use_visible_inventory(self):
        first = self.make_house(org_slug="options-a", org_name="选项甲", room_number="101", asking_rent=Decimal("2600.00"))
        first.area = Decimal("42.00")
        first.tags = ["近地铁"]
        first.building.tags = ["有电梯"]
        first.building.save(update_fields=["tags", "updated_at"])
        first.save()

        second = self.make_house(org_slug="options-b", org_name="选项乙", room_number="202", asking_rent=Decimal("3200.00"))
        second.area = Decimal("55.00")
        second.bedrooms = 2
        second.living_rooms = 1
        second.tags = ["采光好"]
        second.save()

        hidden = self.make_house(org_slug="options-c", org_name="选项丙", room_number="303", status=HouseStatus.VACANT, asking_rent=Decimal("9999.00"))
        hidden.tags = ["内部标签"]
        hidden.save()

        response = self.client.get("/api/public/houses/filters/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "rent_min": "2600.00",
                "rent_max": "3200.00",
                "area_min": "42.00",
                "area_max": "55.00",
                "provinces": ["广东"],
                "cities": ["深圳"],
                "districts": ["南山"],
                "bedrooms": [1, 2],
                "living_rooms": [0, 1],
                "tags": ["有电梯", "近地铁", "采光好"],
            },
        )

    def test_non_public_houses_cannot_be_viewed(self):
        vacant = self.make_house(org_slug="private-vacant", org_name="未发布租户", room_number="601", status=HouseStatus.VACANT)
        archived = self.make_house(org_slug="private-archived", org_name="停用租户", room_number="602", org_active=False)

        self.assertEqual(self.client.get(f"/api/public/houses/{vacant.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/public/houses/{archived.pk}/").status_code, 404)
