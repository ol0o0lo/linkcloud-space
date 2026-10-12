from unittest.mock import patch

from django.contrib.postgres.operations import CreateExtension
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase, override_settings

from model_bakery import baker


def applied_migration_apps():
    loader = MigrationExecutor(connection).loader
    return loader.project_state(list(loader.applied_migrations)).apps


@override_settings(MIGRATION_MODULES={})
class HouseMigrationTestCase(TransactionTestCase):
    def setUp(self):
        super().setUp()
        # PostGIS 是测试数据库的共享基础设施，回退房源迁移时应保留。
        extension_patch = patch.object(CreateExtension, "database_backwards", return_value=None)
        extension_patch.start()
        self.addCleanup(extension_patch.stop)

        executor = MigrationExecutor(connection)
        recorder = MigrationRecorder(connection)
        # --nomigrations 按现有模型建表，需要补齐当前结构的迁移记录。
        for app_label, migration_name in executor.loader.graph.nodes:
            if (app_label, migration_name) not in executor.loader.applied_migrations:
                recorder.record_applied(app_label, migration_name)
        executor = MigrationExecutor(connection)
        self.addCleanup(self.restore_latest_schema)
        executor.migrate(self.migrate_from)
        self.executor = MigrationExecutor(connection)
        # 其他应用仍处于各自已应用的版本，不能仅用房源祖先迁移推导它们的模型。
        self.old_apps = applied_migration_apps()

    def restore_latest_schema(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def tearDown(self):
        self.restore_latest_schema()
        super().tearDown()


class TestOptionalBuildingEstateMigration(HouseMigrationTestCase):
    migrate_from = [("house", "0005_remove_house_available_from")]
    migrate_to = [("house", "0008_building_images")]

    def make_old_hierarchy(self):
        Organization = self.old_apps.get_model("organizations", "Organization")
        Estate = self.old_apps.get_model("house", "Estate")
        organization = baker.make(Organization)
        estate = baker.make(Estate, organization=organization)
        return organization, estate

    def test_migrates_data_allows_null_estate_and_enforces_both_constraints(self):
        organization, estate = self.make_old_hierarchy()
        OldBuilding = self.old_apps.get_model("house", "Building")
        building = baker.make(
            OldBuilding,
            organization=organization,
            estate=estate,
            name="  海滨  公寓  ",
            address="  海滨路  20  号  ",
        )

        self.executor.migrate(self.migrate_to)
        new_apps = applied_migration_apps()
        Building = new_apps.get_model("house", "Building")

        migrated = Building.objects.get(pk=building.pk)
        self.assertEqual(migrated.name, "海滨 公寓")
        self.assertEqual(migrated.address, "海滨路 20 号")
        standalone = Building.objects.create(organization_id=organization.pk, estate=None, name="独立楼", address="独立路 1 号", floors=10)
        self.assertIsNone(standalone.estate_id)

        with connection.cursor() as cursor:
            constraints = connection.introspection.get_constraints(cursor, Building._meta.db_table)
        self.assertIn("house_building_estate_name_unique", constraints)
        self.assertIn("house_building_org_name_address_unique", constraints)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Building.objects.create(organization_id=organization.pk, estate_id=estate.pk, name="海滨 公寓", address="另一地址", floors=12)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Building.objects.create(organization_id=organization.pk, estate=None, name="独立楼", address="独立路 1 号", floors=12)

    def test_conflict_rolls_back_entire_migration_and_leaves_0005_applied(self):
        organization, estate = self.make_old_hierarchy()
        Building = self.old_apps.get_model("house", "Building")
        first = baker.make(Building, organization=organization, estate=estate, name=" 1  栋 ", address=" 地址一 ")
        second = baker.make(Building, organization=organization, estate=estate, name="1 栋", address="地址二")

        try:
            with self.assertRaises(RuntimeError):
                self.executor.migrate(self.migrate_to)

            self.assertFalse(MigrationRecorder(connection).migration_qs.filter(app="house", name="0006_optional_building_estate").exists())
            self.assertTrue(MigrationRecorder(connection).migration_qs.filter(app="house", name="0005_remove_house_available_from").exists())
            self.assertEqual(Building.objects.get(pk=first.pk).name, " 1  栋 ")
            self.assertEqual(Building.objects.get(pk=first.pk).address, " 地址一 ")
            self.assertEqual(Building.objects.get(pk=second.pk).name, "1 栋")
            self.assertEqual(Building.objects.get(pk=second.pk).address, "地址二")
        finally:
            Building.objects.filter(pk=second.pk).update(name="2 栋")
            MigrationExecutor(connection).migrate(self.migrate_to)


class TestUnifiedHouseStatusMigration(HouseMigrationTestCase):
    migrate_from = [("house", "0011_property_responsibility_audit_fields")]
    migrate_to = [("house", "0012_unify_house_status")]

    def test_migrates_legacy_state_to_single_status_without_dropping_columns(self):
        Organization = self.old_apps.get_model("organizations", "Organization")
        Estate = self.old_apps.get_model("house", "Estate")
        Building = self.old_apps.get_model("house", "Building")
        House = self.old_apps.get_model("house", "House")
        organization = baker.make(Organization)
        estate = baker.make(Estate, organization=organization)
        building = baker.make(Building, organization=organization, estate=estate)
        vacant = baker.make(House, building=building, room_number="101", status="vacant", publish_status="draft", is_active=True)
        listed = baker.make(House, building=building, room_number="102", status="vacant", publish_status="published", is_active=True)
        rented = baker.make(House, building=building, room_number="103", status="rented", publish_status="published", is_active=True)
        renovating = baker.make(House, building=building, room_number="104", status="renovating", publish_status="published", is_active=True)
        locked = baker.make(House, building=building, room_number="105", status="locked", publish_status="published", is_active=True)
        inactive = baker.make(House, building=building, room_number="106", status="vacant", publish_status="published", is_active=False)

        self.executor.migrate(self.migrate_to)
        new_apps = applied_migration_apps()
        MigratedHouse = new_apps.get_model("house", "House")

        self.assertEqual(MigratedHouse.objects.get(pk=vacant.pk).status, "vacant")
        self.assertEqual(MigratedHouse.objects.get(pk=listed.pk).status, "listed")
        self.assertEqual(MigratedHouse.objects.get(pk=rented.pk).status, "rented")
        self.assertEqual(MigratedHouse.objects.get(pk=renovating.pk).status, "renovating")
        self.assertEqual(MigratedHouse.objects.get(pk=locked.pk).status, "inactive")
        self.assertEqual(MigratedHouse.objects.get(pk=inactive.pk).status, "inactive")
        self.assertNotIn("publish_status", {field.name for field in MigratedHouse._meta.fields})
        self.assertNotIn("is_active", {field.name for field in MigratedHouse._meta.fields})

        with connection.cursor() as cursor:
            columns = {column.name for column in connection.introspection.get_table_description(cursor, MigratedHouse._meta.db_table)}
        self.assertIn("publish_status", columns)
        self.assertIn("is_active", columns)
