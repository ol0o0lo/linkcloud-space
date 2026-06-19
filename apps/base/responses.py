import time
from typing import Any

from django.http import HttpRequest

from ninja import NinjaAPI

SUCCESS_CODE = 200
SUCCESS_MESSAGE = "success"
EMPTY_TRACE_ID = ""


def response_timestamp() -> int:
    return int(time.time())


def success_envelope(data: Any) -> dict[str, Any]:
    return {
        "code": SUCCESS_CODE,
        "message": SUCCESS_MESSAGE,
        "data": data,
        "timestamp": response_timestamp(),
        "traceId": EMPTY_TRACE_ID,
    }


def error_envelope(*, code: int, error: str, message: str, data: Any = None) -> dict[str, Any]:
    return {
        "code": code,
        "error": error,
        "message": message,
        "data": data,
        "timestamp": response_timestamp(),
        "traceId": EMPTY_TRACE_ID,
    }


class EnvelopedNinjaAPI(NinjaAPI):
    def create_response(self, request: HttpRequest, data: Any, *, status: int | None = None, temporal_response=None):
        if temporal_response:
            status = temporal_response.status_code
        if status == 204:
            status = 200
            if temporal_response:
                temporal_response.status_code = status
        return super().create_response(request, success_envelope(data), status=status, temporal_response=temporal_response)
