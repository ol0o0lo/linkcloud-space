from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.recorder import MigrationRecorder
from django.test import TransactionTestCase, override_settings

from model_bakery import baker


@override_settings(MIGRATION_MODULES={})
class TestOptionalBuildingEstateMigration(TransactionTestCase):
    migrate_from = [("house", "0005_remove_house_available_from")]
    migrate_to = [("house", "0006_optional_building_estate")]

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        recorder = MigrationRecorder(connection)
        for app_label, migration_name in executor.loader.graph.nodes:
            recorder.record_applied(app_label, migration_name)
        executor = MigrationExecutor(connection)
        executor.migrate(self.migrate_from)
        self.executor = MigrationExecutor(connection)
        self.old_apps = self.executor.loader.project_state(self.migrate_from).apps

    def tearDown(self):
        MigrationExecutor(connection).migrate(self.migrate_to)
        super().tearDown()

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
        new_apps = self.executor.loader.project_state(self.migrate_to).apps
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
