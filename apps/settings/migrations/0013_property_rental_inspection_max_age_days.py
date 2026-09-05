from django.db import migrations

INSPECTION_MAX_AGE_DAYS_SETTING = {
    "key": "property_rental.inspection_max_age_days",
    "value": 180,
    "value_type": "integer",
    "widget": "input_number",
    "label": "房源资料复查周期",
    "description": "当前员工负责的房源超过该周期未更新时，将进入待勘察列表。",
    "category": "property_rental",
    "ui": {"scopes": ["organization"], "min": 1, "max": 3650, "step": 1, "unit": "天"},
}


def ensure_property_rental_inspection_max_age_days_setting(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(
        key=INSPECTION_MAX_AGE_DAYS_SETTING["key"],
        defaults=INSPECTION_MAX_AGE_DAYS_SETTING,
    )
    default_setting.objects.filter(pk=setting.pk).update(
        value_type=INSPECTION_MAX_AGE_DAYS_SETTING["value_type"],
        widget=INSPECTION_MAX_AGE_DAYS_SETTING["widget"],
        label=INSPECTION_MAX_AGE_DAYS_SETTING["label"],
        description=INSPECTION_MAX_AGE_DAYS_SETTING["description"],
        category=INSPECTION_MAX_AGE_DAYS_SETTING["category"],
        ui=INSPECTION_MAX_AGE_DAYS_SETTING["ui"],
    )


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0012_alter_defaultsetting_options_and_more")]

    operations = [migrations.RunPython(ensure_property_rental_inspection_max_age_days_setting, migrations.RunPython.noop)]
