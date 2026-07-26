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

from apps.payments.exceptions import PaymentConfigurationException


@dataclass(slots=True)
class WechatConfig:
    mch_id: str
    serial_no: str
    private_key: str
    platform_cert: str
    api_v3_key: str
    api_base_url: str
    timeout_seconds: int
    native_app_id: str = ""
    miniprogram_app_id: str = ""
    payment_notify_url: str = ""
    payout_app_id: str = ""
    payout_notify_url: str = ""
    transfer_scene: str = ""


def _value(name: str, default=""):
    return getattr(settings, name, default)


def is_wechat_checkout_enabled() -> bool:
    return bool(_value("PAYMENTS_WECHAT_PAY_ENABLED"))


def is_wechat_payout_enabled() -> bool:
    return bool(_value("PAYMENTS_WECHAT_PAYOUT_ENABLED"))


def build_wechat_config(*, purpose: str, payment_mode: str = "") -> WechatConfig:
    common = {
        "mch_id": _value("PAYMENTS_WECHAT_MCH_ID"),
        "serial_no": _value("PAYMENTS_WECHAT_SERIAL_NO"),
        "private_key": _value("PAYMENTS_WECHAT_PRIVATE_KEY"),
        "platform_cert": _value("PAYMENTS_WECHAT_PLATFORM_CERT"),
        "api_v3_key": _value("PAYMENTS_WECHAT_API_V3_KEY"),
        "api_base_url": _value("PAYMENTS_WECHAT_API_BASE_URL", "https://api.mch.weixin.qq.com"),
        "timeout_seconds": _value("PAYMENTS_WECHAT_TIMEOUT_SECONDS", 8),
    }
    config = WechatConfig(
        **common,
        native_app_id=_value("PAYMENTS_WECHAT_NATIVE_APP_ID"),
        miniprogram_app_id=_value("PAYMENTS_WECHAT_MINIPROGRAM_APP_ID"),
        payment_notify_url=_value("PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL"),
        payout_app_id=_value("PAYMENTS_WECHAT_PAYOUT_APP_ID"),
        payout_notify_url=_value("PAYMENTS_WECHAT_PAYOUT_NOTIFY_URL"),
        transfer_scene=_value("PAYMENTS_WECHAT_TRANSFER_SCENE"),
    )
    enabled = is_wechat_checkout_enabled() if purpose == "payment" else is_wechat_payout_enabled()
    required = [config.mch_id, config.serial_no, config.private_key, config.platform_cert, config.api_base_url]
    if purpose == "payment":
        required += [config.api_v3_key, config.payment_notify_url]
        if payment_mode == "native":
            required.append(config.native_app_id)
        elif payment_mode == "miniprogram":
            required.append(config.miniprogram_app_id)
    else:
        required += [config.payout_app_id, config.payout_notify_url, config.transfer_scene]
    if not enabled or any(not value for value in required):
        raise PaymentConfigurationException("微信支付配置不完整。")
    return config


class WechatPayClient:
    callback_signature_type = "WECHATPAY2-SHA256-RSA2048"
    user_agent = "linkcloud-payments/1.0"

    def __init__(self, config: WechatConfig, session: requests.Session | None = None):
        self.config = config
        self.session = session or requests.Session()
        self.private_key = serialization.load_pem_private_key(config.private_key.encode(), password=None)
        self.platform_certificate = load_pem_x509_certificate(config.platform_cert.encode())

    def create_native_payment(self, payment) -> dict:
        payload = self._payment_payload(payment=payment, app_id=self.config.native_app_id)
        result = self._request_json("POST", "/v3/pay/transactions/native", payload)
        if not result["ok"] or not result["body"].get("code_url"):
            raise PaymentConfigurationException(result["body"].get("message", "微信 Native 下单失败。"))
        return {"code_url": result["body"]["code_url"], "request_snapshot": payload, "response_snapshot": result["body"]}

    def create_miniprogram_payment(self, payment, *, openid: str) -> dict:
        payload = self._payment_payload(payment=payment, app_id=self.config.miniprogram_app_id)
        payload["payer"] = {"openid": openid}
        result = self._request_json("POST", "/v3/pay/transactions/jsapi", payload)
        prepay_id = result["body"].get("prepay_id", "")
        if not result["ok"] or not prepay_id:
            raise PaymentConfigurationException(result["body"].get("message", "微信小程序下单失败。"))
        timestamp = str(int(time.time()))
        nonce = uuid.uuid4().hex
        package = f"prepay_id={prepay_id}"
        message = f"{self.config.miniprogram_app_id}\n{timestamp}\n{nonce}\n{package}\n".encode()
        pay_sign = base64.b64encode(self.private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())).decode()
        return {
            "payment_params": {"timeStamp": timestamp, "nonceStr": nonce, "package": package, "signType": "RSA", "paySign": pay_sign},
            "request_snapshot": payload,
            "response_snapshot": result["body"],
        }

    def close_payment(self, payment) -> None:
        result = self._request_json(
            "POST",
            f"/v3/pay/transactions/out-trade-no/{payment.transaction_no}/close",
            {"mchid": self.config.mch_id},
        )
        if not result["ok"] and result["body"].get("code") not in {"ORDERNOTEXIST", "ORDERCLOSED"}:
            raise PaymentConfigurationException(result["body"].get("message", "微信关单失败。"))

    def create_payout(self, payout) -> dict:
        snapshot = payout.payee_snapshot
        openid = snapshot.get("openid", "")
        if snapshot.get("channel") != "wechat" or not openid:
            raise PaymentConfigurationException("微信提现收款方信息不完整。")
        payload = {
            "appid": self.config.payout_app_id,
            "out_bill_no": payout.out_trade_no,
            "transfer_scene_id": self.config.transfer_scene,
            "openid": openid,
            "user_name": snapshot.get("receiver_name", ""),
            "transfer_amount": payout.amount,
            "notify_url": self.config.payout_notify_url,
            "transfer_remark": f"{payout.biz_type}-{payout.biz_id}",
        }
        result = self._request_json("POST", "/v3/fund-app/mch-transfer/transfer-bills", payload)
        body = result["body"]
        return {
            "accepted": result["ok"],
            "provider_trade_no": body.get("transfer_bill_no", ""),
            "request_snapshot": payload,
            "response_snapshot": body,
            "error_code": body.get("code", ""),
            "error_message": body.get("message", body.get("detail", "")),
        }

    def query_payout(self, payout) -> dict:
        result = self._request_json("GET", f"/v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{payout.out_trade_no}")
        state = result["body"].get("state", "")
        return {
            "status": "succeeded" if state == "SUCCESS" else "failed" if state in {"FAILED", "CANCELLED"} else "processing",
            "provider_trade_no": result["body"].get("transfer_bill_no", ""),
            "response_snapshot": result["body"],
        }

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

    def parse_payment_callback(self, *, raw_body: str) -> dict:
        resource = self._callback_resource(raw_body)
        if resource.get("trade_state") != "SUCCESS":
            raise PaymentConfigurationException("微信支付回调不是成功状态。")
        return {
            "transaction_no": resource.get("out_trade_no", ""),
            "provider_trade_no": resource.get("transaction_id", ""),
            "callback_event_id": json.loads(raw_body).get("id") or resource.get("transaction_id", ""),
            "response_snapshot": {"trade_state": resource.get("trade_state"), "trade_state_desc": resource.get("trade_state_desc", "")},
        }

    def parse_payout_callback(self, *, raw_body: str) -> dict:
        resource = self._callback_resource(raw_body)
        return {
            "out_trade_no": resource.get("out_bill_no", ""),
            "provider_trade_no": resource.get("transfer_bill_no", ""),
            "succeeded": resource.get("state") == "SUCCESS",
            "response_snapshot": {"state": resource.get("state", "")},
        }

    def _payment_payload(self, *, payment, app_id: str) -> dict:
        return {
            "appid": app_id,
            "mchid": self.config.mch_id,
            "description": payment.description,
            "out_trade_no": payment.transaction_no,
            "notify_url": self.config.payment_notify_url,
            "amount": {"total": payment.amount, "currency": "CNY"},
        }

    def _callback_resource(self, raw_body: str) -> dict:
        payload = json.loads(raw_body)
        resource = payload.get("resource", {})
        if payload.get("resource_type") == "encrypt-resource":
            resource = json.loads(
                AESGCM(self.config.api_v3_key.encode())
                .decrypt(
                    resource["nonce"].encode(),
                    base64.b64decode(resource["ciphertext"]),
                    resource.get("associated_data", "").encode(),
                )
                .decode()
            )
        return resource

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
        signature = base64.b64encode(self.private_key.sign(message, padding.PKCS1v15(), hashes.SHA256())).decode()
        authorization = (
            f'WECHATPAY2-SHA256-RSA2048 mchid="{self.config.mch_id}",nonce_str="{nonce}",signature="{signature}",timestamp="{timestamp}",serial_no="{self.config.serial_no}"'
        )
        return {"Accept": "application/json", "Authorization": authorization, "Content-Type": "application/json", "User-Agent": self.user_agent}

    @staticmethod
    def _header(headers: dict, name: str) -> str:
        variants = {name, name.lower(), name.upper(), f"HTTP_{name.upper().replace('-', '_')}"}
        for key, value in headers.items():
            if key in variants:
                return value
        return ""
