from unittest.mock import patch

import pytest

from apps.accounts.models import User

OSS_TOKEN_URL = "/api/media/oss-token/"


def _make_sts_response():
    return {
        "access_key_id": "STS.test",
        "access_key_secret": "secret",
        "security_token": "token",
        "expires_at": "2026-05-16T08:30:00Z",
    }


@pytest.mark.django_db
class TestOssTokenAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="alice", password="secret")  # noqa: S106

    def _login(self):
        self.client.force_login(self.user)

    def _get(self, params):
        return self.client.get(OSS_TOKEN_URL, params)

    def test_requires_login(self):
        resp = self._get({"scope": "user", "filename": "photo.jpg"})
        assert resp.status_code == 403

    @patch("apps.media.services._generate_sts_token")
    @patch("apps.media.services.generate_upload_path", return_value="uploads/users/1/abc.jpg")
    def test_user_scope_returns_token(self, mock_path, mock_sts):
        mock_sts.return_value = _make_sts_response()
        self._login()
        resp = self._get({"scope": "user", "filename": "photo.jpg"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["access_key_id"] == "STS.test"
        assert data["path"] == "uploads/users/1/abc.jpg"
        assert "bucket" in data
        assert "endpoint" in data

    def test_invalid_scope_returns_400(self):
        self._login()
        resp = self._get({"scope": "admin", "filename": "photo.jpg"})
        assert resp.status_code == 400

    @patch("apps.media.services._generate_sts_token")
    @patch("apps.media.services.generate_upload_path")
    def test_invalid_extension_returns_400(self, mock_path, mock_sts):
        mock_sts.return_value = _make_sts_response()
        mock_path.side_effect = ValueError("Invalid extension")
        self._login()
        resp = self._get({"scope": "user", "filename": "file.exe"})
        assert resp.status_code == 400

    @patch("apps.media.services._generate_sts_token")
    @patch("apps.media.services.generate_upload_path", return_value="uploads/orgs/5/abc.jpg")
    def test_org_scope_requires_active_org(self, mock_path, mock_sts):
        mock_sts.return_value = _make_sts_response()
        self._login()
        resp = self._get({"scope": "org", "filename": "room.jpg"})
        assert resp.status_code == 403
