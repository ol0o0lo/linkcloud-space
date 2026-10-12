from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.geography.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from apps.house.models import House
from apps.house.queries.public import build_public_house_regions, get_public_houses_queryset
from apps.house.seeds.guangzhou import DEMO_ORGANIZATION_SLUG, seed_guangzhou_ui_data
from apps.organizations.models import Organization


@override_settings(DEBUG=True)
class HousingUiDemoSeedTestCase(TestCase):
    metro_payload = {
        "s": "广州市地铁",
        "l": [
            {
                "ln": "1号线",
                "cl": "FCD600",
                "st": [
                    {"n": "西塱", "sl": "113.231514,23.065063"},
                    {"n": "公园前", "sl": "113.264315,23.125446"},
                ],
            },
            {
                "ln": "2号线",
                "cl": "0065B3",
                "st": [
                    {"n": "公园前", "sl": "113.264315,23.125446"},
                    {"n": "嘉禾望岗", "sl": "113.289243,23.237460"},
                ],
            },
        ],
    }

    @patch("apps.house.seeds.guangzhou.fetch_amap_guangzhou_metro_payload", return_value=metro_payload)
    def test_seed_command_populates_complete_guangzhou_filter_data_idempotently(self, _fetch_metro):
        call_command("seed_housing_ui_demo")
        initial_counts = (
            MetroCity.objects.count(),
            MetroLine.objects.count(),
            MetroStation.objects.count(),
            MetroLineStation.objects.count(),
            House.objects.filter(building__organization__slug=DEMO_ORGANIZATION_SLUG).count(),
        )

        call_command("seed_housing_ui_demo")

        self.assertEqual(
            (
                MetroCity.objects.count(),
                MetroLine.objects.count(),
                MetroStation.objects.count(),
                MetroLineStation.objects.count(),
                House.objects.filter(building__organization__slug=DEMO_ORGANIZATION_SLUG).count(),
            ),
            initial_counts,
        )
        city = MetroCity.objects.get(name="广州市")
        self.assertIsNotNone(city.imported_at)
        self.assertEqual(city.lines.filter(is_active=True).count(), 2)
        self.assertEqual(city.stations.filter(is_active=True).count(), 3)
        self.assertEqual(MetroLineStation.objects.filter(line__city=city, is_active=True).count(), 4)

        regions = build_public_house_regions(get_public_houses_queryset())
        guangzhou = next(city_item for province in regions["items"] for city_item in province["cities"] if city_item["city"] == "广州市")
        self.assertEqual(
            {item["district"] for item in guangzhou["districts"]},
            {"荔湾区", "越秀区", "海珠区", "天河区", "白云区", "黄埔区", "番禺区", "花都区", "南沙区", "从化区", "增城区"},
        )
        tianhe = next(item for item in guangzhou["districts"] if item["district"] == "天河区")
        self.assertEqual({item["subdistrict"] for item in tianhe["subdistricts"]}, {"珠江新城", "天河北", "车陂"})
        self.assertEqual(House.objects.filter(building__organization__slug=DEMO_ORGANIZATION_SLUG).count(), 46)

    def test_demo_houses_stay_in_dedicated_organization_when_business_organizations_exist(self):
        first = Organization.objects.create(slug="existing-business", name="现有业务组织")
        demo_space = Organization.objects.create(slug="demo-space", name="已有演示空间")

        result = seed_guangzhou_ui_data(source=self.metro_payload)

        self.assertEqual(result.organization_slug, DEMO_ORGANIZATION_SLUG)
        self.assertEqual(House.objects.filter(building__organization__slug=DEMO_ORGANIZATION_SLUG).count(), 46)
        self.assertFalse(House.objects.filter(building__organization__in=[first, demo_space]).exists())
