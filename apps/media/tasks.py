import logging
from datetime import timedelta

from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone

from celery import shared_task

from apps.media.constants import ThumbnailStatus
from apps.media.models import MediaFile
from apps.media.services import cleanup_unreferenced_media
from apps.media.thumbnails import InvalidImageContentError, create_thumbnail_file, get_thumbnail_path, is_image_path

logger = logging.getLogger(__name__)


def enqueue_media_thumbnail(media_file_id: int) -> bool:
    """发布缩略图任务；Broker 不可用时不影响已经完成的上传。"""
    try:
        generate_media_thumbnail.apply_async(args=(media_file_id,), retry=False)
        MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PENDING).update(thumbnail_enqueued_at=timezone.now())
    except Exception:
        logger.exception("媒体缩略图任务发布失败", extra={"media_file_id": media_file_id})
        return False
    return True


def _mark_thumbnail_failed(media_file_id: int) -> None:
    MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PROCESSING).update(
        thumbnail=None,
        thumbnail_status=ThumbnailStatus.FAILED,
        thumbnail_enqueued_at=None,
        thumbnail_started_at=None,
        thumbnail_generated_at=None,
    )


def _release_thumbnail_for_retry(media_file_id: int) -> None:
    MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PROCESSING).update(
        thumbnail_status=ThumbnailStatus.PENDING,
        thumbnail_enqueued_at=timezone.now(),
        thumbnail_started_at=None,
    )


def _cleanup_missing_media_thumbnail(self, media_file_id: int) -> bool:
    thumbnail_path = get_thumbnail_path(media_file_id)
    try:
        if default_storage.exists(thumbnail_path):
            default_storage.delete(thumbnail_path)
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.exception("无主缩略图清理重试耗尽", extra={"media_file_id": media_file_id, "thumbnail_path": thumbnail_path})
            return False
        raise self.retry(exc=exc, countdown=2**self.request.retries) from exc
    return False


@shared_task(
    bind=True,
    max_retries=3,
    acks_late=True,
    reject_on_worker_lost=True,
    rate_limit="12/m",
    soft_time_limit=110,
    time_limit=120,
)
def generate_media_thumbnail(self, media_file_id: int) -> bool:
    claimed = MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PENDING).update(
        thumbnail_status=ThumbnailStatus.PROCESSING,
        thumbnail_enqueued_at=None,
        thumbnail_started_at=timezone.now(),
    )
    if claimed == 0:
        if MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.READY).exists():
            return True
        if not MediaFile.objects.filter(pk=media_file_id).exists():
            return _cleanup_missing_media_thumbnail(self, media_file_id)
        return False

    try:
        media_file = MediaFile.objects.get(pk=media_file_id)
        if not is_image_path(media_file.file.name):
            MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PROCESSING).update(
                thumbnail_status=ThumbnailStatus.NOT_REQUESTED,
                thumbnail_enqueued_at=None,
                thumbnail_started_at=None,
            )
            return False

        thumbnail_path = create_thumbnail_file(media_file)
        updated = MediaFile.objects.filter(pk=media_file_id, thumbnail_status=ThumbnailStatus.PROCESSING).update(
            thumbnail=thumbnail_path,
            thumbnail_status=ThumbnailStatus.READY,
            thumbnail_enqueued_at=None,
            thumbnail_started_at=None,
            thumbnail_generated_at=timezone.now(),
            updated_at=timezone.now(),
        )
        if updated:
            return True

        if not MediaFile.objects.filter(pk=media_file_id).exists():
            media_file.thumbnail.storage.delete(thumbnail_path)
        return False
    except MediaFile.DoesNotExist:
        return False
    except InvalidImageContentError:
        _mark_thumbnail_failed(media_file_id)
        return False
    except Exception as exc:
        if self.request.retries >= self.max_retries:
            logger.exception("媒体缩略图生成重试耗尽", extra={"media_file_id": media_file_id})
            _mark_thumbnail_failed(media_file_id)
            return False
        _release_thumbnail_for_retry(media_file_id)
        raise self.retry(exc=exc, countdown=2**self.request.retries) from exc


@shared_task
def recover_pending_media_thumbnails() -> int:
    """重新投递近期卡住的新图片，不触碰迁移后保持 not_requested 的存量图片。"""
    now = timezone.now()
    processing_cutoff = now - timedelta(minutes=settings.MEDIA_THUMBNAIL_PROCESSING_TIMEOUT_MINUTES)
    MediaFile.objects.filter(
        thumbnail_status=ThumbnailStatus.PROCESSING,
        thumbnail_started_at__lt=processing_cutoff,
    ).update(
        thumbnail_status=ThumbnailStatus.PENDING,
        thumbnail_enqueued_at=None,
        thumbnail_started_at=None,
    )

    pending_cutoff = now - timedelta(minutes=settings.MEDIA_THUMBNAIL_RECOVERY_DELAY_MINUTES)
    enqueue_cutoff = now - timedelta(minutes=settings.MEDIA_THUMBNAIL_ENQUEUE_TIMEOUT_MINUTES)
    pending_ids = list(
        MediaFile.objects.filter(
            thumbnail_status=ThumbnailStatus.PENDING,
            created_at__lt=pending_cutoff,
        )
        .filter(Q(thumbnail_enqueued_at__isnull=True) | Q(thumbnail_enqueued_at__lt=enqueue_cutoff))
        .order_by("pk")
        .values_list("pk", flat=True)[: settings.MEDIA_THUMBNAIL_RECOVERY_BATCH_SIZE]
    )
    return sum(enqueue_media_thumbnail(media_file_id) for media_file_id in pending_ids)


@shared_task
def cleanup_unreferenced_media_files() -> int:
    """Celery entry point. Runs via CELERY_BEAT_SCHEDULE."""
    result = cleanup_unreferenced_media(older_than=timedelta(hours=settings.MEDIA_ORPHAN_RETENTION_HOURS))
    return result.deleted_count
