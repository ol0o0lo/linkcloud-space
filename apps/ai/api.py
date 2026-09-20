import json
from dataclasses import asdict
from typing import Literal

from django.http import StreamingHttpResponse

from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.ai.runtime.contracts import AIErrorCode, AIExecutionError
from apps.ai.schemas import ConversationCreateIn, ConversationOut, MessageCreateIn, MessageGenerationOut, MessageOut
from apps.ai.services import (
    _conversation_queryset,
    _create_conversation,
    _get_conversation,
    _send_conversation_message,
    _stream_conversation_message,
)
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected

router = Router(tags=["AI"])

ERROR_STATUS = {
    AIErrorCode.INVALID_REQUEST: 400,
    AIErrorCode.PERMISSION_DENIED: 403,
    AIErrorCode.CONTENT_REJECTED: 422,
    AIErrorCode.STRUCTURED_OUTPUT_INVALID: 422,
    AIErrorCode.CAPABILITY_UNAVAILABLE: 503,
    AIErrorCode.PROVIDER_AUTH_ERROR: 503,
    AIErrorCode.RATE_LIMITED: 503,
    AIErrorCode.TIMEOUT: 504,
    AIErrorCode.PROVIDER_UNAVAILABLE: 503,
    AIErrorCode.STREAM_INTERRUPTED: 502,
    AIErrorCode.INTERNAL_ERROR: 500,
}


def _service_call(function, **kwargs):
    try:
        return function(**kwargs)
    except AIExecutionError as exc:
        raise HttpError(ERROR_STATUS.get(exc.code, 500), exc.safe_message) from exc


def _scope_org(request, scope: Literal["personal", "organization"]):
    return None if scope == "personal" else require_org_selected(request)


@router.post("/conversations/", response=ConversationOut, summary="创建 AI 对话")
def create_conversation(request, payload: ConversationCreateIn):
    require_authenticated(request)
    return _service_call(_create_conversation, actor=request.user, organization=_scope_org(request, payload.scope))


@router.get("/conversations/", response=list[ConversationOut], summary="查询本人 AI 对话")
@paginate(LegacyPagination)
def list_conversations(request, scope: Literal["personal", "organization"] = Query("organization")):
    require_authenticated(request)
    return _service_call(_conversation_queryset, actor=request.user, active_organization=_scope_org(request, scope))


@router.get("/conversations/{conversation_id}/messages/", response=list[MessageOut], summary="查询 AI 对话消息")
@paginate(LegacyPagination)
def list_messages(request, conversation_id: int):
    require_authenticated(request)
    active_org = getattr(getattr(request, "org", None), "instance", None)
    conversation = _service_call(
        _get_conversation,
        actor=request.user,
        active_organization=active_org,
        conversation_id=conversation_id,
    )
    return conversation.messages.all()


@router.post("/conversations/{conversation_id}/messages/", response=MessageGenerationOut, summary="发送 AI 对话消息")
def create_message(request, conversation_id: int, payload: MessageCreateIn):
    require_authenticated(request)
    active_org = getattr(getattr(request, "org", None), "instance", None)
    result, message = _service_call(
        _send_conversation_message,
        actor=request.user,
        active_organization=active_org,
        conversation_id=conversation_id,
        content=payload.content,
        idempotency_key=payload.idempotency_key,
    )
    return {"invocation_id": result.invocation_id, "message": message}


def _sse_events(handle):
    for chunk in handle.chunks:
        payload = {
            "invocation_id": handle.invocation_id,
            "text": chunk.text,
            "usage": asdict(chunk.usage) if chunk.usage else None,
            "finish_reason": chunk.finish_reason,
            "error_code": chunk.error_code,
            "message": chunk.error_message,
            **dict(chunk.metadata),
        }
        yield f"event: {chunk.event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/conversations/{conversation_id}/messages/stream/", response=None, summary="流式发送 AI 对话消息")
def stream_message(request, conversation_id: int, payload: MessageCreateIn):
    require_authenticated(request)
    active_org = getattr(getattr(request, "org", None), "instance", None)
    handle = _service_call(
        _stream_conversation_message,
        actor=request.user,
        active_organization=active_org,
        conversation_id=conversation_id,
        content=payload.content,
        idempotency_key=payload.idempotency_key,
    )
    response = StreamingHttpResponse(_sse_events(handle), content_type="text/event-stream; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response
