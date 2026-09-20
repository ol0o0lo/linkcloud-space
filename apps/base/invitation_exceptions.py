from apps.base.exceptions import ConflictException, ForbiddenException, NotFoundException


class InvitationUnavailableException(NotFoundException):
    error = "invitation.unavailable"
    message = "邀请无效或已过期。"


class InvitationExpiredException(NotFoundException):
    error = "invitation.expired"
    code = 410
    message = "该邀请已过期。"


class InvitationRecipientMismatchException(ForbiddenException):
    error = "invitation.recipient_mismatch"
    message = "该邀请不是发送给当前账号的。"


class InvitationPhoneVerificationRequiredException(ForbiddenException):
    error = "invitation.phone_verification_required"
    message = "请先验证受邀手机号。"


class InvitationBindingConflictException(ConflictException):
    error = "invitation.binding_conflict"
    message = "该邀请对应的业务关系已绑定其他账号。"
