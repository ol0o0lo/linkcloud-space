from datetime import timedelta

from django.conf import settings

from celery import shared_task

from apps.media.services import cleanup_unreferenced_media


@shared_task
def cleanup_unreferenced_media_files() -> int:
    """Celery entry point. Runs via CELERY_BEAT_SCHEDULE."""
    result = cleanup_unreferenced_media(older_than=timedelta(hours=settings.MEDIA_ORPHAN_RETENTION_HOURS))
    return result.deleted_count
