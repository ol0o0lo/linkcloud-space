from django.db import migrations, models

DEFAULT_TAG_SUGGESTIONS = [
    "近地铁",
    "交通便利",
    "成熟配套",
    "有电梯",
    "采光好",
    "南北通透",
    "精装修",
    "拎包入住",
]

TAG_SUGGESTIONS_SETTING = {
    "key": "property_rental.tag_suggestions",
    "value": DEFAULT_TAG_SUGGESTIONS,
    "value_type": "json",
    "widget": "tags",
    "label": "常用标签",
    "description": "仅作为楼栋和房源标签录入时的快捷候选，不会自动添加，也不限制手动输入。",
    "category": "property_rental",
    "ui": {
        "allow_custom": True,
        "scopes": ["system"],
        "token_separators": [",", "，", ";", "；", "、"],
    },
}


def ensure_property_rental_tag_suggestions(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(
        key=TAG_SUGGESTIONS_SETTING["key"],
        defaults=TAG_SUGGESTIONS_SETTING,
    )
    default_setting.objects.filter(pk=setting.pk).update(
        value_type=TAG_SUGGESTIONS_SETTING["value_type"],
        widget=TAG_SUGGESTIONS_SETTING["widget"],
        label=TAG_SUGGESTIONS_SETTING["label"],
        description=TAG_SUGGESTIONS_SETTING["description"],
        category=TAG_SUGGESTIONS_SETTING["category"],
        ui=TAG_SUGGESTIONS_SETTING["ui"],
    )


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0007_add_location_picker_widget")]

    operations = [
        migrations.AlterField(
            model_name="defaultsetting",
            name="widget",
            field=models.CharField(
                blank=True,
                choices=[
                    ("input", "输入框"),
                    ("textarea", "多行文本"),
                    ("password", "密码框"),
                    ("switch", "开关"),
                    ("input_number", "数字输入框"),
                    ("select", "选择器"),
                    ("json_editor", "JSON 编辑器"),
                    ("location_picker", "地址选择器"),
                    ("tags", "标签输入"),
                ],
                max_length=20,
            ),
        ),
        migrations.RunPython(ensure_property_rental_tag_suggestions, migrations.RunPython.noop),
    ]
