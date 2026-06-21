from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0002_use_base_model_timestamps"),
    ]

    operations = [
        migrations.AddField(
            model_name="defaultsetting",
            name="label",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
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
                ],
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="defaultsetting",
            name="ui",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AlterField(
            model_name="defaultsetting",
            name="value_type",
            field=models.CharField(
                choices=[
                    ("text", "文本"),
                    ("password", "密码"),
                    ("json", "JSON"),
                    ("boolean", "布尔"),
                    ("integer", "整数"),
                    ("float", "浮点数"),
                ],
                default="text",
                max_length=20,
            ),
        ),
    ]
