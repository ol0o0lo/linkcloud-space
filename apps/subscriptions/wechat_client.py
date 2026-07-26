import base64
import json
import time
import uuid
from dataclasses import dataclass

from django.conf import settings

import requests
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.x509 import load_pem_x509_certificate

from apps.subscriptions.exceptions import PaymentConfigurationException


@dataclass(slots=True)
class WechatCheckoutConfig:
    mch_id: str
    native_app_id: str
    miniprogram_app_id: str
    serial_no: str
    private_key: str
    platform_cert: str
    api_v3_key: str
    notify_url: str
    api_base_url: str
    timeout_seconds: int


class WechatCheckoutClient:
    callback_signature_type = "WECHATPAY2-SHA256-RSA2048"
    user_agent = "linkcloud-subscriptions/1.0"

    def __init__(self, config: WechatCheckoutConfig | None = None, session: requests.Session | None = None):
        self.config = config or build_wechat_checkout_config()
        self.session = session or requests.Session()
        self.private_key = serialization.load_pem_private_key(self.config.private_key.encode("utf-8"), password=None)
        self.platform_certificate = load_pem_x509_certificate(self.config.platform_cert.encode("utf-8"))

    def create_native_order(self, *, order) -> dict:
        request_payload = self._base_order_payload(order=order, app_id=self.config.native_app_id)
        result = self._request_json("POST", "/v3/pay/transactions/native", request_payload)
        if not result["ok"] or not result["body"].get("code_url"):
            raise PaymentConfigurationException(result["body"].get("message", "微信 Native 下单失败。"))
        return {"code_url": result["body"]["code_url"], "request_snapshot": request_payload, "response_snapshot": result["body"]}

    def create_miniprogram_order(self, *, order, openid: str) -> dict:
        request_payload = self._base_order_payload(order=order, app_id=self.config.miniprogram_app_id)
        request_payload["payer"] = {"openid": openid}
        result = self._request_json("POST", "/v3/pay/transactions/jsapi", request_payload)
        prepay_id = result["body"].get("prepay_id", "")
        if not result["ok"] or not prepay_id:
            raise PaymentConfigurationException(result["body"].get("message", "微信小程序下单失败。"))
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex
        package = f"prepay_id={prepay_id}"
        pay_sign = self._sign_miniprogram_payment(timestamp=timestamp, nonce=nonce, package=package)
        return {
            "payment_params": {"timeStamp": timestamp, "nonceStr": nonce, "package": package, "signType": "RSA", "paySign": pay_sign},
            "request_snapshot": request_payload,
            "response_snapshot": result["body"],
        }

    def close_order(self, *, order_no: str) -> None:
        result = self._request_json("POST", f"/v3/pay/transactions/out-trade-no/{order_no}/close", {"mchid": self.config.mch_id})
        if not result["ok"] and result["body"].get("code") not in {"ORDERNOTEXIST", "ORDERCLOSED"}:
            raise PaymentConfigurationException(result["body"].get("message", "微信关单失败。"))

    def verify_callback(self, *, headers: dict, raw_body: str) -> bool:
        signature = self._header(headers, "Wechatpay-Signature")
        timestamp = self._header(headers, "Wechatpay-Timestamp")
        nonce = self._header(headers, "Wechatpay-Nonce")
        serial = self._header(headers, "Wechatpay-Serial")
        signature_type = self._header(headers, "Wechatpay-Signature-Type") or self.callback_signature_type
        if not all([signature, timestamp, nonce, serial]) or signature_type != self.callback_signature_type:
            return False
        if serial.upper() != format(self.platform_certificate.serial_number, "X"):
            return False
        message = f"{timestamp}\n{nonce}\n{raw_body}\n".encode()
        try:
            self.platform_certificate.public_key().verify(base64.b64decode(signature), message, padding.PKCS1v15(), hashes.SHA256())
        except (InvalidSignature, TypeError, ValueError):
            return False
        return True

    def parse_callback(self, *, raw_body: str) -> dict:
        payload = json.loads(raw_body)
        resource = payload.get("resource", {})
        if payload.get("resource_type") == "encrypt-resource":
            resource = self._decrypt_resource(resource)
        if resource.get("trade_state") != "SUCCESS":
            raise PaymentConfigurationException("微信支付回调不是成功状态。")
        return {
            "order_no": resource.get("out_trade_no", ""),
            "provider_trade_no": resource.get("transaction_id", ""),
            "callback_event_id": payload.get("id") or resource.get("transaction_id", ""),
            "response_snapshot": {"trade_state": resource.get("trade_state"), "trade_state_desc": resource.get("trade_state_desc", "")},
        }

    def _base_order_payload(self, *, order, app_id: str) -> dict:
        return {
            "appid": app_id,
            "mchid": self.config.mch_id,
            "description": f"链云空间 {order.plan_snapshot.get('name', 'SaaS 服务')}",
            "out_trade_no": order.order_no,
            "notify_url": self.config.notify_url,
            "amount": {"total": order.payable_amount, "currency": "CNY"},
        }

    def _request_json(self, method: str, path: str, payload: dict | None = None) -> dict:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True) if payload else ""
        response = self.session.request(
            method=method,
            url=f"{self.config.api_base_url.rstrip('/')}{path}",
            data=body or None,
            headers=self._request_headers(method=method, path=path, body=body),
            timeout=self.config.timeout_seconds,
        )
        try:
            response_body = response.json() if response.text else {}
        except ValueError:
            response_body = {}
        return {"ok": 200 <= response.status_code < 300, "body": response_body}

    def _request_headers(self, *, method: str, path: str, body: str) -> dict:
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex.upper()
        message = f"{method}\n{path}\n{timestamp}\n{nonce}\n{body}\n".encode()
        signature = base64.b64encode(self.private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())).decode("utf-8")
        authorization = (
            'WECHATPAY2-SHA256-RSA2048 '
            f'mchid="{self.config.mch_id}",nonce_str="{nonce}",signature="{signature}",timestamp="{timestamp}",serial_no="{self.config.serial_no}"'
        )
        return {"Accept": "application/json", "Authorization": authorization, "Content-Type": "application/json", "User-Agent": self.user_agent}

    def _sign_miniprogram_payment(self, *, timestamp: str, nonce: str, package: str) -> str:
        message = f"{self.config.miniprogram_app_id}\n{timestamp}\n{nonce}\n{package}\n".encode()
        return base64.b64encode(self.private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())).decode("utf-8")

    def _decrypt_resource(self, resource: dict) -> dict:
        plaintext = AESGCM(self.config.api_v3_key.encode("utf-8")).decrypt(
            resource["nonce"].encode("utf-8"), base64.b64decode(resource["ciphertext"]), resource.get("associated_data", "").encode("utf-8")
        )
        return json.loads(plaintext.decode("utf-8"))

    @staticmethod
    def _header(headers: dict, name: str) -> str:
        variants = {name, name.lower(), name.upper(), f"HTTP_{name.upper().replace('-', '_')}"}
        for key, value in headers.items():
            if key in variants:
                return value
        return ""


def is_wechat_checkout_enabled() -> bool:
    return bool(getattr(settings, "SUBSCRIPTIONS_WECHAT_PAY_ENABLED", False))


def build_wechat_checkout_config() -> WechatCheckoutConfig:
    required = {
        "mch_id": getattr(settings, "SUBSCRIPTIONS_WECHAT_MCH_ID", ""),
        "native_app_id": getattr(settings, "SUBSCRIPTIONS_WECHAT_NATIVE_APP_ID", ""),
        "miniprogram_app_id": getattr(settings, "SUBSCRIPTIONS_WECHAT_MINIPROGRAM_APP_ID", ""),
        "serial_no": getattr(settings, "SUBSCRIPTIONS_WECHAT_SERIAL_NO", ""),
        "private_key": getattr(settings, "SUBSCRIPTIONS_WECHAT_PRIVATE_KEY", ""),
        "platform_cert": getattr(settings, "SUBSCRIPTIONS_WECHAT_PLATFORM_CERT", ""),
        "api_v3_key": getattr(settings, "SUBSCRIPTIONS_WECHAT_API_V3_KEY", ""),
        "notify_url": getattr(settings, "SUBSCRIPTIONS_WECHAT_NOTIFY_URL", ""),
    }
    if not is_wechat_checkout_enabled() or any(not value for value in required.values()):
        raise PaymentConfigurationException()
    return WechatCheckoutConfig(
        **required,
        api_base_url=getattr(settings, "SUBSCRIPTIONS_WECHAT_API_BASE_URL", "https://api.mch.weixin.qq.com"),
        timeout_seconds=getattr(settings, "SUBSCRIPTIONS_WECHAT_TIMEOUT_SECONDS", 8),
    )
