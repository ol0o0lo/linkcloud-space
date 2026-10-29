from django.db import migrations

CONTACT_FALLBACK_MEMBER_SETTING = {
    "key": "property_rental.contact_fallback_member_id",
    "value": 0,
    "value_type": "integer",
    "widget": "select",
    "label": "房源咨询兜底接待人",
    "description": "房源没有有效负责人时，默认转给组织管理员，也可指定本组织成员。指定成员失效后自动回退到管理员；已有咨询继续由原有效接待人跟进。",
    "category": "property_rental",
    "ui": {"scopes": ["organization"], "options_source": "organization.members"},
}


def ensure_contact_fallback_member_setting(apps, schema_editor):
    default_setting = apps.get_model("app_settings", "DefaultSetting")
    setting, _ = default_setting.objects.get_or_create(key=CONTACT_FALLBACK_MEMBER_SETTING["key"], defaults=CONTACT_FALLBACK_MEMBER_SETTING)
    default_setting.objects.filter(pk=setting.pk).update(**{key: value for key, value in CONTACT_FALLBACK_MEMBER_SETTING.items() if key not in {"key", "value"}})


class Migration(migrations.Migration):
    dependencies = [("app_settings", "0015_ai_allowed_capabilities")]

    operations = [migrations.RunPython(ensure_contact_fallback_member_setting, migrations.RunPython.noop)]
