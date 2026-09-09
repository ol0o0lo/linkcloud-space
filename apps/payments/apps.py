from django.apps import AppConfig


class PaymentsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.payments"
    verbose_name = "支付"

    def ready(self):
        import apps.payments.checks  # noqa: F401
