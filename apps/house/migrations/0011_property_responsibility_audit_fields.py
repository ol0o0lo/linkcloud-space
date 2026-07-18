from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0010_property_responsibility_building"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="propertyresponsibility",
            name="assigned_by",
        ),
        migrations.AddField(
            model_name="propertyresponsibility",
            name="created_by",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
        migrations.AddField(
            model_name="propertyresponsibility",
            name="updated_by",
            field=models.CharField(blank=True, default="", max_length=150),
        ),
    ]
