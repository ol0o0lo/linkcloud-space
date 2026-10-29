from django.apps import AppConfig


class DataMigrationConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.data_migration"
    verbose_name = "团队数据迁移"
