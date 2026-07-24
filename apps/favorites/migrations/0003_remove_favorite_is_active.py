from django.db import migrations, models


def remove_inactive_favorites(apps, schema_editor):
    Favorite = apps.get_model("favorites", "Favorite")
    Favorite.objects.filter(is_active=False).delete()


class Migration(migrations.Migration):
    dependencies = [("favorites", "0002_migrate_house_favorites")]

    operations = [
        migrations.RunPython(remove_inactive_favorites, migrations.RunPython.noop),
        migrations.RemoveIndex(
            model_name="favorite",
            name="favorite_user_type_active_idx",
        ),
        migrations.RemoveField(
            model_name="favorite",
            name="is_active",
        ),
        migrations.AlterModelOptions(
            name="favorite",
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="favorite",
            index=models.Index(fields=["user", "target_type", "created_at"], name="favorite_user_type_created_idx"),
        ),
    ]
