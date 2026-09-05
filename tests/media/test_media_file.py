import importlib
from datetime import timedelta
from unittest.mock import MagicMock, PropertyMock, patch

from django.test import override_settings
from django.utils import timezone

import pytest

from apps.accounts.models import User
from apps.media.constants import MediaScope, ResourceType, ThumbnailStatus
from apps.media.exceptions import InvalidExtensionException, InvalidScopeException
from apps.media.models import MediaFile
from apps.media.services import (
    CleanupResult,
    cleanup_unreferenced_media,
    collect_media_ref_field_ids,
    collect_referenced_media_ids,
    delete_media_file,
    extract_media_ids,
    get_media_thumbnail_url,
    register_media_file,
    resolve_media_refs,
    validate_media_refs,
)
from apps.organizations.models import Organization


def fake_media_provider():
    return [101, 102, None]


@pytest.mark.django_db
class TestRegisterMediaFile:
    def test_creates_record(self):
        user = User.objects.create_user(username="tester", password="secret")  # noqa: S106
        mf = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/abc.png",
            original_filename="photo.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )
        assert mf.pk is not None
        assert mf.original_filename == "photo.png"
        assert mf.resource_type == ResourceType.AVATAR
        assert mf.file_size == 1024
        assert mf.uploader == user
        assert mf.thumbnail_status == ThumbnailStatus.PENDING

    @patch("apps.media.tasks.generate_media_thumbnail.apply_async")
    @patch("apps.media.services.transaction.on_commit")
    def test_image_registration_schedules_thumbnail_after_commit(self, on_commit, delay):
        user = User.objects.create_user(username="thumbnail_scheduler", password="secret")  # noqa: S106

        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/scheduled.png",
            original_filename="scheduled.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )

        callback = on_commit.call_args.args[0]
        callback()

        delay.assert_called_once_with(args=(media.pk,), retry=False)
        assert on_commit.call_args.kwargs["robust"] is True
        media.refresh_from_db()
        assert media.thumbnail_enqueued_at is not None

    @patch("apps.media.tasks.generate_media_thumbnail.apply_async", side_effect=RuntimeError("broker unavailable"))
    @patch("apps.media.services.transaction.on_commit")
    def test_broker_failure_does_not_break_completed_registration(self, on_commit, _delay):
        user = User.objects.create_user(username="thumbnail_broker_failure", password="secret")  # noqa: S106

        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/broker-failure.png",
            original_filename="broker-failure.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )

        on_commit.call_args.args[0]()

        media.refresh_from_db()
        assert media.thumbnail_status == ThumbnailStatus.PENDING

    @patch("apps.media.services.transaction.on_commit")
    def test_non_image_registration_does_not_schedule_thumbnail(self, on_commit):
        user = User.objects.create_user(username="non_image_scheduler", password="secret")  # noqa: S106

        media = register_media_file(
            uploader=user,
            oss_path="uploads/orgs/1/lease.pdf",
            original_filename="lease.pdf",
            resource_type=ResourceType.LEASE_CONTRACT,
            file_size=1024,
            scope=MediaScope.ORG,
            object_id=1,
        )

        assert media.thumbnail_status == ThumbnailStatus.NOT_REQUESTED
        on_commit.assert_not_called()

    def test_file_name_is_oss_path(self):
        user = User.objects.create_user(username="tester2", password="secret")  # noqa: S106
        mf = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/abc.png",
            original_filename="photo.png",
            resource_type=ResourceType.AVATAR,
            file_size=1024,
        )
        assert mf.file.name == "uploads/users/1/abc.png"

    def test_house_media_resource_types_must_use_org_scope_paths(self):
        user = User.objects.create_user(username="house_media_scope", password="secret")  # noqa: S106

        with pytest.raises(InvalidScopeException):
            register_media_file(
                uploader=user,
                oss_path="uploads/users/1/house.png",
                original_filename="house.png",
                resource_type=ResourceType.HOUSE_IMAGE,
                file_size=1024,
            )

    def test_resource_type_restricts_file_extension(self):
        user = User.objects.create_user(username="house_media_extension", password="secret")  # noqa: S106

        with pytest.raises(InvalidExtensionException):
            register_media_file(
                uploader=user,
                oss_path="uploads/orgs/1/house.mp4",
                original_filename="house.mp4",
                resource_type=ResourceType.HOUSE_IMAGE,
                file_size=1024,
            )

        with pytest.raises(InvalidExtensionException):
            register_media_file(
                uploader=user,
                oss_path="uploads/orgs/1/tour.png",
                original_filename="tour.png",
                resource_type=ResourceType.HOUSE_VIDEO,
                file_size=1024,
            )

        with pytest.raises(InvalidExtensionException):
            register_media_file(
                uploader=user,
                oss_path="uploads/orgs/1/lease.png",
                original_filename="lease.png",
                resource_type=ResourceType.LEASE_CONTRACT,
                file_size=1024,
            )


from apps.media.services import upload_and_register  # noqa: E402


@pytest.mark.django_db
class TestUploadAndRegister:
    @patch("apps.media.services.default_storage")
    def test_uploads_and_creates_record(self, mock_storage):
        mock_storage.save.return_value = "uploads/users/1/abc.png"
        user = User.objects.create_user(username="uploader", password="secret")  # noqa: S106

        fake_file = MagicMock()
        fake_file.name = "photo.png"
        fake_file.size = 2048

        mf = upload_and_register(
            uploader=user,
            file=fake_file,
            resource_type=ResourceType.AVATAR,
        )
        assert mf.pk is not None
        assert mf.original_filename == "photo.png"
        assert mf.file_size == 2048
        mock_storage.save.assert_called_once()

    @patch("apps.media.services.default_storage")
    def test_uploads_to_org_scope(self, mock_storage):
        mock_storage.save.return_value = "uploads/orgs/9/abc.png"
        user = User.objects.create_user(username="org_uploader", password="secret")  # noqa: S106
        org = Organization.objects.create(name="Example Org", slug="example-org")

        fake_file = MagicMock()
        fake_file.name = "logo.png"
        fake_file.size = 2048

        mf = upload_and_register(
            uploader=user,
            file=fake_file,
            resource_type=ResourceType.ORG_LOGO,
            scope=MediaScope.ORG,
            object_id=org.pk,
        )

        assert mf.pk is not None
        assert mf.resource_type == ResourceType.ORG_LOGO
        saved_path = mock_storage.save.call_args[0][0]
        assert saved_path.startswith(f"uploads/orgs/{org.pk}/")

    def test_house_media_upload_rejects_user_scope(self):
        user = User.objects.create_user(username="house_media_upload_scope", password="secret")  # noqa: S106

        fake_file = MagicMock()
        fake_file.name = "room.png"
        fake_file.size = 2048

        with pytest.raises(InvalidScopeException):
            upload_and_register(
                uploader=user,
                file=fake_file,
                resource_type=ResourceType.HOUSE_IMAGE,
                scope=MediaScope.USER,
            )

    def test_contract_upload_allows_pdf_doc_and_docx_only(self):
        user = User.objects.create_user(username="contract_upload", password="secret")  # noqa: S106

        for filename in ["lease.pdf", "lease.doc", "lease.docx"]:
            fake_file = MagicMock()
            fake_file.name = filename
            fake_file.size = 2048
            with patch("apps.media.services.default_storage") as mock_storage:
                mock_storage.save.return_value = f"uploads/orgs/1/{filename}"
                mf = upload_and_register(
                    uploader=user,
                    file=fake_file,
                    resource_type=ResourceType.LEASE_CONTRACT,
                    scope=MediaScope.ORG,
                    object_id=1,
                )
                assert mf.original_filename == filename

        invalid_file = MagicMock()
        invalid_file.name = "lease.png"
        invalid_file.size = 2048
        with pytest.raises(InvalidExtensionException):
            upload_and_register(
                uploader=user,
                file=invalid_file,
                resource_type=ResourceType.LEASE_CONTRACT,
                scope=MediaScope.ORG,
                object_id=1,
            )


class TestPublicServiceSurface:
    def test_removed_helpers_are_not_publicly_exposed(self):
        services = importlib.import_module("apps.media.services")

        assert not hasattr(services, "validate_media_ids")
        assert not hasattr(services, "get_media_list_info")


@pytest.mark.django_db
class TestMediaRefsInfo:
    def test_resolve_media_refs_flattens_media_info_and_refreshes_platform_fields(self):
        user = User.objects.create_user(username="flat_viewer", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/flat.png",
            original_filename="flat.png",
            resource_type=ResourceType.AVATAR,
            file_size=300,
        )

        result = resolve_media_refs(
            [
                {
                    "media_id": media.pk,
                    "media_type": "image",
                    "label": "业务标签",
                    "url": "stale-url",
                    "file_size": 999,
                }
            ]
        )

        assert result == [
            {
                "media_id": media.pk,
                "media_type": "image",
                "label": "业务标签",
                "url": media.file.url,
                "file_size": 300,
                "resource_type": ResourceType.AVATAR,
                "original_filename": "flat.png",
                "thumbnail": media.file.url,
                "created_at": media.created_at,
            }
        ]

    def test_resolve_media_refs_aliases_flattened_media_ref_response(self):
        user = User.objects.create_user(username="resolve_viewer", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/resolve.png",
            original_filename="resolve.png",
            resource_type=ResourceType.AVATAR,
            file_size=300,
        )

        result = resolve_media_refs([{"media_id": media.pk, "label": "封面"}])

        assert result[0]["media_id"] == media.pk
        assert result[0]["label"] == "封面"
        assert result[0]["url"] == media.file.url

    def test_resolve_media_refs_reuses_preloaded_media(self, django_assert_num_queries):
        user = User.objects.create_user(username="preloaded_viewer", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/preloaded.png",
            original_filename="preloaded.png",
            resource_type=ResourceType.AVATAR,
            file_size=300,
        )
        media_by_id = MediaFile.objects.in_bulk([media.pk])

        with django_assert_num_queries(0):
            result = resolve_media_refs([{"media_id": media.pk}], media_by_id=media_by_id)

        assert result[0]["media_id"] == media.pk

    def test_non_image_media_has_no_thumbnail(self):
        user = User.objects.create_user(username="non_image_viewer", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/orgs/1/lease.pdf",
            original_filename="lease.pdf",
            resource_type=ResourceType.LEASE_CONTRACT,
            file_size=300,
            scope=MediaScope.ORG,
            object_id=1,
        )

        assert get_media_thumbnail_url(media) is None

    def test_thumbnail_url_error_falls_back_to_original_url(self):
        user = User.objects.create_user(username="thumbnail_url_fallback", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="fallback.png",
            file="uploads/users/1/fallback.png",
            file_size=300,
            thumbnail="derived/thumbnails/v1/fallback.webp",
            thumbnail_status=ThumbnailStatus.READY,
        )

        with patch.object(type(media.thumbnail), "url", new_callable=PropertyMock, side_effect=OSError("url failure")):
            assert get_media_thumbnail_url(media, original_url="original-url") == "original-url"

    def test_ready_image_returns_thumbnail_url(self):
        user = User.objects.create_user(username="ready_thumbnail_viewer", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=user,
            resource_type=ResourceType.AVATAR,
            original_filename="ready.png",
            file="uploads/users/1/ready.png",
            file_size=300,
            thumbnail="derived/thumbnails/v1/ready.webp",
            thumbnail_status=ThumbnailStatus.READY,
        )

        assert get_media_thumbnail_url(media) == media.thumbnail.url


@pytest.mark.django_db
class TestMediaRefs:
    def test_extract_media_ids_accepts_ints_and_dicts(self):
        assert extract_media_ids([1, {"media_id": "2"}, 3]) == [1, 2, 3]

    def test_validate_media_refs_returns_storage_safe_refs_after_validating_media_ids(self):
        user = User.objects.create_user(username="ref_validator", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/ref-validator.png",
            original_filename="ref-validator.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        refs = [
            {
                "media_id": str(media.pk),
                "label": "封面",
                "url": "stale-url",
                "resource_type": "wrong",
                "original_filename": "wrong.png",
                "thumbnail": "wrong-thumbnail",
                "file_size": 999,
                "created_at": "stale-created-at",
            }
        ]

        assert validate_media_refs(refs) == [{"media_id": media.pk, "label": "封面"}]

    def test_extract_media_ids_requires_media_id_for_dict_items(self):
        with pytest.raises(ValueError, match="媒体引用对象必须包含 media_id"):
            extract_media_ids([{"label": "缺少 ID"}])


@pytest.mark.django_db
class TestCleanupUnreferencedMedia:
    def test_cleanup_deletes_only_old_unreferenced_media_records(self):
        user = User.objects.create_user(username="cleaner", password="secret")  # noqa: S106
        referenced = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/referenced.png",
            original_filename="referenced.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        orphan = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/orphan.png",
            original_filename="orphan.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        orphan.thumbnail.name = f"derived/thumbnails/v1/{orphan.pk}.webp"
        orphan.thumbnail_status = ThumbnailStatus.READY
        orphan.save(update_fields=["thumbnail", "thumbnail_status"])
        fresh = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/fresh.png",
            original_filename="fresh.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        old_time = timezone.now() - timedelta(days=2)
        MediaFile.objects.filter(pk__in=[referenced.pk, orphan.pk]).update(created_at=old_time)

        with patch("django.db.models.fields.files.FieldFile.delete") as delete_file:
            result = cleanup_unreferenced_media(referenced_media_ids={referenced.pk}, older_than=timedelta(days=1))

        assert result.deleted_count == 1
        assert result.deleted_ids == [orphan.pk]
        assert MediaFile.objects.filter(pk=referenced.pk).exists()
        assert not MediaFile.objects.filter(pk=orphan.pk).exists()
        assert MediaFile.objects.filter(pk=fresh.pk).exists()
        assert delete_file.call_count == 2

    def test_cleanup_skips_media_while_thumbnail_is_processing(self):
        user = User.objects.create_user(username="processing_cleaner", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/processing.png",
            original_filename="processing.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        MediaFile.objects.filter(pk=media.pk).update(
            created_at=timezone.now() - timedelta(days=2),
            thumbnail_status=ThumbnailStatus.PROCESSING,
            thumbnail_started_at=timezone.now(),
        )

        result = cleanup_unreferenced_media(referenced_media_ids=set(), older_than=timedelta(days=1))

        assert result.deleted_count == 0
        assert MediaFile.objects.filter(pk=media.pk).exists()


@pytest.mark.django_db
def test_delete_media_file_removes_original_thumbnail_and_record():
    user = User.objects.create_user(username="unified_media_deleter", password="secret")  # noqa: S106
    media = MediaFile.objects.create(
        uploader=user,
        resource_type=ResourceType.AVATAR,
        original_filename="delete.png",
        file="uploads/users/1/delete.png",
        file_size=100,
        thumbnail="derived/thumbnails/v1/delete.webp",
        thumbnail_status=ThumbnailStatus.READY,
    )

    with patch("django.db.models.fields.files.FieldFile.delete") as delete_file:
        assert delete_media_file(media.pk) is True

    assert delete_file.call_count == 2
    assert not MediaFile.objects.filter(pk=media.pk).exists()


@override_settings(MEDIA_REFERENCE_PROVIDERS=["tests.media.test_media_file.fake_media_provider"])
@pytest.mark.django_db
def test_collect_referenced_media_ids_supports_import_string():
    assert collect_referenced_media_ids() == {101, 102}


@pytest.mark.django_db
@override_settings(MEDIA_REFERENCE_PROVIDERS=[])
def test_cleanup_uses_media_ref_fields_when_no_providers_configured():
    user = User.objects.create_user(username="cleanup_guard", password="secret")  # noqa: S106
    orphan = register_media_file(
        uploader=user,
        oss_path="uploads/users/1/orphan.png",
        original_filename="orphan.png",
        resource_type=ResourceType.AVATAR,
        file_size=100,
    )
    MediaFile.objects.filter(pk=orphan.pk).update(created_at=timezone.now() - timedelta(days=2))

    result = cleanup_unreferenced_media(older_than=timedelta(days=1))

    assert result == CleanupResult(deleted_count=1, deleted_ids=[orphan.pk])
    assert not MediaFile.objects.filter(pk=orphan.pk).exists()


@pytest.mark.django_db
def test_collect_media_ref_field_ids_detects_registered_fields():
    _, has_media_ref_fields = collect_media_ref_field_ids()

    assert has_media_ref_fields is True
