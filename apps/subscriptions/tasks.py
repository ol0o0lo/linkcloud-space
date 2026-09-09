from datetime import timedelta

from django.utils import timezone

from celery import shared_task

from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.payments.constants import PaymentStatus
from apps.payments.exceptions import PaymentConfigurationException
from apps.payments.services import close_payment, get_payment
from apps.subscriptions.constants import SubscriptionStatus
from apps.subscriptions.models import Subscription
from apps.subscriptions.services import close_expired_orders, expire_subscriptions, reconcile_pending_saas_order_payments


@shared_task(autoretry_for=(PaymentConfigurationException,), retry_backoff=True, retry_kwargs={"max_retries": 5})
def close_saas_order_in_wechat_task(order_id: int) -> None:
    """关闭被替代、超时或由用户取消的微信订单。"""
    payment = get_payment(biz_type="subscriptions.saas_order", biz_id=str(order_id))
    if payment is not None and payment.status == PaymentStatus.PENDING:
        close_payment(payment)


@shared_task
def close_expired_saas_orders_task() -> int:
    """先恢复回调丢失的支付，再关闭已确认未支付的超时订单。"""
    reconcile_pending_saas_order_payments()
    return close_expired_orders()


@shared_task
def expire_saas_subscriptions_task() -> int:
    """将试用和付费订阅到期状态回落为 ended，权益服务随即返回免费版。"""
    send_subscription_lifecycle_notifications()
    return expire_subscriptions()


def send_subscription_lifecycle_notifications(*, now=None) -> int:
    now = now or timezone.now()
    subscriptions = (
        Subscription.objects.filter(
            status__in=[SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE],
            ends_at__isnull=False,
            ends_at__lte=now + timedelta(days=30),
        )
        .select_related("organization")
        .order_by("ends_at", "pk")
    )
    created = 0
    for subscription in subscriptions:
        event = "expired" if subscription.ends_at <= now else "expiring"
        data = {"event": event, "ends_at": subscription.ends_at.isoformat()}
        existing_recipient_ids = set(
            Notification.objects.filter(
                organization=subscription.organization,
                category="subscription.billing",
                target_object_id=subscription.pk,
                data=data,
            ).values_list("recipient_id", flat=True)
        )
        owners = [
            member.user for member in subscription.organization.organizationmember_set.filter(is_owner=True).select_related("user") if member.user_id not in existing_recipient_ids
        ]
        if not owners:
            continue
        if event == "expired":
            title = "订阅已到期"
            body = "当前付费权益已到期，组织已回落到免费版权益，请及时续费。"
        else:
            title = "订阅即将到期"
            body = f"当前订阅将在 {subscription.ends_at:%Y-%m-%d} 到期，请提前安排续费。"
        created += len(
            notify(
                owners,
                title=title,
                body=body,
                url="/dashboard/space/subscription",
                organization=subscription.organization,
                target=subscription,
                category="subscription.billing",
                data=data,
            )
        )
    return created
