from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent


class ReferralRuleConfig(CreateUpdateTimeModelMixin):
    name = models.CharField(max_length=50, unique=True, verbose_name="规则名称")
    trigger_event = models.CharField(max_length=50, choices=ReferralTriggerEvent.choices, default=ReferralTriggerEvent.REAL_NAME_VERIFIED, verbose_name="触发事件")
    inviter_reward_amount = models.BigIntegerField(default=0, verbose_name="邀请人奖励金额")
    invitee_reward_amount = models.BigIntegerField(default=0, verbose_name="受邀人奖励金额")
    requires_manual_review = models.BooleanField(default=True, verbose_name="是否需要人工审核")
    allow_link = models.BooleanField(default=True, verbose_name="允许邀请链接")
    allow_code = models.BooleanField(default=True, verbose_name="允许邀请码")
    display_level = models.CharField(max_length=32, choices=ReferralDisplayLevel.choices, default=ReferralDisplayLevel.MASKED_PROGRESS, verbose_name="展示级别")

    class Meta:
        verbose_name = "邀请奖励规则"
        verbose_name_plural = "邀请奖励规则"

    def __str__(self):
        return self.name


class ReferralLink(CreateUpdateTimeModelMixin):
    inviter = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_link", verbose_name="邀请人")
    code = models.CharField(max_length=32, unique=True, verbose_name="编码")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        verbose_name = "邀请链接"
        verbose_name_plural = "邀请链接"

    def __str__(self):
        return f"ReferralLink<{self.inviter_id}:{self.code}>"


class ReferralRecord(CreateUpdateTimeModelMixin):
    inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_referral_records", verbose_name="邀请人")
    invitee = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_referral_record", verbose_name="受邀人")
    referral_link = models.ForeignKey(ReferralLink, on_delete=models.PROTECT, related_name="records", verbose_name="邀请链接")
    status = models.CharField(max_length=32, choices=ReferralRecordStatus.choices, default=ReferralRecordStatus.REGISTERED, verbose_name="状态")

    class Meta:
        verbose_name = "邀请记录"
        verbose_name_plural = "邀请记录"
        ordering = ("-created_at", "-pk")

    def __str__(self):
        return f"ReferralRecord<{self.inviter_id}->{self.invitee_id}>"


class ReferralRewardReview(CreateUpdateTimeModelMixin):
    referral_record = models.ForeignKey(ReferralRecord, on_delete=models.CASCADE, related_name="reviews", verbose_name="邀请记录")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="审核人")
    action = models.CharField(max_length=20, verbose_name="操作")
    remark = models.CharField(max_length=255, blank=True, default="", verbose_name="备注")

    class Meta:
        verbose_name = "邀请奖励审核"
        verbose_name_plural = "邀请奖励审核"
        ordering = ("-created_at", "-pk")

    def __str__(self):
        return f"ReferralRewardReview<{self.referral_record_id}:{self.action}>"
