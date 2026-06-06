from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0003_add_updated_at"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="mediafile",
            name="order",
        ),
    ]
