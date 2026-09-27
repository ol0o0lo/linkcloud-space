from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

import requests

from apps.base.maps import MapPoint, MapProviderUnavailable, MapRouteNotFound
from apps.base.maps.amap import AmapProvider


@override_settings(AMAP_WEB_SERVICE_KEY="test-map-key")
class MapRouteProviderTests(SimpleTestCase):
    @patch("apps.base.maps.amap.requests.get")
    def test_request_failure_does_not_chain_url_containing_key(self, mock_get):
        mock_get.side_effect = requests.RequestException("request URL contains key")
        with self.assertRaises(MapProviderUnavailable) as captured:
            AmapProvider().search_places("广州塔")
        self.assertTrue(captured.exception.__suppress_context__)

    @patch("apps.base.maps.amap.requests.get")
    def test_place_search_converts_coordinates_and_route_reads_duration(self, mock_get):
        mock_get.return_value.json.side_effect = [
            {"status": "1", "pois": [{"id": "POI-A", "name": "丰兴广场", "address": "天河路", "cityname": "广州市", "citycode": "020", "location": "113.330000,23.140000"}]},
            {"status": "1", "route": {"paths": [{"distance": "4200", "cost": {"duration": "1320"}, "steps": [{"instruction": "沿天河路行驶"}]}]}},
        ]
        provider = AmapProvider()
        place = provider.search_places("丰兴广场", "广州市")[0]
        self.assertEqual(place["id"], "POI-A")
        self.assertAlmostEqual(place["point"].to_gcj02()[0], 113.33, places=5)

        route = provider.plan_route(MapPoint(113.31, 23.13), place["point"], "driving")
        self.assertEqual(route["duration_seconds"], 1320)
        self.assertEqual(route["steps"], ["沿天河路行驶"])
        self.assertIn("/v5/direction/driving", mock_get.call_args.args[0])

    @patch("apps.base.maps.amap.requests.get")
    def test_metro_rejects_bus_only_alternative(self, mock_get):
        mock_get.return_value.json.return_value = {
            "status": "1",
            "route": {"transits": [{"cost": {"duration": "1200"}, "segments": [{"bus": {"buslines": [{"name": "公交 1 路", "type": "公交"}]}}]}]},
        }
        with self.assertRaises(MapRouteNotFound):
            AmapProvider().plan_route(MapPoint(113.31, 23.13), MapPoint(113.33, 23.14), "metro", city_code="020")

    @patch("apps.base.maps.amap.requests.get")
    def test_metro_route_keeps_line_transfer_and_walking_segments(self, mock_get):
        mock_get.return_value.json.return_value = {
            "status": "1",
            "route": {
                "transits": [
                    {
                        "distance": "4400",
                        "cost": {"duration": "2640"},
                        "segments": [
                            {"walking": {"distance": "620", "cost": {"duration": "600"}}, "bus": {"buslines": [{"name": "地铁 5 号线(滘口-文冲)", "type": "地铁"}]}},
                            {"walking": {"distance": "180", "cost": {"duration": "180"}}, "bus": {"buslines": [{"name": "3号线", "type": "地铁"}]}},
                            {"walking": {"distance": "120", "cost": {"duration": "120"}}},
                        ],
                    }
                ]
            },
        }
        route = AmapProvider().plan_route(MapPoint(113.31, 23.13), MapPoint(113.33, 23.14), "metro", city_code="020")
        self.assertEqual(route["walking_distance_m"], 920)
        self.assertEqual(
            route["transit_segments"],
            [
                {"kind": "walk", "label": "步行", "distance_m": 620, "duration_seconds": 600},
                {"kind": "metro", "label": "5号线", "distance_m": 0, "duration_seconds": None},
                {"kind": "walk", "label": "步行", "distance_m": 180, "duration_seconds": 180},
                {"kind": "metro", "label": "3号线", "distance_m": 0, "duration_seconds": None},
                {"kind": "walk", "label": "步行", "distance_m": 120, "duration_seconds": 120},
            ],
        )

    @patch("apps.base.maps.amap.requests.get")
    def test_route_out_of_range_is_unreachable_instead_of_service_failure(self, mock_get):
        mock_get.return_value.json.return_value = {"status": "0", "info": "OVER_DIRECTION_RANGE", "infocode": "20803"}
        with self.assertRaises(MapRouteNotFound):
            AmapProvider().plan_route(MapPoint(113.31, 23.13), MapPoint(113.33, 23.14), "walking")

    @patch("apps.base.maps.amap.requests.get")
    def test_all_commute_modes_use_shared_provider(self, mock_get):
        metro = {
            "status": "1",
            "route": {
                "transits": [
                    {
                        "distance": "3000",
                        "cost": {"duration": "1200"},
                        "segments": [{"walking": {"distance": "200", "steps": [{"instruction": "步行至车站"}]}, "bus": {"buslines": [{"name": "地铁 3 号线", "type": "地铁"}]}}],
                    }
                ]
            },
        }
        other = {"status": "1", "route": {"paths": [{"distance": "3000", "cost": {"duration": "1200"}, "steps": [{"instruction": "前往目的地"}]}]}}
        mock_get.return_value.json.side_effect = [metro, other, other, other, other]
        provider = AmapProvider()
        origin = MapPoint(113.31, 23.13)
        destination = MapPoint(113.33, 23.14)
        for mode, path in (
            ("metro", "transit/integrated"),
            ("ebike", "electrobike"),
            ("bicycle", "bicycling"),
            ("walking", "walking"),
            ("driving", "driving"),
        ):
            result = provider.plan_route(origin, destination, mode, city_code="020")
            self.assertEqual(result["duration_seconds"], 1200)
            self.assertIn(path, mock_get.call_args.args[0])
            if mode == "metro":
                self.assertEqual(result["walking_distance_m"], 200)
