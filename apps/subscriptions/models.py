from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.subscriptions.constants import (
    BillingCycle,
    InvoiceStatus,
    InvoiceType,
    OrderCloseReason,
    OrderStatus,
    OrderType,
    PaymentMode,
    PaymentProvider,
    PaymentStatus,
    RefundStatus,
    RefundSubscriptionAction,
    SubscriptionKind,
    SubscriptionStatus,
)


class Plan(BaseModelMixin):
    """稳定套餐目录；价格和权益始终在独立版本表中维护。"""

    code = models.SlugField(max_length=32, unique=True)
    name = models.CharField(max_length=64)
    description = models.TextField(blank=True, default="")
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "subscriptions_plan"
        ordering = ("display_order", "pk")

    def __str__(self):
        """返回套餐名称。"""
        return self.name


class PlanPrice(CreateUpdateTimeModelMixin):
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="prices")
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices)
    version = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    amount = models.PositiveIntegerField(help_text="含税价格，单位：分")
    is_current = models.BooleanField(default=True)
    display_note = models.CharField(max_length=255, blank=True, default="")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        db_table = "subscriptions_plan_price"
        ordering = ("plan", "billing_cycle", "-version")
        constraints = [
            models.UniqueConstraint(fields=("plan", "billing_cycle", "version"), name="subscriptions_price_plan_cycle_version_unique"),
            models.UniqueConstraint(fields=("plan", "billing_cycle"), condition=Q(is_current=True), name="subscriptions_one_current_price_per_cycle"),
        ]

    def __str__(self):
        """返回套餐价格版本。"""
        return f"{self.plan} {self.get_billing_cycle_display()} v{self.version}"

    def save(self, *args, **kwargs):
        if self.is_current and self.plan_id:
            type(self).objects.filter(plan_id=self.plan_id, billing_cycle=self.billing_cycle, is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class PlanEntitlement(CreateUpdateTimeModelMixin):
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="entitlements")
    version = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    member_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限")
    team_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限")
    house_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限")
    house_counting_rule = models.CharField(max_length=64, default="all")
    feature_flags = models.JSONField(default=dict, blank=True)
    is_current = models.BooleanField(default=True)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        db_table = "subscriptions_plan_entitlement"
        ordering = ("plan", "-version")
        constraints = [
            models.UniqueConstraint(fields=("plan", "version"), name="subscriptions_entitlement_plan_version_unique"),
            models.UniqueConstraint(fields=("plan",), condition=Q(is_current=True), name="subscriptions_one_current_entitlement"),
        ]

    def __str__(self):
        """返回套餐权益版本。"""
        return f"{self.plan} 权益 v{self.version}"

    def save(self, *args, **kwargs):
        if self.is_current and self.plan_id:
            type(self).objects.filter(plan_id=self.plan_id, is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)


class SubscriptionSettings(CreateUpdateTimeModelMixin):
    """后台可配置的全局订阅策略，目前仅维护组织创建上限。"""

    singleton = models.BooleanField(default=True, unique=True, editable=False)
    organization_creation_limit = models.PositiveIntegerField(default=3)

    class Meta:
        db_table = "subscriptions_settings"
        verbose_name = "订阅全局设置"
        verbose_name_plural = "订阅全局设置"


class Subscription(CreateUpdateTimeModelMixin):
    organization = models.OneToOneField("organizations.Organization", on_delete=models.PROTECT, related_name="subscription")
    source_order = models.ForeignKey("SaaSOrder", null=True, blank=True, on_delete=models.SET_NULL, related_name="activated_subscriptions")
    kind = models.CharField(max_length=16, choices=SubscriptionKind.choices)
    status = models.CharField(max_length=16, choices=SubscriptionStatus.choices)
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices, blank=True, default="")
    plan_snapshot = models.JSONField(default=dict)
    price_snapshot = models.JSONField(default=dict)
    entitlement_snapshot = models.JSONField(default=dict)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    trial_started_at = models.DateTimeField(null=True, blank=True)
    trial_ended_at = models.DateTimeField(null=True, blank=True)
    trial_granted_to = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="granted_subscription_trials")

    class Meta:
        db_table = "subscriptions_subscription"

    def __str__(self):
        """返回组织当前订阅摘要。"""
        return f"{self.organization} - {self.plan_snapshot.get('name', '免费版')}"


class SaaSOrder(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="saas_orders")
    order_no = models.CharField(max_length=40, unique=True, db_index=True)
    order_type = models.CharField(max_length=24, choices=OrderType.choices)
    status = models.CharField(max_length=24, choices=OrderStatus.choices, default=OrderStatus.PENDING_PAYMENT, db_index=True)
    close_reason = models.CharField(max_length=24, choices=OrderCloseReason.choices, blank=True, default="")
    target_plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="orders")
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices)
    plan_snapshot = models.JSONField(default=dict)
    price_snapshot = models.JSONField(default=dict)
    entitlement_snapshot = models.JSONField(default=dict)
    list_amount = models.PositiveIntegerField()
    credit_amount = models.PositiveIntegerField(default=0)
    payable_amount = models.PositiveIntegerField()
    expires_at = models.DateTimeField(db_index=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_saas_orders")
    refund_status = models.CharField(max_length=16, choices=RefundStatus.choices, default=RefundStatus.NONE)
    refunded_amount = models.PositiveIntegerField(default=0)
    refund_reason = models.TextField(blank=True, default="")
    refund_proof = models.CharField(max_length=500, blank=True, default="")
    refund_subscription_action = models.CharField(max_length=16, choices=RefundSubscriptionAction.choices, blank=True, default="")
    refunded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="refunded_saas_orders")
    refunded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "subscriptions_saas_order"
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("organization", "status"), name="sub_order_org_status_idx")]

    def __str__(self):
        """返回平台订单号。"""
        return self.order_no


class PaymentTransaction(CreateUpdateTimeModelMixin):
    order = models.ForeignKey(SaaSOrder, on_delete=models.PROTECT, related_name="payments")
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.WECHAT)
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices)
    transaction_no = models.CharField(max_length=40, unique=True)
    provider_trade_no = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True)
    status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    callback_event_id = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    request_snapshot = models.JSONField(default=dict, blank=True)
    response_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "subscriptions_payment_transaction"
        indexes = [models.Index(fields=("order", "status"), name="sub_payment_order_status_idx")]

    def __str__(self):
        """返回本地支付流水号。"""
        return self.transaction_no


class OrganizationInvoiceProfile(CreateUpdateTimeModelMixin):
    organization = models.OneToOneField("organizations.Organization", on_delete=models.PROTECT, related_name="invoice_profile")
    invoice_type = models.CharField(max_length=16, choices=InvoiceType.choices, default=InvoiceType.COMPANY)
    title = models.CharField(max_length=128)
    tax_number = models.CharField(max_length=64, blank=True, default="")
    recipient_email = models.EmailField()
    registered_address = models.CharField(max_length=255, blank=True, default="")
    registered_phone = models.CharField(max_length=32, blank=True, default="")
    bank_name = models.CharField(max_length=128, blank=True, default="")
    bank_account = models.CharField(max_length=128, blank=True, default="")

    class Meta:
        db_table = "subscriptions_organization_invoice_profile"


class InvoiceRequest(CreateUpdateTimeModelMixin):
    order = models.OneToOneField(SaaSOrder, on_delete=models.PROTECT, related_name="invoice_request")
    profile_snapshot = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=InvoiceStatus.choices, default=InvoiceStatus.PENDING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_invoice_requests")
    invoice_number = models.CharField(max_length=128, blank=True, default="")
    issued_at = models.DateTimeField(null=True, blank=True)
    file_url = models.URLField(blank=True, default="")
    admin_note = models.TextField(blank=True, default="")
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="processed_invoice_requests")

    class Meta:
        db_table = "subscriptions_invoice_request"
        ordering = ("-created_at", "-pk")


class SubscriptionAuditLog(CreateUpdateTimeModelMixin):
    action = models.CharField(max_length=64)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="subscription_audit_logs")
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.PROTECT, related_name="subscription_audit_logs")
    target_type = models.CharField(max_length=64)
    target_id = models.PositiveBigIntegerField()
    before = models.JSONField(default=dict, blank=True)
    after = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "subscriptions_audit_log"
        ordering = ("-created_at", "-pk")
