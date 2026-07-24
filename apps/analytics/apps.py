from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.analytics"
    verbose_name = "行为分析"

    def ready(self):
        from apps.analytics.receivers import register_post_save_receivers  # noqa: PLC0415

        register_post_save_receivers()
