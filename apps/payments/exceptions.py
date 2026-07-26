from apps.base.exceptions import ConflictException


class PaymentConfigurationException(Exception):
    """支付渠道配置不完整或渠道请求失败。"""


class PaymentCallbackConflictException(ConflictException):
    error = "PAYMENT_CALLBACK_CONFLICT"
    message = "支付回调与已有交易冲突。"
