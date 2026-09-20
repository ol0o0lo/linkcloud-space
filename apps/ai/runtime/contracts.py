from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from dataclasses import dataclass, field
from decimal import Decimal
from enum import StrEnum
from typing import Any, Literal, Protocol

from pydantic import BaseModel


class AICapability(StrEnum):
    CHAT = "chat"
    TEXT_GENERATION = "text_generation"
    STRUCTURED_EXTRACT = "structured_extract"
    LONG_TEXT = "long_text"
    VISION = "vision"


class AIExecutionMode(StrEnum):
    SYNC = "sync"
    STREAM = "stream"
    ASYNC = "async"


class AIRetentionPolicy(StrEnum):
    CONVERSATION = "conversation"
    TEMPORARY = "temporary"
    METADATA_ONLY = "metadata_only"


class AIStructuredOutputMode(StrEnum):
    NONE = "none"
    JSON_OBJECT = "json_object"
    JSON_SCHEMA = "json_schema"


class AIInvocationStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    INTERRUPTED = "interrupted"


class AIErrorCode(StrEnum):
    INVALID_REQUEST = "invalid_request"
    PERMISSION_DENIED = "permission_denied"
    CAPABILITY_UNAVAILABLE = "capability_unavailable"
    PROVIDER_AUTH_ERROR = "provider_auth_error"
    RATE_LIMITED = "rate_limited"
    TIMEOUT = "timeout"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    CONTENT_REJECTED = "content_rejected"
    STRUCTURED_OUTPUT_INVALID = "structured_output_invalid"
    STREAM_INTERRUPTED = "stream_interrupted"
    INTERNAL_ERROR = "internal_error"


@dataclass(frozen=True, slots=True)
class AIChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True, slots=True)
class AIUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    source: Literal["reported", "unavailable"] = "unavailable"


@dataclass(frozen=True, slots=True)
class AIExecutionContext:
    actor_id: int | None
    organization_id: int | None
    source_app: str
    target_type: str = ""
    target_id: str = ""
    idempotency_key: str = ""
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY
    safe_summary: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AIExecutionRequest:
    capability: AICapability
    prompt_key: str
    prompt_version: int | None = None
    variables: Mapping[str, Any] = field(default_factory=dict)
    messages: Sequence[AIChatMessage] = field(default_factory=tuple)
    response_model: type[BaseModel] | None = None
    execution_mode: AIExecutionMode = AIExecutionMode.SYNC


@dataclass(frozen=True, slots=True)
class AIProviderSettings:
    provider_code: str
    base_url: str
    api_key: str
    timeout_seconds: int
    extra: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AIProviderRequest:
    model_name: str
    messages: Sequence[AIChatMessage]
    parameters: Mapping[str, Any]
    response_schema: Mapping[str, Any] | None = None
    response_schema_name: str | None = None
    structured_output_mode: AIStructuredOutputMode = AIStructuredOutputMode.NONE


@dataclass(frozen=True, slots=True)
class AIExecutionResult:
    text: str
    structured_data: Mapping[str, Any] | None = None
    usage: AIUsage = field(default_factory=AIUsage)
    finish_reason: str = ""
    provider_request_id: str = ""
    first_token_ms: int | None = None
    duration_ms: int | None = None


@dataclass(frozen=True, slots=True)
class AIStreamChunk:
    event: Literal["start", "delta", "usage", "done", "error"]
    text: str = ""
    usage: AIUsage | None = None
    finish_reason: str = ""
    error_code: str = ""
    error_message: str = ""
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class AIModelCandidate:
    provider_code: str
    adapter: str
    base_url: str
    api_key_env: str
    timeout_seconds: int
    provider_extra: Mapping[str, Any]
    model_name: str
    display_name: str
    structured_output_mode: AIStructuredOutputMode
    context_window: int
    max_output_tokens: int
    default_parameters: Mapping[str, Any]
    input_price_per_million: Decimal | None
    output_price_per_million: Decimal | None
    currency: str


class AIExecutionError(Exception):
    def __init__(self, code: AIErrorCode, safe_message: str, *, retryable: bool = False):
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message
        self.retryable = retryable


class AIProviderError(AIExecutionError):
    def __init__(self, code: AIErrorCode, safe_message: str, *, retryable: bool, provider_request_id: str = ""):
        super().__init__(code, safe_message, retryable=retryable)
        self.provider_request_id = provider_request_id


class AIProvider(Protocol):
    def generate(self, request: AIProviderRequest) -> AIExecutionResult: ...

    def stream(self, request: AIProviderRequest) -> Iterator[AIStreamChunk]: ...
