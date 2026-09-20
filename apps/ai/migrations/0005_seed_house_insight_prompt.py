import hashlib
import json

from django.db import migrations

PROMPT_KEY = "house.public_insight"
PROMPT_VERSION = 1
MESSAGES_TEMPLATE = [
    {
        "role": "system",
        "content": (
            "你是租赁房源公开资料解读助手。只能使用用户提供的公开事实，不得补充、猜测或暗示任何未提供的房源事实。"
            "摘要和每条房源特点都必须引用真实存在的 fact_ids；不得使用绝佳、超值、必租等无依据营销判断。"
            "建议核实事项只能写成需要进一步确认的问题或动作，不能把未知信息表述为事实。输出必须符合指定 JSON Schema。"
        ),
    },
    {
        "role": "user",
        "content": "公开事实：{{ facts_json }}\n缺失字段：{{ missing_fields_json }}\n请生成简洁、客观、便于房源运营人员快速阅读的房源洞察。",
    },
]
REQUIRED_VARIABLES = ["facts_json", "missing_fields_json"]
DEFAULT_PARAMETERS = {"temperature": 0.2, "max_tokens": 1200}


def _prompt_hash():
    payload = {
        "capability": "structured_extract",
        "messages_template": MESSAGES_TEMPLATE,
        "required_variables": REQUIRED_VARIABLES,
        "default_parameters": DEFAULT_PARAMETERS,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def seed_house_insight_prompt(apps, schema_editor):
    prompt_model = apps.get_model("ai", "AIPrompt")
    if prompt_model.objects.filter(key=PROMPT_KEY, version=PROMPT_VERSION).exists():
        return
    prompt_model.objects.create(
        key=PROMPT_KEY,
        version=PROMPT_VERSION,
        name="房源公开资料 AI 洞察",
        capability="structured_extract",
        messages_template=MESSAGES_TEMPLATE,
        required_variables=REQUIRED_VARIABLES,
        default_parameters=DEFAULT_PARAMETERS,
        is_active=not prompt_model.objects.filter(key=PROMPT_KEY, is_active=True).exists(),
        template_hash=_prompt_hash(),
        created_by="migration",
        updated_by="migration",
    )


class Migration(migrations.Migration):
    dependencies = [("ai", "0004_remove_aimodel_supports_json_schema")]

    operations = [migrations.RunPython(seed_house_insight_prompt, migrations.RunPython.noop)]
