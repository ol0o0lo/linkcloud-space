from django.db import migrations, models


def backfill_default_building_metadata(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    default_setting.objects.filter(key="property_rental.default_building_id").update(
        label="默认楼栋",
        widget="select",
        ui={"options_source": "house.buildings"},
        category="property_rental",
        description="房源租赁默认楼栋",
    )


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0003_setting_schema_metadata"),
    ]

    operations = [
        migrations.AddField(
            model_name="defaultsetting",
            name="category",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.RunPython(backfill_default_building_metadata, migrations.RunPython.noop),
    ]
