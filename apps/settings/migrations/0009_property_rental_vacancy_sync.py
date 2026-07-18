from django.db import migrations

VACANCY_SYNC_SETTING = {
    "key": "property_rental.vacancy_sync_force_rented",
    "value": False,
    "value_type": "boolean",
    "widget": "switch",
    "label": "房表同步强制改已租",
    "description": "开启后，房表清单外的装修中和封存房源也会强制改为已租；默认保留这些特殊房态。",
    "category": "property_rental",
    "ui": {"scopes": ["organization"]},
}


def ensure_property_rental_vacancy_sync_setting(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(
        key=VACANCY_SYNC_SETTING["key"],
        defaults=VACANCY_SYNC_SETTING,
    )
    default_setting.objects.filter(pk=setting.pk).update(
        value_type=VACANCY_SYNC_SETTING["value_type"],
        widget=VACANCY_SYNC_SETTING["widget"],
        label=VACANCY_SYNC_SETTING["label"],
        description=VACANCY_SYNC_SETTING["description"],
        category=VACANCY_SYNC_SETTING["category"],
        ui=VACANCY_SYNC_SETTING["ui"],
    )


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0008_property_rental_tag_suggestions")]

    operations = [migrations.RunPython(ensure_property_rental_vacancy_sync_setting, migrations.RunPython.noop)]
