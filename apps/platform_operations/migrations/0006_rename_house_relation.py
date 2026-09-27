import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("miniprogram_home", "0005_rename_content_models")]

    operations = [
        migrations.AlterField(
            model_name="contententryhouse",
            name="house",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="content_entry_links",
                to="house.house",
                verbose_name="房源",
            ),
        ),
    ]
