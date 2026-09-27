from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0025_housecommutedestination_housecommuteroute"),
    ]

    operations = [
        migrations.AddField(
            model_name="housecommuteroute",
            name="transit_segments",
            field=models.JSONField(default=list),
        ),
    ]
