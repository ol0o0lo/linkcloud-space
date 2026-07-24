from uuid import UUID, uuid4

from django.db.models.signals import post_save
from django.test import TestCase

from apps.accounts.models import User
from apps.favorites.models import Favorite
from apps.favorites.registry import FavoriteTargetDisplay, register_target_adapter, unregister_target_adapter
from tests.api_helpers import api_data


class ArticleFavoriteTargetAdapter:
    target_type = "test_article"
    display_name = "文章"
    order = 100

    def __init__(self, target_id: str):
        self.target = {"id": target_id, "title": "通用收藏契约"}

    def normalize_target_id(self, target_id: str | int) -> str | None:
        try:
            return str(UUID(str(target_id)))
        except (TypeError, ValueError):
            return None

    def get_collectible_target(self, target_id: str):
        return self.target if target_id == self.target["id"] else None

    def get_visible_targets(self, target_ids: list[str]):
        return {self.target["id"]: self.target} if self.target["id"] in target_ids else {}

    def serialize_target(self, target):
        return dict(target)

    def serialize_display(self, target, serialized_target) -> FavoriteTargetDisplay:
        return {
            "title": serialized_target["title"],
            "subtitle": "测试作者",
            "cover_url": None,
            "description": "用于验证业务无需修改收藏核心即可接入。",
            "tags": ["测试"],
            "facts": [{"label": "类型", "value": "文章"}],
        }


class GenericFavoriteAdapterTestCase(TestCase):
    def setUp(self):
        self.target_id = str(uuid4())
        self.adapter = ArticleFavoriteTargetAdapter(self.target_id)
        register_target_adapter(self.adapter)

    def tearDown(self):
        unregister_target_adapter(self.adapter.target_type)

    def test_create_repeat_delete_and_recreate_use_row_existence_as_favorite_state(self):
        user = User.objects.create_user(username="favorite-article-user", password="secret")  # noqa: S106
        self.client.force_login(user)
        favorite_url = f"/api/users/me/favorite/?target_type={self.adapter.target_type}&target_id={self.target_id}"
        created_events = []

        def on_favorite_created(instance, created, **_kwargs):
            if created and instance.user_id == user.pk and instance.target_type == self.adapter.target_type:
                created_events.append(instance.pk)

        post_save.connect(on_favorite_created, sender=Favorite, weak=False, dispatch_uid="test.favorite.article.created")
        try:
            create_response = self.client.put(favorite_url)
            first = Favorite.objects.get(user=user, target_type=self.adapter.target_type, target_id=self.target_id)
            repeated_response = self.client.put(favorite_url)

            self.assertEqual(create_response.status_code, 201)
            self.assertEqual(repeated_response.status_code, 200)
            self.assertEqual(api_data(repeated_response)["id"], first.pk)
            self.assertIn("created_at", api_data(create_response))
            self.assertNotIn("favorited_at", api_data(create_response))
            self.assertEqual(created_events, [first.pk])

            self.assertEqual(self.client.delete(favorite_url).status_code, 200)
            self.assertFalse(Favorite.objects.filter(pk=first.pk).exists())
            self.assertEqual(self.client.delete(favorite_url).status_code, 200)

            recreate_response = self.client.put(favorite_url)
            recreated = Favorite.objects.get(user=user, target_type=self.adapter.target_type, target_id=self.target_id)

            self.assertEqual(recreate_response.status_code, 201)
            self.assertNotEqual(recreated.pk, first.pk)
            self.assertEqual(created_events, [first.pk, recreated.pk])
        finally:
            post_save.disconnect(dispatch_uid="test.favorite.article.created", sender=Favorite)
