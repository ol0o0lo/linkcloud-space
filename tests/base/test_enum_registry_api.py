from django.test import TestCase

from apps.accounts.models import User
from tests.api_helpers import api_data


class TestEnumRegistryAPI(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="enum-user", password="secret123")  # noqa: S106
        self.client.force_login(self.user)

    def test_list_enums_returns_registered_mapping_options(self):
        resp = self.client.get("/api/enums/")

        self.assertEqual(resp.status_code, 200, resp.content)
        data = api_data(resp)
        self.assertEqual(data["accounts.real_name_status"][0], {"value": "unverified", "mapping": "未实名"})
        self.assertIn({"value": "verified", "mapping": "已实名"}, data["accounts.real_name_status"])
        self.assertIn({"value": "manual_review", "mapping": "人工复核"}, data["accounts.real_name_status"])
        self.assertEqual(
            data["accounts.admin_user_role"],
            [
                {"value": "superuser", "mapping": "超级管理员"},
                {"value": "staff", "mapping": "后台账号"},
                {"value": "user", "mapping": "普通账号"},
            ],
        )
