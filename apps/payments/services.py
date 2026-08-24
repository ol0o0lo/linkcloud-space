import secrets

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.payments.constants import PaymentStatus, PayoutStatus
from apps.payments.exceptions import PaymentCallbackConflictException, PaymentConfigurationException
from apps.payments.models import PaymentTransaction, PayoutTransaction
from apps.payments.wechat import WechatPayClient, build_wechat_config


def _next_payment_no() -> str:
    return f"P{timezone.now():%Y%m%d%H%M%S}{secrets.token_hex(5).upper()}"


def checkout_amount(amount: int) -> int:
    test_amount = settings.PAYMENTS_TEST_AMOUNT_CENTS
    return test_amount if test_amount > 0 else amount


def create_payment(*, biz_type: str, biz_id: str, amount: int, description: str, payment_mode: str, expires_at) -> PaymentTransaction:
    amount = checkout_amount(amount)
    if amount <= 0:
        raise ValueError("支付金额必须大于零。")
    payment, _ = PaymentTransaction.objects.get_or_create(
        biz_type=biz_type,
        biz_id=str(biz_id),
        defaults={
            "transaction_no": _next_payment_no(),
            "amount": amount,
            "description": description,
            "payment_mode": payment_mode,
            "expires_at": expires_at,
        },
    )
    return payment


def get_payment(*, biz_type: str, biz_id: str) -> PaymentTransaction | None:
    return PaymentTransaction.objects.filter(biz_type=biz_type, biz_id=str(biz_id)).first()


@transaction.atomic
def start_checkout(*, payment: PaymentTransaction, openid: str = "") -> dict:
    payment = PaymentTransaction.objects.select_for_update().get(pk=payment.pk)
    if payment.status != PaymentStatus.PENDING or payment.expires_at <= timezone.now():
        raise ValueError("当前支付交易不能再次发起支付。")
    client = WechatPayClient(build_wechat_config(purpose="payment", payment_mode=payment.payment_mode))
    if payment.payment_mode == "native":
        checkout = client.create_native_payment(payment)
    elif payment.payment_mode == "miniprogram":
        if not openid:
            raise ValueError("小程序支付前请先绑定有效的微信小程序账号。")
        checkout = client.create_miniprogram_payment(payment, openid=openid)
    else:
        raise PaymentConfigurationException("不支持的微信支付方式。")
    payment.request_snapshot = checkout.get("request_snapshot", {"out_trade_no": payment.transaction_no, "amount": {"total": payment.amount}})
    payment.response_snapshot = checkout.get("response_snapshot", {})
    payment.save(update_fields=["request_snapshot", "response_snapshot", "updated_at"])
    return {key: value for key, value in checkout.items() if key not in {"request_snapshot", "response_snapshot"}}


def close_payment(payment: PaymentTransaction) -> None:
    WechatPayClient(build_wechat_config(purpose="payment")).close_payment(payment)


def create_payout(*, biz_type: str, biz_id: str, amount: int, payee_snapshot: dict, idempotency_key: str, out_trade_no: str) -> PayoutTransaction:
    if amount <= 0:
        raise ValueError("出款金额必须大于零。")
    payout, created = PayoutTransaction.objects.get_or_create(
        idempotency_key=idempotency_key,
        defaults={
            "biz_type": biz_type,
            "biz_id": str(biz_id),
            "amount": amount,
            "payee_snapshot": payee_snapshot,
            "out_trade_no": out_trade_no,
        },
    )
    if not created:
        return payout

    result = WechatPayClient(build_wechat_config(purpose="payout")).create_payout(payout)
    payout.provider_trade_no = result.get("provider_trade_no", "")
    payout.request_snapshot = result.get("request_snapshot", {})
    payout.response_snapshot = result.get("response_snapshot", {})
    payout.error_code = result.get("error_code", "")
    payout.error_message = result.get("error_message", "")
    payout.executed_at = timezone.now()
    payout.status = PayoutStatus.PROCESSING if result["accepted"] else PayoutStatus.FAILED
    payout.save(
        update_fields=[
            "provider_trade_no",
            "request_snapshot",
            "response_snapshot",
            "error_code",
            "error_message",
            "executed_at",
            "status",
            "updated_at",
        ]
    )
    if payout.status == PayoutStatus.FAILED:
        from apps.payments.signals import payout_failed

        payout_failed.send(sender=PayoutTransaction, payout=payout)
    return payout


def query_payout(payout: PayoutTransaction) -> PayoutTransaction:
    if payout.status not in {PayoutStatus.PENDING, PayoutStatus.PROCESSING}:
        return payout
    result = WechatPayClient(build_wechat_config(purpose="payout")).query_payout(payout)
    if result["status"] == "processing":
        return payout
    return mark_payout_result(
        provider=payout.provider,
        out_trade_no=payout.out_trade_no,
        provider_trade_no=result["provider_trade_no"],
        succeeded=result["status"] == "succeeded",
        response_snapshot=result["response_snapshot"],
    )


@transaction.atomic
def mark_payment_succeeded(*, transaction_no: str, provider_trade_no: str, callback_event_id: str, response_snapshot: dict | None = None) -> PaymentTransaction:
    from apps.payments.signals import payment_succeeded

    payment = PaymentTransaction.objects.select_for_update().get(transaction_no=transaction_no)
    if payment.callback_event_id == callback_event_id or (payment.status == PaymentStatus.SUCCEEDED and payment.provider_trade_no == provider_trade_no):
        return payment
    payment.provider_trade_no = provider_trade_no
    payment.callback_event_id = callback_event_id
    payment.status = PaymentStatus.SUCCEEDED
    payment.paid_at = timezone.now()
    payment.response_snapshot = response_snapshot or {}
    try:
        payment.save(update_fields=["provider_trade_no", "callback_event_id", "status", "paid_at", "response_snapshot", "updated_at"])
    except IntegrityError as exc:
        raise PaymentCallbackConflictException() from exc
    payment_succeeded.send(sender=PaymentTransaction, payment=payment)
    return payment


@transaction.atomic
def mark_payout_result(*, provider: str, out_trade_no: str, provider_trade_no: str, succeeded: bool, response_snapshot: dict) -> PayoutTransaction:
    from apps.payments.signals import payout_failed, payout_succeeded

    payout = PayoutTransaction.objects.select_for_update().get(provider=provider, out_trade_no=out_trade_no)
    if payout.status == PayoutStatus.SUCCEEDED and succeeded:
        return payout
    if payout.status == PayoutStatus.FAILED and not succeeded:
        return payout
    if payout.status not in {PayoutStatus.PENDING, PayoutStatus.PROCESSING}:
        raise ValueError("当前出款交易不能接收结果。")
    payout.provider_trade_no = provider_trade_no
    payout.response_snapshot = response_snapshot
    payout.status = PayoutStatus.SUCCEEDED if succeeded else PayoutStatus.FAILED
    payout.save(update_fields=["provider_trade_no", "response_snapshot", "status", "updated_at"])
    (payout_succeeded if succeeded else payout_failed).send(sender=PayoutTransaction, payout=payout)
    return payout
