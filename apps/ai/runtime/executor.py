import json
from dataclasses import dataclass, field
from decimal import Decimal
from time import monotonic

from django.conf import settings

from pydantic import ValidationError as PydanticValidationError

from apps.ai.runtime import quota as quota_runtime
from apps.ai.runtime.contracts import (
    AIChatMessage,
    AIErrorCode,
    AIExecutionContext,
    AIExecutionError,
    AIExecutionRequest,
    AIExecutionResult,
    AIModelCandidate,
    AIProviderError,
    AIProviderRequest,
    AIProviderSettings,
    AIStreamChunk,
    AIStructuredOutputMode,
    AIUsage,
)
from apps.ai.runtime.prompts import PromptSnapshot, resolve_prompt
from apps.ai.runtime.providers import build_provider, get_provider_api_key
from apps.ai.runtime.quota import QuotaPolicy
from apps.ai.runtime.router import get_model_candidates

ALLOWED_PARAMETERS = {"temperature", "top_p", "max_tokens", "presence_penalty", "frequency_penalty", "seed", "stop"}


@dataclass(slots=True)
class ExecutionTrace:
    prompt: PromptSnapshot | None = None
    attempts: list[dict] = field(default_factory=list)
    selected_candidate: AIModelCandidate | None = None


@dataclass(frozen=True, slots=True)
class PreparedExecution:
    request: AIExecutionRequest
    prompt: PromptSnapshot
    candidates: tuple[AIModelCandidate, ...]
    reservation: object


@dataclass(slots=True)
class StreamExecutionState:
    trace: ExecutionTrace = field(default_factory=ExecutionTrace)
    text_parts: list[str] = field(default_factory=list)
    usage: AIUsage = field(default_factory=AIUsage)
    finish_reason: str = ""
    first_token_ms: int | None = None
    provider_request_id: str = ""
    error: AIExecutionError | None = None
    emitted_content: bool = False
    completed: bool = False


def _estimated_cost(candidate: AIModelCandidate, usage: AIUsage) -> Decimal | None:
    if usage.input_tokens is None or usage.output_tokens is None:
        return None
    if candidate.input_price_per_million is None or candidate.output_price_per_million is None:
        return None
    million = Decimal(1_000_000)
    return (Decimal(usage.input_tokens) * candidate.input_price_per_million + Decimal(usage.output_tokens) * candidate.output_price_per_million) / million


def aggregate_attempt_usage(attempts: list[dict]) -> AIUsage:
    reported = [item for item in attempts if item.get("usage_status") == "reported"]
    has_unavailable = any(item.get("usage_status") != "reported" for item in attempts)
    input_values = [item["input_tokens"] for item in reported if item.get("input_tokens") is not None]
    output_values = [item["output_tokens"] for item in reported if item.get("output_tokens") is not None]
    total_values = [item["total_tokens"] for item in reported if item.get("total_tokens") is not None]
    return AIUsage(
        input_tokens=sum(input_values) if input_values else None,
        output_tokens=sum(output_values) if output_values else None,
        total_tokens=sum(total_values) if total_values else None,
        source="unavailable" if has_unavailable or not attempts else "reported",
    )


def aggregate_attempt_cost(attempts: list[dict]) -> tuple[Decimal | None, str]:
    priced = [item for item in attempts if item.get("estimated_cost") is not None]
    currencies = {item.get("currency", "") for item in priced}
    if not priced or len(currencies) != 1:
        return None, ""
    return sum((Decimal(item["estimated_cost"]) for item in priced), Decimal("0")), currencies.pop()


def _parameters(prompt: PromptSnapshot, candidate: AIModelCandidate) -> dict:
    merged = {**candidate.default_parameters, **prompt.parameters}
    unknown = sorted(set(merged) - ALLOWED_PARAMETERS)
    if unknown:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, f"Prompt 包含不支持的模型参数：{', '.join(unknown)}")
    try:
        requested_max = int(merged.get("max_tokens", candidate.max_output_tokens))
    except (TypeError, ValueError) as exc:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 的 max_tokens 必须是整数。") from exc
    if requested_max <= 0:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 的 max_tokens 必须大于 0。")
    merged["max_tokens"] = min(requested_max, candidate.max_output_tokens, settings.AI_MAX_OUTPUT_TOKENS)
    return merged


def _fit_messages(prompt_messages, request_messages, candidate: AIModelCandidate, max_output_tokens: int):
    history = list(request_messages)
    while True:
        fitted = (*prompt_messages, *history)
        estimated_input_tokens = (sum(len(item.content) for item in fitted) + 3) // 4
        if estimated_input_tokens + max_output_tokens <= candidate.context_window:
            return fitted
        if len(history) <= 1:
            return None
        history.pop(0)


def _prepare_execution(request: AIExecutionRequest, context: AIExecutionContext, trace: ExecutionTrace, quota: QuotaPolicy) -> PreparedExecution:
    prompt = resolve_prompt(request.prompt_key, variables=dict(request.variables), version=request.prompt_version)
    trace.prompt = prompt
    if prompt.capability != request.capability:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 与请求能力不匹配。")
    messages = (*prompt.messages, *request.messages)
    if sum(len(item.content) for item in messages) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入内容超过平台上限。")

    reservation = quota.reserve(context, AIUsage())
    try:
        candidates = tuple(
            candidate
            for candidate in get_model_candidates(
                request.capability,
                mode=request.execution_mode,
                requires_structured_output=request.response_model is not None,
            )
            if get_provider_api_key(candidate.api_key_env)
        )
    except Exception:
        quota.release(reservation)
        raise
    if not candidates:
        quota.release(reservation)
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有已配置密钥的可用 AI 模型。")
    return PreparedExecution(request=request, prompt=prompt, candidates=candidates, reservation=reservation)


def _provider_for_candidate(candidate: AIModelCandidate, *, stream: bool = False):
    api_key = get_provider_api_key(candidate.api_key_env)
    if not api_key:
        raise AIProviderError(AIErrorCode.PROVIDER_AUTH_ERROR, "AI 供应商密钥未配置。", retryable=True)
    timeout_seconds = min(candidate.timeout_seconds, settings.AI_STREAM_TIMEOUT_SECONDS) if stream else candidate.timeout_seconds
    return build_provider(
        candidate.adapter,
        AIProviderSettings(
            provider_code=candidate.provider_code,
            base_url=candidate.base_url,
            api_key=api_key,
            timeout_seconds=timeout_seconds,
            extra=candidate.provider_extra,
        ),
    )


def _provider_request(prepared: PreparedExecution, candidate: AIModelCandidate) -> AIProviderRequest | None:
    parameters = _parameters(prepared.prompt, candidate)
    response_schema = prepared.request.response_model.model_json_schema() if prepared.request.response_model else None
    prompt_messages = prepared.prompt.messages
    if response_schema is not None and candidate.structured_output_mode == AIStructuredOutputMode.JSON_OBJECT:
        schema_json = json.dumps(response_schema, ensure_ascii=False, separators=(",", ":"))
        prompt_messages = (
            *prompt_messages,
            AIChatMessage("system", f"只返回符合以下 JSON Schema 的 JSON 对象，不要输出 Markdown 或解释：{schema_json}"),
        )
    messages = _fit_messages(prompt_messages, prepared.request.messages, candidate, parameters["max_tokens"])
    if messages is None:
        return None
    return AIProviderRequest(
        model_name=candidate.model_name,
        messages=messages,
        parameters=parameters,
        response_schema=response_schema,
        response_schema_name=prepared.request.response_model.__name__ if prepared.request.response_model else None,
        structured_output_mode=candidate.structured_output_mode if response_schema is not None else AIStructuredOutputMode.NONE,
    )


def _success_attempt(sequence: int, candidate: AIModelCandidate, result: AIExecutionResult, *, kind: str = "generation") -> dict:
    cost = _estimated_cost(candidate, result.usage)
    return {
        "sequence": sequence,
        "kind": kind,
        "provider": candidate.provider_code,
        "model": candidate.model_name,
        "status": "succeeded",
        "input_tokens": result.usage.input_tokens,
        "output_tokens": result.usage.output_tokens,
        "total_tokens": result.usage.total_tokens,
        "usage_status": result.usage.source,
        "estimated_cost": str(cost) if cost is not None else None,
        "input_price_per_million": str(candidate.input_price_per_million) if candidate.input_price_per_million is not None else None,
        "output_price_per_million": str(candidate.output_price_per_million) if candidate.output_price_per_million is not None else None,
        "currency": candidate.currency,
        "duration_ms": result.duration_ms,
        "provider_request_id": result.provider_request_id,
    }


def _failed_attempt(sequence: int, candidate: AIModelCandidate, error: AIExecutionError, duration_ms: int, *, kind: str = "generation") -> dict:
    return {
        "sequence": sequence,
        "kind": kind,
        "provider": candidate.provider_code,
        "model": candidate.model_name,
        "status": "failed",
        "usage_status": "unavailable",
        "error_type": error.code.value,
        "provider_request_id": getattr(error, "provider_request_id", ""),
        "duration_ms": duration_ms,
    }


def _validate_structured(result: AIExecutionResult, response_model):
    parsed = response_model.model_validate_json(result.text)
    return AIExecutionResult(
        text=result.text,
        structured_data=parsed.model_dump(mode="json"),
        usage=result.usage,
        finish_reason=result.finish_reason,
        provider_request_id=result.provider_request_id,
        first_token_ms=result.first_token_ms,
        duration_ms=result.duration_ms,
    )


def _repair_structured_output(prepared, candidate, provider, provider_request, result, trace):
    response_model = prepared.request.response_model
    try:
        return _validate_structured(result, response_model)
    except PydanticValidationError as validation_error:
        trace.attempts[-1]["status"] = "invalid"
        trace.attempts[-1]["error_type"] = AIErrorCode.STRUCTURED_OUTPUT_INVALID.value
        repair_request = AIProviderRequest(
            model_name=candidate.model_name,
            messages=(
                *provider_request.messages,
                AIChatMessage("assistant", result.text),
                AIChatMessage(
                    "user",
                    f"上一条输出未通过 JSON Schema 校验。只返回修正后的 JSON，不要解释。校验错误：{validation_error.errors(include_input=False, include_url=False)}",
                ),
            ),
            parameters=provider_request.parameters,
            response_schema=provider_request.response_schema,
            response_schema_name=provider_request.response_schema_name,
            structured_output_mode=provider_request.structured_output_mode,
        )
        started = monotonic()
        try:
            repaired = provider.generate(repair_request)
        except AIProviderError as error:
            trace.attempts.append(_failed_attempt(len(trace.attempts) + 1, candidate, error, int((monotonic() - started) * 1000), kind="structured_repair"))
            raise
        repair_attempt = _success_attempt(len(trace.attempts) + 1, candidate, repaired, kind="structured_repair")
        try:
            validated = _validate_structured(repaired, response_model)
        except PydanticValidationError as final_error:
            repair_attempt["status"] = "invalid"
            repair_attempt["error_type"] = AIErrorCode.STRUCTURED_OUTPUT_INVALID.value
            trace.attempts.append(repair_attempt)
            raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, "AI 返回的结构化结果无效。") from final_error
        trace.attempts.append(repair_attempt)
        return validated


def execute(
    request: AIExecutionRequest,
    context: AIExecutionContext,
    *,
    trace: ExecutionTrace | None = None,
    quota: QuotaPolicy | None = None,
) -> AIExecutionResult:
    trace = trace or ExecutionTrace()
    quota = quota or quota_runtime.quota_policy
    prepared = _prepare_execution(request, context, trace, quota)
    last_error: AIExecutionError | None = None
    try:
        for sequence, candidate in enumerate(prepared.candidates, start=1):
            provider_request = _provider_request(prepared, candidate)
            if provider_request is None:
                error = AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入超过候选模型上下文窗口。", retryable=True)
                trace.attempts.append(_failed_attempt(sequence, candidate, error, 0))
                last_error = error
                continue

            started = monotonic()
            try:
                provider = _provider_for_candidate(candidate)
                result = provider.generate(provider_request)
            except AIProviderError as error:
                trace.attempts.append(_failed_attempt(sequence, candidate, error, int((monotonic() - started) * 1000)))
                last_error = error
                if error.retryable:
                    continue
                raise

            trace.selected_candidate = candidate
            trace.attempts.append(_success_attempt(sequence, candidate, result))
            if request.response_model is not None:
                result = _repair_structured_output(prepared, candidate, provider, provider_request, result, trace)
            quota.settle(prepared.reservation, aggregate_attempt_usage(trace.attempts))
            return result
        raise last_error or AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")
    except Exception:
        quota.release(prepared.reservation)
        raise


def stream_execute(
    request: AIExecutionRequest,
    context: AIExecutionContext,
    *,
    state: StreamExecutionState,
    quota: QuotaPolicy | None = None,
):
    quota = quota or quota_runtime.quota_policy
    prepared = _prepare_execution(request, context, state.trace, quota)
    stream_started = monotonic()
    settled = False
    last_error: AIExecutionError | None = None
    try:
        for sequence, candidate in enumerate(prepared.candidates, start=1):
            if not state.emitted_content:
                state.usage = AIUsage()
                state.finish_reason = ""
            provider_request = _provider_request(prepared, candidate)
            if provider_request is None:
                error = AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入超过候选模型上下文窗口。", retryable=True)
                state.trace.attempts.append(_failed_attempt(sequence, candidate, error, 0))
                last_error = error
                continue

            candidate_started = monotonic()
            pending_usage = False
            usage_emitted = False
            try:
                provider = _provider_for_candidate(candidate, stream=True)
                for chunk in provider.stream(provider_request):
                    if monotonic() - stream_started > settings.AI_STREAM_TIMEOUT_SECONDS:
                        raise AIProviderError(AIErrorCode.TIMEOUT, "AI 流式请求超时。", retryable=not state.emitted_content)
                    if chunk.event == "delta":
                        if not state.emitted_content:
                            state.trace.selected_candidate = candidate
                            state.first_token_ms = int((monotonic() - stream_started) * 1000)
                            yield AIStreamChunk(event="start", metadata={"provider": candidate.provider_code, "model": candidate.display_name})
                        state.emitted_content = True
                        state.text_parts.append(chunk.text)
                        yield chunk
                    elif chunk.event == "usage" and chunk.usage is not None:
                        state.usage = chunk.usage
                        if state.emitted_content:
                            usage_emitted = True
                            yield chunk
                        else:
                            pending_usage = True
                    elif chunk.event == "done":
                        state.finish_reason = chunk.finish_reason
                    elif chunk.event == "error":
                        raise AIProviderError(AIErrorCode.PROVIDER_UNAVAILABLE, "AI 流式调用失败。", retryable=not state.emitted_content)

                if not state.emitted_content:
                    state.trace.selected_candidate = candidate
                    yield AIStreamChunk(event="start", metadata={"provider": candidate.provider_code, "model": candidate.display_name})
                if pending_usage and not usage_emitted:
                    yield AIStreamChunk(event="usage", usage=state.usage)
                result = AIExecutionResult(
                    text="".join(state.text_parts),
                    usage=state.usage,
                    finish_reason=state.finish_reason,
                    provider_request_id=getattr(provider, "last_request_id", ""),
                    duration_ms=int((monotonic() - candidate_started) * 1000),
                )
                state.trace.attempts.append(_success_attempt(sequence, candidate, result))
                state.provider_request_id = result.provider_request_id
                quota.settle(prepared.reservation, aggregate_attempt_usage(state.trace.attempts))
                settled = True
                state.completed = True
                yield AIStreamChunk(event="done", finish_reason=state.finish_reason)
                return
            except AIProviderError as error:
                state.trace.attempts.append(_failed_attempt(sequence, candidate, error, int((monotonic() - candidate_started) * 1000)))
                last_error = error
                if error.retryable and not state.emitted_content:
                    continue
                state.error = AIExecutionError(AIErrorCode.STREAM_INTERRUPTED, "AI 流式输出已中断。") if state.emitted_content else error
                yield AIStreamChunk(event="error", error_code=state.error.code.value, error_message=state.error.safe_message)
                return

        state.error = last_error or AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")
        yield AIStreamChunk(event="error", error_code=state.error.code.value, error_message=state.error.safe_message)
    finally:
        if not settled:
            quota.release(prepared.reservation)
