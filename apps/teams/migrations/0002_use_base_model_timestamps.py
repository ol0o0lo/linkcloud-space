from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("teams", "0001_initial"),
    ]

    operations = [
        migrations.RenameField("Team", "created", "created_at"),
        migrations.RenameField("Team", "modified", "updated_at"),
        migrations.AddField("Team", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("Team", "updated_by", models.CharField(blank=True, default="", max_length=150)),
    ]
