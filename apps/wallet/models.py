from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.wallet.constants import WithdrawalPayChannel, WithdrawalStatus


class WalletAccount(CreateUpdateTimeModelMixin):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_account")
    available_balance = models.BigIntegerField(default=0)
    frozen_balance = models.BigIntegerField(default=0)
    total_income = models.BigIntegerField(default=0)
    total_withdrawn = models.BigIntegerField(default=0)

    def __str__(self):
        """返回钱包账户标识。"""
        return f"WalletAccount<{self.user_id}>"


class WalletLedger(CreateUpdateTimeModelMixin):
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="ledgers")
    entry_type = models.CharField(max_length=64)
    amount_delta = models.BigIntegerField()
    available_balance_after = models.BigIntegerField()
    frozen_balance_after = models.BigIntegerField()
    biz_type = models.CharField(max_length=100, blank=True, default="")
    biz_id = models.CharField(max_length=100, blank=True, default="")
    idempotency_key = models.CharField(max_length=120, unique=True)
    remark = models.CharField(max_length=255, blank=True, default="")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")

    class Meta:
        ordering = ("-created_at", "-pk")


class WithdrawalRequest(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawal_requests")
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="withdrawal_requests")
    amount = models.BigIntegerField()
    fee_amount = models.BigIntegerField(default=0)
    net_amount = models.BigIntegerField()
    client_request_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=32, choices=WithdrawalStatus.choices, default=WithdrawalStatus.PENDING_REVIEW)
    pay_channel = models.CharField(max_length=32, choices=WithdrawalPayChannel.choices, default=WithdrawalPayChannel.WECHAT)
    payee_account_snapshot = models.JSONField(default=dict)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_withdrawals")
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reject_reason = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "client_request_id"], name="wallet_withdraw_user_client_req_uniq"),
        ]
        ordering = ("-created_at", "-pk")
