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
