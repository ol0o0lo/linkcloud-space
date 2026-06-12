from django.conf import settings

from apps.wallet.exceptions import WalletWechatConfigMissingException, WalletWechatSnapshotIncompleteException
from apps.wallet.providers.base import BasePayoutProvider, ProviderQueryResult, ProviderTransferResult
from apps.wallet.wechat_client import WechatPayClient


class WeChatPayoutProvider(BasePayoutProvider):
    code = "wechat"

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = WechatPayClient()
        return self._client

    required_settings = (
        "WALLET_WECHAT_PAYOUT_ENABLED",
        "WALLET_WECHAT_MCH_ID",
        "WALLET_WECHAT_APP_ID",
        "WALLET_WECHAT_SERIAL_NO",
        "WALLET_WECHAT_PRIVATE_KEY",
        "WALLET_WECHAT_PLATFORM_CERT",
        "WALLET_WECHAT_NOTIFY_URL",
        "WALLET_WECHAT_TRANSFER_SCENE",
        "WALLET_WECHAT_API_BASE_URL",
    )

    def _validate_settings(self):
        missing = [name for name in self.required_settings if not getattr(settings, name, "")]
        if missing:
            raise WalletWechatConfigMissingException()

    def _get_openid(self, snapshot: dict) -> str:
        openid = snapshot.get("openid", "")
        if not openid:
            raise WalletWechatSnapshotIncompleteException()
        return openid

    def build_transfer_request(self, withdrawal, idempotency_key: str) -> dict:
        self._validate_settings()
        snapshot = withdrawal.payee_account_snapshot or {}
        if snapshot.get("channel") != "wechat":
            raise WalletWechatSnapshotIncompleteException()
        openid = self._get_openid(snapshot)
        return {
            "appid": settings.WALLET_WECHAT_APP_ID,
            "out_bill_no": idempotency_key,
            "transfer_scene_id": settings.WALLET_WECHAT_TRANSFER_SCENE,
            "openid": openid,
            "user_name": snapshot.get("receiver_name", ""),
            "transfer_amount": withdrawal.net_amount,
            "notify_url": settings.WALLET_WECHAT_NOTIFY_URL,
            "transfer_remark": f"wallet-withdrawal-{withdrawal.pk}",
        }

    def create_transfer(self, withdrawal, idempotency_key: str) -> ProviderTransferResult:
        payload = self.build_transfer_request(withdrawal, idempotency_key=idempotency_key)
        result = self.client.create_transfer(payload)
        return ProviderTransferResult(
            provider=self.code,
            out_trade_no=result["out_trade_no"],
            accepted=result["accepted"],
            status="processing" if result["accepted"] else "failed",
            request_payload=result.get("request_payload", payload),
            response_payload=result.get("response_payload", {}),
            provider_trade_no=result.get("provider_trade_no", ""),
            error_code=result.get("error_code", ""),
            error_message=result.get("error_message", ""),
        )

    def query_transfer(self, payout) -> ProviderQueryResult:
        result = self.client.query_transfer(out_trade_no=payout.out_trade_no)
        return ProviderQueryResult(
            out_trade_no=payout.out_trade_no,
            provider_trade_no=result.get("provider_trade_no", ""),
            payout_status=result["payout_status"],
            response_payload=result.get("response_payload", {}),
            error_code=result.get("error_code", ""),
            error_message=result.get("error_message", ""),
        )

    def verify_callback(self, payload: dict, headers: dict, raw_body: str = "") -> bool:
        return self.client.verify_callback(headers=headers, payload=payload, raw_body=raw_body)

    def parse_callback(self, payload: dict, headers: dict, raw_body: str = ""):
        return self.client.parse_callback(headers=headers, payload=payload, raw_body=raw_body)
