from django.apps import AppConfig


class PlatformOperationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.platform_operations"
    # 历史迁移与数据表使用该标签；更换 Python 包名不改变数据库身份。
    label = "miniprogram_home"
    verbose_name = "平台运营"
