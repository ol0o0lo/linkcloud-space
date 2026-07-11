import django.db.models.deletion
from django.db import migrations, models


def normalize_space_identity(value):
    return " ".join(value.split())


def normalize_existing_buildings(apps, schema_editor):
    Building = apps.get_model("house", "Building")
    buildings = list(Building.objects.all())
    normalized = []
    identities = set()

    for building in buildings:
        name = normalize_space_identity(building.name)
        address = normalize_space_identity(building.address)
        identity = ("estate", building.estate_id, name) if building.estate_id else ("organization", building.organization_id, name, address)
        if identity in identities:
            raise RuntimeError(f"楼栋规范化后发生唯一性冲突: {identity}")
        identities.add(identity)
        normalized.append((building.pk, name, address))

    for pk, name, address in normalized:
        Building.objects.filter(pk=pk).update(name=name, address=address)


class Migration(migrations.Migration):
    dependencies = [("house", "0005_remove_house_available_from")]

    operations = [
        migrations.RemoveConstraint(model_name="building", name="house_building_estate_name_unique"),
        migrations.AlterField(
            model_name="building",
            name="estate",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="buildings",
                to="house.estate",
            ),
        ),
        migrations.RunPython(normalize_existing_buildings, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="building",
            constraint=models.UniqueConstraint(condition=models.Q(("estate__isnull", False)), fields=("estate", "name"), name="house_building_estate_name_unique"),
        ),
        migrations.AddConstraint(
            model_name="building",
            constraint=models.UniqueConstraint(
                condition=models.Q(("estate__isnull", True)),
                fields=("organization", "name", "address"),
                name="house_building_org_name_address_unique",
            ),
        ),
    ]
