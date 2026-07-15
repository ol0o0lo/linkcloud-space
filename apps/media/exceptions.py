from django.utils.translation import gettext_lazy as _

from apps.base.exceptions import AppException, BadRequestException


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


class InvalidFileSizeException(MediaException):
    """媒体文件大小不合法。"""

    error = "INVALID_FILE_SIZE"
    code = 400
    message = _("媒体文件大小不合法")


class MediaStorageUnavailableException(AppException):
    """对象存储暂时不可用。"""

    error = "MEDIA_STORAGE_UNAVAILABLE"
    code = 503
    message = _("媒体存储暂时不可用，请稍后重试")
