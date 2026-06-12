from django.test import SimpleTestCase, override_settings

from apps.wallet.exceptions import WalletWechatConfigMissingException
from apps.wallet.wechat_client import WechatCallbackResult, WechatClientConfig, build_wechat_client_config, parse_wechat_callback_resource


class WechatClientTests(SimpleTestCase):
    @override_settings(WALLET_WECHAT_PAYOUT_ENABLED=False)
    def test_build_wechat_client_config_rejects_missing_required_settings(self):
        with self.assertRaises(WalletWechatConfigMissingException):
            build_wechat_client_config()

    @override_settings(
        WALLET_WECHAT_PAYOUT_ENABLED=True,
        WALLET_WECHAT_MCH_ID="1900000109",
        WALLET_WECHAT_APP_ID="wx123",
        WALLET_WECHAT_SERIAL_NO="serial-1",
        WALLET_WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
        WALLET_WECHAT_PLATFORM_CERT="-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
        WALLET_WECHAT_NOTIFY_URL="https://example.com/api/wallet/payout/callback/wechat/",
        WALLET_WECHAT_TRANSFER_SCENE="ORDINARY_TRANSFER",
        WALLET_WECHAT_API_BASE_URL="https://api.mch.weixin.qq.com",
        WALLET_WECHAT_TIMEOUT_SECONDS=8,
        WALLET_WECHAT_QUERY_RETRY_MINUTES=10,
        WALLET_WECHAT_QUERY_MAX_RETRIES=6,
        WALLET_WECHAT_CERT_REFRESH_SECONDS=3600,
    )
    def test_build_wechat_client_config_reads_runtime_settings(self):
        config = build_wechat_client_config()

        self.assertIsInstance(config, WechatClientConfig)
        self.assertEqual(config.mch_id, "1900000109")
        self.assertEqual(config.timeout_seconds, 8)
        self.assertEqual(config.query_max_retries, 6)

    def test_parse_wechat_callback_resource_maps_terminal_statuses(self):
        result = parse_wechat_callback_resource(
            {
                "out_bill_no": "out-1",
                "state": "SUCCESS",
                "transfer_bill_no": "wx-1",
            }
        )

        self.assertEqual(
            result,
            WechatCallbackResult(
                out_trade_no="out-1",
                provider_trade_no="wx-1",
                callback_status="success",
                response_payload={"state": "SUCCESS"},
            ),
        )
