from apps.base.enums import StrChoices


class BillingCycle(StrChoices):
    MONTH = "month", "月付"
    YEAR = "year", "年付"


class SubscriptionKind(StrChoices):
    TRIAL = "trial", "试用"
    PAID = "paid", "付费"


class SubscriptionStatus(StrChoices):
    TRIALING = "trialing", "试用中"
    ACTIVE = "active", "已生效"
    ENDED = "ended", "已结束"


class OrderType(StrChoices):
    INITIAL_PURCHASE = "initial_purchase", "首次购买"
    RENEWAL = "renewal", "续费"
    UPGRADE = "upgrade", "套餐升级"


class OrderStatus(StrChoices):
    PENDING_PAYMENT = "pending_payment", "待支付"
    PAID = "paid", "已支付"
    CLOSED = "closed", "已关闭"
    PAYMENT_FAILED = "payment_failed", "支付失败"


class OrderCloseReason(StrChoices):
    TIMEOUT = "timeout", "支付超时"
    SUPERSEDED = "superseded", "已被新订单替代"
    PROVIDER_FAILED = "provider_failed", "渠道失败"


class RefundStatus(StrChoices):
    NONE = "none", "未退款"
    PARTIAL = "partial", "部分退款"
    FULL = "full", "全额退款"


class RefundSubscriptionAction(StrChoices):
    KEEP = "keep", "保留订阅"
    END = "end", "立即结束订阅"


class PaymentProvider(StrChoices):
    WECHAT = "wechat", "微信支付"


class PaymentMode(StrChoices):
    NATIVE = "native", "微信扫码支付"
    MINIPROGRAM = "miniprogram", "微信小程序支付"


class PaymentStatus(StrChoices):
    PENDING = "pending", "待支付"
    SUCCEEDED = "succeeded", "支付成功"
    FAILED = "failed", "支付失败"
    EXCEPTION = "exception", "异常待处理"


class InvoiceStatus(StrChoices):
    PENDING = "pending", "待处理"
    PROCESSING = "processing", "处理中"
    ISSUED = "issued", "已开票"
    REJECTED = "rejected", "已拒绝"
    CANCELLED = "cancelled", "已取消"


class InvoiceType(StrChoices):
    PERSONAL = "personal", "个人"
    COMPANY = "company", "企业"


MONTH_DAYS = 30
YEAR_DAYS = 365
MAX_SUBSCRIPTION_DAYS = 365 * 3
TRIAL_DAYS = 14
ORDER_EXPIRY_MINUTES = 30
