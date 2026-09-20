import hashlib
import hmac
import json
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.module_loading import import_string

from pydantic import BaseModel

from apps.access.constants import AIPermission
from apps.access.services import has_permission
from apps.ai.models import AIConversation, AIInvocation, AIMessage
from apps.ai.runtime.contracts import (
    AICapability,
    AIChatMessage,
    AIErrorCode,
    AIExecutionContext,
    AIExecutionError,
    AIExecutionMode,
    AIExecutionRequest,
    AIInvocationStatus,
    AIRetentionPolicy,
    AIStreamChunk,
    AIUsage,
)
from apps.ai.runtime.executor import (
    ExecutionTrace,
    StreamExecutionState,
    aggregate_attempt_cost,
    aggregate_attempt_usage,
    execute,
    stream_execute,
)
from apps.ai.runtime.retention import RetentionDecision, decide_retention, sanitize_safe_summary
from apps.organizations.models import OrganizationMember
from apps.settings.models import DefaultSetting
from apps.settings.service import get_org_setting

__all__ = [
    "AICapability",
    "AIChatMessage",
    "AIErrorCode",
    "AIExecutionError",
    "AIJob",
    "AIResult",
    "AIRetentionPolicy",
    "AIStreamHandle",
    "ensure_capability_access",
    "enqueue",
    "generate",
    "get_job",
    "stream",
]


@dataclass(frozen=True, slots=True)
class AIResult:
    invocation_id: int
    text: str
    data: dict[str, Any] | None
    usage: AIUsage


@dataclass(frozen=True, slots=True)
class AIStreamHandle:
    invocation_id: int
    chunks: Iterator[AIStreamChunk]


@dataclass(frozen=True, slots=True)
class AIJob:
    invocation_id: int
    status: str
    text: str | None
    data: dict[str, Any] | None
    error_code: str
    error_message: str


def _authorize_call(*, actor, organization, capability: AICapability, trusted_system: bool) -> None:
    if not settings.AI_ENABLED:
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "AI 功能当前未启用。")
    if actor is None:
        if not trusted_system:
            raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "AI 系统任务未被授权。")
        if organization is not None:
            _ensure_capability_allowed(organization, capability)
        return
    if not getattr(actor, "is_authenticated", False):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is None:
        if capability != AICapability.CHAT:
            raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "该 AI 能力必须在组织空间内使用。")
        return
    if not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    if not actor.is_superuser and not has_permission(actor, organization, AIPermission.USE.value):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "没有使用 AI 能力的权限。")
    _ensure_capability_allowed(organization, capability)


def ensure_capability_access(*, actor, organization, capability: AICapability) -> None:
    """供业务模块在读取已生成 AI 结果前复用统一权限与组织能力校验。"""
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=False)


def _ensure_capability_allowed(organization, capability: AICapability) -> None:
    try:
        allowed = get_org_setting(organization, "ai.allowed_capabilities")["value"]
    except DefaultSetting.DoesNotExist as exc:
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "AI 组织能力配置尚未初始化。") from exc
    if not isinstance(allowed, list) or capability.value not in allowed:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "当前组织未启用该 AI 能力。")


def _authorize_history(*, actor, organization) -> None:
    if not getattr(actor, "is_authenticated", False):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is None:
        return
    if not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    if not actor.is_superuser and not has_permission(actor, organization, AIPermission.VIEW_OWN_HISTORY.value):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "没有查看 AI 对话历史的权限。")


def _json_safe(value):
    try:
        return json.loads(json.dumps(value, cls=DjangoJSONEncoder, ensure_ascii=False))
    except (TypeError, ValueError) as exc:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入必须是可序列化的 JSON 数据。") from exc


def _content_hash(input_payload: dict, output_payload: dict) -> str:
    encoded = json.dumps(
        {"input": input_payload, "output": output_payload},
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        cls=DjangoJSONEncoder,
    ).encode()
    return hmac.new(str(settings.SECRET_KEY).encode(), encoded, hashlib.sha256).hexdigest()


def _validate_call_metadata(*, prompt_key: str, source_app: str, target_type: str, target_id: str, idempotency_key: str) -> None:
    limits = {
        "Prompt key": (prompt_key, 100),
        "来源模块": (source_app, 80),
        "业务对象类型": (target_type, 80),
        "业务对象 ID": (target_id, 100),
        "幂等键": (idempotency_key, 128),
    }
    if not isinstance(source_app, str) or not source_app.strip():
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 调用必须声明来源模块。")
    for label, (value, max_length) in limits.items():
        if not isinstance(value, str) or len(value) > max_length:
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, f"{label}格式无效或超过长度限制。")


def _normalize_messages(messages: Sequence[AIChatMessage]) -> tuple[AIChatMessage, ...]:
    normalized = []
    for message in messages:
        role = getattr(message, "role", None)
        content = getattr(message, "content", None)
        if role not in {"system", "user", "assistant"} or not isinstance(content, str):
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 消息格式无效。")
        normalized.append(AIChatMessage(role=role, content=content))
    return tuple(normalized)


def _invocations_for_identity(*, actor, organization, source_app: str, idempotency_key: str):
    return AIInvocation.objects.filter(
        actor=actor,
        organization=organization,
        source_app=source_app,
        idempotency_key=idempotency_key,
    )


def _replay(invocation: AIInvocation) -> AIResult | None:
    if invocation.status != AIInvocationStatus.SUCCEEDED.value:
        return None
    if hasattr(invocation, "assistant_message"):
        message = invocation.assistant_message
        return AIResult(
            invocation.pk,
            message.content,
            message.content_json,
            AIUsage(invocation.input_tokens, invocation.output_tokens, invocation.total_tokens, invocation.usage_status),
        )
    if invocation.output_payload:
        return AIResult(
            invocation.pk,
            invocation.output_payload.get("text", ""),
            invocation.output_payload.get("data"),
            AIUsage(invocation.input_tokens, invocation.output_tokens, invocation.total_tokens, invocation.usage_status),
        )
    return None


def _build_input_payload(variables: dict[str, Any], messages: Sequence[AIChatMessage]) -> dict:
    payload = _json_safe(
        {
            "variables": variables,
            "messages": [{"role": item.role, "content": item.content} for item in messages],
        }
    )
    if len(json.dumps(payload, ensure_ascii=False)) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入载荷超过平台上限。")
    return payload


def _execution_context(invocation: AIInvocation) -> AIExecutionContext:
    return AIExecutionContext(
        actor_id=invocation.actor_id,
        organization_id=invocation.organization_id,
        source_app=invocation.source_app,
        target_type=invocation.target_type,
        target_id=invocation.target_id,
        idempotency_key=invocation.idempotency_key,
        retention_policy=AIRetentionPolicy(invocation.retention_policy),
        safe_summary=invocation.safe_summary,
    )


def _failure_updates(invocation: AIInvocation, error: AIExecutionError, trace: ExecutionTrace, input_payload: dict) -> dict:
    finished_at = timezone.now()
    candidate = trace.selected_candidate
    return {
        "status": AIInvocationStatus.FAILED.value,
        "prompt_key": trace.prompt.key if trace.prompt else invocation.prompt_key,
        "prompt_version": trace.prompt.version if trace.prompt else invocation.prompt_version,
        "prompt_hash": trace.prompt.template_hash if trace.prompt else invocation.prompt_hash,
        "provider_code": candidate.provider_code if candidate else invocation.provider_code,
        "model_name": candidate.model_name if candidate else invocation.model_name,
        "error_type": error.code.value,
        "error_code": error.code.value,
        "error_summary": error.safe_message[:500],
        "attempts": trace.attempts,
        "content_hash": _content_hash(input_payload, {}),
        "finished_at": finished_at,
        "duration_ms": int((finished_at - (invocation.started_at or invocation.created_at)).total_seconds() * 1000),
    }


def _success_updates(
    invocation: AIInvocation,
    result,
    trace: ExecutionTrace,
    retention: RetentionDecision,
    input_payload: dict,
) -> tuple[dict, AIUsage]:
    candidate = trace.selected_candidate
    if candidate is None or trace.prompt is None:
        raise AIExecutionError(AIErrorCode.INTERNAL_ERROR, "AI 调用缺少执行轨迹。")
    aggregate_usage = aggregate_attempt_usage(trace.attempts)
    aggregate_cost, aggregate_currency = aggregate_attempt_cost(trace.attempts)
    output_payload = {"text": result.text, "data": result.structured_data} if retention.persist_output else {}
    finished_at = timezone.now()
    return (
        {
            "status": AIInvocationStatus.SUCCEEDED.value,
            "prompt_key": trace.prompt.key,
            "prompt_version": trace.prompt.version,
            "prompt_hash": trace.prompt.template_hash,
            "provider_code": candidate.provider_code,
            "model_name": candidate.model_name,
            "input_tokens": aggregate_usage.input_tokens,
            "output_tokens": aggregate_usage.output_tokens,
            "total_tokens": aggregate_usage.total_tokens,
            "usage_status": aggregate_usage.source,
            "input_price_snapshot": candidate.input_price_per_million,
            "output_price_snapshot": candidate.output_price_per_million,
            "estimated_cost": aggregate_cost,
            "currency": aggregate_currency,
            "first_token_ms": result.first_token_ms,
            "provider_request_id": result.provider_request_id,
            "attempts": trace.attempts,
            "output_payload": output_payload,
            "content_hash": _content_hash(input_payload, {"text": result.text, "data": result.structured_data}),
            "finished_at": finished_at,
            "duration_ms": int((finished_at - (invocation.started_at or invocation.created_at)).total_seconds() * 1000),
        },
        aggregate_usage,
    )


def _execute_existing_invocation(
    invocation: AIInvocation,
    request: AIExecutionRequest,
    *,
    retention: RetentionDecision,
    input_payload: dict,
) -> AIResult:
    trace = ExecutionTrace()
    try:
        result = execute(request, _execution_context(invocation), trace=trace)
    except AIExecutionError as error:
        AIInvocation.objects.filter(pk=invocation.pk).update(**_failure_updates(invocation, error, trace, input_payload))
        raise
    except Exception as unexpected:
        error = AIExecutionError(AIErrorCode.INTERNAL_ERROR, "AI 调用发生内部错误。")
        AIInvocation.objects.filter(pk=invocation.pk).update(**_failure_updates(invocation, error, trace, input_payload))
        raise error from unexpected

    updates, aggregate_usage = _success_updates(invocation, result, trace, retention, input_payload)
    AIInvocation.objects.filter(pk=invocation.pk).update(**updates)
    if invocation.conversation_id:
        AIMessage.objects.get_or_create(
            invocation_id=invocation.pk,
            defaults={
                "conversation_id": invocation.conversation_id,
                "role": "assistant",
                "content": result.text,
                "content_json": result.structured_data,
                "token_count": aggregate_usage.output_tokens,
            },
        )
    return AIResult(invocation.pk, result.text, dict(result.structured_data) if result.structured_data is not None else None, aggregate_usage)


def generate(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    prompt_version: int | None = None,
    variables: dict[str, Any] | None = None,
    messages: Sequence[AIChatMessage] = (),
    response_model: type[BaseModel] | None = None,
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    conversation: AIConversation | None = None,
    trusted_system: bool = False,
) -> AIResult:
    """同步生成；业务模块应通过此函数接入 AI。"""
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    _validate_call_metadata(
        prompt_key=prompt_key,
        source_app=source_app,
        target_type=target_type,
        target_id=target_id,
        idempotency_key=idempotency_key,
    )
    if idempotency_key:
        existing = _invocations_for_identity(actor=actor, organization=organization, source_app=source_app, idempotency_key=idempotency_key).first()
        if existing is not None:
            replayed = _replay(existing)
            if replayed is not None:
                return replayed
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同幂等键的 AI 调用正在执行、已失败或结果已过期。")

    variables = variables or {}
    messages = _normalize_messages(messages)
    input_payload = _build_input_payload(variables, messages)
    now = timezone.now()
    retention = decide_retention(retention_policy, now=now, temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    try:
        invocation = AIInvocation.objects.create(
            actor=actor,
            organization=organization,
            conversation=conversation,
            capability=capability.value,
            source_app=source_app,
            target_type=target_type,
            target_id=target_id,
            execution_mode=AIExecutionMode.SYNC.value,
            status=AIInvocationStatus.RUNNING.value,
            idempotency_key=idempotency_key,
            retention_policy=retention_policy.value,
            input_payload=input_payload if retention.persist_input else {},
            content_expires_at=retention.expires_at,
            safe_summary=sanitize_safe_summary(safe_summary),
            content_hash=_content_hash(input_payload, {}),
            started_at=now,
        )
    except IntegrityError as exc:
        if idempotency_key:
            existing = _invocations_for_identity(actor=actor, organization=organization, source_app=source_app, idempotency_key=idempotency_key).first()
            replayed = _replay(existing) if existing else None
            if replayed is not None:
                return replayed
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 调用幂等键冲突。") from exc

    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        prompt_version=prompt_version,
        variables=variables,
        messages=messages,
        response_model=response_model,
        execution_mode=AIExecutionMode.SYNC,
    )
    return _execute_existing_invocation(invocation, request, retention=retention, input_payload=input_payload)


def _finalize_stream_invocation(
    invocation: AIInvocation,
    state: StreamExecutionState,
    retention: RetentionDecision,
    original_input_payload: dict,
) -> None:
    text = "".join(state.text_parts)
    candidate = state.trace.selected_candidate
    if state.completed:
        status = AIInvocationStatus.SUCCEEDED.value
    elif state.error and state.error.code == AIErrorCode.STREAM_INTERRUPTED:
        status = AIInvocationStatus.INTERRUPTED.value
    else:
        status = AIInvocationStatus.FAILED.value
    output_payload = {"text": text, "data": None} if retention.persist_output and state.completed else {}
    aggregate_usage = aggregate_attempt_usage(state.trace.attempts)
    aggregate_cost, aggregate_currency = aggregate_attempt_cost(state.trace.attempts)
    finished_at = timezone.now()
    AIInvocation.objects.filter(pk=invocation.pk).update(
        status=status,
        prompt_key=state.trace.prompt.key if state.trace.prompt else "",
        prompt_version=state.trace.prompt.version if state.trace.prompt else None,
        prompt_hash=state.trace.prompt.template_hash if state.trace.prompt else "",
        provider_code=candidate.provider_code if candidate else "",
        model_name=candidate.model_name if candidate else "",
        input_price_snapshot=candidate.input_price_per_million if candidate else None,
        output_price_snapshot=candidate.output_price_per_million if candidate else None,
        estimated_cost=aggregate_cost,
        currency=aggregate_currency,
        input_tokens=aggregate_usage.input_tokens,
        output_tokens=aggregate_usage.output_tokens,
        total_tokens=aggregate_usage.total_tokens,
        usage_status=aggregate_usage.source,
        first_token_ms=state.first_token_ms,
        error_type=state.error.code.value if state.error else "",
        error_code=state.error.code.value if state.error else "",
        error_summary=state.error.safe_message[:500] if state.error else "",
        provider_request_id=state.provider_request_id,
        attempts=state.trace.attempts,
        output_payload=output_payload,
        content_hash=_content_hash(original_input_payload, {"text": text}),
        finished_at=finished_at,
        duration_ms=int((finished_at - (invocation.started_at or invocation.created_at)).total_seconds() * 1000),
    )
    if state.completed and invocation.conversation_id:
        message, _ = AIMessage.objects.get_or_create(
            invocation_id=invocation.pk,
            defaults={
                "conversation_id": invocation.conversation_id,
                "role": "assistant",
                "content": text,
                "token_count": aggregate_usage.output_tokens,
            },
        )
        AIConversation.objects.filter(pk=invocation.conversation_id).update(last_message_at=message.created_at)


def stream(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    prompt_version: int | None = None,
    variables: dict[str, Any] | None = None,
    messages: Sequence[AIChatMessage] = (),
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    conversation: AIConversation | None = None,
    trusted_system: bool = False,
) -> AIStreamHandle:
    """创建流式调用并返回惰性 chunk 迭代器。"""
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    _validate_call_metadata(
        prompt_key=prompt_key,
        source_app=source_app,
        target_type=target_type,
        target_id=target_id,
        idempotency_key=idempotency_key,
    )
    if (
        idempotency_key
        and _invocations_for_identity(
            actor=actor,
            organization=organization,
            source_app=source_app,
            idempotency_key=idempotency_key,
        ).exists()
    ):
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同幂等键的流式调用已存在。")

    variables = variables or {}
    messages = _normalize_messages(messages)
    input_payload = _build_input_payload(variables, messages)
    now = timezone.now()
    retention = decide_retention(retention_policy, now=now, temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    try:
        invocation = AIInvocation.objects.create(
            actor=actor,
            organization=organization,
            conversation=conversation,
            capability=capability.value,
            source_app=source_app,
            target_type=target_type,
            target_id=target_id,
            execution_mode=AIExecutionMode.STREAM.value,
            status=AIInvocationStatus.RUNNING.value,
            idempotency_key=idempotency_key,
            retention_policy=retention_policy.value,
            input_payload=input_payload if retention.persist_input else {},
            content_expires_at=retention.expires_at,
            safe_summary=sanitize_safe_summary(safe_summary),
            content_hash=_content_hash(input_payload, {}),
            started_at=now,
        )
    except IntegrityError as exc:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 流式调用幂等键冲突。") from exc

    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        prompt_version=prompt_version,
        variables=variables,
        messages=messages,
        execution_mode=AIExecutionMode.STREAM,
    )
    state = StreamExecutionState()

    def persisted_chunks():
        try:
            yield from stream_execute(request, _execution_context(invocation), state=state)
        except GeneratorExit:
            state.error = AIExecutionError(AIErrorCode.STREAM_INTERRUPTED, "客户端已断开流式连接。")
            raise
        except AIExecutionError as error:
            state.error = error
            yield AIStreamChunk(event="error", error_code=error.code.value, error_message=error.safe_message)
        except Exception:
            state.error = AIExecutionError(AIErrorCode.INTERNAL_ERROR, "AI 流式调用发生内部错误。")
            yield AIStreamChunk(event="error", error_code=state.error.code.value, error_message=state.error.safe_message)
        finally:
            _finalize_stream_invocation(invocation, state, retention, input_payload)

    return AIStreamHandle(invocation_id=invocation.pk, chunks=persisted_chunks())


def _response_model_path(response_model: type[BaseModel] | None) -> str:
    if response_model is None:
        return ""
    if "<locals>" in response_model.__qualname__ or "." in response_model.__qualname__:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "异步结构化 Schema 必须定义在可导入模块的顶层。")
    return f"{response_model.__module__}.{response_model.__qualname__}"


def _serialize_async_request(request: AIExecutionRequest) -> dict:
    return {
        "capability": request.capability.value,
        "prompt_key": request.prompt_key,
        "prompt_version": request.prompt_version,
        "variables": dict(request.variables),
        "messages": [{"role": item.role, "content": item.content} for item in request.messages],
        "response_model_path": _response_model_path(request.response_model),
    }


def enqueue(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    prompt_version: int | None = None,
    variables: dict[str, Any] | None = None,
    messages: Sequence[AIChatMessage] = (),
    response_model: type[BaseModel] | None = None,
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    trusted_system: bool = False,
) -> AIJob:
    """创建异步 AI 任务；Celery 消息只携带 invocation_id。"""
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    _validate_call_metadata(
        prompt_key=prompt_key,
        source_app=source_app,
        target_type=target_type,
        target_id=target_id,
        idempotency_key=idempotency_key,
    )
    if retention_policy != AIRetentionPolicy.TEMPORARY:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "可查询的异步任务必须使用 temporary 保留策略。")
    if idempotency_key:
        existing = _invocations_for_identity(actor=actor, organization=organization, source_app=source_app, idempotency_key=idempotency_key).first()
        if existing is not None:
            return _job_from_invocation(existing)

    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        prompt_version=prompt_version,
        variables=variables or {},
        messages=_normalize_messages(messages),
        response_model=response_model,
        execution_mode=AIExecutionMode.ASYNC,
    )
    retention = decide_retention(retention_policy, now=timezone.now(), temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    input_payload = _json_safe({"request": _serialize_async_request(request)})
    if len(json.dumps(input_payload, ensure_ascii=False)) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 异步输入载荷超过平台上限。")
    try:
        invocation = AIInvocation.objects.create(
            actor=actor,
            organization=organization,
            capability=capability.value,
            source_app=source_app,
            target_type=target_type,
            target_id=target_id,
            execution_mode=AIExecutionMode.ASYNC.value,
            status=AIInvocationStatus.QUEUED.value,
            idempotency_key=idempotency_key,
            retention_policy=retention_policy.value,
            input_payload=input_payload,
            content_expires_at=retention.expires_at,
            safe_summary=sanitize_safe_summary(safe_summary),
            content_hash=_content_hash(input_payload, {}),
        )
    except IntegrityError as exc:
        if idempotency_key:
            existing = _invocations_for_identity(actor=actor, organization=organization, source_app=source_app, idempotency_key=idempotency_key).first()
            if existing is not None:
                return _job_from_invocation(existing)
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 异步任务幂等键冲突。") from exc

    from apps.ai.tasks import execute_ai_invocation

    transaction.on_commit(lambda: execute_ai_invocation.delay(invocation.pk))
    return _job_from_invocation(invocation)


def _execute_queued_invocation(invocation: AIInvocation) -> None:
    payload = invocation.input_payload.get("request") or {}
    try:
        capability = AICapability(payload["capability"])
        _authorize_call(
            actor=invocation.actor,
            organization=invocation.organization,
            capability=capability,
            trusted_system=invocation.actor_id is None,
        )
        model_path = payload.get("response_model_path", "")
        response_model = import_string(model_path) if model_path else None
        if response_model is not None and not issubclass(response_model, BaseModel):
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "异步结构化 Schema 类型无效。")
        request = AIExecutionRequest(
            capability=capability,
            prompt_key=payload["prompt_key"],
            prompt_version=payload.get("prompt_version"),
            variables=payload.get("variables", {}),
            messages=tuple(AIChatMessage(item["role"], item["content"]) for item in payload.get("messages", [])),
            response_model=response_model,
            execution_mode=AIExecutionMode.ASYNC,
        )
    except AIExecutionError:
        raise
    except Exception as exc:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 异步任务载荷无效。") from exc

    retention = decide_retention(
        AIRetentionPolicy(invocation.retention_policy),
        now=invocation.created_at,
        temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS,
    )
    _execute_existing_invocation(invocation, request, retention=retention, input_payload=invocation.input_payload)


def _job_from_invocation(invocation: AIInvocation) -> AIJob:
    payload = invocation.output_payload or {}
    return AIJob(
        invocation_id=invocation.pk,
        status=invocation.status,
        text=payload.get("text"),
        data=payload.get("data"),
        error_code=invocation.error_code,
        error_message=invocation.error_summary,
    )


def get_job(*, actor, organization, invocation_id: int, source_app: str) -> AIJob:
    """按调用人、租户和来源模块查询异步任务，避免跨边界读取。"""
    if not getattr(actor, "is_authenticated", False):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is not None and not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    invocation = (
        AIInvocation.objects.defer("input_payload")
        .filter(actor=actor, organization=organization, source_app=source_app, pk=invocation_id, execution_mode=AIExecutionMode.ASYNC.value)
        .first()
    )
    if invocation is None:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "无权查看该 AI 任务。")
    return _job_from_invocation(invocation)


def _conversation_queryset(*, actor, active_organization):
    _authorize_history(actor=actor, organization=active_organization)
    return AIConversation.objects.filter(owner=actor, organization=active_organization)


def _create_conversation(*, actor, organization):
    _authorize_call(actor=actor, organization=organization, capability=AICapability.CHAT, trusted_system=False)
    return AIConversation.objects.create(owner=actor, organization=organization, capability=AICapability.CHAT.value)


def _get_conversation(*, actor, active_organization, conversation_id):
    conversation = get_object_or_404(AIConversation.objects.filter(owner=actor), pk=conversation_id)
    if conversation.organization_id is not None and conversation.organization_id != getattr(active_organization, "pk", None):
        raise Http404
    _authorize_history(actor=actor, organization=conversation.organization)
    return conversation


def _conversation_invocation_key(conversation_id: int, client_key: str) -> str:
    raw = f"conversation:{conversation_id}:{client_key}"
    return raw if len(raw) <= 128 else f"conversation:{conversation_id}:{hashlib.sha256(client_key.encode()).hexdigest()}"


def _create_user_message(conversation: AIConversation, content: str, client_key: str) -> tuple[AIMessage, bool]:
    normalized = content.strip()
    if not normalized:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "消息内容不能为空。")
    with transaction.atomic():
        message, created = AIMessage.objects.get_or_create(
            conversation=conversation,
            client_message_key=client_key,
            defaults={"role": "user", "content": normalized},
        )
        if not created and message.content != normalized:
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同幂等键不能对应不同消息内容。")
        if created:
            fields = ["last_message_at", "updated_at"]
            conversation.last_message_at = message.created_at
            if not conversation.title:
                conversation.title = normalized[:60]
                fields.append("title")
            conversation.save(update_fields=fields)
    return message, created


def _conversation_history(conversation: AIConversation) -> tuple[AIChatMessage, ...]:
    history = list(conversation.messages.order_by("-created_at", "-pk")[: settings.AI_MAX_CONVERSATION_MESSAGES])
    history.reverse()
    return tuple(AIChatMessage(message.role, message.content) for message in history)


def _send_conversation_message(*, actor, active_organization, conversation_id: int, content: str, idempotency_key: str):
    conversation = _get_conversation(actor=actor, active_organization=active_organization, conversation_id=conversation_id)
    if conversation.status != "active":
        raise Http404
    _, created = _create_user_message(conversation, content, idempotency_key)
    invocation_key = _conversation_invocation_key(conversation.pk, idempotency_key)
    if not created:
        existing = _invocations_for_identity(
            actor=actor,
            organization=conversation.organization,
            source_app="ai.conversation",
            idempotency_key=invocation_key,
        ).first()
        replayed = _replay(existing) if existing is not None else None
        if replayed is not None:
            return replayed, existing.assistant_message
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同消息正在生成或上次生成失败。")

    result = generate(
        actor=actor,
        organization=conversation.organization,
        capability=AICapability.CHAT,
        prompt_key=settings.AI_CHAT_PROMPT_KEY,
        messages=_conversation_history(conversation),
        source_app="ai.conversation",
        target_type="conversation",
        target_id=str(conversation.pk),
        idempotency_key=invocation_key,
        retention_policy=AIRetentionPolicy.CONVERSATION,
        conversation=conversation,
    )
    assistant = AIMessage.objects.get(invocation_id=result.invocation_id)
    AIConversation.objects.filter(pk=conversation.pk).update(last_message_at=assistant.created_at)
    return result, assistant


def _stream_conversation_message(*, actor, active_organization, conversation_id: int, content: str, idempotency_key: str):
    conversation = _get_conversation(actor=actor, active_organization=active_organization, conversation_id=conversation_id)
    if conversation.status != "active":
        raise Http404
    _, created = _create_user_message(conversation, content, idempotency_key)
    if not created:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同消息的流式生成已存在。")
    return stream(
        actor=actor,
        organization=conversation.organization,
        capability=AICapability.CHAT,
        prompt_key=settings.AI_CHAT_PROMPT_KEY,
        messages=_conversation_history(conversation),
        source_app="ai.conversation",
        target_type="conversation",
        target_id=str(conversation.pk),
        idempotency_key=_conversation_invocation_key(conversation.pk, idempotency_key),
        retention_policy=AIRetentionPolicy.CONVERSATION,
        conversation=conversation,
    )
