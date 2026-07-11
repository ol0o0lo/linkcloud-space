from importlib import import_module

from django.apps import apps
from django.test import TestCase

from model_bakery import baker


class TestNormalizeExistingBuildingsMigration(TestCase):
    def setUp(self):
        self.migration = import_module("apps.house.migrations.0006_optional_building_estate")
        self.organization = baker.make("organizations.Organization")
        self.estate = baker.make("house.Estate", organization=self.organization)

    def test_normalizes_all_existing_buildings(self):
        building = baker.make(
            "house.Building",
            organization=self.organization,
            estate=self.estate,
            name="待规范楼栋",
            address="待规范地址",
        )
        type(building).objects.filter(pk=building.pk).update(name="  海滨  公寓  ", address="  海滨路  20  号  ")

        self.migration.normalize_existing_buildings(apps, None)

        building.refresh_from_db()
        self.assertEqual(building.name, "海滨 公寓")
        self.assertEqual(building.address, "海滨路 20 号")

    def test_normalized_conflict_aborts_without_partial_updates(self):
        first = baker.make("house.Building", organization=self.organization, estate=self.estate, name="迁移前一栋", address="地址一")
        second = baker.make("house.Building", organization=self.organization, estate=self.estate, name="迁移前二栋", address="地址二")
        type(first).objects.filter(pk=first.pk).update(name=" 1  栋 ", address=" 地址一 ")
        type(second).objects.filter(pk=second.pk).update(name="1 栋", address="地址二")

        with self.assertRaises(RuntimeError):
            self.migration.normalize_existing_buildings(apps, None)

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.name, " 1  栋 ")
        self.assertEqual(first.address, " 地址一 ")
        self.assertEqual(second.name, "1 栋")
        self.assertEqual(second.address, "地址二")
