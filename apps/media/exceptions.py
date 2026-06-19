from django.utils.translation import gettext_lazy as _

from apps.base.exceptions import BadRequestException


class MediaException(BadRequestException):
    """Media app 异常基类。"""

    error = "MEDIA_ERROR"
    code = 400
    message = _("媒体操作失败")


class InvalidExtensionException(MediaException):
    """不支持的文件扩展名。"""

    error = "INVALID_EXTENSION"
    code = 400
    message = _("不支持的文件扩展名")


class InvalidScopeException(MediaException):
    """非法的 scope 参数。"""

    error = "INVALID_SCOPE"
    code = 400
    message = _("非法的 scope 参数")
