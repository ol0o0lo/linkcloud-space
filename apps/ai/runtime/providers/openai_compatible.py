from time import monotonic

from openai import APIConnectionError, APITimeoutError, OpenAI

from apps.ai.runtime.contracts import (
    AIErrorCode,
    AIExecutionResult,
    AIProviderError,
    AIProviderRequest,
    AIProviderSettings,
    AIStreamChunk,
    AIStructuredOutputMode,
    AIUsage,
)


class OpenAICompatibleProvider:
    """OpenAI Chat Completions 兼容适配器。"""

    def __init__(self, provider_settings: AIProviderSettings, *, client_factory=OpenAI):
        self.settings = provider_settings
        self.last_request_id = ""
        client_options = {key: value for key, value in provider_settings.extra.items() if key == "default_query" and isinstance(value, dict)}
        self.client = client_factory(
            api_key=provider_settings.api_key,
            base_url=provider_settings.base_url,
            timeout=provider_settings.timeout_seconds,
            max_retries=0,
            **client_options,
        )

    @staticmethod
    def _kwargs(request: AIProviderRequest) -> dict:
        kwargs = {
            "model": request.model_name,
            "messages": [{"role": item.role, "content": item.content} for item in request.messages],
            **request.parameters,
        }
        if request.response_schema is not None and request.structured_output_mode == AIStructuredOutputMode.JSON_SCHEMA:
            kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {
                    "name": request.response_schema_name or "structured_output",
                    "strict": True,
                    "schema": request.response_schema,
                },
            }
        elif request.response_schema is not None and request.structured_output_mode == AIStructuredOutputMode.JSON_OBJECT:
            kwargs["response_format"] = {"type": "json_object"}
        return kwargs

    def generate(self, request: AIProviderRequest) -> AIExecutionResult:
        started = monotonic()
        try:
            response = self.client.chat.completions.create(**self._kwargs(request))
        except Exception as exc:
            raise self._normalize_error(exc) from exc
        self.last_request_id = getattr(response, "id", "") or ""
        usage = getattr(response, "usage", None)
        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise AIProviderError(
                AIErrorCode.CONTENT_REJECTED,
                "AI 内容安全策略拒绝了该请求。",
                retryable=False,
                provider_request_id=self.last_request_id,
            )
        return AIExecutionResult(
            text=choice.message.content or "",
            usage=AIUsage(
                input_tokens=getattr(usage, "prompt_tokens", None),
                output_tokens=getattr(usage, "completion_tokens", None),
                total_tokens=getattr(usage, "total_tokens", None),
                source="reported" if usage is not None else "unavailable",
            ),
            finish_reason=choice.finish_reason or "",
            provider_request_id=self.last_request_id,
            duration_ms=int((monotonic() - started) * 1000),
        )

    def stream(self, request: AIProviderRequest):
        try:
            source = self.client.chat.completions.create(
                **self._kwargs(request),
                stream=True,
                stream_options={"include_usage": True},
            )
            final_usage = None
            finish_reason = ""
            for chunk in source:
                self.last_request_id = getattr(chunk, "id", "") or self.last_request_id
                if chunk.choices:
                    text = getattr(chunk.choices[0].delta, "content", None)
                    if text:
                        yield AIStreamChunk(event="delta", text=text)
                    if chunk.choices[0].finish_reason:
                        finish_reason = chunk.choices[0].finish_reason
                        if finish_reason == "content_filter":
                            raise AIProviderError(
                                AIErrorCode.CONTENT_REJECTED,
                                "AI 内容安全策略拒绝了该请求。",
                                retryable=False,
                                provider_request_id=self.last_request_id,
                            )
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    final_usage = AIUsage(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, "reported")
            if final_usage is not None:
                yield AIStreamChunk(event="usage", usage=final_usage)
            yield AIStreamChunk(event="done", finish_reason=finish_reason)
        except AIProviderError:
            raise
        except Exception as exc:
            raise self._normalize_error(exc) from exc

    @staticmethod
    def _normalize_error(exc: Exception) -> AIProviderError:
        status = getattr(exc, "status_code", None)
        request_id = getattr(exc, "request_id", "") or ""
        if status in {401, 403}:
            return AIProviderError(AIErrorCode.PROVIDER_AUTH_ERROR, "AI 供应商认证失败。", retryable=False, provider_request_id=request_id)
        if status == 429:
            return AIProviderError(AIErrorCode.RATE_LIMITED, "AI 服务繁忙，请稍后重试。", retryable=True, provider_request_id=request_id)
        if status is not None and status >= 500:
            return AIProviderError(AIErrorCode.PROVIDER_UNAVAILABLE, "AI 服务暂时不可用。", retryable=True, provider_request_id=request_id)
        if isinstance(exc, APITimeoutError):
            return AIProviderError(AIErrorCode.TIMEOUT, "AI 请求超时。", retryable=True, provider_request_id=request_id)
        if isinstance(exc, APIConnectionError):
            return AIProviderError(AIErrorCode.PROVIDER_UNAVAILABLE, "AI 服务连接失败。", retryable=True, provider_request_id=request_id)
        return AIProviderError(AIErrorCode.INTERNAL_ERROR, "AI 调用失败。", retryable=False, provider_request_id=request_id)
