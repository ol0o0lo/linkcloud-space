from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("app_settings", "0001_initial"),
    ]

    operations = [
        migrations.RenameField("DefaultSetting", "created", "created_at"),
        migrations.RenameField("DefaultSetting", "modified", "updated_at"),
        migrations.RemoveField("DefaultSetting", "updated_by"),
        migrations.AddField("DefaultSetting", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("DefaultSetting", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("OrganizationSetting", "created", "created_at"),
        migrations.RenameField("OrganizationSetting", "modified", "updated_at"),
        migrations.AddField("OrganizationSetting", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("OrganizationSetting", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("TeamSetting", "created", "created_at"),
        migrations.RenameField("TeamSetting", "modified", "updated_at"),
        migrations.AddField("TeamSetting", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("TeamSetting", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("UserSetting", "created", "created_at"),
        migrations.RenameField("UserSetting", "modified", "updated_at"),
        migrations.AddField("UserSetting", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("UserSetting", "updated_by", models.CharField(blank=True, default="", max_length=150)),
    ]
