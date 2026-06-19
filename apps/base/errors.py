"""
Exception handlers for the ninja API.

Translate ninja/Pydantic/Django errors into one stable JSON envelope.
"""

from collections import defaultdict

from django.core.exceptions import PermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404, JsonResponse

from ninja.errors import HttpError
from ninja.errors import ValidationError as NinjaValidationError

from apps.base.exceptions import AppException
from apps.base.responses import error_envelope


def _wrap_field_errors(field_errors: dict[str, list[str]]) -> dict[str, list[str]]:
    return {field: list(messages) for field, messages in field_errors.items() if messages}


def _first_field_error(field_errors: dict[str, list[str]], default: str) -> str:
    for messages in field_errors.values():
        if messages:
            return str(messages[0])
    return default


def _error_response(
    *,
    error: str,
    message: str,
    code: int,
    fields: dict[str, list[str]] | None = None,
):
    data = {"fields": fields} if fields else None
    payload = error_envelope(code=code, error=error, message=message, data=data)
    return JsonResponse(payload, status=code)


def _http_error_code(status_code: int) -> str:
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        409: "CONFLICT",
        410: "GONE",
        422: "UNPROCESSABLE_ENTITY",
    }.get(status_code, "HTTP_ERROR")


def _ninja_validation_to_field_errors(exc: NinjaValidationError) -> dict[str, list[str]]:
    """
    Translate ninja validation errors into a field-keyed dict.

    Ninja emits ``[{loc: [...], msg: ..., type: ...}, ...]``; this collapses
    that into ``{field_name: [msg, ...]}``. The last meaningful element of
    ``loc`` is the field name; ``body``/``query``/``path`` location prefixes
    are dropped.
    """
    grouped: dict[str, list[str]] = defaultdict(list)
    for err in exc.errors:
        loc = [str(part) for part in err.get("loc", []) if str(part) not in {"body", "query", "path", "form"}]
        field = loc[-1] if loc else "non_field_errors"
        grouped[field].append(err.get("msg", "Invalid input."))
    return _wrap_field_errors(grouped)


def _django_validation_to_field_errors(exc: DjangoValidationError) -> dict[str, list[str]]:
    if hasattr(exc, "message_dict"):
        # Replace the magic __all__ key with the SPA's expected non_field_errors key.
        result = dict(exc.message_dict)
        if "__all__" in result:
            result["non_field_errors"] = result.pop("__all__")
        return _wrap_field_errors(result)
    if hasattr(exc, "messages"):
        return _wrap_field_errors({"non_field_errors": list(exc.messages)})
    return _wrap_field_errors({"non_field_errors": [str(exc)]})


def register_error_handlers(api) -> None:
    @api.exception_handler(AppException)
    def _app_exception(request, exc: AppException):
        return _error_response(
            error=exc.__class__.error,
            message=str(exc.message),
            code=exc.__class__.code,
            fields=exc.fields,
        )

    @api.exception_handler(NinjaValidationError)
    def _ninja_validation(request, exc):
        fields = _ninja_validation_to_field_errors(exc)
        return _error_response(
            error="VALIDATION_ERROR",
            message=_first_field_error(fields, "请求参数错误。"),
            code=400,
            fields=fields,
        )

    @api.exception_handler(DjangoValidationError)
    def _django_validation(request, exc):
        fields = _django_validation_to_field_errors(exc)
        return _error_response(
            error="VALIDATION_ERROR",
            message=_first_field_error(fields, "请求参数错误。"),
            code=400,
            fields=fields,
        )

    @api.exception_handler(PermissionDenied)
    def _permission_denied(request, exc):
        return _error_response(error="FORBIDDEN", message=str(exc) or "Permission denied.", code=403)

    @api.exception_handler(Http404)
    def _not_found(request, exc):
        return _error_response(error="NOT_FOUND", message="Not found.", code=404)

    @api.exception_handler(HttpError)
    def _http_error(request, exc):
        return _error_response(error=_http_error_code(exc.status_code), message=str(exc.message), code=exc.status_code)
