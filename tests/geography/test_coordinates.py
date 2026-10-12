from django.test import SimpleTestCase

from apps.geography.coordinates import convert_viewport_to_wgs84, gcj02_to_wgs84, is_outside_china, make_wgs84_point, serialize_point, wgs84_to_gcj02


class CoordinateConversionTestCase(SimpleTestCase):
    def test_beijing_wgs84_to_gcj02_matches_known_coordinate(self):
        longitude, latitude = wgs84_to_gcj02(116.397128, 39.916527)

        self.assertAlmostEqual(longitude, 116.403372, places=6)
        self.assertAlmostEqual(latitude, 39.917931, places=6)

    def test_gcj02_round_trip_keeps_sub_meter_precision(self):
        original = (113.9304, 22.5331)
        wgs84 = gcj02_to_wgs84(*original)
        restored = wgs84_to_gcj02(*wgs84)

        self.assertAlmostEqual(restored[0], original[0], places=7)
        self.assertAlmostEqual(restored[1], original[1], places=7)

    def test_coordinates_outside_china_are_not_shifted(self):
        london = (-0.1276, 51.5072)

        self.assertTrue(is_outside_china(*london))
        self.assertEqual(wgs84_to_gcj02(*london), london)
        self.assertEqual(gcj02_to_wgs84(*london), london)

    def test_point_serialization_returns_gcj02_contract(self):
        point = make_wgs84_point(113.9304, 22.5331, "gcj02")

        self.assertEqual(
            serialize_point(point),
            {"longitude": 113.9304, "latitude": 22.5331, "coordinate_system": "gcj02"},
        )

    def test_wgs84_input_is_kept_without_gcj02_offset(self):
        point = make_wgs84_point(113.974, 22.536, "wgs84")

        self.assertEqual(point.srid, 4326)
        self.assertAlmostEqual(point.x, 113.974, places=7)
        self.assertAlmostEqual(point.y, 22.536, places=7)

    def test_viewport_is_a_wgs84_polygon_covering_all_converted_corners(self):
        viewport = convert_viewport_to_wgs84(113.2, 23.0, 113.5, 23.3, "gcj02")
        corners = [make_wgs84_point(longitude, latitude, "gcj02") for longitude, latitude in ((113.2, 23.0), (113.2, 23.3), (113.5, 23.0), (113.5, 23.3))]

        self.assertEqual(viewport.srid, 4326)
        self.assertEqual(viewport.geom_type, "Polygon")
        self.assertTrue(all(viewport.covers(point) for point in corners))
