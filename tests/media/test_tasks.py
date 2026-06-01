from datetime import timedelta
from unittest.mock import patch

from django.conf import settings

from apps.media.tasks import cleanup_unreferenced_media_files


@patch("apps.media.tasks.cleanup_unreferenced_media")
def test_cleanup_task_calls_media_cleanup_service(cleanup):
    cleanup.return_value.deleted_count = 3

    result = cleanup_unreferenced_media_files()

    assert result == 3
    cleanup.assert_called_once_with(older_than=timedelta(hours=settings.MEDIA_ORPHAN_RETENTION_HOURS))


def test_cleanup_task_is_registered_in_celery_beat_schedule():
    schedule = settings.CELERY_BEAT_SCHEDULE["cleanup-unreferenced-media"]

    assert schedule["task"] == "apps.media.tasks.cleanup_unreferenced_media_files"
