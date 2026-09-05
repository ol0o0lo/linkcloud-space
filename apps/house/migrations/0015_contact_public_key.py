import uuid

from django.db import migrations, models


def backfill_bound_landlord_public_keys(apps, schema_editor):
    Contact = apps.get_model("house", "Contact")
    for contact in Contact.objects.filter(user__isnull=False, public_key__isnull=True).iterator():
        if "landlord" not in (contact.roles or []):
            continue
        contact.public_key = uuid.uuid4()
        contact.save(update_fields=["public_key"])


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0014_housefavorite"),
    ]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="public_key",
            field=models.UUIDField(blank=True, editable=False, null=True, unique=True),
        ),
        migrations.RunPython(backfill_bound_landlord_public_keys, migrations.RunPython.noop),
    ]
