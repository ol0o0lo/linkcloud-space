import json
from importlib import import_module

from django.conf import settings
from django.test import TestCase

from allauth.mfa.models import Authenticator
from allauth.socialaccount.models import SocialAccount
from allauth.usersessions.models import UserSession

from apps.accounts.models import User


class TestAdminUserLifecycleAPI(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="secret",  # noqa: S106
        )
        self.user = User.objects.create_user(
            username="member",
            email="member@example.com",
            password="secret",  # noqa: S106
            phone="+8613800000000",
            phone_verified=True,
        )
        self.client.force_login(self.admin)

    def test_superuser_can_disable_and_enable_user(self):
        disable_resp = self.client.patch(
            f"/api/admin/users/{self.user.pk}/status/",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(disable_resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertFalse(disable_resp.json()["is_active"])

        enable_resp = self.client.patch(
            f"/api/admin/users/{self.user.pk}/status/",
            data=json.dumps({"is_active": True}),
            content_type="application/json",
        )
        self.assertEqual(enable_resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(enable_resp.json()["is_active"])

    def test_superuser_cannot_disable_self(self):
        resp = self.client.patch(
            f"/api/admin/users/{self.admin.pk}/status/",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_force_logout_removes_user_sessions(self):
        session_store = import_module(settings.SESSION_ENGINE).SessionStore()
        session_store["_auth_user_id"] = str(self.user.pk)
        session_store.save()
        UserSession.objects.create(user=self.user, session_key=session_store.session_key, ip="127.0.0.1", user_agent="test")

        resp = self.client.post(f"/api/admin/users/{self.user.pk}/force-logout/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["deleted_sessions"], 1)
        self.assertFalse(UserSession.objects.filter(user=self.user).exists())
        self.assertFalse(import_module(settings.SESSION_ENGINE).SessionStore().exists(session_store.session_key))

    def test_reset_mfa_removes_authenticators(self):
        Authenticator.objects.create(user=self.user, type=Authenticator.Type.TOTP, data={"secret": "abc"})

        resp = self.client.post(f"/api/admin/users/{self.user.pk}/reset-mfa/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["deleted_authenticators"], 1)
        self.assertFalse(Authenticator.objects.filter(user=self.user).exists())

    def test_unbind_phone_clears_phone_fields(self):
        resp = self.client.delete(f"/api/admin/users/{self.user.pk}/phone/")

        self.assertEqual(resp.status_code, 204)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.phone)
        self.assertFalse(self.user.phone_verified)

    def test_unbind_wechat_removes_wechat_social_accounts(self):
        SocialAccount.objects.create(user=self.user, provider="weixin", uid="wx-openid")
        SocialAccount.objects.create(user=self.user, provider="wechat_miniprogram", uid="mp-openid")
        SocialAccount.objects.create(user=self.user, provider="github", uid="gh-user")

        resp = self.client.delete(f"/api/admin/users/{self.user.pk}/wechat/")

        self.assertEqual(resp.status_code, 204)
        self.assertFalse(SocialAccount.objects.filter(user=self.user, provider__in=["weixin", "wechat_miniprogram"]).exists())
        self.assertTrue(SocialAccount.objects.filter(user=self.user, provider="github").exists())

    def test_unbind_wechat_honors_allauth_disconnect_validation(self):
        self.user.set_unusable_password()
        self.user.save(update_fields=["password"])
        SocialAccount.objects.create(user=self.user, provider="weixin", uid="only-login")

        resp = self.client.delete(f"/api/admin/users/{self.user.pk}/wechat/")

        self.assertEqual(resp.status_code, 400)
        self.assertTrue(SocialAccount.objects.filter(user=self.user, provider="weixin").exists())

    def test_staff_user_is_forbidden(self):
        staff = User.objects.create_user(username="staff", password="secret", is_staff=True)  # noqa: S106
        self.client.force_login(staff)

        resp = self.client.patch(
            f"/api/admin/users/{self.user.pk}/status/",
            data=json.dumps({"is_active": False}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)
