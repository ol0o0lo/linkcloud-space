from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.favorites.models import Favorite
from apps.favorites.registry import get_target_adapter
from apps.favorites.services import get_favorites
from apps.house.constants import ContactRole, EstatePropertyType, HouseStatus
from apps.house.models import Building, Contact, Estate, House, HouseFavorite
from tests.api_helpers import api_data


class FavoriteApiTestCase(TestCase):
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

    def test_authenticated_user_can_manage_favorites_without_selecting_organization(self):
        user = User.objects.create_user(username="favorite-user", password="secret")  # noqa: S106
        house = self.make_house(org_slug="favorite-publisher", org_name="收藏发布方", room_number="501")
        favorite_url = f"/api/users/me/favorite/?target_type=house&target_id={house.pk}"

        anonymous_response = self.client.put(favorite_url)
        self.assertEqual(anonymous_response.status_code, 401)

        self.client.force_login(user)
        favorite_query = {"target_type": "house", "target_id": house.pk, "page": 1, "page_size": 1}
        self.assertEqual(api_data(self.client.get("/api/users/me/favorite/", favorite_query))["items"], [])

        create_response = self.client.put(favorite_url)

        self.assertEqual(create_response.status_code, 201)
        created = api_data(create_response)
        self.assertEqual(created["target_type"], "house")
        self.assertEqual(created["target_id"], str(house.pk))
        self.assertTrue(created["available"])
        self.assertEqual(created["target"]["id"], house.pk)
        self.assertEqual(created["display"]["title"], "1栋 · 501")
        self.assertIn({"label": "户型", "value": "单间"}, created["display"]["facts"])
        self.assertTrue(Favorite.objects.filter(user=user, target_type="house", target_id=str(house.pk)).exists())
        self.assertFalse(HouseFavorite.objects.filter(user=user, house=house).exists())
        self.assertEqual(api_data(self.client.get("/api/users/me/favorite/", favorite_query))["items"][0]["target_id"], str(house.pk))

        repeated_response = self.client.put(favorite_url)
        self.assertEqual(repeated_response.status_code, 200)
        self.assertEqual(api_data(repeated_response)["id"], created["id"])

        list_response = self.client.get("/api/users/me/favorite/", {"target_type": "house", "page": 1, "page_size": 20})
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual([item["target_id"] for item in api_data(list_response)["items"]], [str(house.pk)])

        remove_response = self.client.delete(favorite_url)
        self.assertEqual(remove_response.status_code, 200)
        self.assertEqual(api_data(remove_response), {"success": True})
        self.assertEqual(api_data(self.client.get("/api/users/me/favorite/", favorite_query))["items"], [])

        empty_response = self.client.get("/api/users/me/favorite/", {"target_type": "house", "page": 1, "page_size": 20})
        self.assertEqual(api_data(empty_response)["items"], [])

        self.assertEqual(self.client.put(f"/api/users/me/house/favorite/{house.pk}/").status_code, 404)
        self.assertEqual(self.client.get("/api/users/me/house/favorite/").status_code, 404)
        self.assertEqual(self.client.put(f"/api/users/me/favorite/house/{house.pk}/").status_code, 404)

    def test_non_public_targets_cannot_be_newly_favorited(self):
        user = User.objects.create_user(username="private-house-user", password="secret")  # noqa: S106
        vacant = self.make_house(org_slug="private-vacant", org_name="未发布租户", room_number="601", status=HouseStatus.VACANT)
        archived = self.make_house(org_slug="private-archived", org_name="停用租户", room_number="602", org_active=False)

        self.client.force_login(user)
        self.assertEqual(self.client.put(f"/api/users/me/favorite/?target_type=house&target_id={vacant.pk}").status_code, 404)
        self.assertEqual(self.client.put(f"/api/users/me/favorite/?target_type=house&target_id={archived.pk}").status_code, 404)
        self.assertEqual(self.client.put(f"/api/users/me/favorite/?target_type=building&target_id={vacant.building_id}").status_code, 404)
        self.assertEqual(self.client.put(f"/api/users/me/favorite/?target_type=estate&target_id={vacant.building.estate_id}").status_code, 404)

    def test_authenticated_user_can_favorite_public_building_and_estate(self):
        user = User.objects.create_user(username="place-favorite-user", password="secret")  # noqa: S106
        house = self.make_house(org_slug="place-favorite", org_name="地点收藏发布方", room_number="901")
        building = house.building
        estate = building.estate
        self.client.force_login(user)

        building_response = self.client.put(f"/api/users/me/favorite/?target_type=building&target_id={building.pk}")
        estate_response = self.client.put(f"/api/users/me/favorite/?target_type=estate&target_id={estate.pk}")

        self.assertEqual(building_response.status_code, 201)
        self.assertEqual(estate_response.status_code, 201)
        building_item = api_data(building_response)
        estate_item = api_data(estate_response)
        self.assertEqual(building_item["target_type"], "building")
        self.assertEqual(building_item["target"]["name"], "1栋")
        self.assertEqual(building_item["target"]["publisher"]["name"], "地点收藏发布方")
        self.assertEqual(estate_item["target_type"], "estate")
        self.assertEqual(estate_item["target"]["display_name"], "地点收藏发布方小区")
        self.assertEqual(estate_item["target"]["publisher"]["name"], "地点收藏发布方")
        self.assertNotIn("billing_email", building_item["target"]["publisher"])

        building_list = api_data(self.client.get("/api/users/me/favorite/", {"target_type": "building", "page": 1, "page_size": 20}))
        estate_list = api_data(self.client.get("/api/users/me/favorite/", {"target_type": "estate", "page": 1, "page_size": 20}))
        self.assertEqual([item["target_id"] for item in building_list["items"]], [str(building.pk)])
        self.assertEqual([item["target_id"] for item in estate_list["items"]], [str(estate.pk)])

    def test_existing_favorite_is_retained_when_house_is_unlisted(self):
        user = User.objects.create_user(username="unlisted-favorite-user", password="secret")  # noqa: S106
        house = self.make_house(org_slug="unlisted-favorite", org_name="下架发布方", room_number="701")
        self.client.force_login(user)
        self.client.put(f"/api/users/me/favorite/?target_type=house&target_id={house.pk}")

        house.status = HouseStatus.VACANT
        house.save(update_fields=["status", "updated_at"])
        response = self.client.get("/api/users/me/favorite/", {"target_type": "house", "page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        item = api_data(response)["items"][0]
        self.assertEqual(item["target_id"], str(house.pk))
        self.assertFalse(item["available"])
        self.assertIsNone(item["target"])

    def test_authenticated_user_can_list_house_favorites_through_generic_endpoint(self):
        user = User.objects.create_user(username="generic-favorite-user", password="secret")  # noqa: S106
        house = self.make_house(org_slug="generic-favorite", org_name="通用收藏发布方", room_number="801")

        self.assertEqual(self.client.get("/api/users/me/favorite/", {"target_type": "house"}).status_code, 401)

        self.client.force_login(user)
        self.client.put(f"/api/users/me/favorite/?target_type=house&target_id={house.pk}")
        response = self.client.get("/api/users/me/favorite/", {"target_type": "house", "page": 1, "page_size": 20})

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["total"], 1)
        self.assertEqual(payload["items"][0]["target_type"], "house")
        self.assertEqual(payload["items"][0]["target_id"], str(house.pk))
        self.assertTrue(payload["items"][0]["available"])
        self.assertEqual(payload["items"][0]["target"]["id"], house.pk)
        self.assertNotIn("internal_notes", payload["items"][0]["target"])

        all_response = self.client.get("/api/users/me/favorite/", {"page": 1, "page_size": 20})
        self.assertEqual(all_response.status_code, 200)
        self.assertEqual(api_data(all_response)["items"][0]["target_type"], "house")

    def test_generic_favorite_endpoint_rejects_unknown_target_type(self):
        user = User.objects.create_user(username="unknown-favorite-type-user", password="secret")  # noqa: S106
        self.client.force_login(user)

        response = self.client.get("/api/users/me/favorite/", {"target_type": "unknown"})

        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/users/me/favorite/", {"target_id": "1"}).status_code, 422)
        self.assertEqual(self.client.put("/api/users/me/favorite/?target_type=unknown&target_id=1").status_code, 422)
        self.assertEqual(self.client.delete("/api/users/me/favorite/?target_type=unknown&target_id=1").status_code, 422)

    def test_favorite_types_include_registered_metadata_and_counts(self):
        user = User.objects.create_user(username="favorite-types-user", password="secret")  # noqa: S106
        house = self.make_house(org_slug="favorite-types", org_name="收藏类型发布方", room_number="1001")
        Favorite.objects.create(user=user, target_type="house", target_id=str(house.pk))
        Favorite.objects.create(user=user, target_type="building", target_id=str(house.building_id))

        self.assertEqual(self.client.get("/api/users/me/favorite/type/").status_code, 401)
        self.client.force_login(user)
        response = self.client.get("/api/users/me/favorite/type/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            [
                {"target_type": "house", "display_name": "房源", "order": 10, "favorite_count": 1},
                {"target_type": "building", "display_name": "楼栋", "order": 20, "favorite_count": 1},
                {"target_type": "estate", "display_name": "小区", "order": 30, "favorite_count": 0},
            ],
        )

    def test_favorite_list_only_resolves_targets_in_current_page(self):
        user = User.objects.create_user(username="favorite-page-user", password="secret")  # noqa: S106
        houses = [self.make_house(org_slug=f"favorite-page-{index}", org_name=f"分页发布方{index}", room_number=str(1100 + index)) for index in range(3)]
        for house in houses:
            Favorite.objects.create(user=user, target_type="house", target_id=str(house.pk))
        expected_target_id = list(get_favorites(user, target_type="house").values_list("target_id", flat=True))[1]
        adapter = get_target_adapter("house")
        self.client.force_login(user)

        with patch.object(adapter, "get_visible_targets", wraps=adapter.get_visible_targets) as get_visible_targets:
            response = self.client.get(
                "/api/users/me/favorite/",
                {"target_type": "house", "page": 2, "page_size": 1},
            )

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["total"], 3)
        self.assertEqual([item["target_id"] for item in payload["items"]], [expected_target_id])
        get_visible_targets.assert_called_once_with([expected_target_id])
