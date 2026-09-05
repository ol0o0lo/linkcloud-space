from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.payments.constants import PaymentMode, PaymentProvider, PaymentStatus, PayoutStatus


class PaymentTransaction(CreateUpdateTimeModelMixin):
    biz_type = models.CharField(max_length=64, verbose_name="业务类型")
    biz_id = models.CharField(max_length=64, verbose_name="业务标识")
    transaction_no = models.CharField(max_length=64, unique=True, verbose_name="交易号")
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.WECHAT, verbose_name="服务提供方")
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices, verbose_name="支付方式")
    amount = models.PositiveIntegerField(help_text="金额，单位：分", verbose_name="金额")
    description = models.CharField(max_length=128, verbose_name="描述")
    expires_at = models.DateTimeField(verbose_name="过期时间")
    provider_trade_no = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True, verbose_name="服务方交易号")
    status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING, verbose_name="状态")
    callback_event_id = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True, verbose_name="回调事件标识")
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name="支付时间")
    request_snapshot = models.JSONField(default=dict, blank=True, verbose_name="请求快照")
    response_snapshot = models.JSONField(default=dict, blank=True, verbose_name="响应快照")

    class Meta:
        db_table = "payments_payment_transaction"
        verbose_name = "支付交易"
        verbose_name_plural = "支付交易"
        constraints = [models.UniqueConstraint(fields=("biz_type", "biz_id"), name="payments_transaction_business_unique")]
        indexes = [models.Index(fields=("biz_type", "biz_id"), name="payments_tx_business_idx")]

    def __str__(self):
        """返回本地支付交易号。"""
        return self.transaction_no


class PayoutTransaction(CreateUpdateTimeModelMixin):
    biz_type = models.CharField(max_length=64, verbose_name="业务类型")
    biz_id = models.CharField(max_length=64, verbose_name="业务标识")
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.WECHAT, verbose_name="服务提供方")
    out_trade_no = models.CharField(max_length=64, unique=True, verbose_name="商户订单号")
    provider_trade_no = models.CharField(max_length=128, blank=True, default="", verbose_name="服务方交易号")
    idempotency_key = models.CharField(max_length=120, unique=True, verbose_name="幂等键")
    amount = models.PositiveIntegerField(help_text="金额，单位：分", verbose_name="金额")
    payee_snapshot = models.JSONField(default=dict, verbose_name="收款方快照")
    request_snapshot = models.JSONField(default=dict, blank=True, verbose_name="请求快照")
    response_snapshot = models.JSONField(default=dict, blank=True, verbose_name="响应快照")
    status = models.CharField(max_length=16, choices=PayoutStatus.choices, default=PayoutStatus.PENDING, verbose_name="状态")
    error_code = models.CharField(max_length=64, blank=True, default="", verbose_name="错误码")
    error_message = models.CharField(max_length=255, blank=True, default="", verbose_name="错误信息")
    executed_at = models.DateTimeField(null=True, blank=True, verbose_name="执行时间")

    class Meta:
        db_table = "payments_payout_transaction"
        verbose_name = "付款交易"
        verbose_name_plural = "付款交易"
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("biz_type", "biz_id", "status"), name="payments_payout_biz_idx")]

    def __str__(self):
        """返回本地出款交易号。"""
        return self.out_trade_no
