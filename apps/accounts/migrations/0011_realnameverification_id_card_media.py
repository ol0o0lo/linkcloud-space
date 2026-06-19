from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0010_remove_user_phone"),
    ]

    operations = [
        migrations.AddField(
            model_name="realnameverification",
            name="id_card_media",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
