from django.utils.translation import gettext_lazy as _

from apps.base.exceptions import ConflictException


class AccessException(ConflictException):
    error = "ACCESS_ERROR"
    message = _("访问控制操作失败")


class RoleInUseException(AccessException):
    error = "ROLE_IN_USE"
    code = 409
    message = _("角色仍被用户引用，无法删除。")

    def __init__(self):
        message = str(self.__class__.message)
        super().__init__(message, fields={"role": [message]})
