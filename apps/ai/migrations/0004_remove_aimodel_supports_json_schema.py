from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("ai", "0003_seed_default_ai_runtime")]

    operations = [
        migrations.RemoveField(
            model_name="aimodel",
            name="supports_json_schema",
        ),
    ]
