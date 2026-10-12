from copy import deepcopy
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.geography.metro import MetroImportError, get_metro_city, import_metro_city
from apps.geography.models import MetroCity, MetroLine, MetroLineStation, MetroStation


def city_payload():
    return {
        "schema_version": 1,
        "data_version": "2026-09",
        "coordinate_system": "gcj02",
        "city": {"name": "深圳市", "province": "广东省"},
        "lines": [
            {
                "name": "1号线",
                "color": "#00A651",
                "sort_order": 1,
                "is_loop": False,
                "stations": [
                    {
                        "name": "世界之窗",
                        "aliases": [],
                        "district": "南山区",
                        "address": "",
                        "longitude": 113.974,
                        "latitude": 22.536,
                        "sort_order": 1,
                    }
                ],
            },
            {
                "name": "2号线",
                "color": "#F58220",
                "sort_order": 2,
                "is_loop": False,
                "stations": [
                    {
                        "name": "世界之窗",
                        "aliases": [],
                        "district": "南山区",
                        "address": "",
                        "longitude": 113.974,
                        "latitude": 22.536,
                        "sort_order": 8,
                    },
                    {
                        "name": "后海",
                        "aliases": [],
                        "district": "南山区",
                        "address": "",
                        "longitude": 113.942,
                        "latitude": 22.518,
                        "sort_order": 9,
                    },
                ],
            },
        ],
    }


class MetroImporterTestCase(TestCase):
    @override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "metro-import-cache-test"}})
    def test_import_refreshes_cached_city_only_after_commit(self):
        cache.clear()
        import_metro_city(city_payload())
        self.assertEqual(get_metro_city("深圳市")["data_version"], "2026-09")
        payload = city_payload()
        payload["data_version"] = "2026-10"

        with self.captureOnCommitCallbacks(execute=True):
            import_metro_city(payload)
            self.assertEqual(get_metro_city("深圳市")["data_version"], "2026-09")

        self.assertEqual(get_metro_city("深圳市")["data_version"], "2026-10")

    def test_transfer_station_is_merged_and_linked_to_each_line(self):
        result = import_metro_city(city_payload())

        self.assertEqual(result.station_created, 2)
        self.assertEqual(MetroStation.objects.count(), 2)
        self.assertEqual(MetroLineStation.objects.filter(station__name="世界之窗").count(), 2)

    def test_conflicting_transfer_station_coordinates_reject_whole_package(self):
        payload = city_payload()
        payload["lines"][1]["stations"][0]["longitude"] = 114.0

        with self.assertRaisesMessage(MetroImportError, "世界之窗"):
            import_metro_city(payload)

        self.assertFalse(MetroCity.objects.exists())

    def test_database_failure_rolls_back_previous_version(self):
        import_metro_city(city_payload())
        payload = deepcopy(city_payload())
        payload["data_version"] = "2026-10"

        with (
            patch("apps.geography.metro.MetroLine.objects.update_or_create", side_effect=RuntimeError("write failed")),
            self.assertRaises(RuntimeError),
        ):
            import_metro_city(payload)

        self.assertEqual(MetroCity.objects.get().data_version, "2026-09")

    def test_missing_records_are_marked_inactive_without_deletion(self):
        import_metro_city(city_payload())
        payload = city_payload()
        payload["data_version"] = "2026-10"
        payload["lines"] = payload["lines"][:1]

        result = import_metro_city(payload)

        self.assertEqual(result.line_deactivated, 1)
        self.assertFalse(MetroLine.objects.get(name="2号线").is_active)
        self.assertFalse(MetroStation.objects.get(name="后海").is_active)
        self.assertFalse(MetroLineStation.objects.get(line__name="2号线", station__name="后海").is_active)
        self.assertTrue(MetroStation.objects.get(name="世界之窗").is_active)

    def test_wgs84_input_is_saved_without_offset(self):
        payload = city_payload()
        payload["coordinate_system"] = "wgs84"

        import_metro_city(payload)

        station = MetroStation.objects.get(name="世界之窗")
        self.assertAlmostEqual(station.location.x, 113.974, places=7)
        self.assertAlmostEqual(station.location.y, 22.536, places=7)
