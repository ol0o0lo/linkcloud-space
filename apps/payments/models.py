from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.payments.constants import PaymentMode, PaymentProvider, PaymentStatus, PayoutStatus


class PaymentTransaction(CreateUpdateTimeModelMixin):
    biz_type = models.CharField(max_length=64)
    biz_id = models.CharField(max_length=64)
    transaction_no = models.CharField(max_length=64, unique=True)
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.WECHAT)
    payment_mode = models.CharField(max_length=16, choices=PaymentMode.choices)
    amount = models.PositiveIntegerField(help_text="金额，单位：分")
    description = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    provider_trade_no = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True)
    status = models.CharField(max_length=16, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    callback_event_id = models.CharField(max_length=128, blank=True, default=None, unique=True, null=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    request_snapshot = models.JSONField(default=dict, blank=True)
    response_snapshot = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "payments_payment_transaction"
        constraints = [models.UniqueConstraint(fields=("biz_type", "biz_id"), name="payments_transaction_business_unique")]
        indexes = [models.Index(fields=("biz_type", "biz_id"), name="payments_tx_business_idx")]

    def __str__(self):
        """返回本地支付交易号。"""
        return self.transaction_no


class PayoutTransaction(CreateUpdateTimeModelMixin):
    biz_type = models.CharField(max_length=64)
    biz_id = models.CharField(max_length=64)
    provider = models.CharField(max_length=16, choices=PaymentProvider.choices, default=PaymentProvider.WECHAT)
    out_trade_no = models.CharField(max_length=64, unique=True)
    provider_trade_no = models.CharField(max_length=128, blank=True, default="")
    idempotency_key = models.CharField(max_length=120, unique=True)
    amount = models.PositiveIntegerField(help_text="金额，单位：分")
    payee_snapshot = models.JSONField(default=dict)
    request_snapshot = models.JSONField(default=dict, blank=True)
    response_snapshot = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=16, choices=PayoutStatus.choices, default=PayoutStatus.PENDING)
    error_code = models.CharField(max_length=64, blank=True, default="")
    error_message = models.CharField(max_length=255, blank=True, default="")
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments_payout_transaction"
        ordering = ("-created_at", "-pk")
        indexes = [models.Index(fields=("biz_type", "biz_id", "status"), name="payments_payout_biz_idx")]

    def __str__(self):
        """返回本地出款交易号。"""
        return self.out_trade_no
