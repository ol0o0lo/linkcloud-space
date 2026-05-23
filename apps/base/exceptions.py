"""
异常体系基类。

code 由 MRO 链上各层的 _code_segment 拼接而成：
    BadRequestError(_code_segment="01") + MediaError(_code_segment="20")
    + InvalidExtensionError(_code_segment="01") → code="012001"

各 app 在自己的 exceptions.py 中继承对应的大类并定义子类。
"""


class AppException(Exception):
    _code_segment: str = ""
    status_code: int = 500
    default_message: str = "服务异常"

    def __init__(self, message: str | None = None):
        self.message = message or self.default_message
        super().__init__(self.message)

    @classmethod
    def code(cls) -> str:
        return "".join(
            klass.__dict__["_code_segment"]
            for klass in reversed(cls.__mro__)
            if "_code_segment" in klass.__dict__ and klass.__dict__["_code_segment"]
        )


# ── 通用大类 ────────────────────────────────────────────────────────────────

class BadRequestException(AppException):
    """400 参数或业务校验失败。"""
    _code_segment = "01"
    status_code = 400
    default_message = "请求参数错误"


class AuthException(AppException):
    """401 未认证。"""
    _code_segment = "02"
    status_code = 401
    default_message = "请先登录"


class ForbiddenException(AppException):
    """403 无权限。"""
    _code_segment = "03"
    status_code = 403
    default_message = "无操作权限"


class NotFoundException(AppException):
    """404 资源不存在。"""
    _code_segment = "04"
    status_code = 404
    default_message = "资源不存在"


class ConflictException(AppException):
    """409 资源冲突（重复创建等）。"""
    _code_segment = "05"
    status_code = 409
    default_message = "资源已存在"


class QuotaExceededException(AppException):
    """402 超出配额限制。"""
    _code_segment = "06"
    status_code = 402
    default_message = "已达到创建上限"
