from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("access", "0004_update_permission_names_zh"),
    ]

    operations = [
        migrations.RenameField("AccessRole", "created", "created_at"),
        migrations.RenameField("AccessRole", "modified", "updated_at"),
        migrations.AddField("AccessRole", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("AccessRole", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("OrganizationGroupBinding", "created", "created_at"),
        migrations.RenameField("OrganizationGroupBinding", "modified", "updated_at"),
        migrations.AddField("OrganizationGroupBinding", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("OrganizationGroupBinding", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("TeamGroupBinding", "created", "created_at"),
        migrations.RenameField("TeamGroupBinding", "modified", "updated_at"),
        migrations.AddField("TeamGroupBinding", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("TeamGroupBinding", "updated_by", models.CharField(blank=True, default="", max_length=150)),
    ]
