from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("organizations", "0004_add_is_primary_to_organizationmember"),
    ]

    operations = [
        migrations.RenameField("Organization", "created", "created_at"),
        migrations.RenameField("Organization", "modified", "updated_at"),
        migrations.AddField("Organization", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("Organization", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("OrganizationMember", "created", "created_at"),
        migrations.RenameField("OrganizationMember", "modified", "updated_at"),
        migrations.AddField("OrganizationMember", "created_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.AddField("OrganizationMember", "updated_by", models.CharField(blank=True, default="", max_length=150)),
        migrations.RenameField("OrganizationInvite", "created", "created_at"),
        migrations.RenameField("OrganizationInvite", "modified", "updated_at"),
    ]
