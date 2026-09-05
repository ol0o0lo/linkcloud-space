import logging

from django.utils import timezone

from celery import shared_task

from apps.payments.services import close_payment, get_payment
from apps.subscriptions.models import SaaSOrder
from apps.subscriptions.services import close_expired_orders, expire_subscriptions

logger = logging.getLogger(__name__)


@shared_task
def close_saas_order_in_wechat_task(order_id: int) -> None:
    """关闭被替代、超时或由用户取消的微信订单。"""
    payment = get_payment(biz_type="subscriptions.saas_order", biz_id=str(order_id))
    if payment is not None:
        close_payment(payment)


@shared_task
def close_expired_saas_orders_task() -> int:
    """关闭超时订单，并尽力向微信同步关单；数据库状态始终以本地事务为准。"""
    for order_id in SaaSOrder.objects.filter(status="pending_payment", expires_at__lte=timezone.now()).values_list("pk", flat=True):
        try:
            close_saas_order_in_wechat_task(order_id)
        except Exception:  # noqa: BLE001 - 后台重试不应阻塞其他超时订单的本地关闭
            logger.warning("关闭微信 SaaS 订单失败：%s", order_id, exc_info=True)
    return close_expired_orders()


@shared_task
def expire_saas_subscriptions_task() -> int:
    """将试用和付费订阅到期状态回落为 ended，权益服务随即返回免费版。"""
    return expire_subscriptions()
