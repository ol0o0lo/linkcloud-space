from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="aimodel",
            name="structured_output_mode",
            field=models.CharField(
                choices=[("none", "none"), ("json_object", "json_object"), ("json_schema", "json_schema")],
                default="none",
                max_length=20,
                verbose_name="结构化输出模式",
            ),
        ),
    ]
