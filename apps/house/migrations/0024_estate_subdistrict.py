from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("house", "0023_postgis_locations")]

    operations = [
        migrations.AddField(
            model_name="estate",
            name="subdistrict",
            field=models.CharField(blank=True, default="", max_length=64, verbose_name="街道/板块"),
        ),
    ]
