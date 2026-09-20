from collections.abc import Iterator
from types import SimpleNamespace

import pytest
from model_bakery import baker

from apps.ai.runtime import providers
from apps.ai.runtime.contracts import AICapability, AIExecutionResult, AIProviderRequest, AIStreamChunk, AIStructuredOutputMode, AIUsage


class FakeProvider:
    responses: list[AIExecutionResult | Exception] = []
    stream_responses: list[list[AIStreamChunk | Exception] | Exception] = []
    requests: list[AIProviderRequest] = []

    @classmethod
    def reset(cls):
        cls.responses = []
        cls.stream_responses = []
        cls.requests = []

    def __init__(self, provider_settings):
        self.settings = provider_settings
        self.last_request_id = "fake-request"

    def generate(self, request: AIProviderRequest) -> AIExecutionResult:
        type(self).requests.append(request)
        response = type(self).responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def stream(self, request: AIProviderRequest) -> Iterator[AIStreamChunk]:
        type(self).requests.append(request)
        response = type(self).stream_responses.pop(0)
        if isinstance(response, Exception):
            raise response
        for item in response:
            if isinstance(item, Exception):
                raise item
            yield item


@pytest.fixture
def org_owner(db):
    user = baker.make("accounts.User")
    organization = baker.make("organizations.Organization")
    baker.make("organizations.OrganizationMember", organization=organization, user=user, is_owner=True)
    return SimpleNamespace(user=user, organization=organization)


@pytest.fixture
def ai_runtime(monkeypatch, settings):
    FakeProvider.reset()
    monkeypatch.setitem(providers.PROVIDERS, "fake", FakeProvider)
    monkeypatch.setenv("TEST_AI_KEY", "secret")
    settings.AI_ENABLED = True
    baker.make(
        "app_settings.DefaultSetting",
        key="ai.allowed_capabilities",
        value=[item.value for item in AICapability],
        value_type="json",
        ui={"scopes": ["organization"]},
    )

    def configure(
        *,
        response: AIExecutionResult | None = None,
        capability=AICapability.TEXT_GENERATION,
        prompt_key="house.description",
        priority=10,
        provider_code="fake-provider",
        model_name="fake-model",
        currency="CNY",
    ):
        provider = baker.make(
            "ai.AIProviderConfig",
            code=provider_code,
            name=provider_code,
            adapter="fake",
            base_url="https://example.com/v1",
            api_key_env="TEST_AI_KEY",
            enabled=True,
        )
        model = baker.make(
            "ai.AIModel",
            provider=provider,
            model_name=model_name,
            display_name=model_name,
            enabled=True,
            supports_streaming=True,
            structured_output_mode=AIStructuredOutputMode.JSON_SCHEMA.value,
            currency=currency,
        )
        baker.make("ai.AIModelRoute", capability=capability.value, model=model, priority=priority)
        baker.make(
            "ai.AIPrompt",
            key=prompt_key,
            version=1,
            name=prompt_key,
            capability=capability.value,
            messages_template=[{"role": "system", "content": "安全、客观地回答用户"}],
            is_active=True,
        )
        if response is not None:
            FakeProvider.responses.append(response)
        return model

    return configure


@pytest.fixture
def enabled_ai_chat_runtime(ai_runtime):
    ai_runtime(response=AIExecutionResult("你好", usage=AIUsage(2, 1, 3, "reported")), capability=AICapability.CHAT, prompt_key="general.chat")
    FakeProvider.stream_responses = [
        [
            AIStreamChunk(event="delta", text="你"),
            AIStreamChunk(event="delta", text="好"),
            AIStreamChunk(event="usage", usage=AIUsage(2, 2, 4, "reported")),
            AIStreamChunk(event="done", finish_reason="stop"),
        ]
    ]
