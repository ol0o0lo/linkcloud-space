from apps.base.exceptions import ConflictException


class AccountMergeReviewRequired(ConflictException):
    error = "ACCOUNT_MERGE_REVIEW_REQUIRED"
    message = "该手机号已有账号，当前无法自动合并，请联系人工处理。"

    def __init__(self, reason: str):
        super().__init__(data={"reason": reason})
