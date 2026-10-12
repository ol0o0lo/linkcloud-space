from apps.base.exceptions import AppException, ConflictException


class HouseInvalidException(AppException):
    code = 422
    error = "UNPROCESSABLE_ENTITY"


class HouseUnavailableException(AppException):
    code = 503
    error = "HTTP_ERROR"


class ResourceInUseException(ConflictException):
    error = "RESOURCE_IN_USE"

    def __init__(self, message: str, check: dict):
        super().__init__(message, data=check)


class HouseCommuteRouteBusy(ConflictException):
    message = "该通勤路线正在计算，请稍后重试。"
