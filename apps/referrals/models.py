from django.conf import settings
from django.db import models

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.referrals.constants import ReferralDisplayLevel, ReferralRecordStatus, ReferralTriggerEvent


class ReferralRuleConfig(CreateUpdateTimeModelMixin):
    name = models.CharField(max_length=50, unique=True)
    trigger_event = models.CharField(max_length=50, choices=ReferralTriggerEvent.choices, default=ReferralTriggerEvent.REAL_NAME_VERIFIED)
    inviter_reward_amount = models.BigIntegerField(default=0)
    invitee_reward_amount = models.BigIntegerField(default=0)
    requires_manual_review = models.BooleanField(default=True)
    allow_link = models.BooleanField(default=True)
    allow_code = models.BooleanField(default=True)
    display_level = models.CharField(max_length=32, choices=ReferralDisplayLevel.choices, default=ReferralDisplayLevel.MASKED_PROGRESS)

    def __str__(self):
        return self.name


class ReferralLink(CreateUpdateTimeModelMixin):
    inviter = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="referral_link")
    code = models.CharField(max_length=32, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"ReferralLink<{self.inviter_id}:{self.code}>"


class ReferralRecord(CreateUpdateTimeModelMixin):
    inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_referral_records")
    invitee = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="received_referral_record")
    referral_link = models.ForeignKey(ReferralLink, on_delete=models.PROTECT, related_name="records")
    status = models.CharField(max_length=32, choices=ReferralRecordStatus.choices, default=ReferralRecordStatus.REGISTERED)

    class Meta:
        ordering = ("-created_at", "-pk")

    def __str__(self):
        return f"ReferralRecord<{self.inviter_id}->{self.invitee_id}>"


class ReferralRewardReview(CreateUpdateTimeModelMixin):
    referral_record = models.ForeignKey(ReferralRecord, on_delete=models.CASCADE, related_name="reviews")
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    action = models.CharField(max_length=20)
    remark = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        ordering = ("-created_at", "-pk")

    def __str__(self):
        return f"ReferralRewardReview<{self.referral_record_id}:{self.action}>"
