from types import SimpleNamespace

import pytest
from model_bakery import baker
from pydantic import BaseModel

from apps.ai.runtime import providers
from apps.ai.runtime.contracts import (
    AICapability,
    AIChatMessage,
    AIErrorCode,
    AIExecutionContext,
    AIExecutionRequest,
    AIExecutionResult,
    AIProviderError,
    AIProviderRequest,
    AIProviderSettings,
    AIRetentionPolicy,
    AIStructuredOutputMode,
    AIUsage,
)
from apps.ai.runtime.executor import ExecutionTrace, execute
from apps.ai.runtime.providers import get_provider_api_key
from apps.ai.runtime.providers.openai_compatible import OpenAICompatibleProvider
from apps.ai.runtime.quota import UnlimitedQuotaPolicy
from apps.ai.runtime.retention import decide_retention, sanitize_safe_summary
from apps.ai.runtime.router import get_model_candidates
from tests.ai.factories import FakeProvider


class HouseExtract(BaseModel):
    monthly_rent: int
    bedrooms: int


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
    assert result.text == "完成"
    assert result.usage.total_tokens == 13


def test_openai_compatible_provider_maps_json_object_response_format():
    request = AIProviderRequest(
        "demo",
        [AIChatMessage("user", "提取 JSON")],
        {},
        response_schema={"type": "object"},
        structured_output_mode=AIStructuredOutputMode.JSON_OBJECT,
    )
    assert OpenAICompatibleProvider._kwargs(request)["response_format"] == {"type": "json_object"}


def test_provider_api_key_can_be_loaded_from_django_settings(monkeypatch, settings):
    monkeypatch.delenv("SETTINGS_ONLY_AI_KEY", raising=False)
    settings.SETTINGS_ONLY_AI_KEY = "secret"
    assert get_provider_api_key("SETTINGS_ONLY_AI_KEY") == "secret"


@pytest.mark.django_db
def test_router_only_selects_models_with_structured_output_support():
    provider = baker.make(
        "ai.AIProviderConfig",
        code="structured-router",
        name="structured-router",
        base_url="https://example.com/v1",
        api_key_env="TEST_AI_KEY",
    )
    unsupported = baker.make(
        "ai.AIModel",
        provider=provider,
        model_name="plain",
        display_name="plain",
        structured_output_mode=AIStructuredOutputMode.NONE.value,
    )
    supported = baker.make(
        "ai.AIModel",
        provider=provider,
        model_name="json",
        display_name="json",
        structured_output_mode=AIStructuredOutputMode.JSON_OBJECT.value,
    )
    baker.make("ai.AIModelRoute", capability=AICapability.STRUCTURED_EXTRACT.value, model=unsupported, priority=1)
    baker.make("ai.AIModelRoute", capability=AICapability.STRUCTURED_EXTRACT.value, model=supported, priority=2)

    candidates = get_model_candidates(
        AICapability.STRUCTURED_EXTRACT,
        mode="sync",
        requires_structured_output=True,
    )
    assert [candidate.model_name for candidate in candidates] == ["json"]


def test_unlimited_quota_and_retention_policies():
    quota = UnlimitedQuotaPolicy()
    reservation = quota.reserve(None, AIUsage())
    quota.settle(reservation, AIUsage(1, 1, 2, "reported"))
    quota.release(reservation)
    assert reservation.policy == "unlimited"
    assert decide_retention(AIRetentionPolicy.METADATA_ONLY, now=SimpleNamespace(), temporary_hours=24).persist_input is False
    assert sanitize_safe_summary({"house_id": 1, "phone": "13800138000", "note": "a@example.com"}) == {"house_id": 1}


@pytest.mark.django_db
def test_executor_instructs_json_object_model_and_validates_locally(ai_runtime):
    model = ai_runtime(
        response=AIExecutionResult('{"monthly_rent":3500,"bedrooms":2}'),
        capability=AICapability.STRUCTURED_EXTRACT,
        prompt_key="house.json-object",
    )
    model.structured_output_mode = AIStructuredOutputMode.JSON_OBJECT.value
    model.save(update_fields=("structured_output_mode",))

    result = execute(
        AIExecutionRequest(AICapability.STRUCTURED_EXTRACT, "house.json-object", response_model=HouseExtract),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
    )

    assert result.structured_data == {"monthly_rent": 3500, "bedrooms": 2}
    assert FakeProvider.requests[0].structured_output_mode == AIStructuredOutputMode.JSON_OBJECT
    assert any("JSON Schema" in message.content for message in FakeProvider.requests[0].messages)


@pytest.mark.django_db
def test_executor_skips_provider_without_configured_key(ai_runtime, monkeypatch):
    ai_runtime(provider_code="missing-key", model_name="missing-key-model", priority=1)
    configured_model = ai_runtime(
        response=AIExecutionResult("可用"),
        provider_code="configured-key",
        model_name="configured-key-model",
        priority=2,
        prompt_key="configured-key.prompt",
    )
    configured_model.provider.api_key_env = "SECOND_AI_KEY"
    configured_model.provider.save(update_fields=("api_key_env",))
    monkeypatch.delenv("TEST_AI_KEY")
    monkeypatch.setenv("SECOND_AI_KEY", "secret")

    trace = ExecutionTrace()
    result = execute(
        AIExecutionRequest(AICapability.TEXT_GENERATION, "configured-key.prompt"),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="test"),
        trace=trace,
    )

    assert result.text == "可用"
    assert [attempt["provider"] for attempt in trace.attempts] == ["configured-key"]


@pytest.mark.django_db
def test_executor_falls_back_and_repairs_structured_output(ai_runtime, monkeypatch):
    ai_runtime(
        capability=AICapability.STRUCTURED_EXTRACT,
        prompt_key="house.extract",
        priority=10,
        provider_code="primary",
        model_name="primary-model",
    )
    provider = baker.make(
        "ai.AIProviderConfig",
        code="fallback",
        name="fallback",
        adapter="fake",
        base_url="https://example.com/v1",
        api_key_env="TEST_AI_KEY",
        enabled=True,
    )
    model = baker.make(
        "ai.AIModel",
        provider=provider,
        model_name="fallback-model",
        display_name="fallback-model",
        structured_output_mode=AIStructuredOutputMode.JSON_SCHEMA.value,
    )
    baker.make("ai.AIModelRoute", capability=AICapability.STRUCTURED_EXTRACT.value, model=model, priority=20)
    monkeypatch.setitem(providers.PROVIDERS, "fake", FakeProvider)
    FakeProvider.responses = [
        AIProviderError(AIErrorCode.TIMEOUT, "超时", retryable=True),
        AIExecutionResult('{"monthly_rent":"未知"}', usage=AIUsage(10, 2, 12, "reported")),
        AIExecutionResult('{"monthly_rent":3500,"bedrooms":2}', usage=AIUsage(12, 3, 15, "reported")),
    ]
    trace = ExecutionTrace()
    result = execute(
        AIExecutionRequest(AICapability.STRUCTURED_EXTRACT, "house.extract", response_model=HouseExtract),
        AIExecutionContext(actor_id=1, organization_id=1, source_app="house"),
        trace=trace,
    )
    assert result.structured_data == {"monthly_rent": 3500, "bedrooms": 2}
    assert [item["status"] for item in trace.attempts] == ["failed", "invalid", "succeeded"]
    assert trace.attempts[-1]["kind"] == "structured_repair"
