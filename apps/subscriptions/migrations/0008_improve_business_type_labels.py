from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("subscriptions", "0007_commercial_closure"),
    ]

    operations = [
        migrations.AlterField(
            model_name="organizationsaasprofile",
            name="business_type",
            field=models.CharField(choices=[("individual", "独立经纪人"), ("store", "经纪门店")], default="store", max_length=24, verbose_name="经营类型"),
        ),
    ]
