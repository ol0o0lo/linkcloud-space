from types import SimpleNamespace

from django.test import SimpleTestCase, TestCase

from apps.base.enum_registry import enum_field_mapping, enum_list_field_mapping
from apps.notifications.constants import NotificationChannel
from apps.wallet.constants import WithdrawalStatus
from tests.api_helpers import api_data


class TestEnumRegistryAPI(TestCase):
    def test_list_selected_enums(self):
        response = self.client.get("/api/enums/", {"keys": "accounts.admin_user_role,accounts.real_name_status,wallet.withdrawal_status"})

        data = api_data(response)

        assert data["accounts.admin_user_role"] == [
            {"value": "superuser", "mapping": "超级管理员"},
            {"value": "staff", "mapping": "后台账号"},
            {"value": "user", "mapping": "普通账号"},
        ]
        assert data["accounts.real_name_status"][0] == {"value": "unverified", "mapping": "未实名"}
        assert {"value": "verified", "mapping": "已实名"} in data["accounts.real_name_status"]
        assert {"value": "pending_review", "mapping": "待审核"} in data["wallet.withdrawal_status"]

    def test_list_all_enums_when_keys_missing(self):
        response = self.client.get("/api/enums/")

        data = api_data(response)

        assert "accounts.admin_user_role" in data
        assert "accounts.real_name_status" in data
        assert "house.house_status" in data
        assert "wallet.withdrawal_status" in data

    def test_unknown_enum_key_returns_400(self):
        response = self.client.get("/api/enums/", {"keys": "missing.status"})

        assert response.status_code == 400


class TestEnumRegistryHelpers(SimpleTestCase):
    def test_enum_field_mapping_supports_object_and_dict_rows(self):
        row_obj = SimpleNamespace(status=WithdrawalStatus.PENDING_REVIEW)
        row_dict = {"status": WithdrawalStatus.PENDING_REVIEW}

        assert enum_field_mapping(WithdrawalStatus, row_obj, "status") == "待审核"
        assert enum_field_mapping(WithdrawalStatus, row_dict, "status") == "待审核"

    def test_enum_list_field_mapping_supports_object_and_dict_rows(self):
        channels = [NotificationChannel.IN_APP, NotificationChannel.EMAIL]
        row_obj = SimpleNamespace(default_channels=channels)
        row_dict = {"default_channels": channels}

        assert enum_list_field_mapping(NotificationChannel, row_obj, "default_channels") == ["In-app", "Email"]
        assert enum_list_field_mapping(NotificationChannel, row_dict, "default_channels") == ["In-app", "Email"]
