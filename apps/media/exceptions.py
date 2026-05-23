"""
Media app 异常。

app 分类 code segment = "20"，继承 BadRequestException(01)。
完整 code = "01" + "20" + 具体段，例如 InvalidExtensionException → "012001"
"""

from apps.base.exceptions import BadRequestException


class MediaException(BadRequestException):
    """Media app 异常基类。"""
    code = "20"
    message = "媒体操作失败"


class InvalidExtensionException(MediaException):
    """不支持的文件扩展名。"""
    code = "01"
    message = "不支持的文件扩展名"


class InvalidScopeException(MediaException):
    """非法的 scope 参数。"""
    code = "02"
    message = "非法的 scope 参数"
