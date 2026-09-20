# 通用 AI 底座 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Django 内实现一个供应商无关、多租户安全、支持同步、结构化、SSE 和 Celery 异步调用的通用 AI 底座，并只向业务模块暴露稳定服务接口。

**Architecture:** `apps.ai.services` 是跨应用唯一入口，负责权限、租户、幂等、调用记录和内容保留；`apps.ai.runtime.executor` 组织 Prompt、限额、模型路由和 Provider 调用；`runtime.providers` 只负责 OpenAI-compatible 协议适配。平台管理员维护供应商、模型、路由和 Prompt，HTTP 客户端不能自由指定模型、Prompt 或生成参数。

**Tech Stack:** Python 3.12、Django 5、django-ninja、Pydantic v2、Celery、PostgreSQL、官方 OpenAI Python SDK、pytest、Model Bakery。

---

## 实施边界

- 实现通用 AI 底座及受控对话 API，不实现房源自动写入、RAG、Agent、工具调用、BYOK、模型缓存或套餐计费。
- 首期所有合法调用使用 `UnlimitedQuotaPolicy` 放行，但完整执行 `reserve → settle/release` 生命周期。
- 业务模块只能导入 `apps.ai.services` 中的 `generate()`、`stream()`、`enqueue()`、`get_job()` 及返回类型。
- 供应商密钥只保存在环境变量中，数据库只保存环境变量名。
- 不执行 Git 操作；每个任务末尾仅给出建议提交信息。

## 最终文件结构

```text
apps/ai/
├── __init__.py
├── apps.py
├── models.py
├── admin.py
├── schemas.py
├── api.py
├── services.py
├── tasks.py
├── migrations/
│   ├── __init__.py
│   └── 0001_initial.py
└── runtime/
    ├── __init__.py
    ├── contracts.py
    ├── executor.py
    ├── router.py
    ├── prompts.py
    ├── quota.py
    ├── retention.py
    └── providers/
        ├── __init__.py
        └── openai_compatible.py

tests/ai/
├── __init__.py
├── factories.py
├── test_models.py
├── test_permissions.py
├── test_prompts.py
├── test_router.py
├── test_provider.py
├── test_policies.py
├── test_executor.py
├── test_services.py
├── test_api.py
└── test_tasks.py
```

现有文件修改范围：

- `pyproject.toml`、`uv.lock`：OpenAI SDK 与 AI 环境变量 schema。
- `config/settings/_base.py`：应用注册、安全上限、Chat Prompt key、Celery 清理计划。
- `config/api.py`：挂载 `/api/ai/`。
- `apps/access/constants.py`：增加 AI 权限枚举。
- `apps/settings/migrations/0015_ai_allowed_capabilities.py`：预置组织 capability 开关。

### Task 1: 应用骨架、依赖、配置与运行时契约

**Files:**
- Create: `apps/ai/__init__.py`
- Create: `apps/ai/apps.py`
- Create: `apps/ai/runtime/__init__.py`
- Create: `apps/ai/runtime/contracts.py`
- Create: `apps/ai/runtime/providers/__init__.py`
- Create: `apps/ai/migrations/__init__.py`
- Create: `tests/ai/__init__.py`
- Create: `tests/ai/test_contracts.py`
- Modify: `pyproject.toml:6-30`
- Modify: `pyproject.toml:158-230`
- Modify: `config/settings/_base.py:81-119`

- [ ] **Step 1: 写契约枚举和用量对象的失败测试**

```python
# tests/ai/test_contracts.py
from apps.ai.runtime.contracts import AICapability, AIExecutionMode, AIRetentionPolicy, AIUsage


def test_capability_values_are_stable_configuration_keys():
    assert [item.value for item in AICapability] == [
        "chat",
        "text_generation",
        "structured_extract",
        "long_text",
        "vision",
    ]


def test_usage_preserves_unavailable_values():
    usage = AIUsage(input_tokens=None, output_tokens=None, total_tokens=None, source="unavailable")
    assert usage.input_tokens is None
    assert usage.total_tokens is None
    assert AIExecutionMode.STREAM.value == "stream"
    assert AIRetentionPolicy.METADATA_ONLY.value == "metadata_only"
```

- [ ] **Step 2: 运行测试并确认契约模块尚不存在**

Run: `docker compose exec web pytest tests/ai/test_contracts.py -q`

Expected: FAIL，错误包含 `ModuleNotFoundError: No module named 'apps.ai'`。

- [ ] **Step 3: 创建 AppConfig 和 Provider 无关契约**

```python
# apps/ai/apps.py
from django.apps import AppConfig


class AIConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.ai"
    verbose_name = "AI 能力"
```

```python
# apps/ai/runtime/contracts.py
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
    event: Literal["delta", "usage", "done", "error"]
    text: str = ""
    usage: AIUsage | None = None
    finish_reason: str = ""
    error_code: str = ""
    error_message: str = ""


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
    supports_json_schema: bool
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
    def generate(self, request: AIProviderRequest) -> AIExecutionResult:
        raise NotImplementedError

    def stream(self, request: AIProviderRequest) -> Iterator[AIStreamChunk]:
        raise NotImplementedError
```

创建其余空包初始化文件；`apps/ai/__init__.py` 暂不导出运行时模块。

- [ ] **Step 4: 注册应用、SDK 和安全默认值**

在 `pyproject.toml` 生产依赖中加入：

```toml
"openai>=1.109,<2",
```

在 `[tool.epicenv.variables]` 中加入：

```toml
# AI Foundation
AI_ENABLED = { type = "bool", default = false, help_text = "Enable outbound AI provider calls" }
AI_MAX_INPUT_CHARS = { type = "int", default = 100000, help_text = "Maximum total characters accepted by one AI invocation" }
AI_MAX_OUTPUT_TOKENS = { type = "int", default = 4096, help_text = "Platform-wide maximum output tokens per AI invocation" }
AI_MAX_CONVERSATION_MESSAGES = { type = "int", default = 40, help_text = "Maximum recent conversation messages sent to a provider" }
AI_TEMPORARY_RETENTION_HOURS = { type = "int", default = 24, help_text = "Hours to retain temporary AI payloads" }
AI_STREAM_TIMEOUT_SECONDS = { type = "int", default = 120, help_text = "Maximum streaming duration" }
AI_CHAT_PROMPT_KEY = { type = "str", default = "general.chat", help_text = "Prompt key for controlled chat API" }
OPENAI_API_KEY = { type = "str", default = "", help_text = "OpenAI API key referenced by AIProviderConfig" }
DASHSCOPE_API_KEY = { type = "str", default = "", help_text = "Alibaba Bailian API key referenced by AIProviderConfig" }
ARK_API_KEY = { type = "str", default = "", help_text = "Volcengine Ark API key referenced by AIProviderConfig" }
```

在 `config/settings/_base.py` 的 `INSTALLED_APPS` 中加入 `"apps.ai"`，并在通用业务设置区加入：

```python
AI_ENABLED = env.bool("AI_ENABLED", default=False)
AI_MAX_INPUT_CHARS = env.int("AI_MAX_INPUT_CHARS", default=100_000)
AI_MAX_OUTPUT_TOKENS = env.int("AI_MAX_OUTPUT_TOKENS", default=4096)
AI_MAX_CONVERSATION_MESSAGES = env.int("AI_MAX_CONVERSATION_MESSAGES", default=40)
AI_TEMPORARY_RETENTION_HOURS = env.int("AI_TEMPORARY_RETENTION_HOURS", default=24)
AI_STREAM_TIMEOUT_SECONDS = env.int("AI_STREAM_TIMEOUT_SECONDS", default=120)
AI_CHAT_PROMPT_KEY = env("AI_CHAT_PROMPT_KEY", default="general.chat")
```

- [ ] **Step 5: 更新依赖并验证基础契约**

Run: `uv lock`

Expected: `uv.lock` 更新并包含 `openai`。

Run: `docker compose build web worker`

Expected: web、worker 镜像成功构建；不运行包含 volume 删除的 `just build`。

Run: `docker compose exec web pytest tests/ai/test_contracts.py -q`

Expected: PASS。

建议提交信息：`feat: 建立 AI 应用与运行时契约`

### Task 2: 七个核心数据模型与首个迁移

**Files:**
- Create: `apps/ai/models.py`
- Create: `apps/ai/migrations/0001_initial.py`
- Create: `tests/ai/test_models.py`

- [ ] **Step 1: 写数据库约束和 Prompt 不可变规则的失败测试**

```python
# tests/ai/test_models.py
from django.core.exceptions import ValidationError

import pytest
from model_bakery import baker

from apps.ai.models import AIInvocation, AIPrompt


@pytest.mark.django_db
def test_only_one_active_prompt_version_per_key():
    baker.make(AIPrompt, key="general.chat", version=1, is_active=True)
    with pytest.raises(ValidationError):
        baker.make(AIPrompt, key="general.chat", version=2, is_active=True)


@pytest.mark.django_db
def test_used_prompt_template_cannot_be_mutated():
    prompt = baker.make(
        AIPrompt,
        key="general.chat",
        version=1,
        messages_template=[{"role": "system", "content": "你是租房助手"}],
        required_variables=[],
        is_active=True,
    )
    baker.make(AIInvocation, prompt_key=prompt.key, prompt_version=prompt.version, prompt_hash=prompt.template_hash)
    prompt.messages_template = [{"role": "system", "content": "已被修改"}]
    with pytest.raises(ValidationError, match="已产生调用记录"):
        prompt.save()
```

- [ ] **Step 2: 运行测试并确认模型尚不存在**

Run: `docker compose exec web pytest tests/ai/test_models.py -q`

Expected: FAIL，错误包含 `cannot import name 'AIInvocation'` 或数据库表不存在。

- [ ] **Step 3: 实现供应商、模型、路由和 Prompt 模型**

```python
# apps/ai/models.py（第一部分）
import hashlib
import json

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

from apps.ai.runtime.contracts import AICapability, AIExecutionMode, AIInvocationStatus, AIRetentionPolicy
from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin


def enum_choices(enum_type):
    return [(item.value, item.value) for item in enum_type]


class AIProviderConfig(BaseModelMixin):
    code = models.SlugField(max_length=50, unique=True, verbose_name="供应商编码")
    name = models.CharField(max_length=100, verbose_name="供应商名称")
    adapter = models.CharField(max_length=50, default="openai_compatible", verbose_name="适配器")
    base_url = models.URLField(max_length=500, verbose_name="接口地址")
    api_key_env = models.CharField(
        max_length=100,
        validators=[RegexValidator(r"^[A-Z][A-Z0-9_]*$", "密钥环境变量名必须使用大写字母、数字和下划线。")],
        verbose_name="密钥环境变量名",
    )
    enabled = models.BooleanField(default=True, verbose_name="是否启用")
    timeout_seconds = models.PositiveIntegerField(default=60, verbose_name="超时秒数")
    extra = models.JSONField(default=dict, blank=True, verbose_name="兼容参数")

    class Meta:
        db_table = "ai_provider_config"
        ordering = ["code"]
        verbose_name = "AI 供应商"
        verbose_name_plural = "AI 供应商"

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        from apps.ai.runtime.providers import PROVIDERS

        if self.adapter not in PROVIDERS:
            raise ValidationError({"adapter": "未知的 AI Provider 适配器。"})
        if not isinstance(self.extra, dict):
            raise ValidationError({"extra": "供应商兼容参数必须是 JSON 对象。"})
        if set(self.extra) - {"default_query"}:
            raise ValidationError({"extra": "首期 extra 只允许 default_query。"})
        query = self.extra.get("default_query", {})
        if not isinstance(query, dict) or any(fragment in str(key).lower() for key in query for fragment in ("key", "token", "secret", "authorization")):
            raise ValidationError({"extra": "供应商兼容参数不得保存密钥或令牌。"})


class AIModel(BaseModelMixin):
    provider = models.ForeignKey(AIProviderConfig, on_delete=models.PROTECT, related_name="models", verbose_name="供应商")
    model_name = models.CharField(max_length=150, verbose_name="供应商模型名")
    display_name = models.CharField(max_length=150, verbose_name="显示名称")
    enabled = models.BooleanField(default=True, verbose_name="是否启用")
    supports_streaming = models.BooleanField(default=True, verbose_name="支持流式")
    supports_json_schema = models.BooleanField(default=False, verbose_name="支持 JSON Schema")
    context_window = models.PositiveIntegerField(default=8192, verbose_name="上下文窗口")
    max_output_tokens = models.PositiveIntegerField(default=4096, verbose_name="最大输出 Token")
    default_parameters = models.JSONField(default=dict, blank=True, verbose_name="默认参数")
    input_price_per_million = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="百万输入 Token 单价")
    output_price_per_million = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="百万输出 Token 单价")
    currency = models.CharField(max_length=3, default="USD", verbose_name="币种")
    price_updated_at = models.DateTimeField(null=True, blank=True, verbose_name="价格更新时间")

    class Meta:
        db_table = "ai_model"
        ordering = ["provider__code", "model_name"]
        constraints = [models.UniqueConstraint(fields=("provider", "model_name"), name="ai_model_provider_name_unique")]

    def __str__(self):
        return self.display_name


class AIModelRoute(BaseModelMixin):
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), verbose_name="能力")
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE, related_name="routes", verbose_name="模型")
    priority = models.PositiveSmallIntegerField(default=100, verbose_name="优先级")
    enabled = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        db_table = "ai_model_route"
        ordering = ["capability", "priority", "pk"]
        constraints = [
            models.UniqueConstraint(fields=("capability", "model"), name="ai_route_capability_model_unique"),
            models.UniqueConstraint(fields=("capability", "priority"), name="ai_route_capability_priority_unique"),
        ]


class AIPrompt(BaseModelMixin):
    key = models.CharField(
        max_length=100,
        validators=[RegexValidator(r"^[a-z0-9][a-z0-9_.-]*$", "Prompt key 只能包含小写字母、数字、点、下划线和连字符。")],
        verbose_name="Prompt key",
    )
    version = models.PositiveIntegerField(verbose_name="版本")
    name = models.CharField(max_length=150, verbose_name="名称")
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), verbose_name="能力")
    messages_template = models.JSONField(default=list, verbose_name="消息模板")
    required_variables = models.JSONField(default=list, blank=True, verbose_name="必填变量")
    default_parameters = models.JSONField(default=dict, blank=True, verbose_name="默认参数")
    is_active = models.BooleanField(default=False, verbose_name="是否启用")
    template_hash = models.CharField(max_length=64, editable=False, verbose_name="模板哈希")

    IMMUTABLE_FIELDS = ("key", "version", "messages_template", "required_variables", "default_parameters", "capability")

    class Meta:
        db_table = "ai_prompt"
        ordering = ["key", "-version"]
        constraints = [
            models.UniqueConstraint(fields=("key", "version"), name="ai_prompt_key_version_unique"),
            models.UniqueConstraint(fields=("key",), condition=Q(is_active=True), name="ai_prompt_one_active_version"),
        ]

    def _calculate_hash(self) -> str:
        payload = {
            "capability": self.capability,
            "messages_template": self.messages_template,
            "required_variables": self.required_variables,
            "default_parameters": self.default_parameters,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        return hashlib.sha256(encoded).hexdigest()

    def clean(self):
        super().clean()
        if not isinstance(self.messages_template, list) or not self.messages_template:
            raise ValidationError({"messages_template": "消息模板必须是非空列表。"})
        if self.pk:
            previous = type(self).objects.get(pk=self.pk)
            is_used = AIInvocation.objects.filter(prompt_key=previous.key, prompt_version=previous.version).exists()
            if is_used and any(getattr(previous, field) != getattr(self, field) for field in self.IMMUTABLE_FIELDS):
                raise ValidationError("该 Prompt 版本已产生调用记录，模板内容不可修改。")

    def save(self, *args, **kwargs):
        self.template_hash = self._calculate_hash()
        self.full_clean()
        return super().save(*args, **kwargs)
```

- [ ] **Step 4: 实现对话、消息和调用记录模型**

```python
# apps/ai/models.py（第二部分，接在第一部分后）
class AIConversation(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.CASCADE, related_name="ai_conversations")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_conversations")
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), default=AICapability.CHAT)
    title = models.CharField(max_length=120, blank=True, default="")
    status = models.CharField(max_length=20, choices=(("active", "active"), ("archived", "archived")), default="active")
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ai_conversation"
        ordering = ["-last_message_at", "-created_at"]


class AIInvocation(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", null=True, blank=True, on_delete=models.SET_NULL, related_name="ai_invocations")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="ai_invocations")
    conversation = models.ForeignKey(AIConversation, null=True, blank=True, on_delete=models.SET_NULL, related_name="invocations")
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability))
    source_app = models.CharField(max_length=80)
    target_type = models.CharField(max_length=80, blank=True, default="")
    target_id = models.CharField(max_length=100, blank=True, default="")
    execution_mode = models.CharField(max_length=20, choices=enum_choices(AIExecutionMode))
    status = models.CharField(max_length=20, choices=enum_choices(AIInvocationStatus), db_index=True)
    idempotency_key = models.CharField(max_length=128, blank=True, default="")
    prompt_key = models.CharField(max_length=100, blank=True, default="")
    prompt_version = models.PositiveIntegerField(null=True, blank=True)
    prompt_hash = models.CharField(max_length=64, blank=True, default="")
    provider_code = models.CharField(max_length=50, blank=True, default="")
    model_name = models.CharField(max_length=150, blank=True, default="")
    input_tokens = models.PositiveIntegerField(null=True, blank=True)
    output_tokens = models.PositiveIntegerField(null=True, blank=True)
    total_tokens = models.PositiveIntegerField(null=True, blank=True)
    usage_status = models.CharField(max_length=20, choices=(("reported", "reported"), ("unavailable", "unavailable")), default="unavailable")
    input_price_snapshot = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    output_price_snapshot = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    estimated_cost = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True)
    currency = models.CharField(max_length=3, blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    first_token_ms = models.PositiveIntegerField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    error_type = models.CharField(max_length=50, blank=True, default="")
    error_code = models.CharField(max_length=100, blank=True, default="")
    error_summary = models.CharField(max_length=500, blank=True, default="")
    provider_request_id = models.CharField(max_length=150, blank=True, default="")
    retention_policy = models.CharField(max_length=30, choices=enum_choices(AIRetentionPolicy))
    content_hash = models.CharField(max_length=64, blank=True, default="")
    safe_summary = models.JSONField(default=dict, blank=True)
    attempts = models.JSONField(default=list, blank=True)
    input_payload = models.JSONField(default=dict, blank=True)
    output_payload = models.JSONField(default=dict, blank=True)
    content_expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        db_table = "ai_invocation"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=("organization", "created_at"), name="ai_invocation_org_created_idx"),
            models.Index(fields=("actor", "created_at"), name="ai_invocation_actor_created_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "actor", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=False, actor__isnull=False) & ~Q(idempotency_key=""),
                name="ai_invocation_org_actor_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("actor", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=True, actor__isnull=False) & ~Q(idempotency_key=""),
                name="ai_invocation_personal_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("organization", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=False, actor__isnull=True) & ~Q(idempotency_key=""),
                name="ai_invocation_org_system_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("source_app", "idempotency_key"),
                condition=Q(organization__isnull=True, actor__isnull=True) & ~Q(idempotency_key=""),
                name="ai_invocation_global_system_idempotency_unique",
            ),
        ]


class AIMessage(CreateUpdateTimeModelMixin):
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=(("system", "system"), ("user", "user"), ("assistant", "assistant")))
    content = models.TextField()
    content_json = models.JSONField(null=True, blank=True)
    client_message_key = models.CharField(max_length=128, blank=True, default="")
    invocation = models.OneToOneField(AIInvocation, null=True, blank=True, on_delete=models.SET_NULL, related_name="assistant_message")
    token_count = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "ai_message"
        ordering = ["created_at", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=("conversation", "client_message_key"),
                condition=~Q(client_message_key=""),
                name="ai_message_conversation_client_key_unique",
            )
        ]
```

- [ ] **Step 5: 生成、应用并检查迁移**

Run: `docker compose exec web python manage.py makemigrations ai`

Expected: 创建 `apps/ai/migrations/0001_initial.py`，包含七张表、两个调用索引、Prompt 唯一启用约束和调用幂等约束。

Run: `docker compose exec web python manage.py migrate`

Expected: `Applying ai.0001_initial... OK`。

Run: `docker compose exec web pytest tests/ai/test_models.py -q`

Expected: PASS。

Run: `docker compose exec web python manage.py makemigrations --check --dry-run`

Expected: `No changes detected`。

建议提交信息：`feat: 新增 AI 核心数据模型`

### Task 3: AI 权限和组织 capability 开关

**Files:**
- Modify: `apps/access/constants.py:5-90`
- Create: `apps/settings/migrations/0015_ai_allowed_capabilities.py`
- Create: `tests/ai/test_permissions.py`

- [ ] **Step 1: 写权限注册和组织设置的失败测试**

```python
# tests/ai/test_permissions.py
import pytest
from model_bakery import baker

from apps.access.constants import AIPermission
from apps.access.sync import build_permission_registry
from apps.settings.service import get_org_setting, set_org_setting


def test_ai_permissions_are_part_of_the_registry():
    registry = build_permission_registry()
    assert ("use", "使用 AI 能力") in registry["ai"]
    assert AIPermission.MANAGE_MODELS.value == "ai.manage_models"


@pytest.mark.django_db
def test_organization_can_disable_one_capability():
    organization = baker.make("organizations.Organization")
    default = get_org_setting(organization, "ai.allowed_capabilities")
    assert "chat" in default["value"]
    set_org_setting(organization, "ai.allowed_capabilities", ["text_generation"])
    assert get_org_setting(organization, "ai.allowed_capabilities")["value"] == ["text_generation"]
```

- [ ] **Step 2: 运行测试并确认权限枚举与设置尚不存在**

Run: `docker compose exec web pytest tests/ai/test_permissions.py -q`

Expected: FAIL，错误指向 `AIPermission` 或 `ai.allowed_capabilities` 缺失。

- [ ] **Step 3: 将 AI 权限接入现有注册表**

在 `apps/access/constants.py` 增加：

```python
PERMISSION_MODULES = {
    "access": ("access", "角色与权限"),
    "organizations": ("organization", "成员与组织"),
    "teams": ("team", "团队管理"),
    "settings": ("settings", "系统设置"),
    "allocation": ("allocation", "收益分配"),
    "finance": ("finance", "财务管理"),
    "subscriptions": ("subscription", "套餐与订阅"),
    "analytics": ("analytics", "数据与报表"),
    "team_operations": ("team_operations", "团队协作"),
    "ai": ("ai", "AI 能力"),
}


class AIPermission(StrChoices):
    USE = "ai.use", "使用 AI 能力"
    VIEW_OWN_HISTORY = "ai.view_own_history", "查看本人 AI 历史"
    VIEW_ORG_AUDIT = "ai.view_org_audit", "查看组织 AI 审计"
    MANAGE_PROMPTS = "ai.manage_prompts", "管理 AI Prompt"
    MANAGE_MODELS = "ai.manage_models", "管理 AI 模型"
```

把 `AIPermission` 追加到 `ALL_PERMISSION_ENUMS`。现有 `AccessConfig.ready()` 会在迁移后同步权限，不新增第二套同步机制。

- [ ] **Step 4: 用数据迁移预置组织能力开关**

```python
# apps/settings/migrations/0015_ai_allowed_capabilities.py
from django.db import migrations


AI_ALLOWED_CAPABILITIES = {
    "key": "ai.allowed_capabilities",
    "value": ["chat", "text_generation", "structured_extract", "long_text", "vision"],
    "value_type": "json",
    "widget": "json_editor",
    "label": "允许使用的 AI 能力",
    "description": "控制当前组织允许调用的平台 AI capability；供应商密钥和模型仍由平台统一管理。",
    "category": "ai",
    "ui": {"scopes": ["organization"], "control": "ai_capabilities"},
}


def ensure_ai_allowed_capabilities(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(key=AI_ALLOWED_CAPABILITIES["key"], defaults=AI_ALLOWED_CAPABILITIES)
    default_setting.objects.filter(pk=setting.pk).update(**{key: value for key, value in AI_ALLOWED_CAPABILITIES.items() if key != "key"})


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0014_property_rental_lease_allocation_rule")]
    operations = [migrations.RunPython(ensure_ai_allowed_capabilities, migrations.RunPython.noop)]
```

- [ ] **Step 5: 应用迁移并验证权限与设置**

Run: `docker compose exec web python manage.py migrate`

Expected: `Applying app_settings.0015_ai_allowed_capabilities... OK`，随后 `post_migrate` 同步 AI 权限。

Run: `docker compose exec web pytest tests/ai/test_permissions.py tests/access -q`

Expected: PASS。

建议提交信息：`feat: 接入 AI 权限与组织能力开关`

### Task 4: Prompt 版本解析、变量校验与快照

**Files:**
- Create: `apps/ai/runtime/prompts.py`
- Create: `tests/ai/test_prompts.py`

- [ ] **Step 1: 写启用版本、固定版本和缺失变量的失败测试**

```python
# tests/ai/test_prompts.py
import pytest
from model_bakery import baker

from apps.ai.runtime.contracts import AICapability, AIErrorCode, AIExecutionError
from apps.ai.runtime.prompts import resolve_prompt


@pytest.mark.django_db
def test_resolve_prompt_renders_active_version_and_returns_snapshot():
    prompt = baker.make(
        "ai.AIPrompt",
        key="house.public_description",
        version=2,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "为 {{ estate_name }} 编写客观房源描述"}],
        required_variables=["estate_name"],
        default_parameters={"temperature": 0.3},
        is_active=True,
    )
    snapshot = resolve_prompt("house.public_description", variables={"estate_name": "星河花园"})
    assert snapshot.version == 2
    assert snapshot.template_hash == prompt.template_hash
    assert snapshot.messages[0].content == "为 星河花园 编写客观房源描述"
    assert snapshot.parameters == {"temperature": 0.3}


@pytest.mark.django_db
def test_resolve_prompt_rejects_missing_required_variable():
    baker.make(
        "ai.AIPrompt",
        key="house.public_description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "{{ estate_name }}"}],
        required_variables=["estate_name"],
        is_active=True,
    )
    with pytest.raises(AIExecutionError) as exc_info:
        resolve_prompt("house.public_description", variables={})
    assert exc_info.value.code == AIErrorCode.INVALID_REQUEST
```

- [ ] **Step 2: 运行测试并确认 Prompt 解析器尚不存在**

Run: `docker compose exec web pytest tests/ai/test_prompts.py -q`

Expected: FAIL，错误包含 `No module named 'apps.ai.runtime.prompts'`。

- [ ] **Step 3: 实现单文件 Prompt 解析器**

```python
# apps/ai/runtime/prompts.py
from dataclasses import dataclass
from typing import Any

from django.template import Context, Engine

from apps.ai.models import AIPrompt
from apps.ai.runtime.contracts import AICapability, AIChatMessage, AIErrorCode, AIExecutionError


@dataclass(frozen=True, slots=True)
class PromptSnapshot:
    key: str
    version: int
    capability: AICapability
    template_hash: str
    messages: tuple[AIChatMessage, ...]
    parameters: dict[str, Any]


def resolve_prompt(prompt_key: str, *, variables: dict[str, Any], version: int | None = None) -> PromptSnapshot:
    query = AIPrompt.objects.filter(key=prompt_key)
    query = query.filter(version=version) if version is not None else query.filter(is_active=True)
    prompt = query.first()
    if prompt is None:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "未找到可用的 Prompt 配置。")

    missing = sorted(set(prompt.required_variables) - set(variables))
    if missing:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, f"Prompt 缺少变量：{', '.join(missing)}")

    engine = Engine(debug=False, string_if_invalid="")
    rendered = []
    for item in prompt.messages_template:
        role = item.get("role")
        content = item.get("content")
        if role not in {"system", "user", "assistant"} or not isinstance(content, str):
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 消息模板格式无效。")
        rendered.append(AIChatMessage(role=role, content=engine.from_string(content).render(Context(variables, autoescape=False))))

    return PromptSnapshot(
        key=prompt.key,
        version=prompt.version,
        capability=AICapability(prompt.capability),
        template_hash=prompt.template_hash,
        messages=tuple(rendered),
        parameters=dict(prompt.default_parameters),
    )
```

- [ ] **Step 4: 增加固定历史版本和 Prompt capability 不匹配测试**

在 `tests/ai/test_prompts.py` 增加：

```python
@pytest.mark.django_db
def test_explicit_version_can_resolve_inactive_history():
    baker.make(
        "ai.AIPrompt",
        key="general.chat",
        version=1,
        capability=AICapability.CHAT,
        messages_template=[{"role": "system", "content": "旧版本"}],
        is_active=False,
    )
    snapshot = resolve_prompt("general.chat", variables={}, version=1)
    assert snapshot.messages[0].content == "旧版本"
```

Executor 在下一任务必须比较 `snapshot.capability == request.capability`，不允许用错能力的 Prompt。

- [ ] **Step 5: 运行 Prompt 测试**

Run: `docker compose exec web pytest tests/ai/test_prompts.py tests/ai/test_models.py -q`

Expected: PASS。

建议提交信息：`feat: 实现 AI Prompt 版本解析`

### Task 5: OpenAI-compatible Provider、最小注册表和模型路由

**Files:**
- Create: `apps/ai/runtime/providers/openai_compatible.py`
- Modify: `apps/ai/runtime/providers/__init__.py`
- Create: `apps/ai/runtime/router.py`
- Create: `tests/ai/factories.py`
- Create: `tests/ai/test_provider.py`
- Create: `tests/ai/test_router.py`

- [ ] **Step 1: 创建 Fake Provider 测试工具**

```python
# tests/ai/factories.py
from collections.abc import Iterator

from apps.ai.runtime.contracts import AIExecutionResult, AIProviderRequest, AIStreamChunk, AIUsage


class FakeProvider:
    responses: list[AIExecutionResult | Exception] = []
    stream_responses: list[list[AIStreamChunk | Exception] | Exception] = []
    requests: list[AIProviderRequest] = []

    @classmethod
    def reset(cls):
        cls.responses = []
        cls.stream_responses = []
        cls.requests = []

    def __init__(self, settings):
        self.settings = settings

    def generate(self, request: AIProviderRequest) -> AIExecutionResult:
        type(self).requests.append(request)
        response = type(self).responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def stream(self, request: AIProviderRequest) -> Iterator[AIStreamChunk]:
        type(self).requests.append(request)
        if type(self).stream_responses:
            response = type(self).stream_responses.pop(0)
            if isinstance(response, Exception):
                raise response
            for item in response:
                if isinstance(item, Exception):
                    raise item
                yield item
            return
        yield AIStreamChunk(event="delta", text="你好")
        yield AIStreamChunk(event="usage", usage=AIUsage(2, 1, 3, "reported"))
        yield AIStreamChunk(event="done", finish_reason="stop")
```

同一文件提供可复用 fixture：

```python
from types import SimpleNamespace

import pytest
from model_bakery import baker

from apps.ai.runtime import providers
from apps.ai.runtime.contracts import AICapability, AIExecutionResult


@pytest.fixture
def org_owner(db):
    user = baker.make("accounts.User")
    organization = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=organization, user=user, is_owner=True)
    return SimpleNamespace(user=user, organization=organization)


@pytest.fixture
def ai_runtime(monkeypatch):
    FakeProvider.reset()
    monkeypatch.setitem(providers.PROVIDERS, "fake", FakeProvider)
    monkeypatch.setenv("TEST_AI_KEY", "secret")

    def configure(*, response: AIExecutionResult, capability=AICapability.TEXT_GENERATION, prompt_key="house.description"):
        provider = baker.make("ai.AIProviderConfig", code="fake-provider", adapter="fake", api_key_env="TEST_AI_KEY", enabled=True)
        model = baker.make("ai.AIModel", provider=provider, model_name="fake-model", enabled=True, supports_streaming=True, supports_json_schema=True)
        baker.make("ai.AIModelRoute", capability=capability, model=model, priority=10)
        baker.make(
            "ai.AIPrompt",
            key=prompt_key,
            version=1,
            capability=capability,
            messages_template=[{"role": "system", "content": "安全、客观地回答用户"}],
            is_active=True,
        )
        FakeProvider.responses = [response]

    return configure


@pytest.fixture
def enabled_ai_chat_runtime(ai_runtime, settings):
    settings.AI_ENABLED = True
    ai_runtime(response=AIExecutionResult("你好"), capability=AICapability.CHAT, prompt_key="general.chat")
```

- [ ] **Step 2: 写 Provider 参数映射和 Router 筛选的失败测试**

```python
# tests/ai/test_router.py
import pytest
from model_bakery import baker

from apps.ai.runtime.contracts import AICapability, AIExecutionMode
from apps.ai.runtime.router import get_model_candidates


@pytest.mark.django_db
def test_router_returns_enabled_candidates_in_priority_order():
    provider = baker.make("ai.AIProviderConfig", code="openai", enabled=True)
    secondary = baker.make("ai.AIModel", provider=provider, model_name="secondary", enabled=True, supports_streaming=True)
    primary = baker.make("ai.AIModel", provider=provider, model_name="primary", enabled=True, supports_streaming=True)
    baker.make("ai.AIModelRoute", capability=AICapability.CHAT, model=secondary, priority=20)
    baker.make("ai.AIModelRoute", capability=AICapability.CHAT, model=primary, priority=10)
    candidates = get_model_candidates(AICapability.CHAT, mode=AIExecutionMode.STREAM, requires_json_schema=False)
    assert [item.model_name for item in candidates] == ["primary", "secondary"]


@pytest.mark.django_db
def test_router_excludes_non_json_schema_model_for_structured_request():
    provider = baker.make("ai.AIProviderConfig", enabled=True)
    model = baker.make("ai.AIModel", provider=provider, enabled=True, supports_json_schema=False)
    baker.make("ai.AIModelRoute", capability=AICapability.STRUCTURED_EXTRACT, model=model, priority=10)
    assert get_model_candidates(AICapability.STRUCTURED_EXTRACT, mode=AIExecutionMode.SYNC, requires_json_schema=True) == []
```

```python
# tests/ai/test_provider.py
from types import SimpleNamespace

from apps.ai.runtime.contracts import AIChatMessage, AIProviderRequest, AIProviderSettings
from apps.ai.runtime.providers.openai_compatible import OpenAICompatibleProvider


def test_openai_compatible_provider_maps_chat_completion():
    completion = SimpleNamespace(
        id="req-1",
        choices=[SimpleNamespace(message=SimpleNamespace(content="完成"), finish_reason="stop")],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=3, total_tokens=13),
    )
    calls = []
    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **kwargs: calls.append(kwargs) or completion)))
    provider = OpenAICompatibleProvider(
        AIProviderSettings("openai", "https://api.example.com/v1", "secret", 30),
        client_factory=lambda **kwargs: client,
    )
    result = provider.generate(AIProviderRequest("demo", [AIChatMessage("user", "你好")], {"temperature": 0.2}))
    assert calls[0]["model"] == "demo"
    assert calls[0]["messages"] == [{"role": "user", "content": "你好"}]
    assert result.text == "完成"
    assert result.usage.total_tokens == 13
```

- [ ] **Step 3: 运行测试并确认 Provider 与 Router 尚不存在**

Run: `docker compose exec web pytest tests/ai/test_provider.py tests/ai/test_router.py -q`

Expected: FAIL，错误指向缺失的 Provider 或 Router。

- [ ] **Step 4: 实现最小 Provider 注册表**

```python
# apps/ai/runtime/providers/__init__.py
from apps.ai.runtime.contracts import AIErrorCode, AIExecutionError, AIProviderSettings
from apps.ai.runtime.providers.openai_compatible import OpenAICompatibleProvider

PROVIDERS = {"openai_compatible": OpenAICompatibleProvider}


def build_provider(adapter: str, settings: AIProviderSettings):
    provider_class = PROVIDERS.get(adapter)
    if provider_class is None:
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "AI Provider 适配器未配置。")
    return provider_class(settings)
```

- [ ] **Step 5: 实现 Chat Completions Adapter**

```python
# apps/ai/runtime/providers/openai_compatible.py
from time import monotonic

from openai import APIConnectionError, APITimeoutError, OpenAI

from apps.ai.runtime.contracts import (
    AIErrorCode,
    AIExecutionResult,
    AIProviderError,
    AIProviderRequest,
    AIProviderSettings,
    AIStreamChunk,
    AIUsage,
)


class OpenAICompatibleProvider:
    def __init__(self, settings: AIProviderSettings, *, client_factory=OpenAI):
        self.settings = settings
        self.last_request_id = ""
        client_options = {
            key: value
            for key, value in settings.extra.items()
            if key == "default_query" and isinstance(value, dict)
        }
        self.client = client_factory(
            api_key=settings.api_key,
            base_url=settings.base_url,
            timeout=settings.timeout_seconds,
            max_retries=0,
            **client_options,
        )

    def _kwargs(self, request: AIProviderRequest) -> dict:
        kwargs = {
            "model": request.model_name,
            "messages": [{"role": item.role, "content": item.content} for item in request.messages],
            **request.parameters,
        }
        if request.response_schema is not None:
            kwargs["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": request.response_schema_name or "structured_output", "strict": True, "schema": request.response_schema},
            }
        return kwargs

    def generate(self, request: AIProviderRequest) -> AIExecutionResult:
        started = monotonic()
        try:
            response = self.client.chat.completions.create(**self._kwargs(request))
        except AIProviderError:
            raise
        except Exception as exc:
            raise self._normalize_error(exc) from exc
        usage = getattr(response, "usage", None)
        choice = response.choices[0]
        if choice.finish_reason == "content_filter":
            raise AIProviderError(AIErrorCode.CONTENT_REJECTED, "AI 内容安全策略拒绝了该请求。", retryable=False, provider_request_id=getattr(response, "id", "") or "")
        return AIExecutionResult(
            text=choice.message.content or "",
            usage=AIUsage(
                input_tokens=getattr(usage, "prompt_tokens", None),
                output_tokens=getattr(usage, "completion_tokens", None),
                total_tokens=getattr(usage, "total_tokens", None),
                source="reported" if usage is not None else "unavailable",
            ),
            finish_reason=choice.finish_reason or "",
            provider_request_id=getattr(response, "id", "") or "",
            duration_ms=int((monotonic() - started) * 1000),
        )

    def stream(self, request: AIProviderRequest):
        try:
            stream = self.client.chat.completions.create(**self._kwargs(request), stream=True, stream_options={"include_usage": True})
            final_usage = None
            finish_reason = ""
            for chunk in stream:
                self.last_request_id = getattr(chunk, "id", "") or self.last_request_id
                text = chunk.choices[0].delta.content if chunk.choices else None
                if text:
                    yield AIStreamChunk(event="delta", text=text)
                usage = getattr(chunk, "usage", None)
                if usage is not None:
                    final_usage = AIUsage(usage.prompt_tokens, usage.completion_tokens, usage.total_tokens, "reported")
                if chunk.choices and chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason
                    if finish_reason == "content_filter":
                        raise AIProviderError(AIErrorCode.CONTENT_REJECTED, "AI 内容安全策略拒绝了该请求。", retryable=False)
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
```

- [ ] **Step 6: 实现按 capability 和执行特性筛选的 Router**

```python
# apps/ai/runtime/router.py
from apps.ai.models import AIModelRoute
from apps.ai.runtime.contracts import AICapability, AIExecutionMode, AIModelCandidate


def get_model_candidates(capability: AICapability, *, mode: AIExecutionMode, requires_json_schema: bool) -> list[AIModelCandidate]:
    routes = AIModelRoute.objects.select_related("model__provider").filter(
        capability=capability.value,
        enabled=True,
        model__enabled=True,
        model__provider__enabled=True,
    )
    if mode == AIExecutionMode.STREAM:
        routes = routes.filter(model__supports_streaming=True)
    if requires_json_schema:
        routes = routes.filter(model__supports_json_schema=True)

    return [
        AIModelCandidate(
            provider_code=route.model.provider.code,
            adapter=route.model.provider.adapter,
            base_url=route.model.provider.base_url,
            api_key_env=route.model.provider.api_key_env,
            timeout_seconds=route.model.provider.timeout_seconds,
            provider_extra=route.model.provider.extra,
            model_name=route.model.model_name,
            display_name=route.model.display_name,
            supports_json_schema=route.model.supports_json_schema,
            context_window=route.model.context_window,
            max_output_tokens=route.model.max_output_tokens,
            default_parameters=route.model.default_parameters,
            input_price_per_million=route.model.input_price_per_million,
            output_price_per_million=route.model.output_price_per_million,
            currency=route.model.currency,
        )
        for route in routes.order_by("priority", "pk")
    ]
```

- [ ] **Step 7: 运行 Provider 和 Router 测试**

Run: `docker compose exec web pytest tests/ai/test_provider.py tests/ai/test_router.py -q`

Expected: PASS。

建议提交信息：`feat: 实现 AI Provider 与模型路由`

### Task 6: 限额空策略与分级内容保留

**Files:**
- Create: `apps/ai/runtime/quota.py`
- Create: `apps/ai/runtime/retention.py`
- Create: `tests/ai/test_policies.py`

- [ ] **Step 1: 写限额生命周期和内容保留的失败测试**

```python
# tests/ai/test_policies.py
from datetime import timedelta

from django.utils import timezone

from apps.ai.runtime.contracts import AIRetentionPolicy, AIUsage
from apps.ai.runtime.quota import UnlimitedQuotaPolicy
from apps.ai.runtime.retention import decide_retention, sanitize_safe_summary


def test_unlimited_quota_still_returns_a_reservation_and_accepts_settlement():
    policy = UnlimitedQuotaPolicy()
    reservation = policy.reserve(context=None, estimated_usage=AIUsage())
    assert reservation.policy == "unlimited"
    policy.settle(reservation, AIUsage(10, 5, 15, "reported"))
    policy.release(reservation)


def test_temporary_retention_has_expiry_and_metadata_only_has_no_payload():
    now = timezone.now()
    temporary = decide_retention(AIRetentionPolicy.TEMPORARY, now=now, temporary_hours=24)
    metadata = decide_retention(AIRetentionPolicy.METADATA_ONLY, now=now, temporary_hours=24)
    assert temporary.persist_input is True
    assert temporary.expires_at == now + timedelta(hours=24)
    assert metadata.persist_input is False
    assert metadata.persist_output is False
    assert sanitize_safe_summary({"house_id": 10, "contact": "13800138000", "email": "a@example.com"}) == {"house_id": 10}
```

- [ ] **Step 2: 运行测试并确认策略模块尚不存在**

Run: `docker compose exec web pytest tests/ai/test_policies.py -q`

Expected: FAIL，错误指向缺失的 quota 或 retention 模块。

- [ ] **Step 3: 实现 Quota Protocol 和 UnlimitedQuotaPolicy**

```python
# apps/ai/runtime/quota.py
from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from apps.ai.runtime.contracts import AIExecutionContext, AIUsage


@dataclass(frozen=True, slots=True)
class QuotaReservation:
    reservation_id: str
    policy: str


class QuotaPolicy(Protocol):
    def reserve(self, context: AIExecutionContext | None, estimated_usage: AIUsage) -> QuotaReservation:
        raise NotImplementedError

    def settle(self, reservation: QuotaReservation, actual_usage: AIUsage) -> None:
        raise NotImplementedError

    def release(self, reservation: QuotaReservation) -> None:
        raise NotImplementedError


class UnlimitedQuotaPolicy:
    def reserve(self, context: AIExecutionContext | None, estimated_usage: AIUsage) -> QuotaReservation:
        return QuotaReservation(reservation_id=str(uuid4()), policy="unlimited")

    def settle(self, reservation: QuotaReservation, actual_usage: AIUsage) -> None:
        return None

    def release(self, reservation: QuotaReservation) -> None:
        return None


quota_policy: QuotaPolicy = UnlimitedQuotaPolicy()
```

- [ ] **Step 4: 实现三类保留决策和安全摘要过滤**

```python
# apps/ai/runtime/retention.py
from dataclasses import dataclass
from datetime import datetime, timedelta
import re
from typing import Any

from apps.ai.runtime.contracts import AIRetentionPolicy

SENSITIVE_KEYS = {"phone", "mobile", "email", "id_number", "api_key", "access_token", "secret"}
SENSITIVE_VALUE_PATTERNS = (
    re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
    re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)"),
    re.compile(r"\b(?:sk-|Bearer\s+)[A-Za-z0-9._-]{12,}\b", re.IGNORECASE),
)


@dataclass(frozen=True, slots=True)
class RetentionDecision:
    persist_input: bool
    persist_output: bool
    expires_at: datetime | None


def decide_retention(policy: AIRetentionPolicy, *, now: datetime, temporary_hours: int) -> RetentionDecision:
    if policy == AIRetentionPolicy.TEMPORARY:
        return RetentionDecision(True, True, now + timedelta(hours=temporary_hours))
    return RetentionDecision(False, False, None)


def sanitize_safe_summary(summary: dict[str, Any] | None) -> dict[str, Any]:
    if not summary:
        return {}
    cleaned = {}
    for key, value in summary.items():
        if any(fragment in key.lower() for fragment in SENSITIVE_KEYS):
            continue
        if not isinstance(value, (str, int, float, bool, type(None))):
            continue
        if isinstance(value, str) and any(pattern.search(value) for pattern in SENSITIVE_VALUE_PATTERNS):
            continue
        cleaned[key] = value
    return cleaned
```

`conversation` 返回不保存 invocation payload，因为完整正文只进入 `AIMessage`；`metadata_only` 同样不保存正文。两者差异保留在 `retention_policy`，供审计和后续对话清理使用。

- [ ] **Step 5: 运行策略测试**

Run: `docker compose exec web pytest tests/ai/test_policies.py -q`

Expected: PASS。

建议提交信息：`feat: 接入 AI 限额与内容保留策略`

### Task 7: 统一 Executor 与同步 `generate()` 服务

**Files:**
- Create: `apps/ai/runtime/executor.py`
- Create: `apps/ai/services.py`
- Modify: `apps/ai/__init__.py`
- Create: `tests/ai/test_executor.py`
- Create: `tests/ai/test_services.py`

- [ ] **Step 1: 写同步成功、可重试降级和不可重试停止的失败测试**

```python
# tests/ai/test_executor.py
import pytest
from model_bakery import baker

pytest_plugins = ["tests.ai.factories"]

from apps.ai.runtime import providers
from apps.ai.runtime.contracts import (
    AICapability,
    AIErrorCode,
    AIExecutionContext,
    AIExecutionRequest,
    AIExecutionResult,
    AIProviderError,
    AIUsage,
)
from apps.ai.runtime.executor import ExecutionTrace, execute
from tests.ai.factories import FakeProvider


@pytest.fixture(autouse=True)
def fake_provider(monkeypatch):
    FakeProvider.reset()
    monkeypatch.setitem(providers.PROVIDERS, "fake", FakeProvider)


def make_route(priority, model_name):
    provider = baker.make("ai.AIProviderConfig", code=f"provider-{priority}", adapter="fake", api_key_env="TEST_AI_KEY", enabled=True)
    model = baker.make("ai.AIModel", provider=provider, model_name=model_name, enabled=True)
    baker.make("ai.AIModelRoute", capability=AICapability.TEXT_GENERATION, model=model, priority=priority)


@pytest.mark.django_db
def test_executor_falls_back_only_for_retryable_provider_error(monkeypatch):
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    baker.make(
        "ai.AIPrompt",
        key="house.description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "生成描述"}],
        is_active=True,
    )
    make_route(10, "primary")
    make_route(20, "fallback")
    FakeProvider.responses = [
        AIProviderError(AIErrorCode.TIMEOUT, "超时", retryable=True),
        AIExecutionResult("完成", usage=AIUsage(10, 5, 15, "reported")),
    ]
    trace = ExecutionTrace()
    result = execute(
        AIExecutionRequest(AICapability.TEXT_GENERATION, "house.description"),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
        trace=trace,
    )
    assert result.text == "完成"
    assert [attempt["status"] for attempt in trace.attempts] == ["failed", "succeeded"]
    assert trace.selected_candidate.model_name == "fallback"
```

在同一文件增加：

```python
@pytest.mark.django_db
def test_executor_does_not_fallback_for_non_retryable_error(monkeypatch):
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    baker.make(
        "ai.AIPrompt",
        key="house.description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "生成描述"}],
        is_active=True,
    )
    make_route(10, "primary")
    make_route(20, "fallback")
    FakeProvider.responses = [AIProviderError(AIErrorCode.CONTENT_REJECTED, "内容被拒绝", retryable=False)]
    quota = RecordingQuota()
    with pytest.raises(AIProviderError) as exc_info:
        execute(
            AIExecutionRequest(AICapability.TEXT_GENERATION, "house.description"),
            AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
            quota=quota,
        )
    assert exc_info.value.code == AIErrorCode.CONTENT_REJECTED
    assert len(FakeProvider.requests) == 1
    assert quota.events == ["reserve", "release"]


class RecordingQuota:
    def __init__(self):
        self.events = []

    def reserve(self, context, estimated_usage):
        self.events.append("reserve")
        return object()

    def settle(self, reservation, actual_usage):
        self.events.append("settle")

    def release(self, reservation):
        self.events.append("release")


@pytest.mark.django_db
def test_executor_uses_quota_lifecycle_on_success(monkeypatch):
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    baker.make(
        "ai.AIPrompt",
        key="house.description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "生成描述"}],
        is_active=True,
    )
    make_route(10, "primary")
    FakeProvider.responses = [AIExecutionResult("完成")]
    quota = RecordingQuota()
    execute(
        AIExecutionRequest(AICapability.TEXT_GENERATION, "house.description"),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
        quota=quota,
    )
    assert quota.events == ["reserve", "settle"]
```

```python
# tests/ai/test_services.py
import pytest
from django.test import override_settings
from model_bakery import baker

pytest_plugins = ["tests.ai.factories"]

from apps.ai.models import AIInvocation
from apps.ai.runtime.contracts import AICapability, AIExecutionResult, AIUsage
from apps.ai.services import generate
from tests.ai.factories import FakeProvider


@pytest.mark.django_db
@override_settings(AI_ENABLED=True)
def test_generate_persists_audit_and_returns_text(ai_runtime, org_owner):
    ai_runtime(response=AIExecutionResult("朝南两居室", usage=AIUsage(20, 8, 28, "reported")))
    result = generate(
        actor=org_owner.user,
        organization=org_owner.organization,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.description",
        variables={"title": "测试房源"},
        source_app="house",
        target_type="house",
        target_id="100",
    )
    invocation = AIInvocation.objects.get(pk=result.invocation_id)
    assert result.text == "朝南两居室"
    assert invocation.status == "succeeded"
    assert invocation.total_tokens == 28
    assert invocation.provider_code
```

在 `tests/ai/test_services.py` 通过 `pytest_plugins = ["tests.ai.factories"]` 启用上述 fixture。

- [ ] **Step 2: 运行测试并确认 Executor 与服务入口尚不存在**

Run: `docker compose exec web pytest tests/ai/test_executor.py tests/ai/test_services.py -q`

Expected: FAIL，错误指向 `executor` 或 `generate` 缺失。

- [ ] **Step 3: 实现 Executor 的共享轨迹、输入上限、参数合并和候选降级**

```python
# apps/ai/runtime/executor.py
import os
from dataclasses import dataclass, field
from decimal import Decimal
from time import monotonic

from django.conf import settings

from apps.ai.runtime.contracts import (
    AIErrorCode,
    AIExecutionContext,
    AIExecutionError,
    AIExecutionRequest,
    AIExecutionResult,
    AIModelCandidate,
    AIProviderError,
    AIProviderRequest,
    AIProviderSettings,
    AIUsage,
)
from apps.ai.runtime.prompts import PromptSnapshot, resolve_prompt
from apps.ai.runtime.providers import build_provider
from apps.ai.runtime.quota import QuotaPolicy, quota_policy
from apps.ai.runtime.router import get_model_candidates


@dataclass(slots=True)
class ExecutionTrace:
    prompt: PromptSnapshot | None = None
    attempts: list[dict] = field(default_factory=list)
    selected_candidate: AIModelCandidate | None = None


def _estimated_cost(candidate: AIModelCandidate, usage: AIUsage) -> Decimal | None:
    if usage.input_tokens is None or usage.output_tokens is None:
        return None
    if candidate.input_price_per_million is None or candidate.output_price_per_million is None:
        return None
    million = Decimal(1_000_000)
    return (Decimal(usage.input_tokens) * candidate.input_price_per_million + Decimal(usage.output_tokens) * candidate.output_price_per_million) / million


def _parameters(prompt: PromptSnapshot, candidate: AIModelCandidate) -> dict:
    merged = {**candidate.default_parameters, **prompt.parameters}
    allowed = {"temperature", "top_p", "max_tokens", "presence_penalty", "frequency_penalty", "seed", "stop"}
    unknown = sorted(set(merged) - allowed)
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


def execute(
    request: AIExecutionRequest,
    context: AIExecutionContext,
    *,
    trace: ExecutionTrace | None = None,
    quota: QuotaPolicy = quota_policy,
) -> AIExecutionResult:
    trace = trace or ExecutionTrace()
    prompt = resolve_prompt(request.prompt_key, variables=dict(request.variables), version=request.prompt_version)
    trace.prompt = prompt
    if prompt.capability != request.capability:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 与请求能力不匹配。")

    messages = (*prompt.messages, *request.messages)
    total_chars = sum(len(item.content) for item in messages)
    if total_chars > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入内容超过平台上限。")

    reservation = quota.reserve(context, AIUsage())
    candidates = get_model_candidates(request.capability, mode=request.execution_mode, requires_json_schema=request.response_model is not None)
    if not candidates:
        quota.release(reservation)
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")

    last_error = None
    try:
        for sequence, candidate in enumerate(candidates, start=1):
            started = monotonic()
            parameters = _parameters(prompt, candidate)
            candidate_messages = _fit_messages(prompt.messages, request.messages, candidate, parameters["max_tokens"])
            if candidate_messages is None:
                last_error = AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入超过候选模型上下文窗口。")
                continue
            api_key = os.environ.get(candidate.api_key_env, "")
            if not api_key:
                error = AIProviderError(AIErrorCode.PROVIDER_AUTH_ERROR, "AI 供应商密钥未配置。", retryable=True)
                trace.attempts.append({"sequence": sequence, "provider": candidate.provider_code, "model": candidate.model_name, "status": "failed", "error_type": error.code.value})
                last_error = error
                continue

            provider = build_provider(
                candidate.adapter,
                AIProviderSettings(candidate.provider_code, candidate.base_url, api_key, candidate.timeout_seconds, candidate.provider_extra),
            )
            provider_request = AIProviderRequest(
                model_name=candidate.model_name,
                messages=candidate_messages,
                parameters=parameters,
                response_schema=request.response_model.model_json_schema() if request.response_model else None,
                response_schema_name=request.response_model.__name__ if request.response_model else None,
            )
            try:
                result = provider.generate(provider_request)
            except AIProviderError as error:
                trace.attempts.append(
                    {
                        "sequence": sequence,
                        "provider": candidate.provider_code,
                        "model": candidate.model_name,
                        "status": "failed",
                        "error_type": error.code.value,
                        "provider_request_id": error.provider_request_id,
                        "duration_ms": int((monotonic() - started) * 1000),
                    }
                )
                last_error = error
                if error.retryable:
                    continue
                raise

            cost = _estimated_cost(candidate, result.usage)
            trace.selected_candidate = candidate
            trace.attempts.append(
                {
                    "sequence": sequence,
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
                }
            )
            quota.settle(reservation, result.usage)
            return result
        raise last_error or AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")
    except Exception:
        quota.release(reservation)
        raise
```

这里的字符数仅用于平台输入安全上限；它不写入 Token 审计，也不伪装成供应商 Token 用量。

- [ ] **Step 4: 实现权限、幂等、调用落库和同步公共接口**

`apps/ai/services.py` 的公共签名固定如下：

```python
from dataclasses import dataclass
from decimal import Decimal
import hashlib
import json
from typing import Any

from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.utils import timezone

from pydantic import BaseModel

from apps.access.constants import AIPermission
from apps.access.services import has_permission
from apps.ai.models import AIInvocation
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
    AIUsage,
)
from apps.ai.runtime.executor import ExecutionTrace, execute
from apps.ai.runtime.retention import decide_retention, sanitize_safe_summary
from apps.organizations.models import OrganizationMember
from apps.settings.service import get_org_setting


@dataclass(frozen=True, slots=True)
class AIResult:
    invocation_id: int
    text: str
    data: dict[str, Any] | None
    usage: AIUsage


def _authorize_call(*, actor, organization, capability: AICapability, trusted_system: bool) -> None:
    if not settings.AI_ENABLED:
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "AI 功能当前未启用。")
    if actor is None:
        if not trusted_system:
            raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "AI 系统任务未被授权。")
        return
    if not actor.is_authenticated:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is None:
        if capability != AICapability.CHAT:
            raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "该 AI 能力必须在组织空间内使用。")
        return
    if not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    if not actor.is_superuser and not has_permission(actor, organization, AIPermission.USE.value):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "没有使用 AI 能力的权限。")
    allowed = get_org_setting(organization, "ai.allowed_capabilities")["value"]
    if capability.value not in allowed:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "当前组织未启用该 AI 能力。")


def _json_safe(value):
    return json.loads(json.dumps(value, cls=DjangoJSONEncoder, ensure_ascii=False))


def _content_hash(input_payload: dict, output_payload: dict) -> str:
    encoded = json.dumps({"input": input_payload, "output": output_payload}, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def _replay(invocation: AIInvocation) -> AIResult | None:
    if invocation.status != AIInvocationStatus.SUCCEEDED.value:
        return None
    if hasattr(invocation, "assistant_message"):
        message = invocation.assistant_message
        return AIResult(invocation.pk, message.content, message.content_json, AIUsage(invocation.input_tokens, invocation.output_tokens, invocation.total_tokens, invocation.usage_status))
    if invocation.output_payload:
        return AIResult(
            invocation.pk,
            invocation.output_payload.get("text", ""),
            invocation.output_payload.get("data"),
            AIUsage(invocation.input_tokens, invocation.output_tokens, invocation.total_tokens, invocation.usage_status),
        )
    return None


def generate(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    variables: dict[str, Any] | None = None,
    messages=(),
    response_model: type[BaseModel] | None = None,
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    conversation=None,
    trusted_system: bool = False,
) -> AIResult:
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    if idempotency_key:
        existing = AIInvocation.objects.filter(
            organization=organization,
            actor=actor,
            source_app=source_app,
            idempotency_key=idempotency_key,
        ).first()
        if existing is not None:
            replayed = _replay(existing)
            if replayed is not None:
                return replayed
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同幂等键的 AI 调用正在执行或结果已过期。")

    now = timezone.now()
    retention = decide_retention(retention_policy, now=now, temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    input_payload = _json_safe(
        {
            "variables": variables or {},
            "messages": [{"role": item.role, "content": item.content} for item in messages],
        }
    )
    if len(json.dumps(input_payload, ensure_ascii=False)) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入载荷超过平台上限。")
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
        started_at=now,
    )
    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        variables=variables or {},
        messages=tuple(messages),
        response_model=response_model,
        execution_mode=AIExecutionMode.SYNC,
    )
    context = AIExecutionContext(
        actor_id=getattr(actor, "pk", None),
        organization_id=getattr(organization, "pk", None),
        source_app=source_app,
        target_type=target_type,
        target_id=target_id,
        idempotency_key=idempotency_key,
        retention_policy=retention_policy,
        safe_summary=safe_summary or {},
    )
    trace = ExecutionTrace()
    try:
        result = execute(request, context, trace=trace)
    except AIExecutionError as error:
        failed_at = timezone.now()
        AIInvocation.objects.filter(pk=invocation.pk).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=error.code.value,
            error_code=error.code.value,
            error_summary=error.safe_message[:500],
            attempts=trace.attempts,
            content_hash=_content_hash(input_payload, {}),
            safe_summary=sanitize_safe_summary(safe_summary),
            finished_at=failed_at,
            duration_ms=int((failed_at - invocation.started_at).total_seconds() * 1000),
        )
        raise
    except Exception as unexpected:
        failed_at = timezone.now()
        AIInvocation.objects.filter(pk=invocation.pk).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=AIErrorCode.INTERNAL_ERROR.value,
            error_code=AIErrorCode.INTERNAL_ERROR.value,
            error_summary="AI 调用发生内部错误。",
            attempts=trace.attempts,
            content_hash=_content_hash(input_payload, {}),
            safe_summary=sanitize_safe_summary(safe_summary),
            finished_at=failed_at,
            duration_ms=int((failed_at - invocation.started_at).total_seconds() * 1000),
        )
        raise AIExecutionError(AIErrorCode.INTERNAL_ERROR, "AI 调用发生内部错误。") from unexpected

    candidate = trace.selected_candidate
    output_payload = {"text": result.text, "data": result.structured_data} if retention.persist_output else {}
    finished_at = timezone.now()
    costs = [Decimal(item["estimated_cost"]) for item in trace.attempts if item.get("estimated_cost")]
    AIInvocation.objects.filter(pk=invocation.pk).update(
        status=AIInvocationStatus.SUCCEEDED.value,
        prompt_key=trace.prompt.key,
        prompt_version=trace.prompt.version,
        prompt_hash=trace.prompt.template_hash,
        provider_code=candidate.provider_code,
        model_name=candidate.model_name,
        input_tokens=result.usage.input_tokens,
        output_tokens=result.usage.output_tokens,
        total_tokens=result.usage.total_tokens,
        usage_status=result.usage.source,
        input_price_snapshot=candidate.input_price_per_million,
        output_price_snapshot=candidate.output_price_per_million,
        estimated_cost=sum(costs, Decimal("0")) if costs else None,
        currency=candidate.currency,
        finished_at=finished_at,
        duration_ms=int((finished_at - invocation.started_at).total_seconds() * 1000),
        provider_request_id=result.provider_request_id,
        attempts=trace.attempts,
        output_payload=output_payload,
        content_hash=_content_hash(input_payload, output_payload),
        safe_summary=sanitize_safe_summary(safe_summary),
    )
    return AIResult(invocation.pk, result.text, dict(result.structured_data) if result.structured_data is not None else None, result.usage)
```

结构化修正加入后，`input_tokens/output_tokens/total_tokens/usage_status` 必须改为从 `trace.attempts` 聚合所有实际 Provider 请求；任何一次用量 unavailable 时，汇总 `usage_status` 仍为 unavailable，但已报告的 Token 与费用照常相加。

- [ ] **Step 5: 只导出稳定的跨应用表面**

```python
# apps/ai/__init__.py
from importlib import import_module

__all__ = ["generate", "stream", "enqueue", "get_job"]


def __getattr__(name):
    if name not in __all__:
        raise AttributeError(name)
    services = import_module("apps.ai.services")
    return getattr(services, name)
```

业务模块仍推荐使用 `from apps.ai.services import generate`，不得导入 `models`、`runtime` 或 SDK。

- [ ] **Step 6: 运行 Executor、服务和权限测试**

Run: `docker compose exec web pytest tests/ai/test_executor.py tests/ai/test_services.py tests/ai/test_permissions.py -q`

Expected: PASS。

建议提交信息：`feat: 实现 AI 同步执行与审计流水线`

### Task 8: 结构化 JSON 输出与一次修正

**Files:**
- Modify: `apps/ai/runtime/executor.py`
- Modify: `apps/ai/services.py`
- Modify: `tests/ai/test_executor.py`
- Modify: `tests/ai/test_services.py`

- [ ] **Step 1: 写本地 Pydantic 校验和单次修正的失败测试**

```python
from pydantic import BaseModel


class HouseExtract(BaseModel):
    monthly_rent: int
    bedrooms: int


@pytest.mark.django_db
def test_structured_output_is_validated_and_repaired_once(ai_runtime):
    ai_runtime(
        response=AIExecutionResult('{"monthly_rent":"未知"}'),
        capability=AICapability.STRUCTURED_EXTRACT,
        prompt_key="house.extract",
    )
    FakeProvider.responses = [
        AIExecutionResult('{"monthly_rent":"未知"}'),
        AIExecutionResult('{"monthly_rent":3500,"bedrooms":2}'),
    ]
    trace = ExecutionTrace()
    result = execute(
        AIExecutionRequest(AICapability.STRUCTURED_EXTRACT, "house.extract", response_model=HouseExtract),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
        trace=trace,
    )
    assert result.structured_data == {"monthly_rent": 3500, "bedrooms": 2}
    assert len(trace.attempts) == 2
    assert trace.attempts[1]["kind"] == "structured_repair"


@pytest.mark.django_db
def test_structured_output_never_returns_unvalidated_data(ai_runtime):
    ai_runtime(
        response=AIExecutionResult('{"monthly_rent":"未知"}'),
        capability=AICapability.STRUCTURED_EXTRACT,
        prompt_key="house.extract",
    )
    FakeProvider.responses = [
        AIExecutionResult('{"monthly_rent":"未知"}'),
        AIExecutionResult('{"monthly_rent":3500}'),
    ]
    with pytest.raises(AIExecutionError) as exc_info:
        execute(
            AIExecutionRequest(AICapability.STRUCTURED_EXTRACT, "house.extract", response_model=HouseExtract),
            AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
        )
    assert exc_info.value.code == AIErrorCode.STRUCTURED_OUTPUT_INVALID
```

- [ ] **Step 2: 运行测试并确认当前实现未做本地校验**

Run: `docker compose exec web pytest tests/ai/test_executor.py -q`

Expected: FAIL，首次无效 JSON 被直接当作普通文本返回或 `structured_data` 为空。

- [ ] **Step 3: 在同一候选模型内实现一次修正，不切换模型**

在 `runtime/executor.py` 增加：

```python
from pydantic import ValidationError as PydanticValidationError


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
```

先按 Task 7 记录首次 Provider attempt，再在 `quota.settle()` 和 `return` 之前执行：

```python
if request.response_model is not None:
    try:
        result = _validate_structured(result, request.response_model)
    except PydanticValidationError as validation_error:
        trace.attempts[-1]["status"] = "invalid"
        trace.attempts[-1]["error_type"] = AIErrorCode.STRUCTURED_OUTPUT_INVALID.value
        repair_message = AIChatMessage(
            role="user",
            content=(
                "上一条输出未通过 JSON Schema 校验。只返回修正后的 JSON，不要解释。"
                f"校验错误：{validation_error.errors(include_input=False, include_url=False)}"
            ),
        )
        repair_request = AIProviderRequest(
            model_name=candidate.model_name,
            messages=(*provider_request.messages, AIChatMessage("assistant", result.text), repair_message),
            parameters=provider_request.parameters,
            response_schema=provider_request.response_schema,
            response_schema_name=provider_request.response_schema_name,
        )
        try:
            repaired = provider.generate(repair_request)
        except AIProviderError as repair_error:
            trace.attempts.append(
                {
                    "sequence": len(trace.attempts) + 1,
                    "kind": "structured_repair",
                    "provider": candidate.provider_code,
                    "model": candidate.model_name,
                    "status": "failed",
                    "error_type": repair_error.code.value,
                }
            )
            raise
        repair_cost = _estimated_cost(candidate, repaired.usage)
        repair_attempt = {
            "sequence": len(trace.attempts) + 1,
            "kind": "structured_repair",
            "provider": candidate.provider_code,
            "model": candidate.model_name,
            "status": "succeeded",
            "input_tokens": repaired.usage.input_tokens,
            "output_tokens": repaired.usage.output_tokens,
            "total_tokens": repaired.usage.total_tokens,
            "usage_status": repaired.usage.source,
            "estimated_cost": str(repair_cost) if repair_cost is not None else None,
            "input_price_per_million": str(candidate.input_price_per_million) if candidate.input_price_per_million is not None else None,
            "output_price_per_million": str(candidate.output_price_per_million) if candidate.output_price_per_million is not None else None,
            "currency": candidate.currency,
        }
        try:
            result = _validate_structured(repaired, request.response_model)
        except PydanticValidationError as final_error:
            repair_attempt["status"] = "invalid"
            repair_attempt["error_type"] = AIErrorCode.STRUCTURED_OUTPUT_INVALID.value
            trace.attempts.append(repair_attempt)
            raise AIExecutionError(AIErrorCode.STRUCTURED_OUTPUT_INVALID, "AI 返回的结构化结果无效。") from final_error
        trace.attempts.append(repair_attempt)
```

增加统一用量聚合，并把 Task 7 的 `quota.settle(reservation, result.usage)` 替换为 `quota.settle(reservation, _aggregate_attempt_usage(trace.attempts))`：

```python
def _aggregate_attempt_usage(attempts: list[dict]) -> AIUsage:
    reported = [item for item in attempts if item.get("usage_status") == "reported"]
    unavailable = any(item.get("usage_status") != "reported" for item in attempts)
    input_values = [item["input_tokens"] for item in reported if item.get("input_tokens") is not None]
    output_values = [item["output_tokens"] for item in reported if item.get("output_tokens") is not None]
    total_values = [item["total_tokens"] for item in reported if item.get("total_tokens") is not None]
    return AIUsage(
        input_tokens=sum(input_values) if input_values else None,
        output_tokens=sum(output_values) if output_values else None,
        total_tokens=sum(total_values) if total_values else None,
        source="unavailable" if unavailable else "reported",
    )


def _aggregate_attempt_cost(attempts: list[dict]) -> tuple[Decimal | None, str]:
    priced = [item for item in attempts if item.get("estimated_cost") is not None]
    currencies = {item.get("currency", "") for item in priced}
    if not priced or len(currencies) != 1:
        return None, ""
    return sum((Decimal(item["estimated_cost"]) for item in priced), Decimal("0")), currencies.pop()
```

修正请求属于同一个 logical invocation，追加到 `attempts`；结构化校验失败不得进入备用模型链。Services 使用这两个聚合函数写 `AIInvocation`，不只采用最后一次用量。若备用模型使用不同币种，顶层 `estimated_cost/currency` 留空，真实分项费用仍保存在 attempts，禁止直接跨币种相加。

在 `generate()` 成功块更新 `AIInvocation` 之前，计算 `aggregate_usage = _aggregate_attempt_usage(trace.attempts)` 和 `aggregate_cost, aggregate_currency = _aggregate_attempt_cost(trace.attempts)`；更新语句中的六个对应字段必须赋值为 `aggregate_usage.input_tokens`、`aggregate_usage.output_tokens`、`aggregate_usage.total_tokens`、`aggregate_usage.source`、`aggregate_cost`、`aggregate_currency`。

- [ ] **Step 4: 验证结构化结果和审计汇总**

Run: `docker compose exec web pytest tests/ai/test_executor.py tests/ai/test_services.py -q`

Expected: PASS；无效数据不会返回业务层，一次修正的两次 Provider 调用均进入 attempts 和费用汇总。

建议提交信息：`feat: 支持 AI 结构化输出校验`

### Task 9: 对话模型服务与普通 JSON API

**Files:**
- Create: `apps/ai/schemas.py`
- Create: `apps/ai/api.py`
- Modify: `apps/ai/services.py`
- Modify: `config/api.py:1-90`
- Create: `tests/ai/test_api.py`

- [ ] **Step 1: 写对话租户隔离和普通消息生成的失败测试**

```python
# tests/ai/test_api.py
import json

import pytest
from model_bakery import baker

pytest_plugins = ["tests.ai.factories"]

from apps.ai.models import AIConversation, AIMessage
from tests.api_helpers import api_data


def set_session_org(client, org):
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": True})
    session.save()


@pytest.mark.django_db
def test_conversation_list_is_scoped_to_owner_and_selected_org(client):
    user = baker.make("accounts.User")
    other = baker.make("accounts.User")
    org = baker.make("organizations.Organization")
    other_org = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=True)
    baker.make(AIConversation, owner=user, organization=org, title="mine")
    baker.make(AIConversation, owner=user, organization=other_org, title="other org")
    baker.make(AIConversation, owner=other, organization=org, title="other user")
    client.force_login(user)
    set_session_org(client, org)
    response = client.get("/api/ai/conversations/", {"scope": "organization"})
    assert response.status_code == 200
    assert [item["title"] for item in api_data(response)["items"]] == ["mine"]


@pytest.mark.django_db
@pytest.mark.usefixtures("enabled_ai_chat_runtime")
def test_post_message_saves_user_and_assistant_once(client, org_owner):
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    conversation = baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization)
    response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/",
        data=json.dumps({"content": "帮我比较通勤与租金", "idempotency_key": "chat-1"}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert AIMessage.objects.filter(conversation=conversation, role="user").count() == 1
    assert AIMessage.objects.filter(conversation=conversation, role="assistant").count() == 1
```

- [ ] **Step 2: 运行测试并确认路由未挂载**

Run: `docker compose exec web pytest tests/ai/test_api.py -q`

Expected: FAIL，`/api/ai/conversations/` 返回 404。

- [ ] **Step 3: 定义受控对话 HTTP Schema**

```python
# apps/ai/schemas.py
from datetime import datetime
from typing import Literal

from ninja import Field, Schema


class ConversationCreateIn(Schema):
    scope: Literal["personal", "organization"] = "organization"


class ConversationOut(Schema):
    id: int
    organization_id: int | None
    capability: str
    title: str
    status: str
    last_message_at: datetime | None
    created_at: datetime


class MessageCreateIn(Schema):
    content: str = Field(..., min_length=1, max_length=20_000)
    idempotency_key: str = Field(..., min_length=1, max_length=128)


class MessageOut(Schema):
    id: int
    role: str
    content: str
    content_json: dict | list | None
    invocation_id: int | None
    created_at: datetime


class MessageGenerationOut(Schema):
    invocation_id: int
    message: MessageOut
```

- [ ] **Step 4: 在 services 内实现只供 `apps.ai.api` 使用的对话辅助函数**

实现以下模块私有函数，避免扩大跨应用公共表面：

```python
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.ai.models import AIConversation, AIInvocation, AIMessage


def _authorize_history(*, actor, organization) -> None:
    if not actor.is_authenticated:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is None:
        return
    if not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    if not actor.is_superuser and not has_permission(actor, organization, AIPermission.VIEW_OWN_HISTORY.value):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "没有查看 AI 对话历史的权限。")


def _conversation_queryset(*, actor, active_organization):
    _authorize_history(actor=actor, organization=active_organization)
    return AIConversation.objects.filter(owner=actor, organization=active_organization)


def _create_conversation(*, actor, organization):
    _authorize_call(actor=actor, organization=organization, capability=AICapability.CHAT, trusted_system=False)
    return AIConversation.objects.create(owner=actor, organization=organization, capability=AICapability.CHAT)


def _get_conversation(*, actor, active_organization, conversation_id):
    conversation = get_object_or_404(AIConversation.objects.filter(owner=actor), pk=conversation_id)
    if conversation.organization_id is not None and conversation.organization_id != getattr(active_organization, "pk", None):
        raise Http404
    _authorize_history(actor=actor, organization=conversation.organization)
    return conversation
```

普通消息生成流程必须是：短事务写 user message → 事务外调用 `generate()` → 短事务写 assistant message并更新 `last_message_at`。历史消息最多取 `settings.AI_MAX_CONVERSATION_MESSAGES` 条，保留当前 user message，超出时从最早普通消息开始裁剪。

```python
def _send_conversation_message(*, actor, active_organization, conversation_id: int, content: str, idempotency_key: str):
    conversation = _get_conversation(actor=actor, active_organization=active_organization, conversation_id=conversation_id)
    if conversation.status != "active":
        raise Http404
    with transaction.atomic():
        user_message, created = AIMessage.objects.get_or_create(
            conversation=conversation,
            client_message_key=idempotency_key,
            defaults={"role": "user", "content": content},
        )
        if created and not conversation.title:
            conversation.title = content.strip()[:60]
            conversation.last_message_at = user_message.created_at
            conversation.save(update_fields=["title", "last_message_at", "updated_at"])

    if not created:
        existing = AIInvocation.objects.filter(
            conversation=conversation,
            actor=actor,
            source_app="ai.conversation",
            idempotency_key=idempotency_key,
        ).first()
        replayed = _replay(existing) if existing is not None else None
        if replayed is not None:
            return replayed, existing.assistant_message
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同消息正在生成或上次生成失败。")

    history = list(conversation.messages.order_by("-created_at", "-pk")[: settings.AI_MAX_CONVERSATION_MESSAGES])
    history.reverse()
    result = generate(
        actor=actor,
        organization=conversation.organization,
        capability=AICapability.CHAT,
        prompt_key=settings.AI_CHAT_PROMPT_KEY,
        messages=tuple(AIChatMessage(message.role, message.content) for message in history),
        source_app="ai.conversation",
        target_type="conversation",
        target_id=str(conversation.pk),
        idempotency_key=idempotency_key,
        retention_policy=AIRetentionPolicy.CONVERSATION,
        conversation=conversation,
    )
    with transaction.atomic():
        assistant, _ = AIMessage.objects.get_or_create(
            invocation_id=result.invocation_id,
            defaults={
                "conversation": conversation,
                "role": "assistant",
                "content": result.text,
                "content_json": result.data,
                "token_count": result.usage.output_tokens,
            },
        )
        AIConversation.objects.filter(pk=conversation.pk).update(last_message_at=assistant.created_at)
    return result, assistant
```

- [ ] **Step 5: 实现 Ninja Router 并挂载 `/api/ai/`**

```python
# apps/ai/api.py
from typing import Literal

from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.ai.schemas import ConversationCreateIn, ConversationOut, MessageCreateIn, MessageGenerationOut, MessageOut
from apps.ai.services import _conversation_queryset, _create_conversation, _get_conversation, _send_conversation_message
from apps.ai.runtime.contracts import AIErrorCode, AIExecutionError
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
    conversation = _get_conversation(actor=request.user, active_organization=active_org, conversation_id=conversation_id)
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
```

在 `config/api.py` 导入 `from apps.ai.api import router as ai_router`，并增加：

```python
api.add_router("/ai/", ai_router)
```

- [ ] **Step 6: 运行 API、迁移和越权测试**

在 `tests/ai/test_api.py` 增加：

```python
@pytest.mark.django_db
def test_message_history_rejects_other_user_and_other_selected_org(client):
    user = baker.make("accounts.User")
    org = baker.make("organizations.Organization")
    other_org = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=True)
    own_other_org_conversation = baker.make(AIConversation, owner=user, organization=other_org)
    other_user_conversation = baker.make(AIConversation, organization=org)
    client.force_login(user)
    set_session_org(client, org)
    assert client.get(f"/api/ai/conversations/{own_other_org_conversation.pk}/messages/").status_code == 404
    assert client.get(f"/api/ai/conversations/{other_user_conversation.pk}/messages/").status_code == 404


@pytest.mark.django_db
def test_personal_scope_lists_only_personal_conversations(client):
    user = baker.make("accounts.User")
    org = baker.make("organizations.Organization")
    personal = baker.make(AIConversation, owner=user, organization=None, title="personal")
    baker.make(AIConversation, owner=user, organization=org, title="organization")
    client.force_login(user)
    response = client.get("/api/ai/conversations/", {"scope": "personal"})
    assert [item["id"] for item in api_data(response)["items"]] == [personal.pk]


@pytest.mark.django_db
def test_archived_conversation_cannot_receive_messages(client, org_owner):
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    conversation = baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization, status="archived")
    response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/",
        data=json.dumps({"content": "继续", "idempotency_key": "archived-1"}),
        content_type="application/json",
    )
    assert response.status_code == 404
```

Run: `docker compose exec web pytest tests/ai/test_api.py tests/ai/test_services.py -q`

Expected: PASS。

Run: `docker compose exec web python manage.py makemigrations --check --dry-run`

Expected: `No changes detected`。

建议提交信息：`feat: 提供受控 AI 对话接口`

### Task 10: SSE 流式执行与断开审计

**Files:**
- Modify: `apps/ai/runtime/contracts.py`
- Modify: `apps/ai/runtime/executor.py`
- Modify: `apps/ai/services.py`
- Modify: `apps/ai/api.py`
- Modify: `tests/ai/test_executor.py`
- Modify: `tests/ai/test_api.py`

- [ ] **Step 1: 写 SSE 事件顺序、首片段前降级和断开审计测试**

```python
@pytest.mark.django_db
@pytest.mark.usefixtures("enabled_ai_chat_runtime")
def test_stream_endpoint_emits_ordered_sse_events(client, org_owner):
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    conversation = baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization)
    response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/stream/",
        data=json.dumps({"content": "你好", "idempotency_key": "stream-1"}),
        content_type="application/json",
    )
    body = b"".join(response.streaming_content).decode()
    assert response["Content-Type"].startswith("text/event-stream")
    assert body.index("event: start") < body.index("event: delta") < body.index("event: usage") < body.index("event: done")
    assert response["X-Accel-Buffering"] == "no"
```

在 `tests/ai/test_executor.py` 增加：

```python
@pytest.mark.django_db
def test_stream_falls_back_before_first_delta(monkeypatch):
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    baker.make(
        "ai.AIPrompt",
        key="house.description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "生成描述"}],
        is_active=True,
    )
    make_route(10, "primary")
    make_route(20, "fallback")
    FakeProvider.stream_responses = [
        AIProviderError(AIErrorCode.TIMEOUT, "超时", retryable=True),
        [AIStreamChunk(event="delta", text="成功"), AIStreamChunk(event="done", finish_reason="stop")],
    ]
    state = StreamExecutionState()
    chunks = list(
        stream_execute(
            AIExecutionRequest(AICapability.TEXT_GENERATION, "house.description", execution_mode=AIExecutionMode.STREAM),
            AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
            state=state,
        )
    )
    assert [chunk.event for chunk in chunks] == ["start", "delta", "done"]
    assert state.trace.selected_candidate.model_name == "fallback"


@pytest.mark.django_db
def test_stream_never_falls_back_after_first_delta(monkeypatch):
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    baker.make(
        "ai.AIPrompt",
        key="house.description",
        version=1,
        capability=AICapability.TEXT_GENERATION,
        messages_template=[{"role": "system", "content": "生成描述"}],
        is_active=True,
    )
    make_route(10, "primary")
    make_route(20, "fallback")
    FakeProvider.stream_responses = [
        [AIStreamChunk(event="delta", text="部分"), AIProviderError(AIErrorCode.TIMEOUT, "超时", retryable=True)],
    ]
    state = StreamExecutionState()
    chunks = list(
        stream_execute(
            AIExecutionRequest(AICapability.TEXT_GENERATION, "house.description", execution_mode=AIExecutionMode.STREAM),
            AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
            state=state,
        )
    )
    assert [chunk.event for chunk in chunks] == ["start", "delta", "error"]
    assert state.error.code == AIErrorCode.STREAM_INTERRUPTED
    assert len(FakeProvider.requests) == 1
```

- [ ] **Step 2: 运行测试并确认流式路由未实现**

Run: `docker compose exec web pytest tests/ai/test_api.py tests/ai/test_executor.py -q`

Expected: FAIL，stream URL 返回 404 或 `stream()` 尚不存在。

- [ ] **Step 3: 扩展流事件契约并复用准备阶段**

把 `AIStreamChunk.event` 扩为 `Literal["start", "delta", "usage", "done", "error"]`，增加 `metadata: Mapping[str, Any] = field(default_factory=dict)`。

从 `execute()` 抽出 `_prepare_execution(request, context, trace, quota)`，统一完成 Prompt、输入上限、quota reserve、候选路由和 capability 校验。普通与流式执行都调用该函数，禁止在 SSE API 重新实现路由或 Provider 选择。

```python
from apps.ai.runtime.quota import QuotaReservation


@dataclass(frozen=True, slots=True)
class PreparedExecution:
    request: AIExecutionRequest
    prompt: PromptSnapshot
    candidates: tuple[AIModelCandidate, ...]
    reservation: QuotaReservation


def _prepare_execution(request, context, trace, quota) -> PreparedExecution:
    prompt = resolve_prompt(request.prompt_key, variables=dict(request.variables), version=request.prompt_version)
    trace.prompt = prompt
    if prompt.capability != request.capability:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 与请求能力不匹配。")
    all_messages = (*prompt.messages, *request.messages)
    if sum(len(item.content) for item in all_messages) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入内容超过平台上限。")
    reservation = quota.reserve(context, AIUsage())
    candidates = tuple(get_model_candidates(request.capability, mode=request.execution_mode, requires_json_schema=request.response_model is not None))
    if not candidates:
        quota.release(reservation)
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")
    return PreparedExecution(request, prompt, candidates, reservation)


def _provider_for_candidate(candidate):
    api_key = os.environ.get(candidate.api_key_env, "")
    if not api_key:
        raise AIProviderError(AIErrorCode.PROVIDER_AUTH_ERROR, "AI 供应商密钥未配置。", retryable=True)
    provider_settings = AIProviderSettings(
        candidate.provider_code,
        candidate.base_url,
        api_key,
        min(candidate.timeout_seconds, settings.AI_STREAM_TIMEOUT_SECONDS),
        candidate.provider_extra,
    )
    return build_provider(candidate.adapter, provider_settings)


def _provider_request(prepared, candidate):
    parameters = _parameters(prepared.prompt, candidate)
    messages = _fit_messages(prepared.prompt.messages, prepared.request.messages, candidate, parameters["max_tokens"])
    if messages is None:
        raise AIProviderError(AIErrorCode.INVALID_REQUEST, "AI 输入超过候选模型上下文窗口。", retryable=True)
    return AIProviderRequest(
        model_name=candidate.model_name,
        messages=messages,
        parameters=parameters,
        response_schema=prepared.request.response_model.model_json_schema() if prepared.request.response_model else None,
        response_schema_name=prepared.request.response_model.__name__ if prepared.request.response_model else None,
    )
```

`execute()` 改用 `PreparedExecution` 和这两个 Provider 辅助函数，保留 Task 7/8 的普通与结构化行为。

定义流状态：

```python
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
```

- [ ] **Step 4: 实现 `stream_execute()` 的降级边界和 finally 生命周期**

```python
def stream_execute(request, context, *, state: StreamExecutionState, quota: QuotaPolicy = quota_policy):
    prepared = _prepare_execution(request, context, state.trace, quota)
    reservation = prepared.reservation
    stream_started = monotonic()
    settled = False
    try:
        for sequence, candidate in enumerate(prepared.candidates, start=1):
            try:
                provider = _provider_for_candidate(candidate)
                source = provider.stream(_provider_request(prepared, candidate))
                announced = False
                for chunk in source:
                    if monotonic() - stream_started > settings.AI_STREAM_TIMEOUT_SECONDS:
                        raise AIProviderError(AIErrorCode.TIMEOUT, "AI 流式请求超时。", retryable=not state.emitted_content)
                    if not announced:
                        announced = True
                        state.trace.selected_candidate = candidate
                        yield AIStreamChunk(event="start", metadata={"provider": candidate.provider_code, "model": candidate.display_name})
                    if chunk.event == "delta":
                        if state.first_token_ms is None:
                            state.first_token_ms = int((monotonic() - stream_started) * 1000)
                        state.emitted_content = True
                        state.text_parts.append(chunk.text)
                    elif chunk.event == "usage" and chunk.usage is not None:
                        state.usage = chunk.usage
                    elif chunk.event == "done":
                        state.finish_reason = chunk.finish_reason
                        continue
                    yield chunk
                cost = _estimated_cost(candidate, state.usage)
                state.trace.attempts.append(
                    {
                        "sequence": sequence,
                        "provider": candidate.provider_code,
                        "model": candidate.model_name,
                        "status": "succeeded",
                        "input_tokens": state.usage.input_tokens,
                        "output_tokens": state.usage.output_tokens,
                        "total_tokens": state.usage.total_tokens,
                        "usage_status": state.usage.source,
                        "estimated_cost": str(cost) if cost is not None else None,
                        "input_price_per_million": str(candidate.input_price_per_million) if candidate.input_price_per_million is not None else None,
                        "output_price_per_million": str(candidate.output_price_per_million) if candidate.output_price_per_million is not None else None,
                        "currency": candidate.currency,
                    }
                )
                state.provider_request_id = getattr(provider, "last_request_id", "")
                quota.settle(reservation, _aggregate_attempt_usage(state.trace.attempts))
                settled = True
                state.completed = True
                yield AIStreamChunk(event="done", finish_reason=state.finish_reason)
                return
            except AIProviderError as error:
                state.trace.attempts.append(
                    {
                        "sequence": sequence,
                        "provider": candidate.provider_code,
                        "model": candidate.model_name,
                        "status": "failed",
                        "error_type": error.code.value,
                        "provider_request_id": error.provider_request_id,
                    }
                )
                if error.retryable and not state.emitted_content:
                    continue
                state.error = (
                    AIExecutionError(AIErrorCode.STREAM_INTERRUPTED, "AI 流式输出已中断。")
                    if state.emitted_content
                    else error
                )
                yield AIStreamChunk(event="error", error_code=state.error.code.value, error_message=state.error.safe_message)
                return
        state.error = AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "当前没有可用的 AI 模型。")
        yield AIStreamChunk(event="error", error_code=state.error.code.value, error_message=state.error.safe_message)
    finally:
        if not settled:
            quota.release(reservation)
```

超时在尚未输出内容时允许切换候选；已有内容时统一产生 `stream_interrupted`，不得把供应商异常文本发给客户端。

- [ ] **Step 5: 实现公共 `stream()` 句柄和完成/断开落库**

```python
@dataclass(frozen=True, slots=True)
class AIStreamHandle:
    invocation_id: int
    chunks: Iterator[AIStreamChunk]


def stream(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    variables: dict[str, Any] | None = None,
    messages=(),
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    conversation=None,
    trusted_system: bool = False,
) -> AIStreamHandle:
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    if idempotency_key and AIInvocation.objects.filter(organization=organization, actor=actor, source_app=source_app, idempotency_key=idempotency_key).exists():
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同幂等键的流式调用已存在。")

    now = timezone.now()
    retention = decide_retention(retention_policy, now=now, temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    input_payload = _json_safe(
        {
            "variables": variables or {},
            "messages": [{"role": item.role, "content": item.content} for item in messages],
        }
    )
    if len(json.dumps(input_payload, ensure_ascii=False)) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 输入载荷超过平台上限。")
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
        started_at=now,
    )
    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        variables=variables or {},
        messages=tuple(messages),
        execution_mode=AIExecutionMode.STREAM,
    )
    context = AIExecutionContext(
        actor_id=getattr(actor, "pk", None),
        organization_id=getattr(organization, "pk", None),
        source_app=source_app,
        target_type=target_type,
        target_id=target_id,
        idempotency_key=idempotency_key,
        retention_policy=retention_policy,
        safe_summary=safe_summary or {},
    )
    state = StreamExecutionState()

    def persisted_chunks():
        try:
            yield from stream_execute(request, context, state=state)
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
```

`_finalize_stream_invocation()` 使用以下状态规则：

```python
def _finalize_stream_invocation(invocation, state, retention, original_input_payload):
    text = "".join(state.text_parts)
    candidate = state.trace.selected_candidate
    if state.completed:
        status = AIInvocationStatus.SUCCEEDED.value
    elif state.emitted_content:
        status = AIInvocationStatus.INTERRUPTED.value
    else:
        status = AIInvocationStatus.FAILED.value
    output_payload = {"text": text, "data": None} if retention.persist_output and state.completed else {}
    finished_at = timezone.now()
    aggregate_usage = _aggregate_attempt_usage(state.trace.attempts)
    aggregate_cost, aggregate_currency = _aggregate_attempt_cost(state.trace.attempts)
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
        duration_ms=int((finished_at - invocation.started_at).total_seconds() * 1000),
    )
    if state.completed and invocation.conversation_id:
        message, _ = AIMessage.objects.get_or_create(
            invocation=invocation,
            defaults={
                "conversation_id": invocation.conversation_id,
                "role": "assistant",
                "content": text,
                "token_count": aggregate_usage.output_tokens,
            },
        )
        AIConversation.objects.filter(pk=invocation.conversation_id).update(last_message_at=message.created_at)
```

客户端断开或输出后异常时保存 `interrupted`。不得逐 chunk 写数据库，也不得把网络流放在事务内。

对话 SSE 使用独立的内部包装函数写入 user message，再调用公共 `stream()`；assistant message 由上述 finalizer 在完成时一次写入：

```python
def _stream_conversation_message(*, actor, active_organization, conversation_id: int, content: str, idempotency_key: str):
    conversation = _get_conversation(actor=actor, active_organization=active_organization, conversation_id=conversation_id)
    if conversation.status != "active":
        raise Http404
    with transaction.atomic():
        user_message, created = AIMessage.objects.get_or_create(
            conversation=conversation,
            client_message_key=idempotency_key,
            defaults={"role": "user", "content": content},
        )
        if not created:
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "相同消息的流式生成已存在。")
        if not conversation.title:
            conversation.title = content.strip()[:60]
        conversation.last_message_at = user_message.created_at
        conversation.save(update_fields=["title", "last_message_at", "updated_at"])

    history = list(conversation.messages.order_by("-created_at", "-pk")[: settings.AI_MAX_CONVERSATION_MESSAGES])
    history.reverse()
    return stream(
        actor=actor,
        organization=conversation.organization,
        capability=AICapability.CHAT,
        prompt_key=settings.AI_CHAT_PROMPT_KEY,
        messages=tuple(AIChatMessage(message.role, message.content) for message in history),
        source_app="ai.conversation",
        target_type="conversation",
        target_id=str(conversation.pk),
        idempotency_key=idempotency_key,
        retention_policy=AIRetentionPolicy.CONVERSATION,
        conversation=conversation,
    )
```

- [ ] **Step 6: 增加 SSE 格式化和 POST 路由**

```python
import json
from dataclasses import asdict

from django.http import StreamingHttpResponse


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
```

- [ ] **Step 7: 运行流式测试**

Run: `docker compose exec web pytest tests/ai/test_executor.py tests/ai/test_api.py -q`

Expected: PASS；事件顺序固定，首片段后不拼接备用模型，断开后 invocation 为 interrupted。

建议提交信息：`feat: 支持 AI SSE 流式响应`

### Task 11: Celery 异步调用、任务查询与正文清理

**Files:**
- Create: `apps/ai/tasks.py`
- Modify: `apps/ai/services.py`
- Modify: `config/settings/_base.py:316-345`
- Create: `tests/ai/test_tasks.py`

- [ ] **Step 1: 写仅传 invocation ID、原子领取和过期清理的失败测试**

```python
# tests/ai/test_tasks.py
from datetime import timedelta

from django.utils import timezone

import pytest
from model_bakery import baker

from apps.ai.models import AIInvocation
from apps.ai.tasks import execute_ai_invocation, purge_expired_ai_payloads


@pytest.mark.django_db
def test_worker_claims_queued_invocation_only_once(monkeypatch):
    invocation = baker.make(AIInvocation, status="queued", input_payload={"request": {"prompt_key": "house.description"}})
    calls = []
    monkeypatch.setattr("apps.ai.services._execute_queued_invocation", lambda item: calls.append(item.pk))
    assert execute_ai_invocation(invocation.pk) is True
    assert execute_ai_invocation(invocation.pk) is False
    assert calls == [invocation.pk]


@pytest.mark.django_db
def test_purge_clears_only_expired_payloads_and_keeps_audit_metadata():
    expired = baker.make(
        AIInvocation,
        input_payload={"secret": "input"},
        output_payload={"text": "output"},
        content_expires_at=timezone.now() - timedelta(minutes=1),
        prompt_hash="abc",
    )
    active = baker.make(
        AIInvocation,
        input_payload={"keep": True},
        output_payload={"keep": True},
        content_expires_at=timezone.now() + timedelta(hours=1),
    )
    assert purge_expired_ai_payloads() == 1
    expired.refresh_from_db()
    active.refresh_from_db()
    assert expired.input_payload == {}
    assert expired.output_payload == {}
    assert expired.prompt_hash == "abc"
    assert active.input_payload == {"keep": True}
```

- [ ] **Step 2: 写 `enqueue()` 与 `get_job()` 的权限和结果期限测试**

在 `tests/ai/test_services.py` 增加：

```python
@pytest.mark.django_db
@override_settings(AI_ENABLED=True)
def test_enqueue_stores_short_lived_payload_and_dispatches_only_id(monkeypatch, ai_runtime, org_owner):
    dispatched = []
    monkeypatch.setattr("apps.ai.tasks.execute_ai_invocation.delay", lambda invocation_id: dispatched.append(invocation_id))
    job = enqueue(
        actor=org_owner.user,
        organization=org_owner.organization,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.description",
        variables={"title": "测试房源"},
        source_app="house",
        retention_policy=AIRetentionPolicy.TEMPORARY,
    )
    invocation = AIInvocation.objects.get(pk=job.invocation_id)
    assert dispatched == [invocation.pk]
    assert invocation.status == "queued"
    assert invocation.input_payload["request"]["prompt_key"] == "house.description"
    assert invocation.content_expires_at is not None
```

```python
@pytest.mark.django_db
def test_get_job_does_not_cross_user_org_or_source_boundaries(org_owner):
    invocation = baker.make(
        AIInvocation,
        actor=org_owner.user,
        organization=org_owner.organization,
        source_app="house",
        status="succeeded",
    )
    other_user = baker.make("accounts.User")
    other_org = baker.make("organizations.Organization")
    denied_queries = [
        {"actor": other_user, "organization": org_owner.organization, "source_app": "house"},
        {"actor": org_owner.user, "organization": other_org, "source_app": "house"},
        {"actor": org_owner.user, "organization": org_owner.organization, "source_app": "analytics"},
    ]
    for query in denied_queries:
        with pytest.raises(AIExecutionError) as exc_info:
            get_job(invocation_id=invocation.pk, **query)
        assert exc_info.value.code == AIErrorCode.PERMISSION_DENIED


@pytest.mark.django_db
@override_settings(AI_ENABLED=True)
def test_queryable_async_job_rejects_metadata_only(ai_runtime, org_owner):
    ai_runtime(response=AIExecutionResult("完成"))
    with pytest.raises(AIExecutionError) as exc_info:
        enqueue(
            actor=org_owner.user,
            organization=org_owner.organization,
            capability=AICapability.TEXT_GENERATION,
            prompt_key="house.description",
            source_app="house",
            retention_policy=AIRetentionPolicy.METADATA_ONLY,
        )
    assert exc_info.value.code == AIErrorCode.INVALID_REQUEST
```

- [ ] **Step 3: 运行测试并确认异步入口尚不存在**

Run: `docker compose exec web pytest tests/ai/test_tasks.py tests/ai/test_services.py -q`

Expected: FAIL，错误指向 `enqueue`、`get_job` 或任务函数缺失。

- [ ] **Step 4: 提取“执行已有 invocation”内部函数并实现异步序列化**

`generate()` 和 Worker 共享 `_execute_existing_invocation(invocation, request, context)`；该函数调用 Executor 并使用 Task 7 的成功/失败落库辅助函数，不创建第二条 invocation。

序列化只允许 JSON 安全数据：

```python
def _response_model_path(response_model) -> str:
    if response_model is None:
        return ""
    if "<locals>" in response_model.__qualname__ or "." in response_model.__qualname__:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "异步结构化 Schema 必须定义在可导入的模块顶层。")
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
```

Worker 使用 `django.utils.module_loading.import_string()` 恢复顶层 Pydantic 模型，随后构造 `AIExecutionRequest(execution_mode=AIExecutionMode.ASYNC)`。

实现已有调用记录的执行函数；成功和失败字段与同步路径一致，不创建第二条 invocation：

```python
def _execute_queued_invocation(invocation: AIInvocation) -> None:
    if not settings.AI_ENABLED:
        AIInvocation.objects.filter(pk=invocation.pk).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=AIErrorCode.CAPABILITY_UNAVAILABLE.value,
            error_code=AIErrorCode.CAPABILITY_UNAVAILABLE.value,
            error_summary="AI 功能当前未启用。",
            finished_at=timezone.now(),
        )
        return
    payload = invocation.input_payload.get("request") or {}
    model_path = payload.get("response_model_path", "")
    response_model = import_string(model_path) if model_path else None
    capability = AICapability(payload["capability"])
    _authorize_call(
        actor=invocation.actor,
        organization=invocation.organization,
        capability=capability,
        trusted_system=invocation.actor_id is None,
    )
    request = AIExecutionRequest(
        capability=capability,
        prompt_key=payload["prompt_key"],
        prompt_version=payload.get("prompt_version"),
        variables=payload.get("variables", {}),
        messages=tuple(AIChatMessage(item["role"], item["content"]) for item in payload.get("messages", [])),
        response_model=response_model,
        execution_mode=AIExecutionMode.ASYNC,
    )
    context = AIExecutionContext(
        actor_id=invocation.actor_id,
        organization_id=invocation.organization_id,
        source_app=invocation.source_app,
        target_type=invocation.target_type,
        target_id=invocation.target_id,
        idempotency_key=invocation.idempotency_key,
        retention_policy=AIRetentionPolicy(invocation.retention_policy),
        safe_summary=invocation.safe_summary,
    )
    trace = ExecutionTrace()
    try:
        result = execute(request, context, trace=trace)
    except AIExecutionError as error:
        AIInvocation.objects.filter(pk=invocation.pk).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=error.code.value,
            error_code=error.code.value,
            error_summary=error.safe_message[:500],
            attempts=trace.attempts,
            finished_at=timezone.now(),
        )
        raise

    candidate = trace.selected_candidate
    finished_at = timezone.now()
    output_payload = {"text": result.text, "data": result.structured_data}
    aggregate_usage = _aggregate_attempt_usage(trace.attempts)
    aggregate_cost, aggregate_currency = _aggregate_attempt_cost(trace.attempts)
    AIInvocation.objects.filter(pk=invocation.pk).update(
        status=AIInvocationStatus.SUCCEEDED.value,
        prompt_key=trace.prompt.key,
        prompt_version=trace.prompt.version,
        prompt_hash=trace.prompt.template_hash,
        provider_code=candidate.provider_code,
        model_name=candidate.model_name,
        input_tokens=aggregate_usage.input_tokens,
        output_tokens=aggregate_usage.output_tokens,
        total_tokens=aggregate_usage.total_tokens,
        usage_status=aggregate_usage.source,
        input_price_snapshot=candidate.input_price_per_million,
        output_price_snapshot=candidate.output_price_per_million,
        estimated_cost=aggregate_cost,
        currency=aggregate_currency,
        provider_request_id=result.provider_request_id,
        attempts=trace.attempts,
        output_payload=output_payload,
        content_hash=_content_hash(invocation.input_payload, output_payload),
        finished_at=finished_at,
        duration_ms=int((finished_at - invocation.started_at).total_seconds() * 1000),
    )
```

- [ ] **Step 5: 实现 `enqueue()` 和 `get_job()`**

```python
@dataclass(frozen=True, slots=True)
class AIJob:
    invocation_id: int
    status: str
    text: str | None
    data: dict[str, Any] | None
    error_code: str
    error_message: str


def enqueue(
    *,
    actor,
    organization,
    capability: AICapability,
    prompt_key: str,
    variables: dict[str, Any] | None = None,
    messages=(),
    response_model: type[BaseModel] | None = None,
    source_app: str,
    target_type: str = "",
    target_id: str = "",
    idempotency_key: str = "",
    retention_policy: AIRetentionPolicy = AIRetentionPolicy.TEMPORARY,
    safe_summary: dict[str, Any] | None = None,
    trusted_system: bool = False,
) -> AIJob:
    _authorize_call(actor=actor, organization=organization, capability=capability, trusted_system=trusted_system)
    if retention_policy == AIRetentionPolicy.METADATA_ONLY:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "可查询的异步任务必须短期保留结果。")
    if idempotency_key:
        existing = AIInvocation.objects.filter(organization=organization, actor=actor, source_app=source_app, idempotency_key=idempotency_key).first()
        if existing is not None:
            return AIJob(existing.pk, existing.status, existing.output_payload.get("text"), existing.output_payload.get("data"), existing.error_code, existing.error_summary)
    request = AIExecutionRequest(
        capability=capability,
        prompt_key=prompt_key,
        variables=variables or {},
        messages=tuple(messages),
        response_model=response_model,
        execution_mode=AIExecutionMode.ASYNC,
    )
    retention = decide_retention(retention_policy, now=timezone.now(), temporary_hours=settings.AI_TEMPORARY_RETENTION_HOURS)
    request_payload = _json_safe({"request": _serialize_async_request(request)})
    if len(json.dumps(request_payload, ensure_ascii=False)) > settings.AI_MAX_INPUT_CHARS:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "AI 异步输入载荷超过平台上限。")
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
        input_payload=request_payload,
        content_expires_at=retention.expires_at,
        safe_summary=sanitize_safe_summary(safe_summary),
        content_hash=_content_hash(request_payload, {}),
    )
    from apps.ai.tasks import execute_ai_invocation

    transaction.on_commit(lambda: execute_ai_invocation.delay(invocation.pk))
    return AIJob(invocation.pk, invocation.status, None, None, "", "")


def get_job(*, actor, organization, invocation_id: int, source_app: str) -> AIJob:
    if not getattr(actor, "is_authenticated", False):
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "请先登录。")
    if organization is not None and not OrganizationMember.objects.filter(organization=organization, user=actor).exists():
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "你已不属于当前组织。")
    invocation = AIInvocation.objects.defer("input_payload").filter(actor=actor, organization=organization, source_app=source_app, pk=invocation_id).first()
    if invocation is None:
        raise AIExecutionError(AIErrorCode.PERMISSION_DENIED, "无权查看该 AI 任务。")
    payload = invocation.output_payload or {}
    return AIJob(
        invocation_id=invocation.pk,
        status=invocation.status,
        text=payload.get("text"),
        data=payload.get("data"),
        error_code=invocation.error_code,
        error_message=invocation.error_summary,
    )
```

`enqueue()` 不接受供应商、模型、Base URL、API Key、temperature 或 max_tokens 等客户端覆盖参数。

- [ ] **Step 6: 实现无透明重试的 Celery 任务**

```python
# apps/ai/tasks.py
from django.db.models import Q
from django.utils import timezone

from celery import shared_task

from apps.ai.models import AIInvocation
from apps.ai.runtime.contracts import AIExecutionError, AIInvocationStatus


@shared_task
def execute_ai_invocation(invocation_id: int) -> bool:
    claimed = AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.QUEUED.value).update(
        status=AIInvocationStatus.RUNNING.value,
        started_at=timezone.now(),
    )
    if claimed != 1:
        return False
    invocation = AIInvocation.objects.get(pk=invocation_id)
    from apps.ai.services import _execute_queued_invocation

    try:
        _execute_queued_invocation(invocation)
    except AIExecutionError as error:
        AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.RUNNING.value).update(
            status=AIInvocationStatus.FAILED.value,
            error_type=error.code.value,
            error_code=error.code.value,
            error_summary=error.safe_message[:500],
            finished_at=timezone.now(),
        )
        raise
    except Exception as unexpected:
        AIInvocation.objects.filter(pk=invocation_id, status=AIInvocationStatus.RUNNING.value).update(
            status=AIInvocationStatus.FAILED.value,
            error_type="internal_error",
            error_code="internal_error",
            error_summary="AI 异步任务发生内部错误。",
            finished_at=timezone.now(),
        )
        raise RuntimeError("AI 异步任务执行失败。") from unexpected
    return True


def purge_expired_ai_payloads() -> int:
    queryset = AIInvocation.objects.filter(
        Q(content_expires_at__isnull=False),
        content_expires_at__lte=timezone.now(),
    ).exclude(input_payload={}, output_payload={})
    updated = queryset.update(input_payload={}, output_payload={})
    return updated


@shared_task
def purge_expired_ai_payloads_task() -> int:
    return purge_expired_ai_payloads()
```

不要给 `execute_ai_invocation` 配置 Celery `autoretry_for`；模型重试和备用模型切换只有 Executor 一个所有者。

- [ ] **Step 7: 注册每日正文清理计划**

在 `CELERY_BEAT_SCHEDULE` 增加：

```python
"purge-expired-ai-payloads": {
    "task": "apps.ai.tasks.purge_expired_ai_payloads_task",
    "schedule": crontab(hour=3, minute=30),
},
```

- [ ] **Step 8: 运行异步、清理和服务测试**

Run: `docker compose exec web pytest tests/ai/test_tasks.py tests/ai/test_services.py -q`

Expected: PASS；Worker 第二次领取返回 False，Celery 参数只有整数 invocation ID，过期正文清空但审计字段保留。

建议提交信息：`feat: 支持 AI 异步任务与正文清理`

### Task 12: Django Admin 管理与只读审计

**Files:**
- Create: `apps/ai/admin.py`
- Modify: `tests/ai/test_models.py`

- [ ] **Step 1: 写 Provider 密钥状态和审计 QuerySet 延迟正文测试**

```python
import os

from django.contrib.admin.sites import AdminSite
from django.test import RequestFactory

from apps.ai.admin import AIInvocationAdmin, AIProviderConfigAdmin
from apps.ai.models import AIInvocation, AIProviderConfig


def test_provider_admin_only_reports_if_env_exists(monkeypatch):
    provider = AIProviderConfig(api_key_env="OPENAI_API_KEY")
    admin = AIProviderConfigAdmin(AIProviderConfig, AdminSite())
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert admin.key_configured(provider) is False
    monkeypatch.setenv("OPENAI_API_KEY", "secret")
    assert admin.key_configured(provider) is True


@pytest.mark.django_db
def test_invocation_admin_defers_large_payload_fields(rf):
    request = rf.get("/admin/ai/aiinvocation/")
    request.user = baker.make("accounts.User", is_staff=True, is_superuser=True)
    queryset = AIInvocationAdmin(AIInvocation, AdminSite()).get_queryset(request)
    assert {"input_payload", "output_payload"}.issubset(queryset.query.deferred_loading[0])
```

- [ ] **Step 2: 运行测试并确认 Admin 尚未注册**

Run: `docker compose exec web pytest tests/ai/test_models.py -q`

Expected: FAIL，错误指向 `apps.ai.admin` 或 Admin 类缺失。

- [ ] **Step 3: 注册平台配置 Admin**

```python
# apps/ai/admin.py（平台配置部分）
import os

from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone

from apps.ai.models import AIInvocation, AIModel, AIModelRoute, AIPrompt, AIProviderConfig


class SuperuserConfigAdmin(admin.ModelAdmin):
    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(SuperuserConfigAdmin):
    list_display = ("code", "name", "adapter", "enabled", "key_configured", "timeout_seconds")
    search_fields = ("code", "name")
    list_filter = ("enabled", "adapter")

    @admin.display(boolean=True, description="密钥已配置")
    def key_configured(self, obj):
        return bool(os.environ.get(obj.api_key_env))


@admin.register(AIModel)
class AIModelAdmin(SuperuserConfigAdmin):
    list_display = ("display_name", "provider", "model_name", "enabled", "supports_streaming", "supports_json_schema")
    list_filter = ("enabled", "supports_streaming", "supports_json_schema", "provider")
    search_fields = ("display_name", "model_name")


@admin.register(AIModelRoute)
class AIModelRouteAdmin(SuperuserConfigAdmin):
    list_display = ("capability", "model", "priority", "enabled")
    list_filter = ("capability", "enabled")
    ordering = ("capability", "priority")


@admin.register(AIPrompt)
class AIPromptAdmin(SuperuserConfigAdmin):
    list_display = ("key", "version", "name", "capability", "is_active", "template_hash")
    list_filter = ("capability", "is_active")
    search_fields = ("key", "name")
    readonly_fields = ("template_hash", "is_active")
    actions = ("activate_prompt",)

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user.get_username()
        if not change:
            obj.created_by = request.user.get_username()
        super().save_model(request, obj, form, change)

    @admin.action(description="启用选中的 Prompt 版本")
    def activate_prompt(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "每次只能启用一个 Prompt 版本。", level=messages.ERROR)
            return
        with transaction.atomic():
            prompt = AIPrompt.objects.select_for_update().get(pk=queryset.values_list("pk", flat=True).get())
            has_route = AIModelRoute.objects.filter(
                capability=prompt.capability,
                enabled=True,
                model__enabled=True,
                model__provider__enabled=True,
            ).exists()
            if not has_route:
                self.message_user(request, "该 capability 尚无可用模型路由，不能启用 Prompt。", level=messages.ERROR)
                return
            now = timezone.now()
            AIPrompt.objects.filter(key=prompt.key, is_active=True).exclude(pk=prompt.pk).update(is_active=False, updated_at=now)
            AIPrompt.objects.filter(pk=prompt.pk).update(is_active=True, updated_by=request.user.get_username(), updated_at=now)

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and AIInvocation.objects.filter(prompt_key=obj.key, prompt_version=obj.version).exists():
            fields.extend(["key", "version", "capability", "messages_template", "required_variables", "default_parameters"])
        return tuple(fields)
```

- [ ] **Step 4: 注册只读审计 Admin 并延迟大字段**

```python
from apps.ai.models import AIConversation, AIInvocation, AIMessage


class ReadOnlyAuditAdmin(SuperuserConfigAdmin):
    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)


@admin.register(AIInvocation)
class AIInvocationAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "created_at", "organization", "actor", "capability", "status", "provider_code", "model_name", "total_tokens", "estimated_cost", "duration_ms")
    list_filter = ("status", "capability", "provider_code", "execution_mode", "retention_policy")
    search_fields = ("idempotency_key", "target_id", "provider_request_id")
    exclude = ("input_payload", "output_payload")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("organization", "actor").defer("input_payload", "output_payload")


@admin.register(AIConversation)
class AIConversationAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "owner", "organization", "status", "last_message_at", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "owner__username")


@admin.register(AIMessage)
class AIMessageAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "conversation", "role", "invocation", "created_at")
    list_filter = ("role",)
    search_fields = ("conversation__title",)
    exclude = ("content", "content_json")
```

正文详情字段默认折叠且只允许 superuser 查看；列表页永不加载 `input_payload`、`output_payload` 或完整消息正文。

- [ ] **Step 5: 运行 Admin 与模型测试**

Run: `docker compose exec web pytest tests/ai/test_models.py -q`

Expected: PASS。

建议提交信息：`feat: 增加 AI 平台配置与审计后台`

### Task 13: 架构护栏、全量验证与接入示例

**Files:**
- Create: `tests/ai/test_architecture.py`
- Modify: `docs/superpowers/specs/2026-09-09-ai-foundation-design.md`

- [ ] **Step 1: 增加禁止跨应用直接依赖 SDK/runtime/models 的架构测试**

```python
# tests/ai/test_architecture.py
import ast
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_business_apps_do_not_import_ai_runtime_models_or_openai_sdk():
    violations = []
    for path in (PROJECT_ROOT / "apps").glob("*/**/*.py"):
        if "apps/ai/" in path.as_posix() or "/migrations/" in path.as_posix():
            continue
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                names = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                names = [node.module or ""]
            else:
                continue
            if any(name == "openai" or name.startswith("apps.ai.runtime") or name.startswith("apps.ai.models") for name in names):
                violations.append(str(path.relative_to(PROJECT_ROOT)))
    assert violations == []
```

- [ ] **Step 2: 在设计文档补充业务接入的固定路线**

在设计文档“业务接入”部分加入可复制示例：

```python
# apps/house/services.py
from pydantic import BaseModel, Field

from apps.ai.services import AICapability, AIRetentionPolicy, generate


class HouseDescriptionDraft(BaseModel):
    title: str = Field(max_length=60)
    description: str = Field(max_length=800)


def build_house_description_draft(*, actor, organization, house_id: int, house_payload: dict) -> HouseDescriptionDraft:
    """调用前由 house 模块完成房源归属、读取权限和可发送字段白名单校验。"""
    result = generate(
        actor=actor,
        organization=organization,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.public_description",
        variables={"house": house_payload},
        response_model=HouseDescriptionDraft,
        source_app="house",
        target_type="house",
        target_id=str(house_id),
        retention_policy=AIRetentionPolicy.METADATA_ONLY,
        safe_summary={"house_id": house_id},
    )
    return HouseDescriptionDraft.model_validate(result.data)
```

同时明确：这个示例只说明调用路径，不在本计划创建真实房源接口；第一个租房消费者应单独立项，并由 house 服务决定 `house_payload` 的字段白名单。

- [ ] **Step 3: 运行 AI 目标测试**

Run: `docker compose exec web pytest tests/ai -q`

Expected: PASS。

- [ ] **Step 4: 运行相关回归、Lint 和类型检查**

Run: `docker compose exec web pytest tests/access tests/settings -q`

Expected: PASS。

Run: `docker compose exec web ruff check apps/ai tests/ai apps/access/constants.py config/api.py config/settings/_base.py`

Expected: PASS，无 lint 错误。

Run: `docker compose exec web ty check apps/ai`

Expected: PASS，或仅出现项目当前已全局忽略的 Django 动态类型提示。

Run: `docker compose exec web python manage.py check`

Expected: `System check identified no issues`。

Run: `docker compose exec web python manage.py makemigrations --check --dry-run`

Expected: `No changes detected`。

Run: `rg -n "worker_class|threads|timeout" gunicorn.conf.py`

Expected: 保持 `worker_class = "gthread"`、线程数至少为 2，Gunicorn timeout 不小于 `AI_STREAM_TIMEOUT_SECONDS`；当前配置满足首期 SSE，不迁移 ASGI。

- [ ] **Step 5: 人工验收三家兼容供应商配置**

在 Django Admin 分别创建 OpenAI、阿里云百炼、火山方舟的 `AIProviderConfig`，只填写各自 Base URL 和密钥环境变量名；给每家创建模型和相同 capability 路由。验证关闭主路由或让主路由返回可重试错误后，业务调用代码不变且会转向下一候选；Admin 和日志中不出现密钥值或原始正文。

- [ ] **Step 6: 验收普通、结构化、SSE、异步和紧急开关**

逐项确认：

- 普通生成返回 JSON envelope 内的业务结果，invocation 有模型、Token、费用和耗时。
- 结构化输出经过 Pydantic 校验；两次无效时返回统一错误。
- SSE 顺序为 start → delta → usage → done，客户端断开后状态为 interrupted。
- 异步 Worker 只收到 invocation ID，重复领取不会重复调用模型。
- temporary 到期只清正文，metadata_only 从不落原文，conversation 正文只在 AIMessage。
- `AI_ENABLED=False` 时不创建新的供应商请求，现有非 AI API 正常。
- 组织关闭某 capability 后，即使路由存在也不能调用。
- 非 superuser 不能在 Django Admin 查看或修改供应商、模型、Prompt 和原始审计正文。

建议提交信息：`test: 完善 AI 底座架构与验收护栏`

## 实施完成定义

- `apps.ai.services` 的四个跨应用入口签名稳定，其他业务应用没有 Provider、SDK、AI ORM 或 runtime 依赖。
- OpenAI、百炼和方舟只通过配置切换，不修改业务调用代码。
- 普通、结构化、流式和异步模式共享 Prompt、Router、Quota、Provider、Retention 和审计逻辑。
- Prompt 启用版本唯一；已调用版本的内容不可变；invocation 永久保存 key/version/hash 快照。
- 调用审计可区分供应商未报告 Token 与真实零用量，attempts 汇总所有实际请求的费用。
- 租户、用户、对话和任务查询无越权；AI 关闭或供应商故障不影响非 AI 租房业务。
