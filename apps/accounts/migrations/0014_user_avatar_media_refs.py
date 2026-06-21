from pathlib import Path

from django.db import migrations

import apps.media.fields


def forwards(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    MediaFile = apps.get_model("media", "MediaFile")

    for user in User.objects.iterator():
        source_field = user.avatar_original or user.avatar_thumbnail
        source_name = getattr(source_field, "name", "") or str(source_field or "")
        if not source_name:
            continue

        original_filename = Path(source_name).name or f"user-{user.pk}-avatar"
        media = MediaFile.objects.create(
            uploader_id=user.pk,
            resource_type="avatar",
            original_filename=original_filename,
            file=source_name,
            file_size=0,
        )
        user.avatar = [{"media_id": media.pk, "media_type": "image"}]
        user.save(update_fields=["avatar"])


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0005_alter_mediafile_resource_type"),
        ("accounts", "0013_alter_realnameverification_id_card_media"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar",
            field=apps.media.fields.MediaRefsField(
                allowed_media_types=["image"],
                allowed_resource_types=["avatar"],
                blank=True,
                default=list,
                max_items=1,
                verbose_name="头像",
            ),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.RemoveField(model_name="user", name="avatar_original"),
        migrations.RemoveField(model_name="user", name="avatar_thumbnail"),
        migrations.RemoveField(model_name="user", name="avatar_crop_data"),
    ]
