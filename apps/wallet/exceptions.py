from django.utils.translation import gettext_lazy as _

from apps.base.exceptions import BadRequestException


class WalletException(BadRequestException):
    error = "WALLET_ERROR"
    code = 400
    message = _("钱包操作失败")


class UnsupportedWithdrawalChannelException(WalletException):
    error = "UNSUPPORTED_WITHDRAWAL_CHANNEL"
    code = 400
    message = _("不支持的提现渠道")


class WechatBindingRequiredException(WalletException):
    error = "WECHAT_BINDING_REQUIRED"
    code = 400
    message = _("未绑定微信，请先绑定微信")


class WalletWechatConfigMissingException(WalletException):
    error = "WALLET_WECHAT_CONFIG_MISSING"
    code = 400
    message = _("微信提现配置缺失")


class WalletWechatSnapshotIncompleteException(WalletException):
    error = "WALLET_WECHAT_SNAPSHOT_INCOMPLETE"
    code = 400
    message = _("微信提现收款信息不完整")


class WalletPayoutProviderRejectedException(WalletException):
    error = "WALLET_PAYOUT_PROVIDER_REJECTED"
    code = 400
    message = _("微信提现请求未被受理")
