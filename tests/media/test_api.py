import json
from unittest.mock import patch

import pytest

from apps.accounts.models import User
from apps.media.constants import ResourceType
from apps.media.exceptions import InvalidExtensionException
from apps.organizations.models import Organization, OrganizationMember
from tests.api_helpers import api_data, api_error

OSS_TOKEN_URL = "/api/media/oss-token/"


def _make_sts_response():
    return {
        "access_key_id": "STS.test",
        "access_key_secret": "secret",
        "security_token": "token",
        "endpoint": "https://oss.example.com",
        "bucket": "test-bucket",
        "path": "uploads/users/1/abc.jpg",
        "expires_at": "2026-05-16T08:30:00Z",
    }


def set_session_org(client, org, is_owner=False):
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": is_owner})
    session.save()


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
        assert resp.status_code == 401

    @patch("apps.media.api.get_oss_token")
    def test_user_scope_returns_token(self, mock_get_oss_token):
        mock_get_oss_token.return_value = _make_sts_response()
        self._login()
        resp = self._get({"scope": "user", "filename": "photo.jpg"})
        assert resp.status_code == 200
        data = api_data(resp)
        assert data["access_key_id"] == "STS.test"
        assert data["path"] == "uploads/users/1/abc.jpg"
        assert "bucket" in data
        assert "endpoint" in data

    def test_invalid_scope_returns_400(self):
        self._login()
        resp = self._get({"scope": "admin", "filename": "photo.jpg"})
        assert resp.status_code == 400

    @patch("apps.media.api.get_oss_token")
    def test_invalid_extension_returns_400(self, mock_get_oss_token):
        mock_get_oss_token.side_effect = InvalidExtensionException()
        self._login()
        resp = self._get({"scope": "user", "filename": "file.exe"})
        assert resp.status_code == 400
        error = api_error(resp)
        assert error["code"] == 400
        assert error["error"] == InvalidExtensionException.error
        assert error["message"] == str(InvalidExtensionException.message)

    def test_org_scope_requires_active_org(self):
        self._login()
        resp = self._get({"scope": "org", "filename": "room.jpg"})
        assert resp.status_code == 403

    def test_resource_type_scope_and_extension_are_validated_before_issuing_token(self):
        self._login()

        wrong_scope_resp = self._get({"scope": "user", "filename": "house.jpg", "resource_type": ResourceType.HOUSE_IMAGE})
        assert wrong_scope_resp.status_code == 400

        org = Organization.objects.create(name="Token Media Org", slug="token-media-org")
        OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)
        set_session_org(self.client, org, is_owner=True)
        wrong_extension_resp = self._get({"scope": "org", "filename": "house.mp4", "resource_type": ResourceType.HOUSE_IMAGE})
        assert wrong_extension_resp.status_code == 400


from apps.media.models import MediaFile  # noqa: E402

CONFIRM_URL = "/api/media/confirm/"


@pytest.mark.django_db
class TestConfirmAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="confirmer", password="secret")  # noqa: S106
        self.client.force_login(self.user)

    def test_requires_login(self, client):
        from django.test import Client as DjangoClient

        anon = DjangoClient()
        resp = anon.post(
            CONFIRM_URL,
            {"oss_path": "x", "original_filename": "x.png", "resource_type": "avatar", "file_size": 100},
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_creates_media_file(self):
        payload = {
            "oss_path": "uploads/users/1/abc.png",
            "original_filename": "photo.png",
            "resource_type": "avatar",
            "file_size": 1024,
        }
        resp = self.client.post(CONFIRM_URL, payload, content_type="application/json")
        assert resp.status_code == 201
        data = api_data(resp)
        assert data["original_filename"] == "photo.png"
        assert data["resource_type"] == "avatar"
        assert "url" in data
        assert "order" not in data
        assert MediaFile.objects.filter(pk=data["id"]).exists()

    def test_invalid_resource_type_returns_422(self):
        payload = {
            "oss_path": "uploads/users/1/abc.png",
            "original_filename": "photo.png",
            "resource_type": "nonexistent",
            "file_size": 1024,
        }
        resp = self.client.post(CONFIRM_URL, payload, content_type="application/json")
        assert resp.status_code == 422

    def test_org_scoped_house_media_confirm_requires_active_org_and_matching_org_path(self):
        org = Organization.objects.create(name="House Media Org", slug="house-media-org")
        OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)

        no_org_payload = {
            "oss_path": f"uploads/orgs/{org.pk}/house.png",
            "original_filename": "house.png",
            "resource_type": ResourceType.HOUSE_IMAGE,
            "file_size": 1024,
        }
        no_org_resp = self.client.post(CONFIRM_URL, no_org_payload, content_type="application/json")
        assert no_org_resp.status_code == 403

        set_session_org(self.client, org, is_owner=True)
        user_path_resp = self.client.post(
            CONFIRM_URL,
            {
                "oss_path": "uploads/users/1/house.png",
                "original_filename": "house.png",
                "resource_type": ResourceType.HOUSE_IMAGE,
                "file_size": 1024,
            },
            content_type="application/json",
        )
        assert user_path_resp.status_code == 400

        wrong_org_resp = self.client.post(
            CONFIRM_URL,
            {
                "oss_path": f"uploads/orgs/{org.pk + 999}/house.png",
                "original_filename": "house.png",
                "resource_type": ResourceType.HOUSE_IMAGE,
                "file_size": 1024,
            },
            content_type="application/json",
        )
        assert wrong_org_resp.status_code == 400

        valid_resp = self.client.post(CONFIRM_URL, no_org_payload, content_type="application/json")
        assert valid_resp.status_code == 201

    def test_confirm_rejects_resource_type_extension_mismatch(self):
        org = Organization.objects.create(name="Media Extension Org", slug="media-extension-org")
        OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)
        set_session_org(self.client, org, is_owner=True)

        resp = self.client.post(
            CONFIRM_URL,
            {
                "oss_path": f"uploads/orgs/{org.pk}/house.mp4",
                "original_filename": "house.mp4",
                "resource_type": ResourceType.HOUSE_IMAGE,
                "file_size": 1024,
            },
            content_type="application/json",
        )

        assert resp.status_code == 400


from django.core.files.uploadedfile import SimpleUploadedFile  # noqa: E402

UPLOAD_URL = "/api/media/upload/"


@pytest.mark.django_db
class TestUploadAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.user = User.objects.create_user(username="uploader_api", password="secret")  # noqa: S106
        self.client.force_login(self.user)

    def test_requires_login(self):
        from django.test import Client as AnonymousClient

        anon = AnonymousClient()
        file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
        resp = anon.post(UPLOAD_URL, {"files": [file], "resource_type": "avatar"}, format="multipart")
        assert resp.status_code == 401

    @patch("apps.media.services.default_storage")
    def test_single_file_upload(self, mock_storage):
        mock_storage.save.return_value = "uploads/users/1/abc.png"
        file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "avatar"}, format="multipart")
        assert resp.status_code == 201
        data = api_data(resp)
        assert isinstance(data, list)
        assert len(data) == 1
        assert data[0]["original_filename"] == "photo.png"
        assert "order" not in data[0]

    def test_org_scope_requires_active_org(self):
        file = SimpleUploadedFile("logo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "org_logo", "scope": "org"}, format="multipart")
        assert resp.status_code == 403

    @patch("apps.media.services.default_storage")
    def test_org_scope_uploads_into_org_prefix(self, mock_storage):
        mock_storage.save.return_value = "uploads/orgs/5/logo.png"
        org = Organization.objects.create(name="Org A", slug="org-a")
        OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)
        set_session_org(self.client, org, is_owner=True)

        file = SimpleUploadedFile("logo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(
            UPLOAD_URL,
            {"files": [file], "resource_type": "org_logo", "scope": "org"},
            format="multipart",
        )

        assert resp.status_code == 201
        saved_path = mock_storage.save.call_args[0][0]
        assert saved_path.startswith(f"uploads/orgs/{org.pk}/")

    @patch("apps.media.services.default_storage")
    def test_multiple_files_upload(self, mock_storage):
        mock_storage.save.side_effect = ["uploads/users/1/a.png", "uploads/users/1/b.png"]
        f1 = SimpleUploadedFile("a.png", b"content1", content_type="image/png")
        f2 = SimpleUploadedFile("b.png", b"content2", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [f1, f2], "resource_type": "avatar"}, format="multipart")
        assert resp.status_code == 201
        assert len(api_data(resp)) == 2

    def test_invalid_resource_type_returns_422(self):
        file = SimpleUploadedFile("photo.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": "bad_type"}, format="multipart")
        assert resp.status_code == 422

    def test_upload_rejects_house_media_with_user_scope(self):
        file = SimpleUploadedFile("house.png", b"fakecontent", content_type="image/png")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": ResourceType.HOUSE_IMAGE, "scope": "user"}, format="multipart")
        assert resp.status_code == 400

    def test_upload_rejects_resource_type_extension_mismatch(self):
        org = Organization.objects.create(name="Upload Extension Org", slug="upload-extension-org")
        OrganizationMember.objects.create(organization=org, user=self.user, is_owner=True)
        set_session_org(self.client, org, is_owner=True)

        file = SimpleUploadedFile("house.mp4", b"fakecontent", content_type="video/mp4")
        resp = self.client.post(UPLOAD_URL, {"files": [file], "resource_type": ResourceType.HOUSE_IMAGE, "scope": "org"}, format="multipart")

        assert resp.status_code == 400
