import logging

from django.utils import timezone

from celery import shared_task

from apps.subscriptions.models import SaaSOrder
from apps.subscriptions.services import close_expired_orders, expire_subscriptions, get_wechat_checkout_client
from apps.subscriptions.wechat_client import is_wechat_checkout_enabled

logger = logging.getLogger(__name__)


@shared_task
def close_saas_order_in_wechat_task(order_no: str) -> None:
    """关闭被新二维码替代或超时的微信订单。"""
    if is_wechat_checkout_enabled():
        get_wechat_checkout_client().close_order(order_no=order_no)


@shared_task
def close_expired_saas_orders_task() -> int:
    """关闭超时订单，并尽力向微信同步关单；数据库状态始终以本地事务为准。"""
    if is_wechat_checkout_enabled():
        client = get_wechat_checkout_client()
        for order_no in SaaSOrder.objects.filter(status="pending_payment", expires_at__lte=timezone.now()).values_list("order_no", flat=True):
            try:
                client.close_order(order_no=order_no)
            except Exception:  # noqa: BLE001 - 后台重试不应阻塞其他超时订单的本地关闭
                logger.warning("关闭微信 SaaS 订单失败：%s", order_no, exc_info=True)
    return close_expired_orders()


@shared_task
def expire_saas_subscriptions_task() -> int:
    """将试用和付费订阅到期状态回落为 ended，权益服务随即返回免费版。"""
    return expire_subscriptions()
