from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.wallet.constants import WithdrawalPayChannel, WithdrawalStatus


class WalletAccount(CreateUpdateTimeModelMixin):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="wallet_account", verbose_name="用户")
    available_balance = models.BigIntegerField(default=0, verbose_name="可用余额")
    frozen_balance = models.BigIntegerField(default=0, verbose_name="冻结余额")
    total_income = models.BigIntegerField(default=0, verbose_name="累计收入")
    total_withdrawn = models.BigIntegerField(default=0, verbose_name="累计提现")

    class Meta:
        verbose_name = "钱包账户"
        verbose_name_plural = "钱包账户"

    def __str__(self):
        """返回钱包账户标识。"""
        return f"WalletAccount<{self.user_id}>"


class WalletLedger(CreateUpdateTimeModelMixin):
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="ledgers", verbose_name="钱包账户")
    entry_type = models.CharField(max_length=64, verbose_name="流水类型")
    amount_delta = models.BigIntegerField(verbose_name="金额变动")
    available_balance_after = models.BigIntegerField(verbose_name="变动后可用余额")
    frozen_balance_after = models.BigIntegerField(verbose_name="变动后冻结余额")
    biz_type = models.CharField(max_length=100, blank=True, default="", verbose_name="业务类型")
    biz_id = models.CharField(max_length=100, blank=True, default="", verbose_name="业务标识")
    idempotency_key = models.CharField(max_length=120, unique=True, verbose_name="幂等键")
    remark = models.CharField(max_length=255, blank=True, default="", verbose_name="备注")
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="操作人")

    class Meta:
        verbose_name = "钱包流水"
        verbose_name_plural = "钱包流水"
        ordering = ("-created_at", "-pk")


class WithdrawalRequest(CreateUpdateTimeModelMixin):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="withdrawal_requests", verbose_name="用户")
    wallet = models.ForeignKey(WalletAccount, on_delete=models.CASCADE, related_name="withdrawal_requests", verbose_name="钱包账户")
    amount = models.BigIntegerField(verbose_name="金额")
    fee_amount = models.BigIntegerField(default=0, verbose_name="手续费金额")
    net_amount = models.BigIntegerField(verbose_name="实际到账金额")
    client_request_id = models.CharField(max_length=64, blank=True, default="", verbose_name="客户端请求标识")
    status = models.CharField(max_length=32, choices=WithdrawalStatus.choices, default=WithdrawalStatus.PENDING_REVIEW, verbose_name="状态")
    pay_channel = models.CharField(max_length=32, choices=WithdrawalPayChannel.choices, default=WithdrawalPayChannel.WECHAT, verbose_name="付款渠道")
    payee_account_snapshot = models.JSONField(default=dict, verbose_name="收款账户快照")
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="reviewed_withdrawals", verbose_name="审核人")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="审核时间")
    reject_reason = models.CharField(max_length=255, blank=True, default="", verbose_name="拒绝原因")

    class Meta:
        verbose_name = "提现申请"
        verbose_name_plural = "提现申请"
        constraints = [
            models.UniqueConstraint(fields=["user", "client_request_id"], name="wallet_withdraw_user_client_req_uniq"),
        ]
        ordering = ("-created_at", "-pk")
