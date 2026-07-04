from apps.base.enums import StrChoices


class RealNameStatus(StrChoices):
    UNVERIFIED = "unverified", "未实名"
    PENDING = "pending", "待校验"
    VERIFIED = "verified", "已实名"
    REJECTED = "rejected", "已驳回"
    MANUAL_REVIEW = "manual_review", "人工复核"
    REVOKED = "revoked", "已撤销"


class AdminUserRole(StrChoices):
    SUPERUSER = "superuser", "超级管理员"
    STAFF = "staff", "后台账号"
    USER = "user", "普通账号"


class PhoneCountryCode(StrChoices):
    CN = "+86", "+86 (中国)"
    HK = "+852", "+852 (香港)"
    MO = "+853", "+853 (澳门)"
    TW = "+886", "+886 (台湾)"
    US = "+1", "+1 (美国)"
    JP = "+81", "+81 (日本)"
    KR = "+82", "+82 (韩国)"
    SG = "+65", "+65 (新加坡)"
    MY = "+60", "+60 (马来西亚)"
    GB = "+44", "+44 (英国)"


class RealNameSource(StrChoices):
    USER_SUBMIT = "user_submit", "用户主动提交"
    BUSINESS_GATE = "business_gate", "业务拦截触发"


class RealNameProvider(StrChoices):
    MOCK_AUTO = "mock_auto", "模拟自动校验"
    MANUAL_ADMIN = "manual_admin", "后台人工处理"


class RealNameLogAction(StrChoices):
    SUBMITTED = "submitted", "提交认证"
    AUTO_VERIFIED = "auto_verified", "自动通过"
    AUTO_REJECTED = "auto_rejected", "自动驳回"
    MOVED_TO_MANUAL_REVIEW = "moved_to_manual_review", "转人工复核"
    MANUAL_APPROVED = "manual_approved", "人工通过"
    MANUAL_REJECTED = "manual_rejected", "人工驳回"
    REVOKED = "revoked", "撤销实名"


class RealNameIdCardSide(StrChoices):
    FRONT = "front", "人像面"
    BACK = "back", "国徽面"
