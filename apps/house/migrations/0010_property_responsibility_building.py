import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0009_property_responsibility"),
    ]

    operations = [
        migrations.AddField(
            model_name="propertyresponsibility",
            name="building",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="property_responsibilities",
                to="house.building",
            ),
        ),
        migrations.RemoveConstraint(
            model_name="propertyresponsibility",
            name="house_responsibility_one_target",
        ),
        migrations.AddConstraint(
            model_name="propertyresponsibility",
            constraint=models.CheckConstraint(
                condition=models.Q(landlord__isnull=False, building__isnull=True, estate__isnull=True)
                | models.Q(landlord__isnull=True, building__isnull=False, estate__isnull=True)
                | models.Q(landlord__isnull=True, building__isnull=True, estate__isnull=False),
                name="house_responsibility_one_target",
            ),
        ),
        migrations.AddConstraint(
            model_name="propertyresponsibility",
            constraint=models.UniqueConstraint(
                fields=("member", "building"),
                condition=models.Q(building__isnull=False),
                name="house_responsibility_member_building_unique",
            ),
        ),
        migrations.AlterModelOptions(
            name="propertyresponsibility",
            options={"ordering": ["member__user__username", "landlord__name", "building__name", "estate__name", "id"]},
        ),
    ]
