from importlib import import_module
from unittest.mock import Mock

from django.test import TestCase


class FavoriteDataMigrationTestCase(TestCase):
    def test_remove_inactive_favorites_only_deletes_inactive_rows(self):
        migration_apps = Mock()
        Favorite = migration_apps.get_model.return_value
        inactive_favorites = Favorite.objects.filter.return_value
        remove_inactive_favorites = import_module("apps.favorites.migrations.0003_remove_favorite_is_active").remove_inactive_favorites

        remove_inactive_favorites(migration_apps, None)

        migration_apps.get_model.assert_called_once_with("favorites", "Favorite")
        Favorite.objects.filter.assert_called_once_with(is_active=False)
        inactive_favorites.delete.assert_called_once_with()

    def test_legacy_favorited_at_column_receives_a_database_default(self):
        migration = import_module("apps.favorites.migrations.0006_repair_legacy_favorited_at_default")

        sql = migration.REPAIR_LEGACY_FAVORITED_AT_SQL

        self.assertIn("information_schema.columns", sql)
        self.assertIn("column_name = 'favorited_at'", sql)
        self.assertIn("ALTER COLUMN favorited_at SET DEFAULT CURRENT_TIMESTAMP", sql)
