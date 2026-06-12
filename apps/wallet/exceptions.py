from django.utils.translation import gettext_lazy as _

from apps.base.exceptions import BadRequestException


class WalletException(BadRequestException):
    code = "30"
    message = _("钱包操作失败")


class UnsupportedWithdrawalChannelException(WalletException):
    code = "01"
    message = _("不支持的提现渠道")


class WechatBindingRequiredException(WalletException):
    code = "02"
    message = _("未绑定微信，请先绑定微信")


class WalletWechatConfigMissingException(WalletException):
    code = "03"
    message = _("微信提现配置缺失")


class WalletWechatSnapshotIncompleteException(WalletException):
    code = "04"
    message = _("微信提现收款信息不完整")


class WalletPayoutProviderRejectedException(WalletException):
    code = "05"
    message = _("微信提现请求未被受理")
