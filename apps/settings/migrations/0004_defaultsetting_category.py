from django.db import migrations, models


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
    ]
