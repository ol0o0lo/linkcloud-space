from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("payments", "0002_migrate_legacy_transactions"),
        ("wallet", "0002_alter_withdrawalrequest_pay_channel"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="WithdrawalPayout"),
            ],
        ),
    ]
