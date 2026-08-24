import base64
from datetime import timedelta
from unittest.mock import Mock, patch

from django.test import override_settings
from django.utils import timezone

import pytest

from apps.base.exceptions import ConflictException
from apps.payments.constants import PaymentMode, PayoutStatus
from apps.payments.exceptions import PaymentConfigurationException
from apps.payments.services import create_payment, create_payout, mark_payment_succeeded, start_checkout
from apps.payments.wechat import build_wechat_config


def _base64_pem(value: str) -> str:
    return base64.b64encode(value.encode()).decode()


@pytest.mark.django_db
def test_create_payment_records_a_generic_business_reference():
    payment = create_payment(
        biz_type="subscriptions.saas_order",
        biz_id="42",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    assert payment.biz_type == "subscriptions.saas_order"
    assert payment.biz_id == "42"
    assert payment.amount == 29900
    assert payment.description == "专业版月付"


@pytest.mark.django_db
@override_settings(PAYMENTS_TEST_AMOUNT_CENTS=1)
def test_create_payment_uses_configured_test_amount():
    payment = create_payment(
        biz_type="subscriptions.saas_order",
        biz_id="test-one-cent",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )

    assert payment.amount == 1


@pytest.mark.django_db
@override_settings(
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="1900000109",
    PAYMENTS_WECHAT_NATIVE_APP_ID="wx-native",
    PAYMENTS_WECHAT_SERIAL_NO="serial-1",
    PAYMENTS_WECHAT_PRIVATE_KEY=_base64_pem("private-key"),
    PAYMENTS_WECHAT_PLATFORM_CERT=_base64_pem("platform-cert"),
    PAYMENTS_WECHAT_API_V3_KEY="v3-key",
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="https://example.com/api/payments/wechat/notify/",
)
def test_start_checkout_persists_native_checkout_response():
    payment = create_payment(
        biz_type="subscriptions.saas_order",
        biz_id="43",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )
    client = Mock()
    client.create_native_payment.return_value = {
        "code_url": "weixin://wxpay/bizpayurl?pr=test",
        "request_snapshot": {"out_trade_no": payment.transaction_no},
        "response_snapshot": {"code_url": "weixin://wxpay/bizpayurl?pr=test"},
    }

    with patch("apps.payments.services.WechatPayClient", return_value=client):
        checkout = start_checkout(payment=payment)

    payment.refresh_from_db()
    assert checkout["code_url"].startswith("weixin://")
    assert payment.response_snapshot["code_url"].startswith("weixin://")


@override_settings(
    PAYMENTS_WECHAT_PAY_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="1900000109",
    PAYMENTS_WECHAT_NATIVE_APP_ID="wx-native",
    PAYMENTS_WECHAT_SERIAL_NO="serial-1",
    PAYMENTS_WECHAT_PRIVATE_KEY=_base64_pem("private-key"),
    PAYMENTS_WECHAT_PLATFORM_CERT=_base64_pem("platform-cert"),
    PAYMENTS_WECHAT_API_V3_KEY="v3-key",
    PAYMENTS_WECHAT_PAYMENT_NOTIFY_URL="https://example.com/api/payments/wechat/notify/",
)
def test_wechat_config_decodes_base64_certificates():
    config = build_wechat_config(purpose="payment", payment_mode=PaymentMode.NATIVE)

    assert config.private_key == "private-key"
    assert config.platform_cert == "platform-cert"


@pytest.mark.django_db
def test_mark_payment_succeeded_allows_other_business_types():
    payment = create_payment(
        biz_type="test.order",
        biz_id="44",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )
    result = mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wx-trade-1", callback_event_id="event-1")

    assert result.status == "succeeded"


@pytest.mark.django_db
def test_mark_payment_succeeded_rejects_reused_provider_trade_no():
    first = create_payment(
        biz_type="test.order",
        biz_id="45",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )
    second = create_payment(
        biz_type="test.order",
        biz_id="46",
        amount=29900,
        description="专业版月付",
        payment_mode=PaymentMode.NATIVE,
        expires_at=timezone.now() + timedelta(minutes=30),
    )
    mark_payment_succeeded(transaction_no=first.transaction_no, provider_trade_no="wx-trade-1", callback_event_id="event-1")

    with pytest.raises(ConflictException):
        mark_payment_succeeded(transaction_no=second.transaction_no, provider_trade_no="wx-trade-1", callback_event_id="event-2")


@override_settings(
    PAYMENTS_WECHAT_PAY_ENABLED=False,
    SUBSCRIPTIONS_WECHAT_PAY_ENABLED=True,
    SUBSCRIPTIONS_WECHAT_MCH_ID="1900000109",
    SUBSCRIPTIONS_WECHAT_NATIVE_APP_ID="wx-legacy",
    SUBSCRIPTIONS_WECHAT_SERIAL_NO="serial-1",
    SUBSCRIPTIONS_WECHAT_PRIVATE_KEY="private-key",
    SUBSCRIPTIONS_WECHAT_PLATFORM_CERT="platform-cert",
    SUBSCRIPTIONS_WECHAT_API_V3_KEY="v3-key",
    SUBSCRIPTIONS_WECHAT_NOTIFY_URL="https://example.com/api/payments/wechat/notify/",
)
def test_payment_config_does_not_fallback_to_subscription_settings():
    with pytest.raises(PaymentConfigurationException):
        build_wechat_config(purpose="payment", payment_mode=PaymentMode.NATIVE)


@pytest.mark.django_db
@override_settings(
    PAYMENTS_WECHAT_PAYOUT_ENABLED=True,
    PAYMENTS_WECHAT_MCH_ID="1900000109",
    PAYMENTS_WECHAT_SERIAL_NO="serial-1",
    PAYMENTS_WECHAT_PRIVATE_KEY=_base64_pem("private-key"),
    PAYMENTS_WECHAT_PLATFORM_CERT=_base64_pem("platform-cert"),
    PAYMENTS_WECHAT_PAYOUT_APP_ID="wx-payout",
    PAYMENTS_WECHAT_PAYOUT_NOTIFY_URL="https://example.com/api/payments/wechat/payout/notify/",
)
def test_create_payout_submits_a_wechat_transfer():
    client = Mock()
    client.create_payout.return_value = {
        "accepted": True,
        "provider_trade_no": "wx-transfer-1",
        "request_snapshot": {"out_bill_no": "payout-1"},
        "response_snapshot": {"state": "ACCEPTED"},
    }

    with patch("apps.payments.services.WechatPayClient", return_value=client):
        payout = create_payout(
            biz_type="wallet.withdrawal",
            biz_id="1",
            amount=900,
            payee_snapshot={"channel": "wechat", "openid": "openid-1"},
            idempotency_key="payout-1",
            out_trade_no="payout-1",
        )

    assert payout.status == PayoutStatus.PROCESSING
    assert payout.provider_trade_no == "wx-transfer-1"
