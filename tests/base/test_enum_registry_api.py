from django.test import TestCase
from tests.api_helpers import api_data


class TestEnumRegistryAPI(TestCase):
    def test_list_selected_enums(self):
        response = self.client.get("/api/enums/", {"keys": "accounts.admin_user_role,accounts.phone_country_code,accounts.real_name_status,wallet.withdrawal_status"})

        data = api_data(response)

        assert data["accounts.admin_user_role"] == [
            {"label": "超级管理员", "value": "superuser"},
            {"label": "后台账号", "value": "staff"},
            {"label": "普通账号", "value": "user"},
        ]
        assert {"label": "+86 (中国)", "value": "+86"} in data["accounts.phone_country_code"]
        assert data["accounts.real_name_status"][0] == {"label": "未实名", "value": "unverified"}
        assert {"label": "已实名", "value": "verified"} in data["accounts.real_name_status"]
        assert {"label": "待审核", "value": "pending_review"} in data["wallet.withdrawal_status"]

    def test_list_all_enums_when_keys_missing(self):
        response = self.client.get("/api/enums/")

        data = api_data(response)

        assert "accounts.admin_user_role" in data
        assert "accounts.phone_country_code" in data
        assert "accounts.real_name_status" in data
        assert "house.house_status" in data
        assert "wallet.withdrawal_status" in data

    def test_unknown_enum_key_returns_400(self):
        response = self.client.get("/api/enums/", {"keys": "missing.status"})

        assert response.status_code == 400
