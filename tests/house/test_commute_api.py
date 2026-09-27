import json
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core import signing
from django.core.cache import cache
from django.test import TestCase, override_settings

from model_bakery import baker

from apps.base.maps import MapPoint, MapProviderUnavailable
from apps.house.commute.api import PLACE_SIGNING_NAMESPACE
from apps.house.commute.search import get_search, route_task_key
from apps.house.constants import HouseStatus
from apps.house.models import Building, Estate, House, HouseCommuteDestination, HouseCommuteRoute
from apps.house.tasks import compute_commute_batch_task
from apps.metro.models import MetroCity, MetroLine
from tests.api_helpers import api_data


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "house-commute-tests"}})
class HouseCommuteApiTests(TestCase):
    def setUp(self):
        cache.clear()
        org = baker.make("organizations.Organization", name="测试组织", slug="commute-org", is_active=True)
        estate = Estate.objects.create(organization=org, name="测试小区", display_name="测试小区", province="广东", city="广州市", district="天河区", address="天河路")
        self.houses = []
        for index, longitude in enumerate((113.30, 113.31), start=1):
            building = Building.objects.create(
                organization=org, estate=estate, name=f"{index}栋", address=f"天河路 {index} 号", floors=10, location=Point(longitude, 23.13, srid=4326)
            )
            self.houses.append(House.objects.create(building=building, room_number=f"{index}01", status=HouseStatus.LISTED, asking_rent=2000 + index * 100))

    def place_token(self, place_id: str, longitude: float) -> str:
        return signing.dumps(
            {
                "provider_code": "amap",
                "provider_place_id": place_id,
                "name": place_id,
                "address": "天河路",
                "city": "广州市",
                "city_code": "020",
                "longitude": longitude,
                "latitude": 23.14,
            },
            salt=PLACE_SIGNING_NAMESPACE,
        )

    @patch("apps.house.commute.api.get_place_provider")
    def test_place_search_returns_signed_provider_location(self, provider):
        provider.return_value.code = "amap"
        provider.return_value.search_places.return_value = [
            {"id": "POI-A", "name": "丰兴广场", "address": "天河路", "city": "广州市", "city_code": "020", "point": MapPoint(113.33, 23.14)}
        ]
        response = self.client.get("/api/public/houses/commute/places/", {"keyword": "丰兴广场"})
        self.assertEqual(response.status_code, 200, response.content)
        token = api_data(response)[0]["token"]
        place = signing.loads(token, salt=PLACE_SIGNING_NAMESPACE)
        self.assertEqual(place["provider_place_id"], "POI-A")
        self.assertEqual(place["city"], "广州市")

    @patch("apps.house.commute.api.get_place_provider")
    def test_nearby_places_return_distance_and_reusable_destination(self, provider):
        provider.return_value.code = "amap"
        provider.return_value.nearby_places.return_value = [
            {"id": "OFFICE-A", "name": "丰兴广场", "address": "天河路", "city": "广州市", "city_code": "020", "point": MapPoint.from_gcj02(113.33, 23.14)}
        ]
        params = {"lat": 23.14, "lng": 113.33}
        first = self.client.get("/api/public/houses/commute/places/", params)
        second = self.client.get("/api/public/houses/commute/places/", params)
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(api_data(first)[0]["distance_m"], 0)
        self.assertEqual(api_data(second)[0]["name"], "丰兴广场")
        provider.return_value.nearby_places.assert_called_once()

        token = api_data(first)[0]["token"]
        destination = self.client.post("/api/public/houses/commute/destinations/", data=json.dumps({"place_token": token}), content_type="application/json")
        self.assertEqual(destination.status_code, 201, destination.content)
        destination_id = api_data(destination)["destination_id"]
        self.assertEqual(HouseCommuteDestination.objects.get(pk=destination_id).provider_place_id, "OFFICE-A")

    def test_nearby_places_require_valid_coordinates(self):
        self.assertEqual(self.client.get("/api/public/houses/commute/places/").status_code, 422)
        self.assertEqual(self.client.get("/api/public/houses/commute/places/", {"lat": 23.14}).status_code, 422)
        self.assertEqual(self.client.get("/api/public/houses/commute/places/", {"lat": 100, "lng": 113.33}).status_code, 422)

    @patch("apps.house.commute.api.get_place_provider")
    def test_public_place_search_is_rate_limited(self, provider):
        provider.return_value.search_places.return_value = []
        for _ in range(60):
            self.assertEqual(self.client.get("/api/public/houses/commute/places/", {"keyword": "天河"}).status_code, 200)
        self.assertEqual(self.client.get("/api/public/houses/commute/places/", {"keyword": "天河"}).status_code, 429)

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    def test_destination_can_be_saved_without_starting_route_jobs(self, delayed):
        token = self.place_token("A", 113.32)
        response = self.client.post("/api/public/houses/commute/destinations/", data=json.dumps({"place_token": token}), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        destination_id = api_data(response)["destination_id"]
        self.assertEqual(HouseCommuteDestination.objects.get(pk=destination_id).provider_place_id, "A")
        delayed.assert_not_called()
        search = self.start(destination_id=destination_id, filters={"max_rent": 2100})
        self.assertEqual(search["destination_id"], destination_id)
        self.assertEqual(get_search(search["search_id"])["building_ids"], [self.houses[0].building_id])

    def start(self, token: str | None = None, *, destination_id: int | None = None, filters: dict | None = None, retry: bool = False):
        payload = {"mode": "walking", "max_minutes": 60, "filters": filters or {}, "retry": retry}
        if destination_id:
            payload["destination_id"] = destination_id
        else:
            payload["place_token"] = token
        response = self.client.post("/api/public/houses/commute/searches/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201, response.content)
        return api_data(response)

    @patch("apps.house.commute.routing.get_route_provider")
    @patch("apps.house.commute.search.get_route_provider")
    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    def test_addresses_are_isolated_and_results_are_sorted_by_duration(self, delayed, search_provider, routing_provider):
        search_provider.return_value.code = "amap"
        routing_provider.return_value.code = "amap"
        routing_provider.return_value.plan_route.side_effect = lambda origin, destination, mode, **kwargs: {
            "duration_seconds": int(round(abs(origin.longitude - destination.longitude) * 100000)) + 300,
            "distance_m": 1200,
            "walking_distance_m": 1200,
            "steps": ["步行到工作地点"],
        }
        search_a = self.start(self.place_token("A", 113.32))["search_id"]
        search_b = self.start(self.place_token("B", 113.29))["search_id"]
        for search_id in (search_a, search_b):
            job = get_search(search_id)
            compute_commute_batch_task(search_id, job["building_ids"])
            response = self.client.get(f"/api/public/houses/commute/searches/{search_id}/houses/", {"page": 1, "page_size": 10})
            self.assertEqual(response.status_code, 200, response.content)
            self.assertEqual(api_data(response)["total"], 2)
        houses_a = api_data(self.client.get(f"/api/public/houses/commute/searches/{search_a}/houses/"))["items"]
        houses_b = api_data(self.client.get(f"/api/public/houses/commute/searches/{search_b}/houses/"))["items"]
        self.assertEqual([item["id"] for item in houses_a], [self.houses[1].pk, self.houses[0].pk])
        self.assertEqual([item["id"] for item in houses_b], [self.houses[0].pk, self.houses[1].pk])
        self.assertEqual(HouseCommuteRoute.objects.count(), 4)

        self.assertEqual(self.client.get("/api/public/houses/", {"commute_search_id": search_a, "max_rent": 2100}).status_code, 409)
        narrowed = self.start(destination_id=get_search(search_a)["destination_id"], filters={"max_rent": 2100})
        self.assertEqual(get_search(narrowed["search_id"])["building_ids"], [self.houses[0].building_id])
        self.assertEqual(routing_provider.return_value.plan_route.call_count, 4)
        combined = self.client.get("/api/public/houses/", {"commute_search_id": narrowed["search_id"], "max_rent": 2100, "sort": "commute_asc", "page": 1, "page_size": 10})
        self.assertEqual(combined.status_code, 200, combined.content)
        self.assertEqual([item["id"] for item in api_data(combined)["items"]], [self.houses[0].pk])
        self.assertGreater(api_data(combined)["items"][0]["commute_minutes"], 0)
        self.assertIsNotNone(api_data(combined)["items"][0]["commute_route_id"])

        widened = self.client.get("/api/public/houses/", {"commute_search_id": search_a, "min_rent": 2200, "page": 1, "page_size": 10})
        self.assertEqual(widened.status_code, 409)
        self.assertEqual(HouseCommuteRoute.objects.count(), 4)

        other_address = self.client.get("/api/public/houses/", {"commute_search_id": search_b, "min_rent": 2200, "page": 1, "page_size": 10})
        self.assertEqual(other_address.status_code, 409)
        self.assertIsNone(api_data(self.client.get("/api/public/houses/"))["items"][0]["commute_minutes"])

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    def test_pending_search_returns_partial_results(self, delayed):
        search_id = self.start(self.place_token("A", 113.32))["search_id"]
        self.assertEqual(delayed.call_count, 2)
        self.assertEqual({tuple(call.args[1]) for call in delayed.call_args_list}, {(self.houses[0].building_id,), (self.houses[1].building_id,)})
        progress = api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/"))
        self.assertEqual(progress["status"], "pending")
        self.assertEqual(progress["total"], 2)
        self.assertEqual(api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/houses/"))["total"], 0)
        self.assertEqual(api_data(self.client.get("/api/public/houses/", {"commute_search_id": search_id}))["total"], 0)
        self.assertEqual(self.client.get("/api/public/houses/", {"sort": "commute_asc"}).status_code, 422)

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    @patch("apps.house.commute.search.get_route_provider")
    @patch("apps.house.commute.routing.get_route_provider")
    def test_calculated_houses_appear_while_other_routes_are_pending(self, routing_provider, search_provider, delayed):
        search_provider.return_value.code = "amap"
        routing_provider.return_value.code = "amap"
        routing_provider.return_value.plan_route.return_value = {"duration_seconds": 900, "distance_m": 1200, "walking_distance_m": 1200, "steps": []}
        search_id = self.start(self.place_token("A", 113.32))["search_id"]
        first_building_id = self.houses[0].building_id
        compute_commute_batch_task(search_id, [first_building_id])
        progress = api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/"))
        self.assertEqual((progress["status"], progress["processed"], progress["total"]), ("pending", 1, 2))
        result = api_data(self.client.get("/api/public/houses/", {"commute_search_id": search_id, "sort": "commute_asc"}))
        self.assertEqual([item["id"] for item in result["items"]], [self.houses[0].pk])
        self.assertIsNone(cache.get(route_task_key(first_building_id, get_search(search_id)["destination_id"], "walking")))

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    def test_nearby_buildings_in_another_city_are_candidates_without_city_filter(self, delayed):
        estate = Estate.objects.create(
            organization=self.houses[0].building.organization,
            name="邻城小区",
            display_name="邻城小区",
            province="广东",
            city="佛山市",
            district="南海区",
            address="邻城路",
        )
        building = Building.objects.create(organization=estate.organization, estate=estate, name="邻城栋", address="邻城路", floors=10, location=Point(113.32, 23.13, srid=4326))
        House.objects.create(building=building, room_number="301", status=HouseStatus.LISTED, asking_rent=2300)
        unrestricted = self.start(self.place_token("A", 113.32))["search_id"]
        self.assertIn(building.pk, get_search(unrestricted)["building_ids"])
        city_only = self.start(destination_id=get_search(unrestricted)["destination_id"], filters={"city": "广州市"})["search_id"]
        self.assertNotIn(building.pk, get_search(city_only)["building_ids"])

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    @patch("apps.house.commute.search.get_route_provider")
    @patch("apps.house.commute.routing.get_route_provider")
    def test_provider_failure_marks_search_failed_and_next_search_can_resume(self, routing_provider, search_provider, delayed):
        search_provider.return_value.code = "amap"
        routing_provider.return_value.code = "amap"
        routing_provider.return_value.plan_route.side_effect = MapProviderUnavailable("服务暂不可用")
        token = self.place_token("A", 113.32)
        search_id = self.start(token)["search_id"]
        with self.assertRaises(MapProviderUnavailable):
            compute_commute_batch_task(search_id, [self.houses[0].building_id])
        self.assertEqual(api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/"))["status"], "pending")
        route_key = route_task_key(self.houses[0].building_id, get_search(search_id)["destination_id"], "walking")
        self.assertIsNotNone(cache.get(route_key))

        compute_commute_batch_task.apply(args=(search_id, [self.houses[0].building_id]), retries=2, throw=False)
        self.assertEqual(api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/"))["status"], "failed")
        self.assertIsNone(cache.get(route_key))

        routing_provider.return_value.plan_route.side_effect = None
        routing_provider.return_value.plan_route.return_value = {"duration_seconds": 900, "distance_m": 2000, "walking_distance_m": 0, "steps": []}
        resumed_id = self.start(token, retry=True)["search_id"]
        self.assertEqual(delayed.call_count, 3)
        compute_commute_batch_task(resumed_id, get_search(resumed_id)["building_ids"])
        self.assertEqual(api_data(self.client.get(f"/api/public/houses/commute/searches/{resumed_id}/"))["status"], "ready")

    @patch("apps.house.commute.api.compute_commute_batch_task.delay")
    @patch("apps.house.commute.search.get_route_provider")
    @patch("apps.house.commute.routing.get_route_provider")
    def test_route_is_reused_and_detail_checks_public_house_and_coordinates(self, routing_provider, search_provider, delayed):
        search_provider.return_value.code = "amap"
        routing_provider.return_value.code = "amap"
        routing_provider.return_value.plan_route.return_value = {
            "duration_seconds": 900,
            "distance_m": 3200,
            "walking_distance_m": 150,
            "steps": ["步行 150 米", "乘车到目的地"],
        }
        token = self.place_token("A", 113.32)
        search_id = self.start(token)["search_id"]
        job = get_search(search_id)
        compute_commute_batch_task(search_id, job["building_ids"])
        route_id = api_data(self.client.get(f"/api/public/houses/commute/searches/{search_id}/houses/"))["items"][0]["commute_route_id"]
        route_url = f"/api/public/houses/commute/routes/{route_id}/"
        detail = self.client.get(route_url, {"house_id": self.houses[0].pk})
        self.assertEqual(detail.status_code, 200, detail.content)
        self.assertEqual(api_data(detail)["duration_minutes"], 15)
        self.assertEqual(api_data(detail)["destination_name"], "A")

        repeated_search_id = self.start(token)["search_id"]
        self.assertEqual(api_data(self.client.get(f"/api/public/houses/commute/searches/{repeated_search_id}/"))["status"], "ready")
        self.assertEqual(routing_provider.return_value.plan_route.call_count, 2)
        self.assertEqual(self.client.get(route_url, {"house_id": self.houses[1].pk}).status_code, 404)

        self.houses[0].status = HouseStatus.INACTIVE
        self.houses[0].save(update_fields=["status"])
        self.assertEqual(self.client.get(route_url, {"house_id": self.houses[0].pk}).status_code, 404)
        self.houses[0].status = HouseStatus.LISTED
        self.houses[0].save(update_fields=["status"])

        building = self.houses[0].building
        building.location = Point(113.33, 23.13, srid=4326)
        building.save(update_fields=["location"])
        self.assertEqual(self.client.get(route_url, {"house_id": self.houses[0].pk}).status_code, 404)
        self.assertEqual(api_data(self.client.get("/api/public/houses/", {"commute_search_id": search_id}))["total"], 1)

    @patch("apps.house.commute.routing.get_route_provider")
    def test_house_detail_can_calculate_and_reuse_saved_work_place_route(self, routing_provider):
        city = MetroCity.objects.create(name="广州市", province="广东省", data_version="test")
        MetroLine.objects.create(city=city, name="3号线", color="#E89ABC")
        routing_provider.return_value.code = "amap"
        routing_provider.return_value.plan_route.return_value = {
            "duration_seconds": 780,
            "distance_m": 3400,
            "walking_distance_m": 300,
            "steps": ["步行至车站", "乘坐地铁"],
            "transit_segments": [
                {"kind": "walk", "label": "步行", "distance_m": 300, "duration_seconds": 240},
                {"kind": "metro", "label": "3号线", "distance_m": 0, "duration_seconds": None},
            ],
        }
        destination = HouseCommuteDestination.objects.create(
            provider_code="amap",
            provider_place_id="office",
            name="丰兴广场",
            address="天河路",
            city="广州市",
            city_code="020",
            location=Point(113.32, 23.14, srid=4326),
        )
        url = "/api/public/houses/commute/routes/for-house/"
        payload = {"house_id": self.houses[0].pk, "destination_id": destination.pk, "mode": "metro"}
        first = self.client.post(url, data=json.dumps(payload), content_type="application/json")
        second = self.client.post(url, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(api_data(second)["duration_minutes"], 13)
        self.assertEqual(api_data(second)["transit_segments"][0]["distance_m"], 300)
        self.assertEqual(api_data(first)["destination_name"], "丰兴广场")
        self.assertEqual(api_data(first)["transit_segments"][1]["label"], "3号线")
        self.assertEqual(api_data(first)["transit_segments"][1]["color"], "#E89ABC")
        self.assertEqual(api_data(first)["transit_segments"][0]["color"], "")
        self.assertEqual(HouseCommuteRoute.objects.get(building_id=self.houses[0].building_id).version, 2)
        self.assertEqual(routing_provider.return_value.plan_route.call_count, 1)

        HouseCommuteRoute.objects.filter(building_id=self.houses[0].building_id).update(version=1, transit_segments=[])
        refreshed = self.client.post(url, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(api_data(refreshed)["transit_segments"][1]["label"], "3号线")
        self.assertEqual(routing_provider.return_value.plan_route.call_count, 2)

        self.houses[0].status = HouseStatus.INACTIVE
        self.houses[0].save(update_fields=["status"])
        hidden = self.client.post(url, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(hidden.status_code, 404)
