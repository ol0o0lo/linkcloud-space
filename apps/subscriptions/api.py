from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.access.constants import SubscriptionPermission
from apps.access.services import has_permission
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected, require_superuser
from apps.payments.constants import PaymentMode
from apps.payments.models import PaymentTransaction
from apps.payments.services import get_payment
from apps.payments.wechat import is_wechat_checkout_enabled
from apps.subscriptions.constants import InvoiceStatus, OrderStatus
from apps.subscriptions.entitlements import EntitlementService
from apps.subscriptions.exceptions import SubscriptionRuleException
from apps.subscriptions.models import InvoiceRequest, OrganizationInvoiceProfile, Plan, SaaSOrder, Subscription
from apps.subscriptions.schemas import (
    CurrentSubscriptionOut,
    InvoiceProcessIn,
    InvoiceProfileIn,
    InvoiceProfileOut,
    InvoiceRequestIn,
    InvoiceRequestOut,
    PlanOut,
    PurchaseOrderIn,
    RefundIn,
    SaaSOrderOut,
)
from apps.subscriptions.services import cancel_purchase_order, create_purchase_order, initiate_wechat_payment, reconcile_saas_order_payment, refund_order

router = Router(tags=["SaaS 订阅/组织"])
admin_router = Router(tags=["SaaS 订阅/平台管理"])
_PAYMENT_NOT_LOADED = object()


class OrderPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params) -> dict:
        result = super().paginate_queryset(queryset, pagination, **params)
        payments = {
            payment.biz_id: payment
            for payment in PaymentTransaction.objects.filter(
                biz_type="subscriptions.saas_order",
                biz_id__in=[str(order.pk) for order in result["items"]],
            )
        }
        result["items"] = [_serialize_order(order, payment=payments.get(str(order.pk))) for order in result["items"]]
        return result


class InvoiceRequestPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params) -> dict:
        result = super().paginate_queryset(queryset, pagination, **params)
        result["items"] = [_serialize_invoice_request(invoice_request) for invoice_request in result["items"]]
        return result


class AdminInvoiceRequestPagination(LegacyPagination):
    def paginate_queryset(self, queryset, pagination, **params) -> dict:
        result = super().paginate_queryset(queryset, pagination, **params)
        result["items"] = [_serialize_invoice_request(invoice_request, include_profile_snapshot=True) for invoice_request in result["items"]]
        return result


def _require_subscription_permission(request, permission: str):
    org = require_org_selected(request)
    accepted_permissions = [permission]
    if permission == SubscriptionPermission.VIEW:
        accepted_permissions.append(SubscriptionPermission.MANAGE)
    if org.is_owner(request.user) or any(has_permission(request.user, org, accepted_permission) for accepted_permission in accepted_permissions):
        return org
    raise PermissionDenied("没有订阅管理权限。")


def _serialize_order(order: SaaSOrder, *, payment=_PAYMENT_NOT_LOADED) -> dict:
    if payment is _PAYMENT_NOT_LOADED:
        payment = get_payment(biz_type="subscriptions.saas_order", biz_id=str(order.pk))
    payment_data = None
    if payment:
        payment_data = {
            "payment_mode": payment.payment_mode,
            "status": payment.status,
            "transaction_no": payment.transaction_no,
            "provider_trade_no": payment.provider_trade_no or "",
            "amount": payment.amount,
            "paid_at": payment.paid_at,
            "expires_at": payment.expires_at,
        }
        code_url = payment.response_snapshot.get("code_url")
        if (
            code_url
            and payment.payment_mode == PaymentMode.NATIVE
            and payment.status == "pending"
            and order.status == OrderStatus.PENDING_PAYMENT
            and payment.expires_at > timezone.now()
        ):
            payment_data["checkout"] = {"code_url": code_url}
    invoice_request = getattr(order, "invoice_request", None)
    return {
        "id": order.pk,
        "organization_id": order.organization_id,
        "organization_name": order.organization.name,
        "organization_slug": order.organization.slug,
        "order_no": order.order_no,
        "order_type": order.order_type,
        "status": order.status,
        "close_reason": order.close_reason,
        "target_plan_code": order.plan_snapshot.get("code", ""),
        "target_plan_name": order.plan_snapshot.get("name") or order.target_plan.name,
        "billing_cycle": order.billing_cycle,
        "list_amount": order.list_amount,
        "credit_amount": order.credit_amount,
        "payable_amount": order.payable_amount,
        "expires_at": order.expires_at,
        "paid_at": order.paid_at,
        "refund_status": order.refund_status,
        "refunded_amount": order.refunded_amount,
        "refund_reason": order.refund_reason,
        "refund_proof": order.refund_proof,
        "refund_subscription_action": order.refund_subscription_action,
        "refunded_at": order.refunded_at,
        "created_at": order.created_at,
        "payment": payment_data,
        "invoice": {
            "id": invoice_request.pk,
            "status": invoice_request.status,
            "invoice_number": invoice_request.invoice_number,
            "file_url": invoice_request.file_url,
        }
        if invoice_request
        else None,
    }


@router.get("/plans/", response=list[PlanOut], summary="获取可展示的套餐目录")
def list_plans(request):
    require_authenticated(request)
    plans = Plan.objects.filter(is_active=True).prefetch_related("prices", "entitlements").order_by("display_order", "pk")
    result = []
    for plan in plans:
        current_entitlement = next((item for item in plan.entitlements.all() if item.is_current), None)
        result.append(
            {
                "code": plan.code,
                "name": plan.name,
                "description": plan.description,
                "display_order": plan.display_order,
                "is_active": plan.is_active,
                "prices": [
                    {"billing_cycle": price.billing_cycle, "amount": price.amount, "version": price.version, "display_note": price.display_note}
                    for price in plan.prices.all()
                    if price.is_current
                ],
                "entitlement": {
                    "version": current_entitlement.version,
                    "member_limit": current_entitlement.member_limit,
                    "team_limit": current_entitlement.team_limit,
                    "house_limit": current_entitlement.house_limit,
                    "feature_flags": current_entitlement.feature_flags,
                }
                if current_entitlement
                else None,
            }
        )
    return result


@router.get("/current/", response=CurrentSubscriptionOut, summary="获取当前订阅、权益和用量")
def current_subscription(request):
    org = _require_subscription_permission(request, SubscriptionPermission.VIEW)
    entitlement = EntitlementService.for_organization(org)
    usage = EntitlementService.usage_for(org)
    subscription = Subscription.objects.filter(organization=org).first()
    return {
        "plan": {"code": entitlement.plan_code, "name": entitlement.plan_name, "source": entitlement.source},
        "entitlement": {
            "member_limit": entitlement.member_limit,
            "team_limit": entitlement.team_limit,
            "house_limit": entitlement.house_limit,
            "feature_flags": entitlement.feature_flags,
            "ends_at": entitlement.ends_at,
        },
        "usage": usage,
        "subscription": {
            "kind": subscription.kind,
            "status": subscription.status,
            "billing_cycle": subscription.billing_cycle,
            "starts_at": subscription.starts_at,
            "ends_at": subscription.ends_at,
        }
        if subscription
        else None,
        "recommendation": EntitlementService.upgrade_recommendation_for(org, entitlement=entitlement, usage=usage),
    }


@router.post("/orders/", response={201: SaaSOrderOut}, summary="创建套餐支付订单")
def create_order(request, payload: PurchaseOrderIn):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    if payload.payment_mode == PaymentMode.MINIPROGRAM:
        from allauth.socialaccount.models import SocialAccount

        if not SocialAccount.objects.filter(user=request.user, provider="wechat_miniprogram").exists():
            raise SubscriptionRuleException("小程序支付前请先绑定微信小程序账号。")
    order, payment = create_purchase_order(
        organization=org,
        created_by=request.user,
        target_plan_code=payload.target_plan_code,
        billing_cycle=payload.billing_cycle,
        payment_mode=payload.payment_mode,
        idempotency_key=payload.idempotency_key,
    )
    data = _serialize_order(order, payment=payment)
    if (
        is_wechat_checkout_enabled()
        and order.status == OrderStatus.PENDING_PAYMENT
        and payment.status == "pending"
        and payment.expires_at > timezone.now()
        and not data["payment"].get("checkout")
    ):
        data["payment"]["checkout"] = initiate_wechat_payment(order=order, payment=payment, user=request.user)
    return Status(201, data)


@router.get("/orders/", response=list[SaaSOrderOut], summary="获取本组织支付记录")
@paginate(OrderPagination)
def list_orders(request):
    org = _require_subscription_permission(request, SubscriptionPermission.VIEW)
    return SaaSOrder.objects.filter(organization=org).select_related("organization", "target_plan", "invoice_request").order_by("-created_at", "-pk")


@router.get("/orders/{order_no}/", response=SaaSOrderOut, summary="轮询支付订单状态")
def get_order(request, order_no: str):
    org = _require_subscription_permission(request, SubscriptionPermission.VIEW)
    return _serialize_order(get_object_or_404(SaaSOrder, organization=org, order_no=order_no))


@router.post("/orders/{order_no}/cancel/", response=SaaSOrderOut, summary="取消待支付订单")
def cancel_order(request, order_no: str):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    order = get_object_or_404(SaaSOrder, organization=org, order_no=order_no)
    return _serialize_order(cancel_purchase_order(order=order, actor=request.user))


@router.post("/orders/{order_no}/checkout/", response=SaaSOrderOut, summary="继续待支付订单")
def checkout_order(request, order_no: str):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    order = get_object_or_404(SaaSOrder, organization=org, order_no=order_no)
    payment = get_object_or_404(PaymentTransaction, biz_type="subscriptions.saas_order", biz_id=str(order.pk))
    if order.status != OrderStatus.PENDING_PAYMENT or payment.status != "pending" or payment.expires_at <= timezone.now():
        raise SubscriptionRuleException("当前订单已失效，不能继续支付。")
    data = _serialize_order(order, payment=payment)
    if data["payment"].get("checkout"):
        return data
    if not is_wechat_checkout_enabled():
        raise SubscriptionRuleException("微信支付暂未启用，请联系平台管理员。")
    data["payment"]["checkout"] = initiate_wechat_payment(order=order, payment=payment, user=request.user)
    return data


@router.post("/orders/{order_no}/refresh-payment/", response=SaaSOrderOut, summary="主动查询支付订单状态")
def refresh_order_payment(request, order_no: str):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    order = get_object_or_404(SaaSOrder, organization=org, order_no=order_no)
    payment = get_object_or_404(PaymentTransaction, biz_type="subscriptions.saas_order", biz_id=str(order.pk))
    order, payment = reconcile_saas_order_payment(order=order, payment=payment)
    return _serialize_order(order, payment=payment)


@router.get("/invoice-profile/", response=InvoiceProfileOut | None, summary="获取开票资料")
def get_invoice_profile(request):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    profile = OrganizationInvoiceProfile.objects.filter(organization=org).first()
    if profile is None:
        return None
    return {**_serialize_profile(profile), "organization_id": org.pk}


@router.put("/invoice-profile/", response=InvoiceProfileOut, summary="维护开票资料")
def put_invoice_profile(request, payload: InvoiceProfileIn):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    profile, _ = OrganizationInvoiceProfile.objects.update_or_create(organization=org, defaults=payload.model_dump())
    return {**_serialize_profile(profile), "organization_id": org.pk}


def _serialize_profile(profile: OrganizationInvoiceProfile) -> dict:
    return {
        "invoice_type": profile.invoice_type,
        "title": profile.title,
        "tax_number": profile.tax_number,
        "recipient_email": profile.recipient_email,
        "registered_address": profile.registered_address,
        "registered_phone": profile.registered_phone,
        "bank_name": profile.bank_name,
        "bank_account": profile.bank_account,
    }


@router.post("/invoice-requests/", response={201: InvoiceRequestOut}, summary="申请开票")
def create_invoice_request(request, payload: InvoiceRequestIn):
    org = _require_subscription_permission(request, SubscriptionPermission.MANAGE)
    order = get_object_or_404(SaaSOrder, pk=payload.order_id, organization=org, status=OrderStatus.PAID, refund_status="none")
    profile = get_object_or_404(OrganizationInvoiceProfile, organization=org)
    invoice_request = InvoiceRequest.objects.create(order=order, profile_snapshot=_serialize_profile(profile), created_by=request.user)
    return Status(201, _serialize_invoice_request(invoice_request))


def _serialize_invoice_request(invoice_request: InvoiceRequest, *, include_profile_snapshot: bool = False) -> dict:
    order = invoice_request.order
    return {
        "id": invoice_request.pk,
        "organization_id": order.organization_id,
        "organization_name": order.organization.name,
        "organization_slug": order.organization.slug,
        "order_id": order.pk,
        "order_no": order.order_no,
        "target_plan_code": order.plan_snapshot.get("code", ""),
        "target_plan_name": order.plan_snapshot.get("name") or order.target_plan.name,
        "status": invoice_request.status,
        "profile_snapshot": invoice_request.profile_snapshot if include_profile_snapshot else {},
        "invoice_number": invoice_request.invoice_number,
        "issued_at": invoice_request.issued_at,
        "file_url": invoice_request.file_url,
        "admin_note": invoice_request.admin_note,
        "created_at": invoice_request.created_at,
    }


@router.get("/invoice-requests/", response=list[InvoiceRequestOut], summary="获取本组织开票申请")
@paginate(InvoiceRequestPagination)
def list_invoice_requests(request):
    org = _require_subscription_permission(request, SubscriptionPermission.VIEW)
    return InvoiceRequest.objects.filter(order__organization=org).select_related("order__organization", "order__target_plan").order_by("-created_at", "-pk")


@admin_router.get("/orders/", response=list[SaaSOrderOut], summary="平台查看订阅订单")
@paginate(OrderPagination)
def admin_list_orders(request, organization_id: int | None = Query(None)):
    require_superuser(request)
    qs = SaaSOrder.objects.select_related("organization", "target_plan")
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return qs.order_by("-created_at", "-pk")


@admin_router.post("/orders/{order_id}/refund/", response=SaaSOrderOut, summary="线下登记订单退款")
def admin_refund_order(request, order_id: int, payload: RefundIn):
    require_superuser(request)
    order = refund_order(
        order=get_object_or_404(SaaSOrder, pk=order_id),
        operator=request.user,
        amount=payload.amount,
        reason=payload.reason,
        proof=payload.proof,
        subscription_action=payload.subscription_action,
    )
    return _serialize_order(order)


@admin_router.get("/invoice-requests/", response=list[InvoiceRequestOut], summary="平台查看开票申请")
@paginate(AdminInvoiceRequestPagination)
def admin_list_invoice_requests(request):
    require_superuser(request)
    return InvoiceRequest.objects.select_related("order__organization", "order__target_plan").order_by("-created_at", "-pk")


@admin_router.patch("/invoice-requests/{invoice_request_id}/", response=InvoiceRequestOut, summary="处理开票申请")
def admin_process_invoice_request(request, invoice_request_id: int, payload: InvoiceProcessIn):
    require_superuser(request)
    if payload.status not in InvoiceStatus.values:
        raise SubscriptionRuleException("不支持的开票状态。")
    invoice_request = get_object_or_404(
        InvoiceRequest.objects.select_related("created_by", "order__organization"),
        pk=invoice_request_id,
    )
    previous_status = invoice_request.status
    invoice_request.status = payload.status
    invoice_request.invoice_number = payload.invoice_number
    invoice_request.file_url = payload.file_url
    invoice_request.admin_note = payload.admin_note
    invoice_request.processed_by = request.user
    invoice_request.issued_at = timezone.now() if payload.status == InvoiceStatus.ISSUED else None
    invoice_request.save()
    if previous_status != payload.status and payload.status in {InvoiceStatus.ISSUED, InvoiceStatus.REJECTED}:
        from apps.notifications.services import notify

        recipients = {member.user_id: member.user for member in invoice_request.order.organization.organizationmember_set.filter(is_owner=True).select_related("user")}
        if invoice_request.created_by_id:
            recipients[invoice_request.created_by_id] = invoice_request.created_by
        if recipients:
            is_issued = payload.status == InvoiceStatus.ISSUED
            notify(
                list(recipients.values()),
                title="订阅发票已开具" if is_issued else "订阅发票申请未通过",
                body=(
                    f"订单 {invoice_request.order.order_no} 的发票已开具，可前往订单中心查看。"
                    if is_issued
                    else f"订单 {invoice_request.order.order_no} 的发票申请未通过，请查看处理说明后重新核对资料。"
                ),
                url="/dashboard/space/subscription/orders",
                organization=invoice_request.order.organization,
                target=invoice_request,
                category="subscription.billing",
                data={"event": "invoice_issued" if is_issued else "invoice_rejected", "order_no": invoice_request.order.order_no},
            )
    return _serialize_invoice_request(invoice_request, include_profile_snapshot=True)
