from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("house", "0026_housecommuteroute_transit_segments")]

    operations = [
        migrations.AddField(
            model_name="house",
            name="listing_type",
            field=models.CharField(
                blank=True,
                choices=[("whole", "整租"), ("shared", "合租"), ("apartment", "公寓"), ("short_term", "短租")],
                db_index=True,
                max_length=20,
                null=True,
                verbose_name="出租分类",
            ),
        ),
    ]
