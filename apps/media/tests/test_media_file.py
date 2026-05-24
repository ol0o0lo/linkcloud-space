import pytest

from apps.accounts.models import User
from apps.media.constants import ResourceType
from apps.media.models import MediaFile
from apps.media.services import register_media_file


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
