from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest

from apps.media.sts import generate_sts_token, generate_upload_path


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
        with pytest.raises(ValueError, match="scope"):
            generate_upload_path(scope="admin", object_id=1, filename="x.jpg")

    def test_invalid_extension(self):
        with pytest.raises(ValueError, match="extension"):
            generate_upload_path(scope="user", object_id=1, filename="file.exe")

    def test_no_extension(self):
        with pytest.raises(ValueError, match="extension"):
            generate_upload_path(scope="user", object_id=1, filename="noext")

    def test_extension_case_insensitive(self):
        path = generate_upload_path(scope="user", object_id=1, filename="photo.JPG")
        assert path.endswith(".jpg")


class TestGenerateStsToken:
    @patch("apps.media.sts.StsClient")
    def test_returns_credentials(self, mock_client_cls):
        mock_response = MagicMock()
        mock_response.body.credentials.access_key_id = "STS.xxx"
        mock_response.body.credentials.access_key_secret = "secret"
        mock_response.body.credentials.security_token = "token"
        mock_response.body.credentials.expiration = "2026-05-16T08:30:00Z"

        mock_client = MagicMock()
        mock_client.assume_role.return_value = mock_response
        mock_client_cls.return_value = mock_client

        result = generate_sts_token(
            path="uploads/users/1/abc.jpg",
            access_key_id="ak",
            access_key_secret="sk",
            role_arn="acs:ram::123:role/uploader",
            role_session_name="test",
        )

        assert result["access_key_id"] == "STS.xxx"
        assert result["access_key_secret"] == "secret"
        assert result["security_token"] == "token"
        assert result["expires_at"] == "2026-05-16T08:30:00Z"

    @patch("apps.media.sts.StsClient")
    def test_policy_restricts_to_path(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client.assume_role.return_value = MagicMock(
            body=MagicMock(credentials=MagicMock(
                access_key_id="k", access_key_secret="s",
                security_token="t", expiration="2026-05-16T08:30:00Z"
            ))
        )
        mock_client_cls.return_value = mock_client

        generate_sts_token(
            path="uploads/users/1/abc.jpg",
            access_key_id="ak",
            access_key_secret="sk",
            role_arn="acs:ram::123:role/uploader",
            role_session_name="test",
            bucket="my-bucket",
        )

        call_args = mock_client.assume_role.call_args
        request = call_args[0][0]
        import json
        policy = json.loads(request.policy)
        resource = policy["Statement"][0]["Resource"][0]
        assert "my-bucket/uploads/users/1/abc.jpg" in resource
