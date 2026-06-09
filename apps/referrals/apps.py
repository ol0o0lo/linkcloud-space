from django.apps import AppConfig


class ReferralsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.referrals"
    verbose_name = "裂变推广"

    def ready(self):
        from . import signals

        assert signals  # noqa: S101
