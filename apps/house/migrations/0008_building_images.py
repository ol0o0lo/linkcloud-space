from django.db import migrations

import apps.media.fields


class Migration(migrations.Migration):
    dependencies = [
        ("house", "0007_building_tags"),
        ("media", "0008_alter_mediafile_resource_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="building",
            name="images",
            field=apps.media.fields.MediaRefsField(
                allowed_media_types=["image"],
                allowed_resource_types=["building_image"],
                blank=True,
                business_validators=["apps.house.services.validate_org_scoped_media_refs"],
                default=list,
                max_items=9,
                verbose_name="楼栋图片",
            ),
        ),
    ]
