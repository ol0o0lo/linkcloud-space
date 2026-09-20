import os

from django.conf import settings

from apps.ai.runtime.contracts import AIErrorCode, AIExecutionError, AIProviderSettings

PROVIDERS = {}


def get_provider_api_key(api_key_env: str) -> str:
    value = os.environ.get(api_key_env)
    if value is None:
        value = getattr(settings, api_key_env, "")
    return str(value or "").strip()


def build_provider(adapter: str, provider_settings: AIProviderSettings):
    provider_class = PROVIDERS.get(adapter)
    if provider_class is None:
        raise AIExecutionError(AIErrorCode.CAPABILITY_UNAVAILABLE, "AI Provider 适配器未配置。")
    return provider_class(provider_settings)


def register_builtin_providers() -> None:
    from apps.ai.runtime.providers.openai_compatible import OpenAICompatibleProvider

    PROVIDERS.setdefault("openai_compatible", OpenAICompatibleProvider)


register_builtin_providers()
