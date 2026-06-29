import json
from importlib import import_module

from django.conf import settings
from django.test import TestCase

from allauth.mfa.models import Authenticator
from allauth.socialaccount.models import SocialAccount
from allauth.usersessions.models import UserSession

from apps.accounts.constants import AdminUserRole, RealNameStatus
from apps.accounts.models import User
from tests.api_helpers import api_data


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
            phone_country_code="+86",
            phone_national_number="13800000000",
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
        self.assertFalse(api_data(disable_resp)["is_active"])

        enable_resp = self.client.patch(
            f"/api/admin/users/{self.user.pk}/status/",
            data=json.dumps({"is_active": True}),
            content_type="application/json",
        )
        self.assertEqual(enable_resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertTrue(api_data(enable_resp)["is_active"])

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
        self.assertEqual(api_data(resp)["deleted_sessions"], 1)
        self.assertFalse(UserSession.objects.filter(user=self.user).exists())
        self.assertFalse(import_module(settings.SESSION_ENGINE).SessionStore().exists(session_store.session_key))

    def test_reset_mfa_removes_authenticators(self):
        Authenticator.objects.create(user=self.user, type=Authenticator.Type.TOTP, data={"secret": "abc"})

        resp = self.client.post(f"/api/admin/users/{self.user.pk}/reset-mfa/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["deleted_authenticators"], 1)
        self.assertFalse(Authenticator.objects.filter(user=self.user).exists())

    def test_unbind_phone_clears_phone_fields(self):
        resp = self.client.delete(f"/api/admin/users/{self.user.pk}/phone/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.user.refresh_from_db()
        self.assertIsNone(self.user.phone)
        self.assertEqual(self.user.phone_country_code, "")
        self.assertEqual(self.user.phone_national_number, "")
        self.assertFalse(self.user.phone_verified)

    def test_unbind_wechat_removes_wechat_social_accounts(self):
        SocialAccount.objects.create(user=self.user, provider="weixin", uid="wx-openid")
        SocialAccount.objects.create(user=self.user, provider="wechat_miniprogram", uid="mp-openid")
        SocialAccount.objects.create(user=self.user, provider="github", uid="gh-user")

        resp = self.client.delete(f"/api/admin/users/{self.user.pk}/wechat/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
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

    def test_superuser_can_list_all_users_for_admin(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])

        resp = self.client.get("/api/admin/users/")

        self.assertEqual(resp.status_code, 200)
        data = api_data(resp)
        rows = data["items"]
        self.assertEqual(data["total"], 2)
        self.assertEqual(data["page"], 1)
        member = next(row for row in rows if row["id"] == self.user.pk)
        self.assertEqual(member["email"], "member@example.com")
        self.assertEqual(member["role"], AdminUserRole.USER)
        self.assertEqual(member["role__mapping"], AdminUserRole.get_choice_label(AdminUserRole.USER))
        self.assertEqual(member["real_name_status__mapping"], RealNameStatus.get_choice_label(member["real_name_status"]))
        self.assertFalse(member["is_active"])
        self.assertFalse(member["is_staff"])
        self.assertFalse(member["is_superuser"])
        self.assertEqual(member["role"], "user")
        self.assertEqual(member["role__mapping"], "普通账号")
        self.assertEqual(member["real_name_status__mapping"], "未实名")

    def test_superuser_can_filter_admin_users(self):
        staff = User.objects.create_user(username="operator", email="ops@example.com", password="secret", is_staff=True)  # noqa: S106
        verified = User.objects.create_user(
            username="verified-user",
            email="verified@example.com",
            password="secret",  # noqa: S106
            phone_country_code="+86",
            phone_national_number="13900000000",
            real_name_status=RealNameStatus.VERIFIED,
            real_name_masked="张*",
        )

        def usernames(params):
            return {row["username"] for row in api_data(self.client.get("/api/admin/users/", params))["items"]}

        self.assertEqual(usernames({"username": "member"}), {"member"})
        self.assertEqual(usernames({"phone": "1380000"}), {"member"})
        self.assertEqual(usernames({"keyword": "张"}), {"verified-user"})
        self.assertEqual(usernames({"real_name_status": RealNameStatus.VERIFIED}), {"verified-user"})
        self.assertEqual(usernames({"role": "staff"}), {"operator"})
        self.assertIn("admin", usernames({"role": "superuser"}))
        self.assertIn("member", usernames({"role": "user"}))
        self.assertNotIn("operator", usernames({"role": "user"}))

    def test_staff_user_cannot_list_admin_users(self):
        staff = User.objects.create_user(username="staff-list", password="secret", is_staff=True)  # noqa: S106
        self.client.force_login(staff)

        resp = self.client.get("/api/admin/users/")

        self.assertEqual(resp.status_code, 403)

    def test_superuser_can_create_admin_user(self):
        resp = self.client.post(
            "/api/admin/users/",
            data=json.dumps(
                {
                    "username": "new-admin-user",
                    "email": "new-admin@example.com",
                    "first_name": "New",
                    "last_name": "Admin",
                    "timezone": "Asia/Shanghai",
                    "phone_country_code": "+86",
                    "phone_national_number": "13900009999",
                    "phone_verified": True,
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": False,
                    "password": "new-admin-pass",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        created = User.objects.get(username="new-admin-user")
        self.assertEqual(created.email, "new-admin@example.com")
        self.assertEqual(created.phone_country_code, "+86")
        self.assertEqual(created.phone_national_number, "13900009999")
        self.assertTrue(created.is_staff)
        self.assertTrue(created.check_password("new-admin-pass"))

    def test_superuser_can_patch_admin_user(self):
        resp = self.client.patch(
            f"/api/admin/users/{self.user.pk}/",
            data=json.dumps(
                {
                    "first_name": "Edited",
                    "last_name": "Member",
                    "is_staff": True,
                    "timezone": "UTC",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, "Edited")
        self.assertEqual(self.user.last_name, "Member")
        self.assertTrue(self.user.is_staff)
        self.assertEqual(self.user.timezone, "UTC")

    def test_superuser_can_set_user_password(self):
        resp = self.client.post(
            f"/api/admin/users/{self.user.pk}/set-password/",
            data=json.dumps({"password": "new-secret-pass"}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200, resp.content)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("new-secret-pass"))

    def test_superuser_cannot_remove_own_superuser_access(self):
        resp = self.client.patch(
            f"/api/admin/users/{self.admin.pk}/",
            data=json.dumps({"is_superuser": False}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_superuser)

    def test_superuser_cannot_remove_own_staff_access(self):
        resp = self.client.patch(
            f"/api/admin/users/{self.admin.pk}/",
            data=json.dumps({"is_staff": False}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 400)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_staff)
