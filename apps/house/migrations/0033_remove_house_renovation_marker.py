from django.db import migrations

SETTING_KEY = "property_rental.vacancy_sync_force_rented"


def retire_renovation_setting(apps, schema_editor):
    DefaultSetting = apps.get_model("app_settings", "DefaultSetting")
    settings = DefaultSetting.objects.using(schema_editor.connection.alias)
    setting = settings.filter(key=SETTING_KEY).first()
    if setting is not None:
        ui = dict(setting.ui or {})
        ui["scopes"] = []
        settings.filter(pk=setting.pk).update(ui=ui)


def restore_renovation_setting(apps, schema_editor):
    DefaultSetting = apps.get_model("app_settings", "DefaultSetting")
    settings = DefaultSetting.objects.using(schema_editor.connection.alias)
    setting = settings.filter(key=SETTING_KEY).first()
    if setting is not None:
        ui = dict(setting.ui or {})
        ui["scopes"] = ["organization"]
        settings.filter(pk=setting.pk).update(ui=ui)


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0009_property_rental_vacancy_sync"),
        ("house", "0032_simplify_house_status"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="house", name="house_renovating_requires_paused"),
        migrations.RunSQL(
            # 遵循仓库禁止物理删除的约定，保留原列作为历史备份。
            # 模型不再写入旧列，因此需要数据库默认值保证新增房源正常保存。
            "ALTER TABLE house_house ALTER COLUMN is_renovating SET DEFAULT FALSE;",
            reverse_sql=(
                "ALTER TABLE house_house ADD COLUMN IF NOT EXISTS is_renovating boolean NOT NULL DEFAULT FALSE; "
                "UPDATE house_house SET is_renovating = FALSE WHERE status <> 'paused'; "
                "SET CONSTRAINTS ALL IMMEDIATE;"
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[migrations.RemoveField(model_name="house", name="is_renovating")],
        ),
        migrations.RunPython(retire_renovation_setting, restore_renovation_setting),
    ]
