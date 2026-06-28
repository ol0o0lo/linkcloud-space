from django.test import TestCase

from tests.api_helpers import api_data


class TestEnumRegistryAPI(TestCase):
    def test_list_selected_enums(self):
        response = self.client.get("/api/enums/", {"keys": "accounts.real_name_status,wallet.withdrawal_status"})

        data = api_data(response)

        assert data["accounts.real_name_status"][0] == {"value": "unverified", "mapping": "未实名"}
        assert {"value": "verified", "mapping": "已实名"} in data["accounts.real_name_status"]
        assert {"value": "pending_review", "mapping": "待审核"} in data["wallet.withdrawal_status"]

    def test_list_all_enums_when_keys_missing(self):
        response = self.client.get("/api/enums/")

        data = api_data(response)

        assert "accounts.real_name_status" in data
        assert "house.house_status" in data
        assert "wallet.withdrawal_status" in data

    def test_unknown_enum_key_returns_400(self):
        response = self.client.get("/api/enums/", {"keys": "missing.status"})

        assert response.status_code == 400
