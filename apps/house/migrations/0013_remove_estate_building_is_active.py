from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0012_unify_house_status"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="estate",
            name="is_active",
        ),
        migrations.RemoveField(
            model_name="building",
            name="is_active",
        ),
    ]
