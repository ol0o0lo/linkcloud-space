from importlib import import_module

from django.apps import apps
from django.test import TestCase

from model_bakery import baker

from apps.accounts.models import User
from apps.favorites.models import Favorite
from apps.house.models import HouseFavorite


class FavoriteDataMigrationTestCase(TestCase):
    def test_house_favorites_are_copied_idempotently(self):
        user = User.objects.create_user(username="favorite-migration-user", password="secret")  # noqa: S106
        building = baker.make("house.Building", name="1栋", address="迁移测试路 1 号")
        house = baker.make("house.House", building=building, room_number="101")
        HouseFavorite.objects.create(user=user, house=house, is_active=False)
        migrate_house_favorites = import_module("apps.favorites.migrations.0002_migrate_house_favorites").migrate_house_favorites

        migrate_house_favorites(apps, None)
        migrate_house_favorites(apps, None)

        favorite = Favorite.objects.get(user=user, target_type="house", target_id=str(house.pk))
        self.assertFalse(favorite.is_active)
        self.assertEqual(favorite.created_at, HouseFavorite.objects.get(user=user, house=house).created_at)
        self.assertEqual(Favorite.objects.filter(user=user, target_type="house", target_id=str(house.pk)).count(), 1)
