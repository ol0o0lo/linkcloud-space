from apps.base.enums import StrChoices
from apps.payments.constants import PayoutStatus

__all__ = ["PayoutStatus"]


class WalletEntryType(StrChoices):
    PROMOTION_REWARD = "promotion_reward", "推广奖励入账"
    ADMIN_ADJUSTMENT_INCREASE = "admin_adjustment_increase", "管理员增加余额"
    ADMIN_ADJUSTMENT_DECREASE = "admin_adjustment_decrease", "管理员扣减余额"
    WITHDRAW_FREEZE = "withdraw_freeze", "提现冻结"
    WITHDRAW_CANCEL = "withdraw_cancel", "用户撤销提现"
    WITHDRAW_UNFREEZE = "withdraw_unfreeze", "提现驳回解冻"
    WITHDRAW_SETTLE = "withdraw_settle", "提现成功结算"
    WITHDRAW_REFUND = "withdraw_refund", "提现失败退回"


class WithdrawalPayChannel(StrChoices):
    WECHAT = "wechat", "微信提现"


class WithdrawalStatus(StrChoices):
    PENDING_REVIEW = "pending_review", "待审核"
    CANCELLED = "cancelled", "已撤销"
    REJECTED = "rejected", "已驳回"
    APPROVED = "approved", "已通过待打款"
    PAYING = "paying", "打款中"
    PAID = "paid", "已打款"
    FAILED = "failed", "打款失败"
