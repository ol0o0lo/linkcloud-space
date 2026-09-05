from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.media.constants import ResourceType, ThumbnailStatus


def _media_upload_to(instance, filename):
    return filename  # 路径由服务层预先生成，直接返回


class MediaFile(CreateUpdateTimeModelMixin):
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="media_files",
        verbose_name="上传人",
    )
    resource_type = models.CharField(max_length=32, choices=ResourceType.choices, verbose_name="资源类型")
    original_filename = models.CharField(max_length=255, verbose_name="原始文件名")
    file = models.FileField(upload_to=_media_upload_to, verbose_name="文件")
    file_size = models.PositiveIntegerField(help_text="bytes", verbose_name="文件大小")
    thumbnail = models.FileField(upload_to=_media_upload_to, null=True, blank=True, verbose_name="缩略图")
    thumbnail_status = models.CharField(max_length=16, choices=ThumbnailStatus.choices, default=ThumbnailStatus.NOT_REQUESTED, verbose_name="缩略图状态")
    thumbnail_enqueued_at = models.DateTimeField(null=True, blank=True, verbose_name="缩略图入队时间")
    thumbnail_started_at = models.DateTimeField(null=True, blank=True, verbose_name="缩略图开始处理时间")
    thumbnail_generated_at = models.DateTimeField(null=True, blank=True, verbose_name="缩略图生成时间")

    class Meta:
        verbose_name = "媒体文件"
        verbose_name_plural = "媒体文件"
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["thumbnail_status", "thumbnail_enqueued_at"], name="media_thumb_recovery_idx")]

    def __str__(self):  # noqa: D105
        return f"{self.resource_type}:{self.original_filename}"
