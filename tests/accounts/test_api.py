import json

from django.test import TestCase

from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import TOTP, generate_totp_secret

from apps.accounts.models import User
from tests.api_helpers import api_data, api_error


def _detail_url(pk: int) -> str:
    return f"/api/users/{pk}/"


class TestUserTimezoneAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="testuser",
            password="testpass",  # noqa: S106
            timezone="America/Chicago",
        )
        self.client.force_login(self.user)

    def test_patch_timezone_valid(self):
        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"timezone": "America/New_York"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.timezone, "America/New_York")

    def test_patch_timezone_invalid(self):
        resp = self.client.patch(
            _detail_url(self.user.pk),
            data=json.dumps({"timezone": "Invalid/Timezone"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_patch_other_user_forbidden(self):
        other_user = User.objects.create_user(
            username="otheruser",
            password="testpass",  # noqa: S106
        )
        resp = self.client.patch(
            _detail_url(other_user.pk),
            data=json.dumps({"timezone": "America/New_York"}),
            content_type="application/json",
        )
        self.assertIn(resp.status_code, [403, 404])

    def test_get_user_includes_timezone(self):
        resp = self.client.get(_detail_url(self.user.pk))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["timezone"], "America/Chicago")


class TestUserTotpSetupAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="totp-user",
            email="totp@example.com",
            password="testpass",  # noqa: S106
        )
        self.client.force_login(self.user)

    def test_get_totp_setup_returns_secret_and_url(self):
        resp = self.client.get("/api/users/me/mfa/totp-setup/")

        self.assertEqual(resp.status_code, 200)
        body = api_data(resp)
        self.assertTrue(body["secret"])
        self.assertTrue(body["totp_url"].startswith("otpauth://"))
        self.assertIn("totp%40example.com", body["totp_url"])

    def test_get_totp_setup_rejects_enabled_totp(self):
        TOTP.activate(self.user, generate_totp_secret())

        resp = self.client.get("/api/users/me/mfa/totp-setup/")

        self.assertEqual(resp.status_code, 409)
        error = api_error(resp)
        self.assertEqual(error["code"], 409)
        self.assertEqual(error["error"], "CONFLICT")
        self.assertEqual(error["message"], "TOTP is already enabled.")
        self.assertEqual(
            Authenticator.objects.filter(user=self.user, type=Authenticator.Type.TOTP).count(),
            1,
        )
