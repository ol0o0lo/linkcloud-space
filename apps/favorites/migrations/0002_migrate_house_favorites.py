from django.db import migrations


def migrate_house_favorites(apps, schema_editor):
    Favorite = apps.get_model("favorites", "Favorite")
    HouseFavorite = apps.get_model("house", "HouseFavorite")

    for house_favorite in HouseFavorite.objects.all().iterator():
        favorite, _created = Favorite.objects.get_or_create(
            user_id=house_favorite.user_id,
            target_type="house",
            target_id=str(house_favorite.house_id),
            defaults={"is_active": house_favorite.is_active},
        )
        Favorite.objects.filter(pk=favorite.pk).update(
            is_active=house_favorite.is_active,
            created_at=house_favorite.created_at,
            updated_at=house_favorite.updated_at,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("favorites", "0001_initial"),
        ("house", "0014_housefavorite"),
    ]

    operations = [migrations.RunPython(migrate_house_favorites, migrations.RunPython.noop)]
