"""
Permission helpers for ninja routes.

These replace DRF's permission_classes with a small set of explicit checks
that raise ``PermissionDenied`` (which the global error handler in
apps/base/errors.py converts to a 403 API error envelope).
"""

from typing import Any

from django.core.exceptions import PermissionDenied
from django.http import HttpRequest


def require_authenticated(request: HttpRequest) -> None:
    if not (request.user and request.user.is_authenticated):
        raise PermissionDenied("请先登录。")


def require_superuser(request: HttpRequest) -> None:
    require_authenticated(request)
    if not request.user.is_superuser:
        raise PermissionDenied("需要超级管理员权限。")


def require_org_selected(request: HttpRequest) -> Any:
    """Return the active organization model instance or raise 403."""
    org_ctx = getattr(request, "org", None)
    org = org_ctx.instance if org_ctx is not None else None
    if org is None:
        raise PermissionDenied("请先选择组织。")
    return org


def require_org_owner(request: HttpRequest) -> Any:
    """Return the active org or raise 403 if the user isn't the owner."""
    org = require_org_selected(request)
    if not org.is_owner(request.user):
        raise PermissionDenied("仅组织所有者可执行此操作。")
    return org
