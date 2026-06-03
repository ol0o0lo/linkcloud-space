from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0002_mediafile_order"),
    ]

    operations = [
        migrations.AddField("MediaFile", "updated_at", models.DateTimeField(auto_now=True)),
    ]
