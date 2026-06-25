from django.db import migrations


DEFAULT_PUBLISH_RULES = {
    "landlord": {"mode": "required", "label": "房东主体"},
    "rent": {"mode": "required", "label": "租金"},
    "cover": {"mode": "warn", "label": "封面图"},
    "images": {"mode": "warn", "label": "房源图片", "min_count": 3},
    "floor_plan": {"mode": "warn", "label": "户型图"},
    "video": {"mode": "off", "label": "视频", "min_count": 1},
}


def ensure_property_rental_publish_rules(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    default_setting.objects.update_or_create(
        key="property_rental.publish_rules",
        defaults={
            "value": DEFAULT_PUBLISH_RULES,
            "value_type": "json",
            "label": "房源发布规则",
            "widget": "json_editor",
            "ui": {"options_source": "house.publish_rules"},
            "category": "property_rental",
            "description": "控制房源发布时哪些资料缺失会阻断发布，哪些仅做提醒。",
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0004_defaultsetting_category"),
    ]

    operations = [
        migrations.RunPython(ensure_property_rental_publish_rules, migrations.RunPython.noop),
    ]
