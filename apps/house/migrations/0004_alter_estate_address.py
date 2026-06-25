from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0003_house_publish_listing_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="estate",
            name="address",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
    ]
