from django.db import migrations, models

import apps.media.models


class Migration(migrations.Migration):
    dependencies = [
        ("media", "0006_alter_mediafile_resource_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="mediafile",
            name="thumbnail",
            field=models.FileField(blank=True, null=True, upload_to=apps.media.models._media_upload_to),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="thumbnail_enqueued_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="thumbnail_generated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="thumbnail_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="mediafile",
            name="thumbnail_status",
            field=models.CharField(
                choices=[
                    ("not_requested", "未请求"),
                    ("pending", "等待生成"),
                    ("processing", "生成中"),
                    ("ready", "已生成"),
                    ("failed", "生成失败"),
                ],
                default="not_requested",
                max_length=16,
            ),
        ),
        migrations.AddIndex(
            model_name="mediafile",
            index=models.Index(fields=["thumbnail_status", "thumbnail_enqueued_at"], name="media_thumb_recovery_idx"),
        ),
    ]
