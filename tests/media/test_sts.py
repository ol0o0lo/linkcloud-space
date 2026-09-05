from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from apps.media.constants import ResourceType
from apps.media.exceptions import InvalidExtensionException, InvalidScopeException
from apps.media.services import generate_upload_path, get_oss_token


class TestGenerateUploadPath:
    def test_user_scope(self):
        path = generate_upload_path(scope="user", object_id=42, filename="photo.jpg")
        assert path.startswith("uploads/users/42/")
        assert path.endswith(".jpg")
        uuid_part = path.split("/")[-1].replace(".jpg", "")
        UUID(uuid_part)

    def test_org_scope(self):
        path = generate_upload_path(scope="org", object_id=7, filename="room.png")
        assert path.startswith("uploads/orgs/7/")
        assert path.endswith(".png")

    def test_invalid_scope(self):
        with pytest.raises(InvalidScopeException):
            generate_upload_path(scope="admin", object_id=1, filename="x.jpg")

    def test_invalid_extension(self):
        with pytest.raises(InvalidExtensionException):
            generate_upload_path(scope="user", object_id=1, filename="file.exe")

    def test_no_extension(self):
        with pytest.raises(InvalidExtensionException):
            generate_upload_path(scope="user", object_id=1, filename="noext")

    def test_extension_case_insensitive(self):
        path = generate_upload_path(scope="user", object_id=1, filename="photo.JPG")
        assert path.endswith(".jpg")

    def test_resource_type_restricts_scope_and_extension(self):
        with pytest.raises(InvalidScopeException):
            generate_upload_path(scope="user", object_id=1, filename="house.jpg", resource_type=ResourceType.HOUSE_IMAGE)

        with pytest.raises(InvalidExtensionException):
            generate_upload_path(scope="org", object_id=1, filename="house.mp4", resource_type=ResourceType.HOUSE_IMAGE)


class TestGetOssToken:
    @patch("apps.media.services.StsClient")
    def test_returns_credentials(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.body.credentials.access_key_id = "STS.xxx"
        mock_response.body.credentials.access_key_secret = "secret"
        mock_response.body.credentials.security_token = "token"
        mock_response.body.credentials.expiration = "2026-05-16T08:30:00Z"

        mock_client = MagicMock()
        mock_client.assume_role.return_value = mock_response
        mock_client_cls.return_value = mock_client

        result = get_oss_token(scope="user", object_id=1, filename="abc.jpg")

        assert result["access_key_id"] == "STS.xxx"
        assert result["access_key_secret"] == "secret"
        assert result["security_token"] == "token"
        assert result["path"].startswith("uploads/users/1/")
        assert result["bucket"]
        assert result["endpoint"]
        assert result["expires_at"] == "2026-05-16T08:30:00Z"

    @patch("apps.media.services.StsClient")
    def test_policy_restricts_to_path(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.assume_role.return_value = MagicMock(
            body=MagicMock(credentials=MagicMock(access_key_id="k", access_key_secret="s", security_token="t", expiration="2026-05-16T08:30:00Z"))
        )
        mock_client_cls.return_value = mock_client

        result = get_oss_token(scope="user", object_id=1, filename="abc.jpg")

        call_args = mock_client.assume_role.call_args
        request = call_args[0][0]
        import json

        policy = json.loads(request.policy)
        resource = policy["Statement"][0]["Resource"][0]
        assert result["path"] in resource
