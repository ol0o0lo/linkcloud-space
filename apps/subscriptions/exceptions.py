from apps.base.exceptions import AppException


class QuotaExceededException(AppException):
    code = 422
    error = "QUOTA_EXCEEDED"
    message = "当前套餐的数量配额已达上限。"


class SubscriptionRuleException(AppException):
    code = 400
    error = "SUBSCRIPTION_RULE_VIOLATION"
    message = "当前操作不符合订阅规则。"


class PaymentConfigurationException(AppException):
    code = 503
    error = "PAYMENT_CONFIGURATION_MISSING"
    message = "微信支付尚未完成配置。"
