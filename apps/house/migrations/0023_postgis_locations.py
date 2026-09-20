from django.contrib.gis.db.models.fields import PointField
from django.contrib.gis.geos import Point
from django.contrib.postgres.operations import CreateExtension
from django.db import migrations

from apps.house.geo.coordinates import gcj02_to_wgs84


def migrate_locations_to_postgis(apps, schema_editor):
    for model_name in ("Estate", "Building"):
        model = apps.get_model("house", model_name)
        for item in model.objects.exclude(lat__isnull=True).exclude(lng__isnull=True).iterator(chunk_size=500):
            longitude, latitude = gcj02_to_wgs84(float(item.lng), float(item.lat))
            item.location = Point(longitude, latitude, srid=4326)
            item.save(update_fields=["location"])


class Migration(migrations.Migration):
    dependencies = [("house", "0022_house_ai_insight")]

    operations = [
        CreateExtension("postgis"),
        migrations.AddField(
            model_name="estate",
            name="location",
            field=PointField(blank=True, geography=True, help_text="项目/小区级展示点定位", null=True, srid=4326, verbose_name="地理位置"),
        ),
        migrations.AddField(
            model_name="building",
            name="location",
            field=PointField(blank=True, geography=True, help_text="楼栋级精确导航定位", null=True, srid=4326, verbose_name="地理位置"),
        ),
        migrations.RunPython(migrate_locations_to_postgis, migrations.RunPython.noop),
        migrations.RemoveField(model_name="estate", name="lat"),
        migrations.RemoveField(model_name="estate", name="lng"),
        migrations.RemoveField(model_name="building", name="lat"),
        migrations.RemoveField(model_name="building", name="lng"),
    ]
