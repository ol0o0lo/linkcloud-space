import base64
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.test import override_settings

from apps.payments.checks import check_payment_settings


@override_settings(DEBUG=False, PAYMENTS_TEST_AMOUNT_CENTS=1, PAYMENTS_WECHAT_PAY_ENABLED=False)
def test_production_rejects_test_checkout_amount():
    errors = check_payment_settings(None)

    assert {error.id for error in errors} == {"payments.E001"}


@override_settings(
    DEBUG=False,
    PAYMENTS_TEST_AMOUNT_CENTS=0,
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="",
    PAYMENTS_WECHAT_SERIAL_NO="",
    PAYMENTS_WECHAT_PRIVATE_KEY="",
    PAYMENTS_WECHAT_PLATFORM_CERT="",
    PAYMENTS_WECHAT_API_V3_KEY="",
    PAYMENTS_WECHAT_NATIVE_APP_ID="",
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="http://billing.example.com/api/payments/wechat/notify/",
)
def test_production_requires_complete_wechat_checkout_and_https_callback():
    errors = check_payment_settings(None)

    assert {error.id for error in errors} == {"payments.E002", "payments.E003"}


@override_settings(
    DEBUG=True,
    PAYMENTS_TEST_AMOUNT_CENTS=1,
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="http://localhost/api/payments/wechat/notify/",
)
def test_development_allows_test_amount_and_http_callback():
    assert check_payment_settings(None) == []


@override_settings(
    DEBUG=False,
    PAYMENTS_TEST_AMOUNT_CENTS=0,
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="1900000109",
    PAYMENTS_WECHAT_SERIAL_NO="serial-1",
    PAYMENTS_WECHAT_PRIVATE_KEY=base64.b64encode(b"private-key").decode(),
    PAYMENTS_WECHAT_PLATFORM_CERT=base64.b64encode(b"platform-cert").decode(),
    PAYMENTS_WECHAT_API_V3_KEY="short-key",
    PAYMENTS_WECHAT_NATIVE_APP_ID="wx-native",
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="https://billing.example.com/api/payments/wechat/notify/",
)
@patch(
    "apps.payments.checks.load_pem_x509_certificate",
    return_value=SimpleNamespace(not_valid_after_utc=datetime.now(UTC) - timedelta(minutes=1)),
)
def test_production_rejects_expired_platform_certificate_and_invalid_api_v3_key(_load_certificate):
    errors = check_payment_settings(None)

    assert {error.id for error in errors} == {"payments.E005", "payments.E006"}


@override_settings(
    DEBUG=False,
    PAYMENTS_TEST_AMOUNT_CENTS=0,
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="1900000109",
    PAYMENTS_WECHAT_SERIAL_NO="serial-1",
    PAYMENTS_WECHAT_PRIVATE_KEY=base64.b64encode(b"private-key").decode(),
    PAYMENTS_WECHAT_PLATFORM_CERT="not-base64",
    PAYMENTS_WECHAT_API_V3_KEY="x" * 32,
    PAYMENTS_WECHAT_NATIVE_APP_ID="wx-native",
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="https://billing.example.com/api/payments/wechat/notify/",
)
def test_production_rejects_malformed_platform_certificate():
    errors = check_payment_settings(None)

    assert {error.id for error in errors} == {"payments.E004"}
