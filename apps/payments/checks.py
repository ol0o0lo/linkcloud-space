import base64
import binascii
from datetime import UTC, datetime
from urllib.parse import urlsplit

from django.conf import settings
from django.core.checks import Error, Tags, register

from cryptography.x509 import load_pem_x509_certificate


@register(Tags.security)
def check_payment_settings(app_configs, **kwargs):
    if settings.DEBUG:
        return []

    errors = []
    if settings.PAYMENTS_TEST_AMOUNT_CENTS > 0:
        errors.append(
            Error(
                "生产环境不能启用支付测试金额。",
                hint="将 PAYMENTS_TEST_AMOUNT_CENTS 设置为 0。",
                id="payments.E001",
            )
        )
    if not settings.PAYMENTS_WECHAT_PAY_ENABLED:
        return errors

    required_settings = {
        "PAYMENTS_WECHAT_MCH_ID": settings.PAYMENTS_WECHAT_MCH_ID,
        "PAYMENTS_WECHAT_SERIAL_NO": settings.PAYMENTS_WECHAT_SERIAL_NO,
        "PAYMENTS_WECHAT_PRIVATE_KEY": settings.PAYMENTS_WECHAT_PRIVATE_KEY,
        "PAYMENTS_WECHAT_PLATFORM_CERT": settings.PAYMENTS_WECHAT_PLATFORM_CERT,
        "PAYMENTS_WECHAT_API_V3_KEY": settings.PAYMENTS_WECHAT_API_V3_KEY,
        "PAYMENTS_WECHAT_NATIVE_APP_ID": settings.PAYMENTS_WECHAT_NATIVE_APP_ID,
        "PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL": settings.PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL,
    }
    missing = [name for name, value in required_settings.items() if not value]
    if missing:
        errors.append(
            Error(
                "生产环境微信收款配置不完整。",
                hint=f"补齐配置：{', '.join(missing)}。",
                id="payments.E002",
            )
        )
    notify_url = settings.PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL
    if notify_url and urlsplit(notify_url).scheme.lower() != "https":
        errors.append(
            Error(
                "生产环境微信支付回调地址必须使用 HTTPS。",
                hint="将 PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL 配置为公网 HTTPS 地址。",
                id="payments.E003",
            )
        )
    platform_cert = settings.PAYMENTS_WECHAT_PLATFORM_CERT
    if platform_cert:
        try:
            certificate = load_pem_x509_certificate(base64.b64decode(platform_cert, validate=True))
        except (binascii.Error, ValueError):
            errors.append(
                Error(
                    "生产环境微信支付平台证书格式无效。",
                    hint="将 PAYMENTS_WECHAT_PLATFORM_CERT 配置为有效平台证书 PEM 的 Base64 内容。",
                    id="payments.E004",
                )
            )
        else:
            expires_at = getattr(certificate, "not_valid_after_utc", None)
            if expires_at is None:
                expires_at = certificate.not_valid_after.replace(tzinfo=UTC)
            if expires_at <= datetime.now(UTC):
                errors.append(
                    Error(
                        "生产环境微信支付平台证书已过期。",
                        hint="更新 PAYMENTS_WECHAT_PLATFORM_CERT 后再启用收款。",
                        id="payments.E005",
                    )
                )
    api_v3_key = settings.PAYMENTS_WECHAT_API_V3_KEY
    if api_v3_key and len(api_v3_key.encode()) != 32:
        errors.append(
            Error(
                "生产环境微信支付 API v3 密钥长度无效。",
                hint="PAYMENTS_WECHAT_API_V3_KEY 必须是 32 字节密钥。",
                id="payments.E006",
            )
        )
    return errors
