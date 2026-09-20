from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.base.api import AMAP_NEARBY_POI_CACHE_SECONDS
from tests.api_helpers import api_data


class NearbyPoisApiTestCase(TestCase):
    @override_settings(
        AMAP_WEB_SERVICE_KEY="test-amap-key",
        CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "nearby-pois-test"}},
    )
    @patch("apps.base.api.requests.get")
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
        self.assertEqual(AMAP_NEARBY_POI_CACHE_SECONDS, 30 * 24 * 60 * 60)
        self.assertEqual(mock_get.call_count, 1)
