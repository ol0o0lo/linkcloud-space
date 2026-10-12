from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("house", "0028_contact_normalized_phone")]

    operations = [
        migrations.AddField(model_name="building", name="province", field=models.CharField(blank=True, default="", max_length=64, verbose_name="省份")),
        migrations.AddField(model_name="building", name="city", field=models.CharField(blank=True, default="", max_length=64, verbose_name="城市")),
        migrations.AddField(model_name="building", name="district", field=models.CharField(blank=True, default="", max_length=64, verbose_name="区县")),
        migrations.AddField(model_name="building", name="subdistrict", field=models.CharField(blank=True, default="", max_length=64, verbose_name="街道/板块")),
    ]
