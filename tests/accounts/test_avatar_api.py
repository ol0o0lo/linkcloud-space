import io

from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from PIL import Image

from apps.accounts.models import User
from apps.media.models import MediaFile
from tests.api_helpers import api_data

URL = "/api/users/me/avatar/"


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

    def test_upload_avatar_persists_media_ref_and_returns_avatar_url(self):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")

        resp = self.client.post(URL, {"image": upload})

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

    def test_reupload_avatar_replaces_ref_and_deletes_old_media(self):
        self.client.force_login(self.user)
        first = SimpleUploadedFile("first.png", _make_png_bytes(color="red"), content_type="image/png")
        second = SimpleUploadedFile("second.png", _make_png_bytes(color="blue"), content_type="image/png")

        self.client.post(URL, {"image": first})
        self.user.refresh_from_db()
        first_media_id = self.user.avatar[0]["media_id"]
        first_media_path = MediaFile.objects.get(pk=first_media_id).file.name

        resp = self.client.post(URL, {"image": second})

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(len(self.user.avatar), 1)
        self.assertNotEqual(self.user.avatar[0]["media_id"], first_media_id)
        self.assertFalse(MediaFile.objects.filter(pk=first_media_id).exists())
        self.assertFalse(default_storage.exists(first_media_path))

    def test_delete_avatar_clears_ref_and_deletes_media(self):
        self.client.force_login(self.user)
        upload = SimpleUploadedFile("avatar.png", _make_png_bytes(), content_type="image/png")
        self.client.post(URL, {"image": upload})
        self.user.refresh_from_db()
        media_id = self.user.avatar[0]["media_id"]
        media_path = MediaFile.objects.get(pk=media_id).file.name

        resp = self.client.delete(URL)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])
        self.assertIsNone(self.user.avatar_url)
        self.assertFalse(MediaFile.objects.filter(pk=media_id).exists())
        self.assertFalse(default_storage.exists(media_path))

    def test_delete_avatar_is_safe_when_user_has_no_avatar(self):
        self.client.force_login(self.user)

        resp = self.client.delete(URL)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])

    def test_delete_avatar_is_safe_when_media_record_is_missing(self):
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

        resp = self.client.delete(URL)

        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar, [])
