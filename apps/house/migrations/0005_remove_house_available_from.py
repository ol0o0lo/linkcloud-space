from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("house", "0004_alter_estate_address"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="house",
            name="available_from",
        ),
    ]
