import base64
import json
import time
import uuid
from dataclasses import dataclass

import requests
from cryptography.exceptions import InvalidSignature, InvalidTag
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.x509 import load_pem_x509_certificate
from django.conf import settings

from apps.wallet.exceptions import WalletWechatConfigMissingException


@dataclass(slots=True)
class WechatClientConfig:
    app_id: str
    api_base_url: str
    api_v3_key: str
    cert_refresh_seconds: int
    mch_id: str
    notify_url: str
    platform_cert: str
    private_key: str
    query_max_retries: int
    query_retry_minutes: int
    serial_no: str
    timeout_seconds: int
    transfer_scene: str


@dataclass(slots=True)
class WechatCallbackResult:
    out_trade_no: str
    provider_trade_no: str
    callback_status: str
    response_payload: dict


class WechatPayClient:
    callback_signature_type = "WECHATPAY2-SHA256-RSA2048"
    failed_query_states = {"FAILED", "CANCELLED"}
    success_query_states = {"SUCCESS"}
    user_agent = "linkcloud-wallet/1.0"

    def __init__(self, config: WechatClientConfig | None = None, session: requests.Session | None = None):
        self.config = config or build_wechat_client_config()
        self.session = session or requests.Session()
        self.private_key = serialization.load_pem_private_key(self.config.private_key.encode("utf-8"), password=None)
        self.platform_certificate = load_pem_x509_certificate(self.config.platform_cert.encode("utf-8"))

    def create_transfer(self, payload: dict) -> dict:
        response = self._request_json("POST", "/v3/fund-app/mch-transfer/transfer-bills", payload)
        body = response["body"]
        return {
            "accepted": response["ok"],
            "out_trade_no": payload["out_bill_no"],
            "provider_trade_no": body.get("transfer_bill_no", ""),
            "request_payload": payload,
            "response_payload": body,
            "error_code": body.get("code", ""),
            "error_message": body.get("message", body.get("detail", "")),
        }

    def query_transfer(self, *, out_trade_no: str) -> dict:
        response = self._request_json("GET", f"/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_trade_no}")
        body = response["body"]
        state = body.get("state", "")
        if state in self.success_query_states:
            payout_status = "succeeded"
        elif state in self.failed_query_states:
            payout_status = "failed"
        else:
            payout_status = "processing"
        return {
            "provider_trade_no": body.get("transfer_bill_no", ""),
            "payout_status": payout_status,
            "response_payload": body,
            "error_code": body.get("code", ""),
            "error_message": body.get("message", body.get("detail", "")),
        }

    def verify_callback(self, *, headers: dict, payload: dict, raw_body: str = "") -> bool:
        return self._verify_signature(headers=headers, body=raw_body or self._compact_json(payload))

    def parse_callback(self, *, headers: dict, payload: dict, raw_body: str = "") -> dict:
        body = raw_body or self._compact_json(payload)
        data = json.loads(body) if body else {}
        resource = data.get("resource", payload)
        if data.get("resource_type") == "encrypt-resource":
            resource = self._decrypt_callback_resource(resource)
        result = parse_wechat_callback_resource(resource)
        return {
            "out_trade_no": result.out_trade_no,
            "provider_trade_no": result.provider_trade_no,
            "callback_status": result.callback_status,
            "response_payload": resource,
        }

    def _request_json(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = self._compact_json(payload) if payload is not None else ""
        headers = self._build_request_headers(method=method, path=path, body=body)
        response = self.session.request(
            method=method,
            url=f"{self.config.api_base_url.rstrip('/')}{path}",
            data=body or None,
            headers=headers,
            timeout=self.config.timeout_seconds,
        )
        response_text = response.text or ""
        if 200 <= response.status_code < 300 and self._has_wechat_signature(response.headers):
            if not self._verify_signature(headers=dict(response.headers), body=response_text):
                raise ValueError("Invalid WeChat response signature.")
        try:
            response_body = response.json() if response_text else {}
        except ValueError:
            response_body = {}
        return {"ok": 200 <= response.status_code < 300, "body": response_body, "status_code": response.status_code}

    def _build_request_headers(self, *, method: str, path: str, body: str) -> dict:
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex.upper()
        message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body}\n".encode("utf-8")
        signature = base64.b64encode(
            self.private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())
        ).decode("utf-8")
        authorization = (
            'WECHATPAY2-SHA256-RSA2048 '
            f'mchid="{self.config.mch_id}",nonce_str="{nonce}",signature="{signature}",timestamp="{timestamp}",serial_no="{self.config.serial_no}"'
        )
        return {
            "Accept": "application/json",
            "Authorization": authorization,
            "Content-Type": "application/json",
            "User-Agent": self.user_agent,
        }

    def _decrypt_callback_resource(self, resource: dict) -> dict:
        if not self.config.api_v3_key:
            raise WalletWechatConfigMissingException()
        nonce = resource.get("nonce", "")
        ciphertext = resource.get("ciphertext", "")
        associated_data = resource.get("associated_data", "")
        plaintext = AESGCM(self.config.api_v3_key.encode("utf-8")).decrypt(
            nonce.encode("utf-8"),
            base64.b64decode(ciphertext),
            associated_data.encode("utf-8"),
        )
        return json.loads(plaintext.decode("utf-8"))

    def _verify_signature(self, *, headers: dict, body: str) -> bool:
        signature = self._get_header(headers, "Wechatpay-Signature")
        timestamp = self._get_header(headers, "Wechatpay-Timestamp")
        nonce = self._get_header(headers, "Wechatpay-Nonce")
        serial = self._get_header(headers, "Wechatpay-Serial")
        signature_type = self._get_header(headers, "Wechatpay-Signature-Type") or self.callback_signature_type
        if not all([signature, timestamp, nonce, serial]):
            return False
        if signature_type != self.callback_signature_type:
            return False
        if serial.upper() != format(self.platform_certificate.serial_number, "X"):
            return False
        message = f"{timestamp}\n{nonce}\n{body}\n".encode("utf-8")
        try:
            self.platform_certificate.public_key().verify(
                base64.b64decode(signature),
                message,
                padding.PKCS1v15(),
                hashes.SHA256(),
            )
        except (InvalidSignature, ValueError, TypeError):
            return False
        return True

    def _has_wechat_signature(self, headers: dict) -> bool:
        return bool(self._get_header(headers, "Wechatpay-Signature"))

    def _get_header(self, headers: dict, name: str) -> str:
        variants = {
            name,
            name.lower(),
            name.upper(),
            f"HTTP_{name.upper().replace('-', '_')}",
        }
        for key, value in headers.items():
            if key in variants:
                return value
        return ""

    def _compact_json(self, payload: dict | None) -> str:
        if not payload:
            return ""
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def build_wechat_client_config() -> WechatClientConfig:
    required = {
        "mch_id": getattr(settings, "WALLET_WECHAT_MCH_ID", ""),
        "app_id": getattr(settings, "WALLET_WECHAT_APP_ID", ""),
        "serial_no": getattr(settings, "WALLET_WECHAT_SERIAL_NO", ""),
        "private_key": getattr(settings, "WALLET_WECHAT_PRIVATE_KEY", ""),
        "platform_cert": getattr(settings, "WALLET_WECHAT_PLATFORM_CERT", ""),
        "notify_url": getattr(settings, "WALLET_WECHAT_NOTIFY_URL", ""),
        "transfer_scene": getattr(settings, "WALLET_WECHAT_TRANSFER_SCENE", ""),
        "api_base_url": getattr(settings, "WALLET_WECHAT_API_BASE_URL", ""),
    }
    if not getattr(settings, "WALLET_WECHAT_PAYOUT_ENABLED", False) or any(not value for value in required.values()):
        raise WalletWechatConfigMissingException()

    return WechatClientConfig(
        mch_id=required["mch_id"],
        app_id=required["app_id"],
        serial_no=required["serial_no"],
        private_key=required["private_key"],
        platform_cert=required["platform_cert"],
        api_v3_key=getattr(settings, "WALLET_WECHAT_API_V3_KEY", ""),
        notify_url=required["notify_url"],
        transfer_scene=required["transfer_scene"],
        api_base_url=required["api_base_url"],
        timeout_seconds=getattr(settings, "WALLET_WECHAT_TIMEOUT_SECONDS", 8),
        query_retry_minutes=getattr(settings, "WALLET_WECHAT_QUERY_RETRY_MINUTES", 10),
        query_max_retries=getattr(settings, "WALLET_WECHAT_QUERY_MAX_RETRIES", 6),
        cert_refresh_seconds=getattr(settings, "WALLET_WECHAT_CERT_REFRESH_SECONDS", 3600),
    )


def parse_wechat_callback_resource(resource: dict) -> WechatCallbackResult:
    state = resource.get("state", "")
    callback_status = "success" if state == "SUCCESS" else "failed"
    return WechatCallbackResult(
        out_trade_no=resource.get("out_bill_no", ""),
        provider_trade_no=resource.get("transfer_bill_no", ""),
        callback_status=callback_status,
        response_payload={"state": state},
    )
