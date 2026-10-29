from contextlib import nullcontext
from decimal import Decimal
from unittest.mock import patch

from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.db import connection, transaction
from django.forms import modelform_factory
from django.test import TestCase, override_settings

from celery.exceptions import Retry
from model_bakery import baker

from apps.base.maps import MapProviderUnavailable
from apps.house.admin import HouseAdminForm
from apps.house.commute.presentation import route_payload
from apps.house.commute.routing import _route_lock_key, ensure_route
from apps.house.commute.schemas import CommuteRouteOut
from apps.house.commute.search import create_search, get_search, route_error_key, route_task_key, schedule_missing_routes
from apps.house.constants import ContactRole, HouseStatus
from apps.house.exceptions import HouseCommuteRouteBusy, HouseUnavailableException
from apps.house.house_sync import apply_vacancy_sync, build_vacancy_sync_plan
from apps.house.models import Building, Contact, Estate, House, HouseCommuteDestination, HouseCommuteRoute
from apps.house.queries.public import PUBLIC_HOUSE_REGIONS_CACHE_KEY, get_public_house_regions
from apps.house.tasks import compute_commute_batch_task
from tests.api_helpers import api_data


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "house-architecture-tests"}})
class HouseArchitectureTestCase(TestCase):
    def setUp(self):
        cache.clear()
        self.org = baker.make("organizations.Organization", is_active=True)
        self.building = Building.objects.create(
            organization=self.org,
            name="独立公寓",
            address="独立路1号",
            floors=6,
            province=" 广东省 ",
            city="广州市",
            district="天河区",
            subdistrict="元岗街道",
            location=Point(113.30, 23.13, srid=4326),
        )
        self.house = House.objects.create(building=self.building, room_number="101")

    def destination(self, place_id="office"):
        return HouseCommuteDestination.objects.create(
            provider_code="amap",
            provider_place_id=place_id,
            name="上班地点",
            city="广州市",
            city_code="020",
            location=Point(113.32, 23.14, srid=4326),
        )

    def test_standalone_region_is_used_by_search_options_regions_and_all_map_levels(self):
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        filters = {"province": "广东省", "city": "广州市", "district": "天河区", "subdistrict": "元岗街道"}
        response = self.client.get("/api/public/houses/", filters)
        self.assertEqual(response.status_code, 200, response.content)
        items = api_data(response)["items"]
        self.assertEqual([item["id"] for item in items], [self.house.pk])
        self.assertEqual(items[0]["building"]["region"], filters)
        self.assertIsNone(items[0]["building"]["estate"])
        self.assertEqual(api_data(self.client.get("/api/public/houses/filters/"))["cities"], ["广州市"])
        regions = api_data(self.client.get("/api/public/houses/regions/"))["items"]
        self.assertEqual(regions[0]["cities"][0]["districts"][0]["subdistricts"], [{"subdistrict": "元岗街道", "house_count": 1}])
        for zoom in (7, 9, 12, 15):
            with self.subTest(zoom=zoom):
                response = self.client.get("/api/public/houses/map/", {**filters, "zoom": zoom, "coordinate_system": "gcj02"})
                self.assertEqual(response.status_code, 200, response.content)
                marker = api_data(response)["items"][0]
                self.assertEqual(marker["house_count"], 1)
                self.assertEqual(marker["city"], "广州市")
                if zoom >= 12:
                    self.assertEqual(marker["building_id"], self.building.pk)

    def test_empty_building_region_inherits_estate_while_explicit_values_override_it(self):
        estate = Estate.objects.create(organization=self.org, name="小区", display_name="小区", province="广东省", city="广州市", district="天河区", subdistrict="原街道")
        self.building.estate = estate
        self.building.province = self.building.city = self.building.district = ""
        self.building.subdistrict = "新街道"
        self.building.save()
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        response = self.client.get("/api/public/houses/", {"city": "广州市", "subdistrict": "新街道"})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(api_data(response)["items"][0]["building"]["region"], {"province": "广东省", "city": "广州市", "district": "天河区", "subdistrict": "新街道"})
        self.assertEqual(api_data(self.client.get("/api/public/houses/", {"subdistrict": "原街道"}))["total"], 0)

    def test_region_cache_refreshes_after_publication_region_changes_and_organization_archival(self):
        self.assertEqual(get_public_house_regions()["items"], [])
        with self.captureOnCommitCallbacks(execute=True):
            self.house.status = HouseStatus.LISTED
            self.house.save(update_fields=["status"])
        self.assertEqual(get_public_house_regions()["items"][0]["house_count"], 1)

        with self.captureOnCommitCallbacks(execute=True):
            self.building.city = "深圳市"
            self.building.save(update_fields=["city"])
        self.assertEqual(get_public_house_regions()["items"][0]["cities"][0]["city"], "深圳市")

        with self.captureOnCommitCallbacks(execute=True):
            self.org.is_active = False
            self.org.save(update_fields=["is_active"])
        self.assertEqual(get_public_house_regions()["items"], [])

    def test_estate_region_changes_and_house_deletion_refresh_region_cache(self):
        estate = Estate.objects.create(organization=self.org, name="缓存小区", display_name="缓存小区", province="广东省", city="广州市", district="天河区")
        self.building.estate = estate
        self.building.province = self.building.city = self.building.district = self.building.subdistrict = ""
        self.building.save()
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        self.assertEqual(get_public_house_regions()["items"][0]["cities"][0]["districts"][0]["district"], "天河区")

        with self.captureOnCommitCallbacks(execute=True):
            estate.district = "海珠区"
            estate.save(update_fields=["district"])
        self.assertEqual(get_public_house_regions()["items"][0]["cities"][0]["districts"][0]["district"], "海珠区")

        with self.captureOnCommitCallbacks(execute=True):
            self.house.delete()
        self.assertEqual(get_public_house_regions()["items"], [])

    def test_rolled_back_region_change_keeps_cache(self):
        cached = get_public_house_regions()
        with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError), transaction.atomic():
            self.house.status = HouseStatus.LISTED
            self.house.save(update_fields=["status"])
            raise RuntimeError("撤销修改")
        self.assertEqual(cache.get(PUBLIC_HOUSE_REGIONS_CACHE_KEY), cached)

    def test_sync_plan_preserves_floor_when_room_number_does_not_identify_it(self):
        self.house.room_number, self.house.floor, self.house.asking_rent = "A1", 4, 1000
        self.house.bedrooms, self.house.living_rooms, self.house.status = 1, 0, HouseStatus.LISTED
        self.house.save()
        text = "独立路1号\nA1单间1200"
        preview = build_vacancy_sync_plan(self.org, raw_text=text)
        changes = preview["blocks"][0]["changes"]
        self.assertEqual(changes["update_houses"][0]["changed_fields"], ["asking_rent"])
        self.assertEqual(changes["mark_paused"], [])
        apply_vacancy_sync(self.org, raw_text=text, building_overrides=None, ignored_lines=None, expected_plan_hash=preview["plan_hash"])
        self.house.refresh_from_db()
        self.assertEqual(self.house.floor, 4)
        self.assertEqual(self.house.asking_rent, Decimal("1200"))
        self.assertEqual(self.house.status, HouseStatus.LISTED)

    def test_admin_uses_the_same_publication_rules_as_business_entry(self):
        form_type = modelform_factory(House, form=HouseAdminForm, fields=("building", "room_number", "status"))
        data = {"building": self.building.pk, "room_number": "101", "status": HouseStatus.LISTED}
        form = form_type(data=data, instance=self.house)
        self.assertFalse(form.is_valid())
        self.assertIn("缺房东", form.errors["status"][0])
        self.house.refresh_from_db()
        self.house.landlord = Contact.objects.create(organization=self.org, name="房东", phone="13900139001", roles=[ContactRole.LANDLORD])
        self.house.asking_rent = 1000
        self.house.save()
        form = form_type(data=data, instance=self.house)
        self.assertTrue(form.is_valid(), form.errors)

    @patch("apps.house.commute.routing.get_route_provider")
    def test_route_computation_is_excluded_by_another_session_and_releases_after_failure(self, provider):
        provider.return_value.code = "amap"
        provider.return_value.plan_route.side_effect = MapProviderUnavailable("暂不可用")
        destination = self.destination()
        key = _route_lock_key(self.building.pk, destination.pk, "walking")
        other = connection.copy()
        try:
            with other.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(%s)", [key])
            with self.assertRaises(HouseCommuteRouteBusy):
                ensure_route(self.building.pk, destination.pk, "walking")
            provider.return_value.plan_route.assert_not_called()
            with other.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_unlock(%s)", [key])
            with self.assertRaises(MapProviderUnavailable):
                ensure_route(self.building.pk, destination.pk, "walking")
            with other.cursor() as cursor:
                cursor.execute("SELECT pg_try_advisory_lock(%s)", [key])
                self.assertTrue(cursor.fetchone()[0])
                cursor.execute("SELECT pg_advisory_unlock(%s)", [key])
        finally:
            other.close()

    @patch("apps.house.tasks.compute_commute_batch_task.delay")
    @patch("apps.house.commute.search.get_route_provider")
    @patch("apps.house.commute.routing.get_route_provider")
    def test_worker_advances_search_while_polling_and_serialization_do_not_dispatch_or_query(self, route_provider, search_provider, delayed):
        search_provider.return_value.code = route_provider.return_value.code = "amap"
        route_provider.return_value.plan_route.return_value = {"duration_seconds": 900, "distance_m": 1200, "walking_distance_m": 1200, "steps": []}
        second = Building.objects.create(organization=self.org, name="第二栋", address="独立路2号", floors=6, location=Point(113.31, 23.13, srid=4326))
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        House.objects.create(building=second, room_number="101", status=HouseStatus.LISTED)
        destination = self.destination()
        search_id = create_search(destination, "walking", 60)
        job = get_search(search_id)
        schedule_missing_routes(search_id, job, limit=1)
        self.assertEqual(delayed.call_count, 1)
        response = self.client.get(f"/api/public/houses/commute/searches/{search_id}/")
        self.assertEqual(api_data(response)["status"], "pending")
        self.assertEqual(delayed.call_count, 1)
        compute_commute_batch_task(search_id, [delayed.call_args.args[1][0]])
        self.assertEqual(delayed.call_count, 2)
        route = HouseCommuteRoute.objects.select_related("destination").get(destination=destination)
        payload = route_payload(route)
        with self.assertNumQueries(0):
            self.assertEqual(CommuteRouteOut.model_validate(payload).duration_minutes, 15)

    @patch("apps.house.tasks.compute_commute_batch_task.delay", side_effect=RuntimeError("队列不可用"))
    def test_failed_dispatch_releases_queue_marker_for_retry(self, delayed):
        self.house.status = HouseStatus.LISTED
        self.house.save(update_fields=["status"])
        destination = self.destination()
        search_id = create_search(destination, "walking", 60)
        with self.assertRaises(HouseUnavailableException):
            schedule_missing_routes(search_id, get_search(search_id))
        self.assertIsNone(cache.get(route_task_key(self.building.pk, destination.pk, "walking")))
        response = self.client.get(f"/api/public/houses/commute/searches/{search_id}/")
        self.assertEqual(api_data(response)["status"], "failed")

    @patch("apps.house.commute.routing.ensure_route")
    def test_worker_records_terminal_errors_and_releases_queue_marker(self, compute_route):
        destination = self.destination()
        cases = (
            (HouseCommuteRouteBusy(), 20, "路线计算繁忙，请稍后重试计算"),
            (MapProviderUnavailable("暂不可用"), 2, "地图路线服务暂不可用，请稍后重新搜索"),
            (RuntimeError("计算失败"), 0, "路线计算失败，请重试计算"),
        )
        for error, retries, message in cases:
            with self.subTest(error=type(error)):
                search_id = create_search(destination, "walking", 60)
                queued_key = route_task_key(self.building.pk, destination.pk, "walking")
                cache.set(queued_key, 1)
                compute_route.side_effect = error
                compute_commute_batch_task.push_request(retries=retries)
                try:
                    expected = self.assertRaises(RuntimeError) if isinstance(error, RuntimeError) else nullcontext()
                    with expected:
                        compute_commute_batch_task.run(search_id, [self.building.pk])
                finally:
                    compute_commute_batch_task.pop_request()
                self.assertEqual(get_search(search_id)["error"], message)
                self.assertEqual(cache.get(route_error_key(self.building.pk, destination.pk, "walking")), 1)
                self.assertIsNone(cache.get(queued_key))

    @patch("apps.house.commute.routing.ensure_route", side_effect=MapProviderUnavailable("暂不可用"))
    def test_worker_keeps_queue_marker_while_retrying(self, _compute_route):
        destination = self.destination()
        search_id = create_search(destination, "walking", 60)
        queued_key = route_task_key(self.building.pk, destination.pk, "walking")
        cache.set(queued_key, 1)
        with patch.object(compute_commute_batch_task, "retry", side_effect=Retry()) as retry, self.assertRaises(Retry):
            compute_commute_batch_task.run(search_id, [self.building.pk])
        retry.assert_called_once()
        self.assertEqual(retry.call_args.kwargs["countdown"], 3)
        self.assertEqual(get_search(search_id)["error"], "")
        self.assertEqual(cache.get(queued_key), 1)
