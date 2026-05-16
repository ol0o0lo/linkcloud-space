"""
DRF 全局异常处理器。

统一错误响应格式为 {"detail": "..."} 或 {"field": ["..."]}，
与 Ninja 侧（apps/base/errors.py）保持一致，方便前端/小程序统一处理。
"""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    # 先走 DRF 默认处理（处理 DRF 自己的 APIException 子类）
    response = exception_handler(exc, context)
    if response is not None:
        return response

    # Django 原生 PermissionDenied → 403
    if isinstance(exc, DjangoPermissionDenied):
        return Response(
            {"detail": str(exc) or "Permission denied."},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Django 原生 Http404 → 404
    if isinstance(exc, Http404):
        return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    # Django ValidationError → 400
    if isinstance(exc, DjangoValidationError):
        if hasattr(exc, "message_dict"):
            data = dict(exc.message_dict)
            if "__all__" in data:
                data["non_field_errors"] = data.pop("__all__")
        elif hasattr(exc, "messages"):
            data = {"non_field_errors": list(exc.messages)}
        else:
            data = {"non_field_errors": [str(exc)]}
        return Response(data, status=status.HTTP_400_BAD_REQUEST)

    # 其他未处理异常不返回 response，让 Django 默认 500 处理
    return None
