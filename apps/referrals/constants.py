from apps.base.enums import StrChoices


class ReferralRecordStatus(StrChoices):
    REGISTERED = "registered", "已注册"
    PENDING_REVIEW = "pending_review", "待审核"
    REVIEW_REJECTED = "review_rejected", "审核驳回"
    REWARD_ISSUED = "reward_issued", "已发奖"


class ReferralDisplayLevel(StrChoices):
    MASKED_PROGRESS = "masked_progress", "脱敏进度"


class ReferralTriggerEvent(StrChoices):
    REAL_NAME_VERIFIED = "real_name_verified", "实名认证通过"
