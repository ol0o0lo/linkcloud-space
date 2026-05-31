from django.apps import AppConfig
from django.db.models.signals import post_migrate


class AccessConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.access"

    def ready(self):
        # Keep runtime permissions aligned with the registry whenever Django
        # finishes applying migrations, including during local `just start`.
        post_migrate.connect(sync_access_permissions_after_migrate, sender=self, dispatch_uid="access.sync_after_migrate")


def sync_access_permissions_after_migrate(**kwargs):
    from apps.access.sync import sync_access_permissions

    sync_access_permissions()
