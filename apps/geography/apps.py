from django.apps import AppConfig


class GeographyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.geography"
    # 保留历史标识，沿用 metro_* 表、ContentType 和已应用的迁移记录。
    label = "metro"
    verbose_name = "地理信息"
