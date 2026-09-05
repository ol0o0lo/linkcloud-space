from apps.base.exceptions import BadRequestException, ConflictException


class AllocationAlreadyExistsException(ConflictException):
    error = "allocation.already_exists"
    message = "该业务单据已经提交过分配申请。"


class AllocationNotPendingException(ConflictException):
    error = "allocation.not_pending"
    message = "只有待审核的分配申请可以执行该操作。"


class AllocationExpiredException(ConflictException):
    error = "allocation.expired"
    code = 410
    message = "分配申请已经超过审核有效期。"


class AllocationAlreadyVoidedException(ConflictException):
    error = "allocation.already_voided"
    message = "分配申请已经作废。"


class AllocationInvalidException(BadRequestException):
    error = "allocation.invalid"
