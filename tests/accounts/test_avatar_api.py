import io
import json

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from PIL import Image

from apps.accounts.models import User
from apps.media.constants import ThumbnailStatus
from apps.media.models import MediaFile
from tests.api_helpers import api_data

MEDIA_UPLOAD_URL = "/api/media/upload/"


def _detail_url(pk: int) -> str:
    return f"/api/users/{pk}/"


def _make_png_bytes(size=(512, 512), color="red"):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


class TestAvatarAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="user",
            email="user@example.com",
            password="secret",  # noqa: S106
        )

    def _upload_avatar_media(self, filename="avatar.png", color="red"):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile(filename, _make_png_bytes(color=color), content_type="image/png")
        resp = self.client.post(MEDIA_UPLOAD_URL, {"files": [upload], "resource_type": "avatar"}, format="multipart")
        self.assertEqual(resp.status_code, 201)
        return api_data(resp)[0]

    def test_patch_avatar_persists_media_ref_and_returns_avatar_url(self):
        media = self._upload_avatar_media()
        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": [{"media_id": media["id"], "media_type": "image"}]}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertIn("avatar_url", data)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.avatar), 1)
        self.assertEqual(self.user.avatar[0]["media_type"], "image")
        media = MediaFile.objects.get(pk=self.user.avatar[0]["media_id"])
        self.assertEqual(media.resource_type, "avatar")
        self.assertEqual(self.user.avatar_url, data["avatar_url"])

    def test_avatar_url_falls_back_to_resolved_url_when_thumbnail_missing(self):
        media = MediaFile.objects.create(
            uploader=self.user,
            resource_type="avatar",
            original_filename="avatar.png",
            file="uploads/users/1/avatar.png",
            file_size=123,
        )
        self.user.avatar = [{"media_id": media.pk, "media_type": "image"}]
        self.user.save(update_fields=["avatar"])

        self.assertEqual(self.user.avatar_url, media.file.url)

    def test_me_returns_resolved_avatar_media_ref(self):
        media = MediaFile.objects.create(
            uploader=self.user,
            resource_type="avatar",
            original_filename="avatar.png",
            file="uploads/users/1/avatar.png",
            file_size=123,
        )
        self.user.avatar = [{"media_id": media.pk, "media_type": "image"}]
        self.user.save(update_fields=["avatar"])
        self.client.force_login(self.user)

        resp = self.client.get("/api/users/me/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        self.assertNotIn("avatar_url", data)
        self.assertEqual(data["avatar"][0]["media_id"], media.pk)
        self.assertEqual(data["avatar"][0]["resource_type"], "avatar")
        self.assertEqual(data["avatar"][0]["original_filename"], "avatar.png")
        self.assertEqual(data["avatar"][0]["url"], media.file.url)
        self.assertEqual(data["avatar"][0]["thumbnail"], media.file.url)
        self.assertEqual(data["avatar"][0]["file_size"], 123)

    def test_patch_avatar_replaces_ref_and_deletes_old_media(self):
        first = self._upload_avatar_media("first.png", "red")
        second = self._upload_avatar_media("second.png", "blue")
        self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": [{"media_id": first["id"], "media_type": "image"}]}),
            content_type="application/json",
        )
        self.user.refresh_from_db()
        first_media_id = self.user.avatar[0]["media_id"]
        first_media = MediaFile.objects.get(pk=first_media_id)
        first_media_path = first_media.file.name
        first_thumbnail_path = default_storage.save(f"derived/thumbnails/v1/{first_media_id}.webp", ContentFile(b"thumbnail"))
        first_media.thumbnail.name = first_thumbnail_path
        first_media.thumbnail_status = ThumbnailStatus.READY
        first_media.save(update_fields=["thumbnail", "thumbnail_status"])

        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": [{"media_id": second["id"], "media_type": "image"}]}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.avatar), 1)
        self.assertNotEqual(self.user.avatar[0]["media_id"], first_media_id)
        self.assertFalse(MediaFile.objects.filter(pk=first_media_id).exists())
        self.assertFalse(default_storage.exists(first_media_path))
        self.assertFalse(default_storage.exists(first_thumbnail_path))

    def test_patch_avatar_empty_clears_ref_and_deletes_media(self):
        media = self._upload_avatar_media()
        self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": [{"media_id": media["id"], "media_type": "image"}]}),
            content_type="application/json",
        )
        self.user.refresh_from_db()
        media_id = self.user.avatar[0]["media_id"]
        media_path = MediaFile.objects.get(pk=media_id).file.name

        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": []}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])
        self.assertIsNone(self.user.avatar_url)
        self.assertFalse(MediaFile.objects.filter(pk=media_id).exists())
        self.assertFalse(default_storage.exists(media_path))

    def test_patch_avatar_empty_is_safe_when_user_has_no_avatar(self):
        self.client.force_login(self.user)

        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": []}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])

    def test_patch_avatar_empty_is_safe_when_media_record_is_missing(self):
        media = MediaFile.objects.create(
            uploader=self.user,
            resource_type="avatar",
            original_filename="missing.png",
            file="uploads/users/1/missing.png",
            file_size=123,
        )
        self.user.avatar = [{"media_id": media.pk, "media_type": "image"}]
        self.user.save(update_fields=["avatar"])
        media.delete()
        self.client.force_login(self.user)

        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": []}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])

    def test_patch_avatar_rejects_media_uploaded_by_another_user(self):
        other = User.objects.create_user(username="other", password="secret")  # noqa: S106
        media = MediaFile.objects.create(
            uploader=other,
            resource_type="avatar",
            original_filename="avatar.png",
            file="uploads/users/2/avatar.png",
            file_size=123,
        )
        self.client.force_login(self.user)

        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"avatar": [{"media_id": media.pk, "media_type": "image"}]}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)

    def test_dedicated_avatar_upload_endpoint_is_removed(self):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")

        resp = self.client.post("/api/users/me/avatar/", {"image": upload})

        self.assertEqual(resp.status_code, 404)
