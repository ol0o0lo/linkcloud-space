from datetime import timedelta
from unittest.mock import Mock, patch

from django.utils import timezone

import pytest
from model_bakery import baker

from apps.subscriptions.constants import BillingCycle, OrderCloseReason, OrderStatus, OrderType, PaymentMode, SubscriptionStatus
from apps.subscriptions.entitlements import EntitlementService
from apps.subscriptions.models import Plan, PlanEntitlement, PlanPrice, Subscription
from apps.subscriptions.services import create_purchase_order, grant_trial, handle_wechat_payment_success, initiate_wechat_payment


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

    order, _payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    handle_wechat_payment_success(order_no=order.order_no, provider_trade_no="wechat-renew-1", callback_event_id="event-renew-1")

    subscription.refresh_from_db()
    assert order.order_type == OrderType.RENEWAL
    assert subscription.ends_at == expected_start + timedelta(days=30)
    assert subscription.entitlement_snapshot["member_limit"] == 35


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

    order, _payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="enterprise",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    handle_wechat_payment_success(order_no=order.order_no, provider_trade_no="wechat-upgrade-1", callback_event_id="event-upgrade-1")

    subscription = Subscription.objects.get(organization=organization)
    assert order.order_type == OrderType.UPGRADE
    assert order.credit_amount == 19933
    assert order.payable_amount == 49967
    assert subscription.plan_snapshot["code"] == "enterprise"
    assert subscription.billing_cycle == BillingCycle.MONTH
    assert subscription.ends_at == starts_at + timedelta(days=30)


def test_superseded_order_late_payment_is_recorded_without_changing_subscription(plans):
    organization = baker.make("organizations.Organization")
    order, _payment = create_purchase_order(
        organization=organization,
        created_by=baker.make("accounts.User"),
        target_plan_code="professional",
        billing_cycle=BillingCycle.MONTH,
        payment_mode=PaymentMode.NATIVE,
    )
    order.status = OrderStatus.CLOSED
    order.close_reason = OrderCloseReason.SUPERSEDED
    order.closed_at = timezone.now()
    order.save(update_fields=["status", "close_reason", "closed_at", "updated_at"])

    result = handle_wechat_payment_success(order_no=order.order_no, provider_trade_no="wechat-late-1", callback_event_id="event-late-1")

    order.refresh_from_db()
    assert result.subscription_activated is False
    assert order.status == OrderStatus.CLOSED
    assert Subscription.objects.filter(organization=organization).exists() is False
    assert order.payments.get().provider_trade_no == "wechat-late-1"


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
    client.create_native_order.return_value = {"code_url": "weixin://wxpay/bizpayurl?pr=test", "response_snapshot": {"code_url": "weixin://wxpay/bizpayurl?pr=test"}}

    with patch("apps.subscriptions.services.get_wechat_checkout_client", return_value=client):
        checkout = initiate_wechat_payment(order=order, payment=payment, user=baker.make("accounts.User"))

    payment.refresh_from_db()
    assert checkout["code_url"].startswith("weixin://")
    assert payment.request_snapshot["out_trade_no"] == order.order_no
    assert payment.response_snapshot["code_url"].startswith("weixin://")
