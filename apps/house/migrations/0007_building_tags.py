from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0006_optional_building_estate"),
    ]

    operations = [
        migrations.AddField(
            model_name="building",
            name="tags",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
