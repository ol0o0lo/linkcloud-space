from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.base.maps import MapPoint
from apps.base.maps.amap import AmapProvider
from apps.geography.locations import NEARBY_POI_CACHE_SECONDS
from tests.api_helpers import api_data


class NearbyPoisApiTestCase(TestCase):
    @override_settings(AMAP_WEB_SERVICE_KEY="test-amap-key")
    @patch("apps.base.maps.amap.requests.get")
    def test_generic_nearby_places_have_route_ready_coordinates(self, mock_get):
        around_payload = {
            "status": "1",
            "pois": [
                {
                    "id": "OFFICE-A",
                    "name": "丰兴广场",
                    "pname": "广东省",
                    "cityname": "广州市",
                    "adname": "天河区",
                    "address": "天河路",
                    "location": "113.330000,23.140000",
                }
            ],
        }
        mock_get.return_value.json.side_effect = [
            around_payload,
            {"status": "1", "regeocode": {"addressComponent": {"city": "广州市", "citycode": "020"}}},
        ]
        places = AmapProvider().nearby_places(MapPoint.from_gcj02(113.33, 23.14))
        self.assertEqual(places[0]["city_code"], "020")
        self.assertEqual(places[0]["address"], "广东省广州市天河区天河路")
        self.assertAlmostEqual(places[0]["point"].longitude, MapPoint.from_gcj02(113.33, 23.14).longitude)
        self.assertEqual(mock_get.call_count, 2)
        self.assertIn("/v3/place/around", mock_get.call_args_list[0].args[0])
        self.assertEqual(mock_get.call_args_list[0].kwargs["params"]["types"], "120000|170000")
        self.assertIn("/v3/geocode/regeo", mock_get.call_args_list[1].args[0])

    @patch("apps.geography.locations.get_place_provider")
    def test_nearby_pois_cache_is_isolated_by_provider(self, provider_factory):
        cache.clear()
        provider = provider_factory.return_value
        provider.nearby_pois.return_value = {"bus": [], "subway": [], "education": [], "medical": []}
        params = {"lat": "22.533100", "lng": "113.930400"}

        provider.code = "amap"
        self.assertEqual(self.client.get("/api/nearby-pois/", params).status_code, 200)
        provider.code = "another-map"
        self.assertEqual(self.client.get("/api/nearby-pois/", params).status_code, 200)

        self.assertEqual(provider.nearby_pois.call_count, 2)

    @override_settings(
        AMAP_WEB_SERVICE_KEY="test-amap-key",
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "nearby-pois-test"}},
    )
    @patch("apps.base.maps.amap.requests.get")
    def test_nearby_pois_returns_all_categories_and_caches_by_coordinates(self, mock_get):
        cache.clear()
        mock_get.return_value.json.return_value = {
            "status": "1",
            "pois": [
                {
                    "id": "B0FFTEST",
                    "name": "科技园公交站",
                    "pname": "广东省",
                    "cityname": "深圳市",
                    "adname": "南山区",
                    "address": "科技南路",
                    "distance": "320",
                    "typecode": "150700",
                },
                {"id": "SUBWAY", "name": "深大地铁站", "address": "地铁1号线", "distance": "680", "typecode": "150500"},
                {"id": "SCHOOL", "name": "科技园小学", "address": "科苑路", "distance": "900", "typecode": "141203"},
                {"id": "HOSPITAL", "name": "南山区医院", "address": "桃园路", "distance": "1200", "typecode": "090100"},
            ],
        }

        params = {"lat": "22.533100", "lng": "113.930400"}
        first = self.client.get("/api/nearby-pois/", params)
        second = self.client.get("/api/nearby-pois/", params)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(
            api_data(first),
            {
                "bus": [{"id": "B0FFTEST", "name": "科技园公交站", "address": "广东省深圳市南山区科技南路", "distance": 320}],
                "subway": [{"id": "SUBWAY", "name": "深大地铁站", "address": "地铁1号线", "distance": 680}],
                "education": [{"id": "SCHOOL", "name": "科技园小学", "address": "科苑路", "distance": 900}],
                "medical": [{"id": "HOSPITAL", "name": "南山区医院", "address": "桃园路", "distance": 1200}],
            },
        )
        self.assertEqual(NEARBY_POI_CACHE_SECONDS, 30 * 24 * 60 * 60)
        self.assertEqual(mock_get.call_count, 1)
        self.assertEqual(mock_get.call_args.kwargs["params"]["location"], "113.930400,22.533100")

    @override_settings(AMAP_WEB_SERVICE_KEY="test-amap-key")
    @patch("apps.base.maps.amap.requests.get")
    def test_invalid_poi_payload_is_not_cached_as_empty_result(self, mock_get):
        cache.clear()
        mock_get.return_value.json.return_value = {"status": "1", "pois": {}}
        params = {"lat": "22.533100", "lng": "113.930400"}

        self.assertEqual(self.client.get("/api/nearby-pois/", params).status_code, 502)

        mock_get.return_value.json.return_value = {"status": "1", "pois": []}
        self.assertEqual(self.client.get("/api/nearby-pois/", params).status_code, 200)
        self.assertEqual(mock_get.call_count, 2)
