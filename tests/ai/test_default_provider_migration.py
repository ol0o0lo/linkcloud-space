import importlib

from django.apps import apps as django_apps

import pytest

from apps.ai.models import AIModel, AIModelRoute, AIPrompt, AIProviderConfig

seed_default_ai_runtime = importlib.import_module("apps.ai.migrations.0003_seed_default_ai_runtime").seed_default_ai_runtime


@pytest.mark.django_db
def test_default_provider_seed_is_ready_and_idempotent():
    seed_default_ai_runtime(django_apps, None)
    seed_default_ai_runtime(django_apps, None)

    bailian = AIProviderConfig.objects.get(code="bailian")
    deepseek = AIProviderConfig.objects.get(code="deepseek")
    assert (bailian.base_url, bailian.api_key_env) == ("https://dashscope.aliyuncs.com/compatible-mode/v1", "DASHSCOPE_API_KEY")
    assert (deepseek.base_url, deepseek.api_key_env) == ("https://api.deepseek.com", "DEEPSEEK_API_KEY")

    qwen = AIModel.objects.get(provider=bailian, model_name="qwen-plus")
    deepseek_chat = AIModel.objects.get(provider=deepseek, model_name="deepseek-chat")
    assert qwen.structured_output_mode == deepseek_chat.structured_output_mode == "json_object"
    assert AIModelRoute.objects.filter(model=qwen).count() == 4
    assert AIModelRoute.objects.filter(model=deepseek_chat).count() == 4
    assert list(AIModelRoute.objects.filter(capability="chat").order_by("priority").values_list("model__model_name", "priority")) == [
        ("qwen-plus", 10),
        ("deepseek-chat", 20),
    ]

    prompt = AIPrompt.objects.get(key="general.chat", version=1)
    assert prompt.is_active is True
    assert prompt.capability == "chat"


@pytest.mark.django_db
def test_default_provider_seed_preserves_existing_admin_configuration():
    existing = AIProviderConfig.objects.create(
        code="bailian",
        name="自定义百炼",
        adapter="openai_compatible",
        base_url="https://proxy.example.com/v1",
        api_key_env="CUSTOM_BAILIAN_KEY",
        enabled=False,
    )

    seed_default_ai_runtime(django_apps, None)

    existing.refresh_from_db()
    assert existing.name == "自定义百炼"
    assert existing.base_url == "https://proxy.example.com/v1"
    assert existing.api_key_env == "CUSTOM_BAILIAN_KEY"
    assert existing.enabled is False
