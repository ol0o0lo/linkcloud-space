from datetime import timedelta

from django.utils import timezone

import pytest

from apps.accounts.models import User
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.services import cleanup_unreferenced_media, get_media_list_info, register_media_file, set_media_order


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


from unittest.mock import MagicMock, patch  # noqa: E402

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


@pytest.mark.django_db
class TestMediaOrdering:
    def test_set_media_order_updates_order_by_input_position(self):
        user = User.objects.create_user(username="sorter", password="secret")  # noqa: S106
        first = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/first.png",
            original_filename="first.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        second = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/second.png",
            original_filename="second.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        third = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/third.png",
            original_filename="third.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )

        set_media_order([third.pk, first.pk, second.pk])

        assert list(
            MediaFile.objects.filter(pk__in=[first.pk, second.pk, third.pk]).order_by("order", "id").values_list(
                "pk", flat=True
            )
        ) == [third.pk, first.pk, second.pk]

    def test_get_media_list_info_preserves_requested_id_order(self):
        user = User.objects.create_user(username="viewer", password="secret")  # noqa: S106
        first = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/first.png",
            original_filename="first.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        second = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/second.png",
            original_filename="second.png",
            resource_type=ResourceType.AVATAR,
            file_size=200,
        )

        result = get_media_list_info([second.pk, first.pk])

        assert [item["id"] for item in result] == [second.pk, first.pk]
        assert result[0]["original"]["url"]
        assert result[0]["thumbnail"] is None
        assert result[0]["file_size"] == 200


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
        fresh = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/fresh.png",
            original_filename="fresh.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )
        old_time = timezone.now() - timedelta(days=2)
        MediaFile.objects.filter(pk__in=[referenced.pk, orphan.pk]).update(created_at=old_time)

        result = cleanup_unreferenced_media(referenced_media_ids={referenced.pk}, older_than=timedelta(days=1))

        assert result.deleted_count == 1
        assert result.deleted_ids == [orphan.pk]
        assert MediaFile.objects.filter(pk=referenced.pk).exists()
        assert not MediaFile.objects.filter(pk=orphan.pk).exists()
        assert MediaFile.objects.filter(pk=fresh.pk).exists()
