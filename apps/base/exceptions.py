"""
异常体系基类。

code 由 MRO 链上各层的 code 拼接而成：
    BadRequestError(code="01") + MediaError(code="20")
    + InvalidExtensionError(code="01") → code="012001"

各 app 在自己的 exceptions.py 中继承对应的大类并定义子类。
所有 AppException 响应均使用 HTTP 200，由 code 字段区分错误类型。
"""

from typing import ClassVar


class AppException(Exception):
    code: ClassVar[str] = ""
    message: ClassVar[str] = "服务异常"

    def __init__(self, message: str | None = None):
        self.message: str = message if message is not None else self.__class__.message
        super().__init__(self.message)

    @classmethod
    def full_code(cls) -> str:
        return "".join(
            klass.__dict__["code"]
            for klass in reversed(cls.__mro__)
            if "code" in klass.__dict__ and klass.__dict__["code"]
        )


# 通用大类

class BadRequestException(AppException):
    """参数或业务校验失败。"""
    code = "01"
    message = "请求参数错误"


class AuthException(AppException):
    """未认证。"""
    code = "02"
    message = "请先登录"


class ForbiddenException(AppException):
    """无权限。"""
    code = "03"
    message = "无操作权限"


class NotFoundException(AppException):
    """资源不存在。"""
    code = "04"
    message = "资源不存在"


class ConflictException(AppException):
    """资源冲突（重复创建等）。"""
    code = "05"
    message = "资源已存在"


class QuotaExceededException(AppException):
    """超出配额限制。"""
    code = "06"
    message = "已达到创建上限"
