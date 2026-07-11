"""异常体系基类。"""

from typing import Any, ClassVar

from django.utils.translation import gettext_lazy as _


class AppException(Exception):
    error: ClassVar[str] = "APP_ERROR"
    code: ClassVar[int] = 400
    message: ClassVar[str] = _("服务异常")

    def __init__(self, message: str | None = None, *, fields: dict[str, list[str]] | None = None, data: Any = None):
        self.message: str = message if message is not None else self.__class__.message
        self.fields = fields
        self.data = data
        super().__init__(self.message)


# 通用大类


class BadRequestException(AppException):
    """参数或业务校验失败。"""

    error = "BAD_REQUEST"
    code = 400
    message = _("请求参数错误")


class AuthException(AppException):
    """未认证。"""

    error = "UNAUTHORIZED"
    code = 401
    message = _("请先登录")


class ForbiddenException(AppException):
    """无权限。"""

    error = "FORBIDDEN"
    code = 403
    message = _("无操作权限")


class NotFoundException(AppException):
    """资源不存在。"""

    error = "NOT_FOUND"
    code = 404
    message = _("资源不存在")


class ConflictException(AppException):
    """资源冲突（重复创建等）。"""

    error = "CONFLICT"
    code = 409
    message = _("资源已存在")


class QuotaExceededException(AppException):
    """超出配额限制。"""

    error = "QUOTA_EXCEEDED"
    code = 429
    message = _("已达到创建上限")
