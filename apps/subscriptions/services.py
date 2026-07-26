import math
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.payments.constants import PaymentMode, PaymentStatus
from apps.payments.models import PaymentTransaction
from apps.payments.services import create_payment, start_checkout
from apps.subscriptions.constants import (
    MAX_SUBSCRIPTION_DAYS,
    MONTH_DAYS,
    ORDER_EXPIRY_MINUTES,
    TRIAL_DAYS,
    YEAR_DAYS,
    BillingCycle,
    OrderCloseReason,
    OrderStatus,
    OrderType,
    RefundStatus,
    RefundSubscriptionAction,
    SubscriptionKind,
    SubscriptionStatus,
)
from apps.subscriptions.exceptions import SubscriptionRuleException
from apps.subscriptions.models import Plan, PlanEntitlement, PlanPrice, SaaSOrder, Subscription, SubscriptionAuditLog, SubscriptionSettings


def _now():
    return timezone.now()


def _duration_for(cycle: str) -> timedelta:
    return timedelta(days=MONTH_DAYS if cycle == BillingCycle.MONTH else YEAR_DAYS)


def _snapshot_plan(plan: Plan) -> dict:
    return {"code": plan.code, "name": plan.name, "display_order": plan.display_order}


def _snapshot_price(price: PlanPrice) -> dict:
    return {"version": price.version, "amount": price.amount, "billing_cycle": price.billing_cycle, "display_note": price.display_note}


def _snapshot_entitlement(entitlement: PlanEntitlement) -> dict:
    return {
        "version": entitlement.version,
        "member_limit": entitlement.member_limit,
        "team_limit": entitlement.team_limit,
        "house_limit": entitlement.house_limit,
        "house_counting_rule": entitlement.house_counting_rule,
        "feature_flags": entitlement.feature_flags,
    }


def get_subscription_settings() -> SubscriptionSettings:
    settings, _ = SubscriptionSettings.objects.get_or_create(singleton=True, defaults={"organization_creation_limit": 3})
    return settings


def count_currently_owned_organizations(user) -> int:
    from apps.organizations.models import Organization

    return Organization.objects.filter(created_by=user, is_active=True, organizationmember__user=user, organizationmember__is_owner=True).distinct().count()


def can_grant_trial(*, organization, granted_to) -> bool:
    professional = Plan.objects.filter(code="professional", is_active=True).first()
    return (
        granted_to is not None
        and granted_to.phone_verified
        and professional is not None
        and PlanEntitlement.objects.filter(plan=professional, is_current=True).exists()
        and not Subscription.objects.filter(organization=organization, trial_started_at__isnull=False).exists()
        and Subscription.objects.filter(trial_granted_to=granted_to, trial_started_at__isnull=False).count() < 3
    )


@transaction.atomic
def grant_trial(*, organization, granted_to) -> Subscription:
    """为合格的新组织发放一次专业版 14 天试用。"""
    if not can_grant_trial(organization=organization, granted_to=granted_to):
        raise SubscriptionRuleException("当前组织不符合试用开通条件。")
    plan = Plan.objects.filter(code="professional", is_active=True).first()
    entitlement = PlanEntitlement.objects.filter(plan=plan, is_current=True).first() if plan else None
    if plan is None or entitlement is None:
        raise SubscriptionRuleException("专业版试用套餐尚未配置。")
    now = _now()
    subscription, created = Subscription.objects.select_for_update().get_or_create(
        organization=organization,
        defaults={
            "kind": SubscriptionKind.TRIAL,
            "status": SubscriptionStatus.TRIALING,
            "plan_snapshot": _snapshot_plan(plan),
            "price_snapshot": {},
            "entitlement_snapshot": _snapshot_entitlement(entitlement),
            "starts_at": now,
            "ends_at": now + timedelta(days=TRIAL_DAYS),
            "trial_started_at": now,
            "trial_ended_at": now + timedelta(days=TRIAL_DAYS),
            "trial_granted_to": granted_to,
        },
    )
    if not created:
        raise SubscriptionRuleException("该组织已存在订阅记录，不能重复开通试用。")
    audit(action="trial_granted", organization=organization, target=subscription, actor=granted_to, after={"ends_at": subscription.ends_at.isoformat()})
    return subscription


def _current_sale_versions(*, plan_code: str, billing_cycle: str) -> tuple[Plan, PlanPrice, PlanEntitlement]:
    plan = Plan.objects.filter(code=plan_code, is_active=True).first()
    if plan is None or plan.code == "free":
        raise SubscriptionRuleException("该套餐当前不可购买。")
    price = PlanPrice.objects.filter(plan=plan, billing_cycle=billing_cycle, is_current=True).first()
    entitlement = PlanEntitlement.objects.filter(plan=plan, is_current=True).first()
    if price is None or entitlement is None:
        raise SubscriptionRuleException("该套餐的价格或权益尚未配置完成。")
    return plan, price, entitlement


def _active_subscription(organization, *, lock: bool = False) -> Subscription | None:
    qs = Subscription.objects.filter(organization=organization)
    if lock:
        qs = qs.select_for_update()
    subscription = qs.first()
    if subscription and subscription.status in {SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE} and subscription.ends_at and subscription.ends_at > _now():
        return subscription
    return None


def _order_type_and_credit(*, organization, target_plan: Plan, billing_cycle: str) -> tuple[str, int]:
    subscription = _active_subscription(organization, lock=True)
    if subscription is None or subscription.kind != SubscriptionKind.PAID:
        return OrderType.INITIAL_PURCHASE, 0

    current_order = subscription.plan_snapshot.get("display_order", -1)
    current_code = subscription.plan_snapshot.get("code", "")
    if current_code == target_plan.code:
        return OrderType.RENEWAL, 0
    if target_plan.display_order <= current_order:
        raise SubscriptionRuleException("付费套餐仅支持向上升级；低档套餐请在当前周期结束后购买。")
    if billing_cycle != subscription.billing_cycle:
        raise SubscriptionRuleException("套餐升级需保持当前付款周期；付款周期变更请在续费时单独操作。")

    old_amount = int(subscription.price_snapshot.get("amount", 0))
    total_days = MONTH_DAYS if subscription.billing_cycle == BillingCycle.MONTH else YEAR_DAYS
    remaining_seconds = max(0, (subscription.ends_at - _now()).total_seconds())
    remaining_days = math.ceil(remaining_seconds / timedelta(days=1).total_seconds())
    credit = old_amount * min(remaining_days, total_days) // total_days
    return OrderType.UPGRADE, credit


def _assert_subscription_length(*, organization, order_type: str, billing_cycle: str) -> None:
    if order_type != OrderType.RENEWAL:
        return
    subscription = _active_subscription(organization, lock=True)
    start = subscription.ends_at if subscription and subscription.ends_at > _now() else _now()
    if start + _duration_for(billing_cycle) > _now() + timedelta(days=MAX_SUBSCRIPTION_DAYS):
        raise SubscriptionRuleException("同一组织的订阅有效期最多累计三年。")


def _next_order_no() -> str:
    return f"S{_now():%Y%m%d%H%M%S}{secrets.token_hex(5).upper()}"


@transaction.atomic
def create_purchase_order(*, organization, created_by, target_plan_code: str, billing_cycle: str, payment_mode: str) -> tuple[SaaSOrder, PaymentTransaction]:
    """服务端按当前版本计算价格并生成唯一待支付订单。"""
    if billing_cycle not in BillingCycle.values:
        raise SubscriptionRuleException("不支持的付款周期。")
    if payment_mode not in PaymentMode.values:
        raise SubscriptionRuleException("不支持的支付方式。")
    plan, price, entitlement = _current_sale_versions(plan_code=target_plan_code, billing_cycle=billing_cycle)
    order_type, credit_amount = _order_type_and_credit(organization=organization, target_plan=plan, billing_cycle=billing_cycle)
    _assert_subscription_length(organization=organization, order_type=order_type, billing_cycle=billing_cycle)
    payable_amount = price.amount - min(credit_amount, price.amount)
    if payable_amount <= 0:
        raise SubscriptionRuleException("升级后的应付金额必须大于零。")

    now = _now()
    superseded_order_ids = list(SaaSOrder.objects.filter(organization=organization, status=OrderStatus.PENDING_PAYMENT).values_list("pk", flat=True))
    SaaSOrder.objects.filter(organization=organization, status=OrderStatus.PENDING_PAYMENT).update(
        status=OrderStatus.CLOSED,
        close_reason=OrderCloseReason.SUPERSEDED,
        closed_at=now,
        updated_at=now,
    )
    order = SaaSOrder.objects.create(
        organization=organization,
        order_no=_next_order_no(),
        order_type=order_type,
        target_plan=plan,
        billing_cycle=billing_cycle,
        plan_snapshot=_snapshot_plan(plan),
        price_snapshot=_snapshot_price(price),
        entitlement_snapshot=_snapshot_entitlement(entitlement),
        list_amount=price.amount,
        credit_amount=min(credit_amount, price.amount),
        payable_amount=payable_amount,
        expires_at=now + timedelta(minutes=ORDER_EXPIRY_MINUTES),
        created_by=created_by,
    )
    payment = create_payment(
        biz_type="subscriptions.saas_order",
        biz_id=str(order.pk),
        amount=order.payable_amount,
        description=f"链云空间 {order.plan_snapshot.get('name', 'SaaS 服务')}",
        payment_mode=payment_mode,
        expires_at=order.expires_at,
    )
    if superseded_order_ids:
        from apps.subscriptions.tasks import close_saas_order_in_wechat_task

        for order_id in superseded_order_ids:
            transaction.on_commit(lambda order_id=order_id: close_saas_order_in_wechat_task.delay(order_id))
    audit(action="order_created", organization=organization, target=order, actor=created_by, after={"order_type": order_type, "payable_amount": payable_amount})
    return order, payment


def initiate_wechat_payment(*, order: SaaSOrder, payment: PaymentTransaction, user) -> dict:
    """由支付模块向微信创建 Native 或 JSAPI 交易。"""
    if order.status != OrderStatus.PENDING_PAYMENT or payment.status != PaymentStatus.PENDING:
        raise SubscriptionRuleException("当前订单不能再次发起支付。")
    openid = ""
    if payment.payment_mode == PaymentMode.MINIPROGRAM:
        from allauth.socialaccount.models import SocialAccount

        account = SocialAccount.objects.filter(user=user, provider="wechat_miniprogram").first()
        openid = (account.extra_data or {}).get("openid") if account else ""
        if not openid:
            raise SubscriptionRuleException("小程序支付前请先绑定有效的微信小程序账号。")
    return start_checkout(payment=payment, openid=openid)


def _apply_paid_order(order: SaaSOrder, *, paid_at) -> Subscription:
    subscription = Subscription.objects.select_for_update().filter(organization=order.organization).first()
    now = paid_at
    if order.order_type == OrderType.UPGRADE:
        if subscription is None or subscription.status != SubscriptionStatus.ACTIVE or not subscription.ends_at or subscription.ends_at <= now:
            raise SubscriptionRuleException("当前订阅已到期，不能按升级订单开通。")
        subscription.kind = SubscriptionKind.PAID
        subscription.status = SubscriptionStatus.ACTIVE
        subscription.billing_cycle = order.billing_cycle
        subscription.plan_snapshot = order.plan_snapshot
        subscription.price_snapshot = order.price_snapshot
        subscription.entitlement_snapshot = order.entitlement_snapshot
        subscription.source_order = order
        subscription.ended_at = None
        subscription.save(update_fields=["kind", "status", "billing_cycle", "plan_snapshot", "price_snapshot", "entitlement_snapshot", "source_order", "ended_at", "updated_at"])
        return subscription

    if order.order_type == OrderType.RENEWAL and subscription and subscription.status == SubscriptionStatus.ACTIVE and subscription.ends_at and subscription.ends_at > now:
        starts_at = subscription.ends_at
        ends_at = starts_at + _duration_for(order.billing_cycle)
        if ends_at > now + timedelta(days=MAX_SUBSCRIPTION_DAYS):
            raise SubscriptionRuleException("同一组织的订阅有效期最多累计三年。")
    else:
        starts_at = now
        ends_at = starts_at + _duration_for(order.billing_cycle)

    if subscription is None:
        subscription = Subscription(organization=order.organization)
    subscription.kind = SubscriptionKind.PAID
    subscription.status = SubscriptionStatus.ACTIVE
    subscription.billing_cycle = order.billing_cycle
    subscription.plan_snapshot = order.plan_snapshot
    subscription.price_snapshot = order.price_snapshot
    subscription.entitlement_snapshot = order.entitlement_snapshot
    subscription.starts_at = starts_at
    subscription.ends_at = ends_at
    subscription.ended_at = None
    subscription.source_order = order
    subscription.save()
    return subscription


@transaction.atomic
def fulfill_saas_order_payment(*, payment: PaymentTransaction) -> None:
    """处理支付模块确认成功的 SaaS 订单交易。"""
    if payment.biz_type != "subscriptions.saas_order":
        return
    order = SaaSOrder.objects.select_for_update().select_related("organization").get(pk=payment.biz_id)
    if order.status == OrderStatus.CLOSED and order.close_reason == OrderCloseReason.SUPERSEDED:
        payment.status = PaymentStatus.EXCEPTION
        payment.save(update_fields=["status", "updated_at"])
        audit(action="late_payment_requires_manual_refund", organization=order.organization, target=order, after={"provider_trade_no": payment.provider_trade_no})
        return
    if order.status not in {OrderStatus.PENDING_PAYMENT, OrderStatus.CLOSED}:
        raise SubscriptionRuleException("当前订单不能确认支付。")
    if order.status == OrderStatus.CLOSED and order.close_reason != OrderCloseReason.TIMEOUT:
        raise SubscriptionRuleException("当前订单不能确认支付。")

    subscription = _apply_paid_order(order, paid_at=payment.paid_at or _now())
    order.status = OrderStatus.PAID
    order.paid_at = payment.paid_at or _now()
    order.close_reason = ""
    order.closed_at = None
    order.save(update_fields=["status", "paid_at", "close_reason", "closed_at", "updated_at"])
    audit(action="payment_succeeded", organization=order.organization, target=order, after={"provider_trade_no": payment.provider_trade_no, "subscription_id": subscription.pk})


@transaction.atomic
def close_expired_orders(*, now=None) -> int:
    now = now or _now()
    return SaaSOrder.objects.filter(status=OrderStatus.PENDING_PAYMENT, expires_at__lte=now).update(
        status=OrderStatus.CLOSED,
        close_reason=OrderCloseReason.TIMEOUT,
        closed_at=now,
        updated_at=now,
    )


@transaction.atomic
def expire_subscriptions(*, now=None) -> int:
    now = now or _now()
    return Subscription.objects.filter(status__in=[SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE], ends_at__lte=now).update(
        status=SubscriptionStatus.ENDED,
        ended_at=now,
        updated_at=now,
    )


@transaction.atomic
def refund_order(*, order: SaaSOrder, operator, amount: int, reason: str, proof: str, subscription_action: str) -> SaaSOrder:
    order = SaaSOrder.objects.select_for_update().get(pk=order.pk)
    if order.status != OrderStatus.PAID:
        raise SubscriptionRuleException("仅已支付订单可以退款。")
    if order.refund_status != RefundStatus.NONE:
        raise SubscriptionRuleException("每笔订单仅允许退款一次。")
    if amount <= 0 or amount > order.payable_amount:
        raise SubscriptionRuleException("退款金额必须大于零且不超过实付金额。")
    if subscription_action not in RefundSubscriptionAction.values:
        raise SubscriptionRuleException("请选择退款后的订阅处理方式。")
    now = _now()
    order.refund_status = RefundStatus.FULL if amount == order.payable_amount else RefundStatus.PARTIAL
    order.refunded_amount = amount
    order.refund_reason = reason
    order.refund_proof = proof
    order.refund_subscription_action = subscription_action
    order.refunded_by = operator
    order.refunded_at = now
    order.save(
        update_fields=[
            "refund_status",
            "refunded_amount",
            "refund_reason",
            "refund_proof",
            "refund_subscription_action",
            "refunded_by",
            "refunded_at",
            "updated_at",
        ]
    )
    if subscription_action == RefundSubscriptionAction.END:
        Subscription.objects.filter(organization=order.organization, status__in=[SubscriptionStatus.TRIALING, SubscriptionStatus.ACTIVE]).update(
            status=SubscriptionStatus.ENDED,
            ends_at=now,
            ended_at=now,
            updated_at=now,
        )
    audit(action="order_refunded", organization=order.organization, target=order, actor=operator, after={"amount": amount, "action": subscription_action})
    return order


def audit(*, action: str, organization, target, actor=None, before: dict | None = None, after: dict | None = None) -> None:
    SubscriptionAuditLog.objects.create(
        action=action,
        actor=actor,
        organization=organization,
        target_type=target._meta.label_lower,
        target_id=target.pk,
        before=before or {},
        after=after or {},
    )
