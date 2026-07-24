from django.apps import AppConfig


class HouseConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.house"
    verbose_name = "房源租赁"

    def ready(self):
        from apps.house.favorite_targets import register_favorite_target_adapters  # noqa: PLC0415

        register_favorite_target_adapters()
