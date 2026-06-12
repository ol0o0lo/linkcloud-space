from unittest.mock import patch

from django.test import SimpleTestCase, override_settings

from apps.wallet.exceptions import WalletWechatConfigMissingException, WalletWechatSnapshotIncompleteException
from apps.wallet.providers.base import ProviderQueryResult, ProviderTransferResult
from apps.wallet.providers.registry import get_payout_provider
from apps.wallet.providers.wechat import WeChatPayoutProvider


class WeChatPayoutProviderTests(SimpleTestCase):
    def test_registry_returns_wechat_provider(self):
        provider = get_payout_provider("wechat")

        self.assertIsInstance(provider, WeChatPayoutProvider)

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    def test_build_transfer_request_from_snapshot(self):
        provider = WeChatPayoutProvider()
        withdrawal = type(
            "WithdrawalStub",
            (),
            {
                "pk": 1,
                "net_amount": 900,
                "payee_account_snapshot": {
                    "channel": "wechat",
                    "social_provider": "weixin",
                    "social_uid": "wx-user-1",
                    "openid": "openid-1",
                    "unionid": "unionid-1",
                    "receiver_name": "张三",
                    "masked_account": "wx******1234",
                },
            },
        )()

        payload = provider.build_transfer_request(withdrawal, idempotency_key="payout-1")

        self.assertEqual(payload["appid"], "wx123")
        self.assertEqual(payload["out_bill_no"], "payout-1")
        self.assertEqual(payload["transfer_amount"], 900)
        self.assertEqual(payload["openid"], "openid-1")

    @override_settings(WALLET_WECHAT_PAYOUT_ENABLED=False)
    def test_build_transfer_request_rejects_missing_config(self):
        provider = WeChatPayoutProvider()
        withdrawal = type("WithdrawalStub", (), {"pk": 1, "net_amount": 900, "payee_account_snapshot": {}})()

        with self.assertRaises(WalletWechatConfigMissingException):
            provider.build_transfer_request(withdrawal, idempotency_key="payout-2")

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    def test_build_transfer_request_rejects_incomplete_snapshot(self):
        provider = WeChatPayoutProvider()
        withdrawal = type(
            "WithdrawalStub",
            (),
            {"pk": 1, "net_amount": 900, "payee_account_snapshot": {"channel": "wechat", "receiver_name": "张三"}},
        )()

        with self.assertRaises(WalletWechatSnapshotIncompleteException):
            provider.build_transfer_request(withdrawal, idempotency_key="payout-3")

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    @patch("apps.wallet.providers.wechat.WechatPayClient")
    def test_create_transfer_maps_client_accept_response(self, mock_client_cls):
        provider = WeChatPayoutProvider()
        withdrawal = type(
            "WithdrawalStub",
            (),
            {
                "pk": 9,
                "net_amount": 900,
                "payee_account_snapshot": {"channel": "wechat", "openid": "openid-9", "receiver_name": "张三"},
            },
        )()
        mock_client_cls.return_value.create_transfer.return_value = {
            "accepted": True,
            "out_trade_no": "out-9",
            "provider_trade_no": "wx-9",
            "request_payload": {"out_bill_no": "out-9"},
            "response_payload": {"state": "ACCEPTED"},
        }

        result = provider.create_transfer(withdrawal, idempotency_key="out-9")

        self.assertEqual(
            result,
            ProviderTransferResult(
                provider="wechat",
                out_trade_no="out-9",
                accepted=True,
                status="processing",
                request_payload={"out_bill_no": "out-9"},
                response_payload={"state": "ACCEPTED"},
                provider_trade_no="wx-9",
            ),
        )

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    @patch("apps.wallet.providers.wechat.WechatPayClient")
    def test_query_transfer_maps_client_query_result(self, mock_client_cls):
        provider = WeChatPayoutProvider()
        payout = type("PayoutStub", (), {"out_trade_no": "out-11"})()
        mock_client_cls.return_value.query_transfer.return_value = {
            "provider_trade_no": "wx-11",
            "payout_status": "succeeded",
            "response_payload": {"state": "SUCCESS"},
        }

        result = provider.query_transfer(payout)

        self.assertEqual(
            result,
            ProviderQueryResult(
                out_trade_no="out-11",
                provider_trade_no="wx-11",
                payout_status="succeeded",
                response_payload={"state": "SUCCESS"},
            ),
        )

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="private-key",
        WALLET_WECHAT_PLATFORM_CERT="platform-cert",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
    )
    @patch("apps.wallet.providers.wechat.WechatPayClient")
    def test_parse_callback_uses_client_verified_resource(self, mock_client_cls):
        provider = WeChatPayoutProvider()
        mock_client_cls.return_value.parse_callback.return_value = {
            "out_trade_no": "out-10",
            "provider_trade_no": "wx-10",
            "callback_status": "success",
            "response_payload": {"state": "SUCCESS"},
        }

        result = provider.parse_callback(payload={"id": "cb-1"}, headers={"Wechatpay-Signature": "sig"})

        self.assertEqual(result["out_trade_no"], "out-10")
        self.assertEqual(result["callback_status"], "success")
