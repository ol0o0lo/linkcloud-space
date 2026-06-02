from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.RenameField("Notification", "created", "created_at"),
        migrations.RenameField("Notification", "modified", "updated_at"),
        migrations.AlterModelOptions("Notification", {"ordering": ("-created_at",)}),
        migrations.RenameField("NotificationPreference", "created", "created_at"),
        migrations.RenameField("NotificationPreference", "modified", "updated_at"),
    ]
