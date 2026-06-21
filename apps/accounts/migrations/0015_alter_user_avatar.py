from django.db import migrations

import apps.media.fields


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0014_user_avatar_media_refs"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="avatar",
            field=apps.media.fields.MediaRefsField(
                allowed_media_types=["image"],
                allowed_resource_types=["avatar"],
                blank=True,
                business_validators=["apps.accounts.services.validate_avatar_media_owner"],
                default=list,
                max_items=1,
                verbose_name="头像",
            ),
        ),
    ]
