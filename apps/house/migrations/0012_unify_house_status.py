from django.db import migrations, models
from django.db.models import Q


def unify_house_status(apps, schema_editor):
    House = apps.get_model("house", "House")
    House.objects.filter(Q(is_active=False) | Q(status="locked")).update(status="inactive")
    House.objects.filter(is_active=True, status="vacant", publish_status="published").update(status="listed")


def restore_legacy_house_status(apps, schema_editor):
    House = apps.get_model("house", "House")
    House.objects.update(is_active=True, publish_status="unpublished")
    House.objects.filter(status="listed").update(status="vacant", publish_status="published")
    House.objects.filter(status="inactive").update(status="locked", is_active=False)


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0011_property_responsibility_audit_fields"),
    ]

    operations = [
        migrations.RunPython(unify_house_status, restore_legacy_house_status),
        migrations.AlterField(
            model_name="house",
            name="status",
            field=models.CharField(
                choices=[
                    ("vacant", "空置"),
                    ("listed", "招租中"),
                    ("rented", "已租"),
                    ("renovating", "装修中"),
                    ("inactive", "已停用"),
                ],
                db_index=True,
                default="vacant",
                max_length=32,
            ),
        ),
        migrations.RunSQL(
            sql=(
                "ALTER TABLE house_house ALTER COLUMN publish_status SET DEFAULT 'draft'; "
                "ALTER TABLE house_house ALTER COLUMN is_active SET DEFAULT TRUE;"
            ),
            reverse_sql=(
                "ALTER TABLE house_house ADD COLUMN IF NOT EXISTS publish_status varchar(16) NOT NULL DEFAULT 'draft'; "
                "ALTER TABLE house_house ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT TRUE;"
            ),
        ),
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveField(model_name="house", name="publish_status"),
                migrations.RemoveField(model_name="house", name="is_active"),
            ],
        ),
    ]
