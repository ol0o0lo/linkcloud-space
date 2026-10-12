from django.db import migrations, models


def populate_normalized_phone(apps, schema_editor):
    from apps.accounts.models import normalize_phone

    Contact = apps.get_model("house", "Contact")
    contacts = Contact.objects.using(schema_editor.connection.alias)
    for contact in contacts.only("pk", "phone").iterator(chunk_size=1000):
        contacts.filter(pk=contact.pk).update(normalized_phone=normalize_phone(contact.phone) or "")


class Migration(migrations.Migration):
    dependencies = [("house", "0027_house_listing_type")]

    operations = [
        migrations.AddField(
            model_name="contact",
            name="normalized_phone",
            field=models.CharField(blank=True, db_index=True, default="", editable=False, max_length=32, verbose_name="标准化手机号"),
        ),
        migrations.RunPython(populate_normalized_phone, migrations.RunPython.noop),
    ]
