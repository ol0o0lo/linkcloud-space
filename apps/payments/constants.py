from apps.base.enums import StrChoices


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


class PayoutStatus(StrChoices):
    PENDING = "pending", "待发起"
    PROCESSING = "processing", "处理中"
    SUCCEEDED = "succeeded", "成功"
    FAILED = "failed", "失败"
