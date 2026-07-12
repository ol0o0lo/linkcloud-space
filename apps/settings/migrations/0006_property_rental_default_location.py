from django.db import migrations


DEFAULT_LOCATION_SETTING = {
    "key": "property_rental.default_location",
    "value": {},
    "value_type": "json",
    "widget": "location_picker",
    "label": "默认定位",
    "description": "新建项目、楼栋和地图的初始位置。",
    "category": "property_rental",
    "ui": {"provider": "amap"},
}


def ensure_property_rental_default_location(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(
        key=DEFAULT_LOCATION_SETTING["key"],
        defaults=DEFAULT_LOCATION_SETTING,
    )
    default_setting.objects.filter(pk=setting.pk).update(
        value_type=DEFAULT_LOCATION_SETTING["value_type"],
        widget=DEFAULT_LOCATION_SETTING["widget"],
        label=DEFAULT_LOCATION_SETTING["label"],
        description=DEFAULT_LOCATION_SETTING["description"],
        category=DEFAULT_LOCATION_SETTING["category"],
        ui=DEFAULT_LOCATION_SETTING["ui"],
    )


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0005_property_rental_publish_rules")]

    operations = [migrations.RunPython(ensure_property_rental_default_location, migrations.RunPython.noop)]
