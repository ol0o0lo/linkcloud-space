from datetime import timedelta
from unittest.mock import Mock, patch

from django.test import override_settings
from django.utils import timezone

import pytest
from model_bakery import baker

from apps.notifications.models import Notification
from apps.payments.constants import PaymentMode, PaymentStatus
from apps.payments.exceptions import PaymentConfigurationException
from apps.payments.services import mark_payment_succeeded
from apps.subscriptions.constants import BillingCycle, OrderCloseReason, OrderStatus, OrderType, RefundSubscriptionAction, SubscriptionStatus
from apps.subscriptions.entitlements import Entitlement, EntitlementService
from apps.subscriptions.exceptions import SubscriptionRuleException
from apps.subscriptions.models import Plan, PlanEntitlement, PlanPrice, SaaSOrder, Subscription
from apps.subscriptions.services import (
    close_expired_orders,
    create_purchase_order,
    grant_trial,
    initiate_wechat_payment,
    reconcile_pending_saas_order_payments,
    refund_order,
)


@pytest.fixture
def plans(db):
    free = Plan.objects.create(code="free", name="免费版", display_order=10)
    professional = Plan.objects.create(code="professional", name="专业版", display_order=30)
    enterprise = Plan.objects.create(code="enterprise", name="企业版", display_order=40)
    for plan, member_limit, team_limit, house_limit in ((free, 3, 1, 50), (professional, 30, 10, 3000), (enterprise, 100, 30, 20000)):
        PlanEntitlement.objects.create(plan=plan, version=1, is_current=True, member_limit=member_limit, team_limit=team_limit, house_limit=house_limit)
    PlanPrice.objects.create(plan=professional, billing_cycle=BillingCycle.MONTH, version=1, is_current=True, amount=29900)
    PlanPrice.objects.create(plan=professional, billing_cycle=BillingCycle.YEAR, version=1, is_current=True, amount=299900)
    PlanPrice.objects.create(plan=enterprise, billing_cycle=BillingCycle.MONTH, version=1, is_current=True, amount=69900)
    PlanPrice.objects.create(plan=enterprise, billing_cycle=BillingCycle.YEAR, version=1, is_current=True, amount=699900)
    return {"free": free, "professional": professional, "enterprise": enterprise}


def test_grant_trial_keeps_trial_fact_and_applies_professional_entitlement(plans):
    user = baker.make("accounts.User", phone_verified=True)
    organization = baker.make("organizations.Organization", created_by=user)

    subscription = grant_trial(organization=organization, granted_to=user)

    assert subscription.status == SubscriptionStatus.TRIALING
    assert subscription.kind == "trial"
    assert subscription.trial_granted_to == user
    assert subscription.ends_at - subscription.starts_at == timedelta(days=14)
    assert EntitlementService.for_organization(organization).member_limit == 30


def test_upgrade_recommendation_requires_usage_above_default_threshold(plans):
    organization = baker.make("organizations.Organization")
    entitlement = Entitlement(
        plan_code="free",
        plan_name="免费版",
        member_limit=10,
        team_limit=None,
        house_limit=None,
        feature_flags={},
        starts_at=None,
        ends_at=None,
        source="free",
    )

    assert (
        EntitlementService.upgrade_recommendation_for(
            organization,
            entitlement=entitlement,
            usage={"member": 6, "team": 0, "house": 0},
        )
        is None
    )

    recommendation = EntitlementService.upgrade_recommendation_for(
        organization,
        entitlement=entitlement,
        usage={"member": 7, "team": 0, "house": 0},
    )

    assert recommendation["reason"] == "usage_threshold_exceeded"
    assert recommendation["threshold_percent"] == 60
    assert recommendation["target_plan_code"] == "professional"
    assert recommendation["triggered_resources"] == [{"resource": "member", "current": 7, "limit": 10, "usage_percent": 70}]


@override_settings(PAYMENTS_TEST_AMOUNT_CENTS=1)
def test_purchase_order_uses_test_amount_for_order_and_payment(plans):
    order, payment = create_purchase_order(
        organization=baker.make("organizations.Organization"),
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )

    assert order.payable_amount == 1
    assert payment.amount == 1


def test_purchase_order_reuses_same_organization_idempotency_key(plans):
    organization = baker.make("organizations.Organization")
    user = baker.make("accounts.User")

    first_order, first_payment = create_purchase_order(
        organization=organization,
        created_by=user,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
        idempotency_key="checkout-attempt-001",
    )
    second_order, second_payment = create_purchase_order(
        organization=organization,
        created_by=user,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
        idempotency_key="checkout-attempt-001",
    )

    assert second_order.pk == first_order.pk
    assert second_payment.pk == first_payment.pk
    assert SaaSOrder.objects.filter(organization=organization).count() == 1


def test_same_plan_renewal_extends_from_current_end_and_refreshes_current_entitlement(plans):
    organization = baker.make("organizations.Organization")
    starts_at = timezone.now() - timedelta(days=5)
    subscription = Subscription.objects.create(
        organization=organization,
        kind="paid",
        status=SubscriptionStatus.ACTIVE,
        billing_cycle=BillingCycle.MONTH,
        starts_at=starts_at,
        ends_at=timezone.now() + timedelta(days=25),
        plan_snapshot={"code": "professional", "name": "专业版", "display_order": 30},
        price_snapshot={"amount": 29900, "billing_cycle": "month", "version": 1},
        entitlement_snapshot={"member_limit": 30, "team_limit": 10, "house_limit": 3000, "version": 1},
    )
    expected_start = subscription.ends_at
    PlanEntitlement.objects.filter(plan=plans["professional"], is_current=True).update(is_current=False)
    PlanEntitlement.objects.create(plan=plans["professional"], version=2, is_current=True, member_limit=35, team_limit=12, house_limit=3500)

    order, payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-renew-1", callback_event_id="event-renew-1")

    subscription.refresh_from_db()
    assert order.order_type == OrderType.RENEWAL
    assert subscription.ends_at == expected_start + timedelta(days=30)
    assert subscription.entitlement_snapshot["member_limit"] == 35


def test_successful_payment_notifies_organization_owner(plans):
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    order, payment = create_purchase_order(
        organization=organization,
        created_by=owner,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )

    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-notify-success", callback_event_id="event-notify-success")

    notification = Notification.objects.get(recipient=owner, category="subscription.billing", target_object_id=order.pk)
    assert notification.title == "订阅支付成功"
    assert notification.data["event"] == "payment_succeeded"


def test_upgrade_uses_remaining_period_credit_and_immediately_replaces_plan(plans):
    organization = baker.make("organizations.Organization")
    starts_at = timezone.now() - timedelta(days=10)
    Subscription.objects.create(
        organization=organization,
        kind="paid",
        status=SubscriptionStatus.ACTIVE,
        billing_cycle=BillingCycle.MONTH,
        starts_at=starts_at,
        ends_at=starts_at + timedelta(days=30),
        plan_snapshot={"code": "professional", "name": "专业版", "display_order": 30},
        price_snapshot={"amount": 29900, "billing_cycle": "month", "version": 1},
        entitlement_snapshot={"member_limit": 30, "team_limit": 10, "house_limit": 3000, "version": 1},
    )

    order, payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="enterprise",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-upgrade-1", callback_event_id="event-upgrade-1")

    subscription = Subscription.objects.get(organization=organization)
    assert order.order_type == OrderType.UPGRADE
    assert order.credit_amount == 19933
    assert order.payable_amount == 49967
    assert subscription.plan_snapshot["code"] == "enterprise"
    assert subscription.billing_cycle == BillingCycle.MONTH
    assert subscription.ends_at == starts_at + timedelta(days=30)


@pytest.mark.parametrize("close_reason", [OrderCloseReason.SUPERSEDED, OrderCloseReason.USER_CANCELLED])
def test_closed_order_late_payment_is_recorded_without_changing_subscription(plans, close_reason):
    organization = baker.make("organizations.Organization")
    order, payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    order.status = OrderStatus.CLOSED
    order.close_reason = close_reason
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "close_reason", "closed_at", "updated_at"])

    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-late-1", callback_event_id="event-late-1")

    order.refresh_from_db()
    assert order.status == OrderStatus.CLOSED
    assert Subscription.objects.filter(organization=organization).exists() is False
    payment.refresh_from_db()
    assert payment.status == PaymentStatus.EXCEPTION
    assert payment.provider_trade_no == "wechat-late-1"


def test_late_payment_exception_notifies_organization_owner(plans):
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    order, payment = create_purchase_order(
        organization=organization,
        created_by=owner,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    order.status = OrderStatus.CLOSED
    order.close_reason = OrderCloseReason.USER_CANCELLED
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "close_reason", "closed_at", "updated_at"])

    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-notify-late", callback_event_id="event-notify-late")

    notification = Notification.objects.get(recipient=owner, category="subscription.billing", target_object_id=order.pk)
    assert notification.title == "发现异常支付，请处理退款"
    assert notification.data["event"] == "payment_exception"


def test_late_payment_can_only_be_refunded_with_proof_and_without_ending_subscription(plans):
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    operator = baker.make("accounts.User")
    order, payment = create_purchase_order(
        organization=organization,
        created_by=operator,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    order.status = OrderStatus.CLOSED
    order.close_reason = OrderCloseReason.USER_CANCELLED
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "close_reason", "closed_at", "updated_at"])
    mark_payment_succeeded(transaction_no=payment.transaction_no, provider_trade_no="wechat-late-refund", callback_event_id="event-late-refund")

    with pytest.raises(SubscriptionRuleException, match="退款凭证"):
        refund_order(
            order=order,
            operator=operator,
            amount=order.payable_amount,
            reason="迟到付款原路退回",
            proof="",
            subscription_action=RefundSubscriptionAction.KEEP,
        )
    with pytest.raises(SubscriptionRuleException, match="保留当前订阅"):
        refund_order(
            order=order,
            operator=operator,
            amount=order.payable_amount,
            reason="迟到付款原路退回",
            proof="WX-REFUND-001",
            subscription_action=RefundSubscriptionAction.END,
        )

    result = refund_order(
        order=order,
        operator=operator,
        amount=order.payable_amount,
        reason="迟到付款原路退回",
        proof="WX-REFUND-001",
        subscription_action=RefundSubscriptionAction.KEEP,
    )

    assert result.refund_status == "full"
    assert result.refund_proof == "WX-REFUND-001"
    assert Subscription.objects.filter(organization=organization).exists() is False
    refund_notification = Notification.objects.get(recipient=owner, data__event="refund_registered")
    assert refund_notification.title == "订阅订单退款已登记"
    assert refund_notification.data["order_no"] == order.order_no


def test_refunding_historical_order_cannot_end_newer_subscription(plans):
    organization = baker.make("organizations.Organization")
    operator = baker.make("accounts.User")
    historical_order = baker.make(
        "subscriptions.SaaSOrder",
        organization=organization,
        target_plan=plans["professional"],
        status=OrderStatus.PAID,
        payable_amount=29900,
    )
    current_order = baker.make(
        "subscriptions.SaaSOrder",
        organization=organization,
        target_plan=plans["enterprise"],
        status=OrderStatus.PAID,
        payable_amount=69900,
    )
    subscription = baker.make(
        Subscription,
        organization=organization,
        source_order=current_order,
        status=SubscriptionStatus.ACTIVE,
        ends_at=timezone.now() + timedelta(days=30),
    )

    with pytest.raises(SubscriptionRuleException, match="当前生效订阅"):
        refund_order(
            order=historical_order,
            operator=operator,
            amount=29900,
            reason="历史订单退款",
            proof="WX-REFUND-002",
            subscription_action=RefundSubscriptionAction.END,
        )

    subscription.refresh_from_db()
    assert subscription.status == SubscriptionStatus.ACTIVE


def test_native_payment_initialization_persists_wechat_code_url(plans):
    organization = baker.make("organizations.Organization")
    order, payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    client = Mock()
    client.create_native_payment.return_value = {"code_url": "weixin://wxpay/bizpayurl?pr=test", "response_snapshot": {"code_url": "weixin://wxpay/bizpayurl?pr=test"}}

    with patch("apps.payments.services.build_wechat_config"), patch("apps.payments.services.WechatPayClient", return_value=client):
        checkout = initiate_wechat_payment(order=order, payment=payment, user=baker.make("accounts.User"))

    payment.refresh_from_db()
    assert checkout["code_url"].startswith("weixin://")
    assert payment.request_snapshot["out_trade_no"] == payment.transaction_no
    assert payment.response_snapshot["code_url"].startswith("weixin://")


def test_expired_order_waits_for_successful_wechat_query_before_closing(plans):
    organization = baker.make("organizations.Organization")
    order, _payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    now = timezone.now()
    order.expires_at = now - timedelta(minutes=1)
    order.save(update_fields=["expires_at", "updated_at"])

    with (
        patch("apps.subscriptions.services.query_payment", side_effect=PaymentConfigurationException("微信查单暂不可用"), create=True),
        patch("apps.subscriptions.tasks.close_saas_order_in_wechat_task.delay") as close_payment_task,
    ):
        closed_count = close_expired_orders(now=now)

    order.refresh_from_db()
    assert closed_count == 0
    assert order.status == OrderStatus.PENDING_PAYMENT
    close_payment_task.assert_not_called()


def test_expired_order_uses_wechat_failed_result_instead_of_timeout(plans):
    organization = baker.make("organizations.Organization")
    order, payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    now = timezone.now()
    order.expires_at = now - timedelta(minutes=1)
    order.save(update_fields=["expires_at", "updated_at"])

    def mark_failed(current_payment):
        current_payment.status = PaymentStatus.FAILED
        current_payment.save(update_fields=["status", "updated_at"])
        return current_payment

    with (
        patch("apps.subscriptions.services.query_payment", side_effect=mark_failed, create=True),
        patch("apps.subscriptions.tasks.close_saas_order_in_wechat_task.delay") as close_payment_task,
    ):
        closed_count = close_expired_orders(now=now)

    order.refresh_from_db()
    assert closed_count == 0
    assert order.status == OrderStatus.PAYMENT_FAILED
    assert order.close_reason == OrderCloseReason.PROVIDER_FAILED
    close_payment_task.assert_not_called()


def test_pending_reconciliation_recovers_paid_order_without_callback(plans):
    owner = baker.make("accounts.User")
    organization = baker.make("organizations.Organization", created_by=owner)
    baker.make("organizations.OrganizationMember", organization=organization, user=owner, is_owner=True)
    order, payment = create_purchase_order(
        organization=organization,
        created_by=owner,
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    client = Mock()
    client.query_payment.return_value = {
        "state": "SUCCESS",
        "transaction_no": payment.transaction_no,
        "provider_trade_no": "wx-reconciled-success",
        "reported_amount": payment.amount,
        "currency": "CNY",
        "mch_id": "1900000109",
        "app_id": "wx-native",
        "paid_at": timezone.now(),
        "response_snapshot": {"trade_state": "SUCCESS"},
    }

    with (
        override_settings(PAYMENTS_WECHAT_MCH_ID="1900000109", PAYMENTS_WECHAT_NATIVE_APP_ID="wx-native"),
        patch("apps.payments.services.build_wechat_config"),
        patch("apps.payments.services.WechatPayClient", return_value=client),
    ):
        reconciled = reconcile_pending_saas_order_payments()

    order.refresh_from_db()
    payment.refresh_from_db()
    assert reconciled == 1
    assert order.status == OrderStatus.PAID
    assert payment.status == PaymentStatus.SUCCEEDED
    assert Subscription.objects.filter(organization=organization, source_order=order, status=SubscriptionStatus.ACTIVE).exists()
