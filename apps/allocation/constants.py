from apps.base.enums import StrChoices

ALLOCATION_CURRENCY = "CNY"
ALLOCATION_REVIEW_VALIDITY_HOURS = 24 * 7
ALLOCATION_TIMEZONE = "Asia/Shanghai"


class AllocationRequestStatus(StrChoices):
    PENDING = "pending", "待审核"
    APPROVED = "approved", "已通过"
    REJECTED = "rejected", "不通过"
    EXPIRED = "expired", "已过期"
    VOIDED = "voided", "已作废"


class AllocationDistributionMethod(StrChoices):
    PERCENTAGE = "percentage", "按比例"
    FIXED = "fixed", "固定金额"


class AllocationRuleSource(StrChoices):
    DEFAULT = "default", "平台默认"
    ORGANIZATION = "organization", "租户设置"
    TEAM = "team", "团队设置"


class AllocationItemEffect(StrChoices):
    INCREASE = "increase", "增加"
    DECREASE = "decrease", "扣减"


class AccrualEntryType(StrChoices):
    ALLOCATION = "allocation", "业务分配"
    MANUAL_INCREASE = "manual_increase", "人工增加"
    MANUAL_DECREASE = "manual_decrease", "人工扣减"
    REVERSAL = "reversal", "冲销"
