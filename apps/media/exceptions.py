"""
Media app 异常。

app 分类 code segment = "20"，继承 BadRequestException(01)。
完整 code = "01" + "20" + 具体段，例如 InvalidExtensionException → "012001"
"""

from apps.base.exceptions import BadRequestException


class MediaException(BadRequestException):
    """Media app 异常基类。"""
    _code_segment = "20"
    default_message = "媒体操作失败"


class InvalidExtensionException(MediaException):
    """不支持的文件扩展名。"""
    _code_segment = "01"
    default_message = "不支持的文件扩展名"


class InvalidScopeException(MediaException):
    """非法的 scope 参数。"""
    _code_segment = "02"
    default_message = "非法的 scope 参数"
