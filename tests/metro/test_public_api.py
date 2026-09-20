from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from tests.api_helpers import api_data


class PublicMetroApiTestCase(TestCase):
    def setUp(self):
        cache.clear()
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
        line = MetroLine.objects.create(city=city, name="1号线", color="#00A651", sort_order=1)
        station = MetroStation.objects.create(city=city, name="世界之窗", location=Point(113.97, 22.53, srid=4326))
        MetroLineStation.objects.create(line=line, station=station, sort_order=1)

    def test_city_list_only_returns_successfully_imported_active_data(self):
        MetroCity.objects.create(name="空城市", province="广东省", data_version="1")

        response = self.client.get("/api/public/metro/cities/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), [{"name": "深圳市", "province": "广东省"}])

    def test_city_detail_returns_lines_with_embedded_stations(self):
        response = self.client.get("/api/public/metro/cities/深圳市/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            api_data(response),
            {
                "name": "深圳市",
                "province": "广东省",
                "data_version": "2026-09",
                "lines": [{"name": "1号线", "color": "#00A651", "stations": [{"name": "世界之窗"}]}],
            },
        )
        self.assertNotIn("id", str(api_data(response)))

    def test_inactive_station_is_not_public(self):
        MetroStation.objects.filter(name="世界之窗").update(is_active=False)

        response = self.client.get("/api/public/metro/cities/深圳市/")

        self.assertEqual(response.status_code, 404)

