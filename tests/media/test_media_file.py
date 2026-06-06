from datetime import timedelta

from django.test import override_settings
from django.utils import timezone

import pytest

from apps.accounts.models import User
from apps.media.constants import MediaScope, ResourceType
from apps.media.models import MediaFile
from apps.media.services import CleanupResult, cleanup_unreferenced_media, collect_referenced_media_ids, get_media_list_info, register_media_file, validate_media_ids
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


@pytest.mark.django_db
class TestMediaListInfo:
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
        assert "order" not in result[0]


@pytest.mark.django_db
class TestValidateMediaIds:
    def test_returns_ids_in_original_order(self):
        user = User.objects.create_user(username="validator", password="secret")  # noqa: S106
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

        assert validate_media_ids([second.pk, first.pk]) == [second.pk, first.pk]

    def test_returns_empty_list_for_empty_input(self):
        assert validate_media_ids([]) == []

    def test_raises_for_duplicate_ids(self):
        user = User.objects.create_user(username="validator_dup", password="secret")  # noqa: S106
        media = register_media_file(
            uploader=user,
            oss_path="uploads/users/1/dup.png",
            original_filename="dup.png",
            resource_type=ResourceType.AVATAR,
            file_size=100,
        )

        with pytest.raises(ValueError, match="media_ids 不能包含重复 ID"):
            validate_media_ids([media.pk, media.pk])

    def test_raises_for_missing_ids(self):
        with pytest.raises(ValueError, match=r"媒体文件不存在: \[999999\]"):
            validate_media_ids([999999])


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


@override_settings(MEDIA_REFERENCE_PROVIDERS=["tests.media.test_media_file.fake_media_provider"])
def test_collect_referenced_media_ids_supports_import_string():
    assert collect_referenced_media_ids() == {101, 102}


@pytest.mark.django_db
@override_settings(MEDIA_REFERENCE_PROVIDERS=[])
def test_cleanup_is_noop_when_no_providers_configured():
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

    assert result == CleanupResult(deleted_count=0, deleted_ids=[])
    assert MediaFile.objects.filter(pk=orphan.pk).exists()
