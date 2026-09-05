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
    RefundStatus,
    RefundSubscriptionAction,
    SubscriptionKind,
    SubscriptionStatus,
)


class Plan(BaseModelMixin):
    """稳定套餐目录；价格和权益始终在独立版本表中维护。"""

    code = models.SlugField(max_length=32, unique=True, verbose_name="编码")
    name = models.CharField(max_length=64, verbose_name="套餐名称")
    description = models.TextField(blank=True, default="", verbose_name="描述")
    display_order = models.PositiveIntegerField(default=0, verbose_name="显示顺序")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        db_table = "subscriptions_plan"
        verbose_name = "套餐"
        verbose_name_plural = "套餐"
        ordering = ("display_order", "pk")

    def __str__(self):
        """返回套餐名称。"""
        return self.name


class PlanPrice(CreateUpdateTimeModelMixin):
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="prices", verbose_name="套餐")
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices, verbose_name="计费周期")
    version = models.PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name="版本")
    amount = models.PositiveIntegerField(help_text="含税价格，单位：分", verbose_name="金额")
    is_current = models.BooleanField(default=True, verbose_name="是否当前记录")
    display_note = models.CharField(max_length=255, blank=True, default="", verbose_name="展示说明")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="发布人")

    class Meta:
        db_table = "subscriptions_plan_price"
        verbose_name = "套餐价格"
        verbose_name_plural = "套餐价格"
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
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="entitlements", verbose_name="套餐")
    version = models.PositiveIntegerField(validators=[MinValueValidator(1)], verbose_name="版本")
    member_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限", verbose_name="成员数量上限")
    team_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限", verbose_name="团队数量上限")
    house_limit = models.PositiveIntegerField(null=True, blank=True, help_text="null 表示不限", verbose_name="房源数量上限")
    house_counting_rule = models.CharField(max_length=64, default="all", verbose_name="房源计数规则")
    feature_flags = models.JSONField(default=dict, blank=True, verbose_name="功能开关")
    is_current = models.BooleanField(default=True, verbose_name="是否当前记录")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="发布人")

    class Meta:
        db_table = "subscriptions_plan_entitlement"
        verbose_name = "套餐权益"
        verbose_name_plural = "套餐权益"
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

    singleton = models.BooleanField(default=True, unique=True, editable=False, verbose_name="单例标记")
    organization_creation_limit = models.PositiveIntegerField(default=3, verbose_name="可创建组织数量上限")

    class Meta:
        db_table = "subscriptions_settings"
        verbose_name = "订阅全局设置"
        verbose_name_plural = "订阅全局设置"


class Subscription(CreateUpdateTimeModelMixin):
    organization = models.OneToOneField("organizations.Organization", on_delete=models.PROTECT, related_name="subscription", verbose_name="所属组织")
    source_order = models.ForeignKey("SaaSOrder", null=True, blank=True, on_delete=models.SET_NULL, related_name="activated_subscriptions", verbose_name="来源订单")
    kind = models.CharField(max_length=16, choices=SubscriptionKind.choices, verbose_name="类型")
    status = models.CharField(max_length=16, choices=SubscriptionStatus.choices, verbose_name="状态")
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices, blank=True, default="", verbose_name="计费周期")
    plan_snapshot = models.JSONField(default=dict, verbose_name="套餐快照")
    price_snapshot = models.JSONField(default=dict, verbose_name="价格快照")
    entitlement_snapshot = models.JSONField(default=dict, verbose_name="权益快照")
    starts_at = models.DateTimeField(null=True, blank=True, verbose_name="开始时间")
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="到期时间")
    ended_at = models.DateTimeField(null=True, blank=True, verbose_name="结束时间")
    trial_started_at = models.DateTimeField(null=True, blank=True, verbose_name="试用开始时间")
    trial_ended_at = models.DateTimeField(null=True, blank=True, verbose_name="试用结束时间")
    trial_granted_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="granted_subscription_trials", verbose_name="试用权益授予用户"
    )

    class Meta:
        db_table = "subscriptions_subscription"
        verbose_name = "组织订阅"
        verbose_name_plural = "组织订阅"

    def __str__(self):
        """返回组织当前订阅摘要。"""
        return f"{self.organization} - {self.plan_snapshot.get('name', '免费版')}"


class SaaSOrder(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.PROTECT, related_name="saas_orders", verbose_name="所属组织")
    order_no = models.CharField(max_length=40, unique=True, db_index=True, verbose_name="订单号")
    order_type = models.CharField(max_length=24, choices=OrderType.choices, verbose_name="订单类型")
    status = models.CharField(max_length=24, choices=OrderStatus.choices, default=OrderStatus.PENDING_PAYMENT, db_index=True, verbose_name="状态")
    close_reason = models.CharField(max_length=24, choices=OrderCloseReason.choices, blank=True, default="", verbose_name="关闭原因")
    target_plan = models.ForeignKey(Plan, on_delete=models.PROTECT, related_name="orders", verbose_name="目标套餐")
    billing_cycle = models.CharField(max_length=16, choices=BillingCycle.choices, verbose_name="计费周期")
    plan_snapshot = models.JSONField(default=dict, verbose_name="套餐快照")
    price_snapshot = models.JSONField(default=dict, verbose_name="价格快照")
    entitlement_snapshot = models.JSONField(default=dict, verbose_name="权益快照")
    list_amount = models.PositiveIntegerField(verbose_name="原价金额")
    credit_amount = models.PositiveIntegerField(default=0, verbose_name="抵扣金额")
    payable_amount = models.PositiveIntegerField(verbose_name="应付金额")
    expires_at = models.DateTimeField(db_index=True, verbose_name="过期时间")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="支付时间")
    closed_at = models.DateTimeField(null=True, blank=True, verbose_name="关闭时间")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_saas_orders", verbose_name="创建人")
    refund_status = models.CharField(max_length=16, choices=RefundStatus.choices, default=RefundStatus.NONE, verbose_name="退款状态")
    refunded_amount = models.PositiveIntegerField(default=0, verbose_name="退款金额")
    refund_reason = models.TextField(blank=True, default="", verbose_name="退款原因")
    refund_proof = models.CharField(max_length=500, blank=True, default="", verbose_name="退款凭证")
    refund_subscription_action = models.CharField(max_length=16, choices=RefundSubscriptionAction.choices, blank=True, default="", verbose_name="退款后的订阅处理")
    refunded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="refunded_saas_orders", verbose_name="退款操作人")
    refunded_at = models.DateTimeField(null=True, blank=True, verbose_name="退款时间")

    class Meta:
        db_table = "subscriptions_saas_order"
        verbose_name = "SaaS 订单"
        verbose_name_plural = "SaaS 订单"
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("organization", "status"), name="sub_order_org_status_idx")]

    def __str__(self):
        """返回平台订单号。"""
        return self.order_no


class OrganizationInvoiceProfile(CreateUpdateTimeModelMixin):
    organization = models.OneToOneField("organizations.Organization", on_delete=models.PROTECT, related_name="invoice_profile", verbose_name="所属组织")
    invoice_type = models.CharField(max_length=16, choices=InvoiceType.choices, default=InvoiceType.COMPANY, verbose_name="发票类型")
    title = models.CharField(max_length=128, verbose_name="标题")
    tax_number = models.CharField(max_length=64, blank=True, default="", verbose_name="纳税人识别号")
    recipient_email = models.EmailField(verbose_name="收件邮箱")
    registered_address = models.CharField(max_length=255, blank=True, default="", verbose_name="注册地址")
    registered_phone = models.CharField(max_length=32, blank=True, default="", verbose_name="注册电话")
    bank_name = models.CharField(max_length=128, blank=True, default="", verbose_name="开户银行")
    bank_account = models.CharField(max_length=128, blank=True, default="", verbose_name="银行账号")

    class Meta:
        db_table = "subscriptions_organization_invoice_profile"
        verbose_name = "组织开票资料"
        verbose_name_plural = "组织开票资料"


class InvoiceRequest(CreateUpdateTimeModelMixin):
    order = models.OneToOneField(SaaSOrder, on_delete=models.PROTECT, related_name="invoice_request", verbose_name="订单")
    profile_snapshot = models.JSONField(default=dict, verbose_name="开票资料快照")
    status = models.CharField(max_length=16, choices=InvoiceStatus.choices, default=InvoiceStatus.PENDING, verbose_name="状态")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_invoice_requests", verbose_name="创建人")
    invoice_number = models.CharField(max_length=128, blank=True, default="", verbose_name="发票号码")
    issued_at = models.DateTimeField(null=True, blank=True, verbose_name="开票时间")
    file_url = models.URLField(blank=True, default="", verbose_name="文件地址")
    admin_note = models.TextField(blank=True, default="", verbose_name="管理员备注")
    processed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="processed_invoice_requests", verbose_name="处理人")

    class Meta:
        db_table = "subscriptions_invoice_request"
        verbose_name = "开票申请"
        verbose_name_plural = "开票申请"
        ordering = ("-created_at", "-pk")


class SubscriptionAuditLog(CreateUpdateTimeModelMixin):
    action = models.CharField(max_length=64, verbose_name="操作")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="subscription_audit_logs", verbose_name="操作人")
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.PROTECT, related_name="subscription_audit_logs", verbose_name="所属组织")
    target_type = models.CharField(max_length=64, verbose_name="目标类型")
    target_id = models.PositiveBigIntegerField(verbose_name="目标标识")
    before = models.JSONField(default=dict, blank=True, verbose_name="变更前数据")
    after = models.JSONField(default=dict, blank=True, verbose_name="变更后数据")

    class Meta:
        db_table = "subscriptions_audit_log"
        verbose_name = "订阅审计日志"
        verbose_name_plural = "订阅审计日志"
        ordering = ("-created_at", "-pk")
