from django.contrib.gis.geos import Point
from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.geography.models import MetroCity, MetroLine, MetroLineStation, MetroStation


class MetroModelTestCase(TestCase):
    def test_city_line_and_station_names_are_unique_inside_city(self):
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09")
        MetroLine.objects.create(city=city, name="1号线", sort_order=1)
        MetroStation.objects.create(city=city, name="世界之窗", location=Point(113.97, 22.53, srid=4326))

        with self.assertRaises(ValidationError):
            MetroLine(city=city, name="1号线", sort_order=2).full_clean()
        with self.assertRaises(ValidationError):
            MetroStation(city=city, name="世界之窗", location=Point(113.98, 22.54, srid=4326)).full_clean()

    def test_line_station_requires_same_city(self):
        shenzhen = MetroCity.objects.create(name="深圳市", province="广东省", data_version="1")
        guangzhou = MetroCity.objects.create(name="广州市", province="广东省", data_version="1")
        line = MetroLine.objects.create(city=shenzhen, name="1号线", sort_order=1)
        station = MetroStation.objects.create(city=guangzhou, name="公园前", location=Point(113.26, 23.13, srid=4326))

        with self.assertRaises(ValidationError):
            MetroLineStation(line=line, station=station, sort_order=1).full_clean()
