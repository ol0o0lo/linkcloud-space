from django.apps import AppConfig


class FavoritesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.favorites"
    verbose_name = "用户收藏"

    def ready(self):
        from apps.favorites import targets  # noqa: F401, PLC0415
