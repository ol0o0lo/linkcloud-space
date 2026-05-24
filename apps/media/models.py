from django.conf import settings
from django.db import models

from apps.base.storage import S3MediaStorage
from apps.media.constants import ResourceType


def _media_upload_to(instance, filename):
    return filename  # 路径由服务层预先生成，直接返回


class MediaFile(models.Model):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_files",
    )
    resource_type = models.CharField(max_length=32, choices=ResourceType.choices)
    original_filename = models.CharField(max_length=255)
    file = models.FileField(storage=S3MediaStorage(), upload_to=_media_upload_to)
    file_size = models.PositiveIntegerField(help_text="bytes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.resource_type}:{self.original_filename}"
