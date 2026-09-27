from django.test import SimpleTestCase

from apps.base.maps.coordinates import MapPoint


class MapPointTestCase(SimpleTestCase):
    def test_gcj02_input_is_stored_as_wgs84_and_round_trips(self):
        point = MapPoint.from_gcj02(113.9304, 22.5331)

        self.assertNotEqual(point.longitude, 113.9304)
        longitude, latitude = point.to_gcj02()
        self.assertAlmostEqual(longitude, 113.9304, places=6)
        self.assertAlmostEqual(latitude, 22.5331, places=6)

    def test_invalid_coordinate_is_rejected(self):
        with self.assertRaises(ValueError):
            MapPoint(float("nan"), 22.5331)
