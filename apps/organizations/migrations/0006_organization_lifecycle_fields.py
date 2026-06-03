from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0005_use_base_model_timestamps"),
    ]

    operations = [
        migrations.AddField(
            model_name="organization",
            name="archived_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="member_limit",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="organization",
            name="team_limit",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
