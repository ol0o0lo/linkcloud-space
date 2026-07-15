from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone

import pytest
from celery.exceptions import Retry
from PIL import Image

from apps.accounts.models import User
from apps.media.constants import ResourceType, ThumbnailStatus
from apps.media.models import MediaFile
from apps.media.tasks import (
    _mark_thumbnail_failed,
    cleanup_unreferenced_media_files,
    enqueue_media_thumbnail,
    generate_media_thumbnail,
    recover_pending_media_thumbnails,
)


def make_image_bytes(*, size=(900, 600), mode="RGB", image_format="PNG") -> bytes:
    output = BytesIO()
    color = (255, 0, 0, 128) if mode == "RGBA" else (255, 0, 0)
    Image.new(mode, size, color).save(output, format=image_format)
    return output.getvalue()


@pytest.mark.django_db
def test_generate_media_thumbnail_creates_bounded_webp(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(username="thumbnail_worker", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="large.png",
            file=SimpleUploadedFile("large.png", make_image_bytes(), content_type="image/png"),
            file_size=1024,
            thumbnail_status=ThumbnailStatus.PENDING,
        )

        assert generate_media_thumbnail(media.pk) is True

        media.refresh_from_db()
        assert media.thumbnail_status == ThumbnailStatus.READY
        assert media.thumbnail_enqueued_at is None
        assert media.thumbnail_started_at is None
        assert media.thumbnail.name == f"derived/thumbnails/v1/{media.pk}.webp"
        assert media.thumbnail_generated_at is not None
        with Image.open(media.thumbnail.path) as thumbnail:
            assert thumbnail.format == "WEBP"
            assert thumbnail.size == (480, 320)


@pytest.mark.django_db
def test_generate_media_thumbnail_marks_invalid_image_failed(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(username="invalid_thumbnail_worker", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="broken.png",
            file=SimpleUploadedFile("broken.png", b"not-an-image", content_type="image/png"),
            file_size=12,
            thumbnail_status=ThumbnailStatus.PENDING,
        )

        assert generate_media_thumbnail(media.pk) is False

        media.refresh_from_db()
        assert media.thumbnail_status == ThumbnailStatus.FAILED
        assert not media.thumbnail


@pytest.mark.django_db
@override_settings(MEDIA_IMAGE_MAX_FILE_SIZE=4)
def test_generate_media_thumbnail_rejects_oversized_source(tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(username="oversized_thumbnail_worker", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="oversized.png",
            file=SimpleUploadedFile("oversized.png", make_image_bytes(size=(2, 2)), content_type="image/png"),
            file_size=100,
            thumbnail_status=ThumbnailStatus.PENDING,
        )

        assert generate_media_thumbnail(media.pk) is False

        media.refresh_from_db()
        assert media.thumbnail_status == ThumbnailStatus.FAILED


@pytest.mark.django_db
@patch("apps.media.tasks.create_thumbnail_file", side_effect=OSError("temporary storage error"))
def test_generate_media_thumbnail_retries_transient_storage_error(_create_thumbnail, tmp_path):
    with override_settings(MEDIA_ROOT=tmp_path):
        user = User.objects.create_user(username="retry_thumbnail_worker", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="retry.png",
            file=SimpleUploadedFile("retry.png", make_image_bytes(size=(2, 2)), content_type="image/png"),
            file_size=100,
            thumbnail_status=ThumbnailStatus.PENDING,
        )

        with patch.object(generate_media_thumbnail, "retry", side_effect=Retry()) as retry, pytest.raises(Retry):
            generate_media_thumbnail(media.pk)
        retry.assert_called_once()

        media.refresh_from_db()
        assert media.thumbnail_status == ThumbnailStatus.PENDING
        assert media.thumbnail_started_at is None


@pytest.mark.django_db
def test_failed_update_does_not_overwrite_ready_thumbnail():
    user = User.objects.create_user(username="ready_thumbnail_worker", password="secret")  # noqa: S106
    media = MediaFile.objects.create(
        uploader=user,
        resource_type=ResourceType.AVATAR,
        original_filename="ready.png",
        file="uploads/users/1/ready.png",
        file_size=100,
        thumbnail="derived/thumbnails/v1/ready.webp",
        thumbnail_status=ThumbnailStatus.READY,
    )

    _mark_thumbnail_failed(media.pk)

    media.refresh_from_db()
    assert media.thumbnail_status == ThumbnailStatus.READY
    assert media.thumbnail.name == "derived/thumbnails/v1/ready.webp"


@patch("apps.media.tasks.generate_media_thumbnail.apply_async", side_effect=RuntimeError("broker unavailable"))
def test_enqueue_media_thumbnail_contains_broker_failure(_delay):
    assert enqueue_media_thumbnail(123) is False


@pytest.mark.django_db
@patch("apps.media.tasks.enqueue_media_thumbnail", return_value=True)
def test_recover_pending_media_thumbnails_resets_stale_processing_and_requeues(enqueue):
    user = User.objects.create_user(username="recover_thumbnail_worker", password="secret")  # noqa: S106
    old_time = timezone.now() - timedelta(minutes=20)
    pending = MediaFile.objects.create(
        uploader=user,
        resource_type=ResourceType.AVATAR,
        original_filename="pending.png",
        file="uploads/users/1/pending.png",
        file_size=100,
        thumbnail_status=ThumbnailStatus.PENDING,
    )
    stale_processing = MediaFile.objects.create(
        uploader=user,
        resource_type=ResourceType.AVATAR,
        original_filename="processing.png",
        file="uploads/users/1/processing.png",
        file_size=100,
        thumbnail_status=ThumbnailStatus.PROCESSING,
        thumbnail_started_at=old_time,
    )
    recently_enqueued = MediaFile.objects.create(
        uploader=user,
        resource_type=ResourceType.AVATAR,
        original_filename="queued.png",
        file="uploads/users/1/queued.png",
        file_size=100,
        thumbnail_status=ThumbnailStatus.PENDING,
        thumbnail_enqueued_at=timezone.now(),
    )
    MediaFile.objects.filter(pk__in=[pending.pk, stale_processing.pk, recently_enqueued.pk]).update(created_at=old_time)

    assert recover_pending_media_thumbnails() == 2

    stale_processing.refresh_from_db()
    assert stale_processing.thumbnail_status == ThumbnailStatus.PENDING
    assert {call.args[0] for call in enqueue.call_args_list} == {pending.pk, stale_processing.pk}


@pytest.mark.django_db
@patch("apps.media.tasks.default_storage.delete", side_effect=[OSError("temporary delete failure"), None])
@patch("apps.media.tasks.default_storage.exists", return_value=True)
def test_missing_media_retries_orphan_thumbnail_cleanup(_exists, _delete):
    with patch.object(generate_media_thumbnail, "retry", side_effect=Retry()) as retry, pytest.raises(Retry):
        generate_media_thumbnail(999999)
    retry.assert_called_once()


def test_generate_thumbnail_task_is_worker_loss_safe():
    assert generate_media_thumbnail.acks_late is True
    assert generate_media_thumbnail.reject_on_worker_lost is True
    assert generate_media_thumbnail.rate_limit == "12/m"


@patch("apps.media.tasks.cleanup_unreferenced_media")
def test_cleanup_task_calls_media_cleanup_service(cleanup):
    cleanup.return_value.deleted_count = 3

    result = cleanup_unreferenced_media_files()

    assert result == 3
    cleanup.assert_called_once_with(older_than=timedelta(hours=settings.MEDIA_ORPHAN_RETENTION_HOURS))


def test_cleanup_task_is_registered_in_celery_beat_schedule():
    schedule = settings.CELERY_BEAT_SCHEDULE["cleanup-unreferenced-media"]

    assert schedule["task"] == "apps.media.tasks.cleanup_unreferenced_media_files"


def test_thumbnail_recovery_task_is_registered_in_celery_beat_schedule():
    schedule = settings.CELERY_BEAT_SCHEDULE["recover-pending-media-thumbnails"]

    assert schedule["task"] == "apps.media.tasks.recover_pending_media_thumbnails"


@override_settings(MEDIA_REFERENCE_PROVIDERS=[])
@pytest.mark.django_db
def test_cleanup_task_returns_zero_when_no_provider_configured():
    assert cleanup_unreferenced_media_files() == 0
