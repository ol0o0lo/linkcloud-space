from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

import pytest
from model_bakery import baker

from apps.notifications.models import Notification
from apps.payments.exceptions import PaymentConfigurationException
from apps.subscriptions.tasks import close_expired_saas_orders_task, close_saas_order_in_wechat_task, send_subscription_lifecycle_notifications


def test_close_wechat_order_task_retries_channel_failures():
    assert PaymentConfigurationException in close_saas_order_in_wechat_task.autoretry_for
    assert close_saas_order_in_wechat_task.max_retries >= 3


@pytest.mark.django_db
def test_close_wechat_order_task_skips_non_pending_payment():
    order = baker.make("subscriptions.SaaSOrder")
    baker.make(
        "payments.PaymentTransaction",
        biz_type="subscriptions.saas_order",
        biz_id=str(order.pk),
        status="succeeded",
    )

    with patch("apps.subscriptions.tasks.close_payment") as close_payment:
        close_saas_order_in_wechat_task(order.pk)

    close_payment.assert_not_called()


def test_expiry_sweep_reconciles_active_pending_orders_before_closing_expired_orders():
    with (
        patch("apps.subscriptions.tasks.reconcile_pending_saas_order_payments", create=True, return_value=2) as reconcile,
        patch("apps.subscriptions.tasks.close_expired_orders", return_value=1) as close,
    ):
        result = close_expired_saas_orders_task()

    reconcile.assert_called_once_with()
    close.assert_called_once_with()
    assert result == 1


@pytest.mark.django_db
def test_subscription_expiry_notifications_are_required_and_deduplicated():
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    subscription = baker.make(
        "subscriptions.Subscription",
        organization=organization,
        status="active",
        ends_at=timezone.now() + timedelta(days=10),
    )

    assert send_subscription_lifecycle_notifications() == 1
    assert send_subscription_lifecycle_notifications() == 0
    notification = Notification.objects.get(recipient=owner, category="subscription.billing")
    assert notification.data == {"event": "expiring", "ends_at": subscription.ends_at.isoformat()}


@pytest.mark.django_db
def test_expired_subscription_notifies_owner_once():
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    subscription = baker.make(
        "subscriptions.Subscription",
        organization=organization,
        status="active",
        ends_at=timezone.now() - timedelta(minutes=1),
    )

    assert send_subscription_lifecycle_notifications() == 1
    assert send_subscription_lifecycle_notifications() == 0
    notification = Notification.objects.get(recipient=owner, category="subscription.billing")
    assert notification.title == "订阅已到期"
    assert notification.data == {"event": "expired", "ends_at": subscription.ends_at.isoformat()}
