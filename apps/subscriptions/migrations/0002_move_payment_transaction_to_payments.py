from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_migrate_legacy_transactions"),
        ("subscriptions", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="PaymentTransaction"),
            ],
        ),
    ]
