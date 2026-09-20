import hashlib
import json

from django.db import migrations

CAPABILITIES = ("chat", "text_generation", "structured_extract", "long_text")

PROVIDERS = (
    {
        "code": "bailian",
        "name": "阿里云百炼",
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "api_key_env": "DASHSCOPE_API_KEY",
        "model_name": "qwen-plus",
        "display_name": "通义千问 Plus",
        "priority": 10,
    },
    {
        "code": "deepseek",
        "name": "DeepSeek",
        "base_url": "https://api.deepseek.com",
        "api_key_env": "DEEPSEEK_API_KEY",
        "model_name": "deepseek-chat",
        "display_name": "DeepSeek Chat",
        "priority": 20,
    },
)

GENERAL_CHAT_MESSAGES = [
    {
        "role": "system",
        "content": "你是平台提供的 AI 助手。请准确、客观地回答问题；信息不足时明确说明，不要编造事实。",
    }
]


def _prompt_hash():
    payload = {
        "capability": "chat",
        "messages_template": GENERAL_CHAT_MESSAGES,
        "required_variables": [],
        "default_parameters": {},
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def _available_priority(route_model, capability, preferred):
    priority = preferred
    while route_model.objects.filter(capability=capability, priority=priority).exists():
        priority += 1
    return priority


def seed_default_ai_runtime(apps, schema_editor):
    provider_model = apps.get_model("ai", "AIProviderConfig")
    ai_model = apps.get_model("ai", "AIModel")
    route_model = apps.get_model("ai", "AIModelRoute")
    prompt_model = apps.get_model("ai", "AIPrompt")

    model_field_names = {field.name for field in ai_model._meta.get_fields()}
    if "supports_json_schema" in model_field_names:
        ai_model.objects.filter(supports_json_schema=True, structured_output_mode="none").update(structured_output_mode="json_schema")

    for item in PROVIDERS:
        provider, _ = provider_model.objects.get_or_create(
            code=item["code"],
            defaults={
                "name": item["name"],
                "adapter": "openai_compatible",
                "base_url": item["base_url"],
                "api_key_env": item["api_key_env"],
                "enabled": True,
                "timeout_seconds": 60,
                "extra": {},
                "created_by": "migration",
                "updated_by": "migration",
            },
        )
        model_defaults = {
            "display_name": item["display_name"],
            "enabled": True,
            "supports_streaming": True,
            "structured_output_mode": "json_object",
            "context_window": 131072,
            "max_output_tokens": 8192,
            "default_parameters": {},
            "currency": "USD",
            "created_by": "migration",
            "updated_by": "migration",
        }
        if "supports_json_schema" in model_field_names:
            model_defaults["supports_json_schema"] = False
        model, _ = ai_model.objects.get_or_create(
            provider=provider,
            model_name=item["model_name"],
            defaults=model_defaults,
        )
        for capability in CAPABILITIES:
            if route_model.objects.filter(capability=capability, model=model).exists():
                continue
            route_model.objects.create(
                capability=capability,
                model=model,
                priority=_available_priority(route_model, capability, item["priority"]),
                enabled=True,
                created_by="migration",
                updated_by="migration",
            )

    if not prompt_model.objects.filter(key="general.chat", version=1).exists():
        prompt_model.objects.create(
            key="general.chat",
            version=1,
            name="通用 AI 对话",
            capability="chat",
            messages_template=GENERAL_CHAT_MESSAGES,
            required_variables=[],
            default_parameters={},
            is_active=not prompt_model.objects.filter(key="general.chat", is_active=True).exists(),
            template_hash=_prompt_hash(),
            created_by="migration",
            updated_by="migration",
        )


class Migration(migrations.Migration):
    dependencies = [("ai", "0002_structured_output_and_default_providers")]

    operations = [
        migrations.RunPython(seed_default_ai_runtime, migrations.RunPython.noop),
    ]
