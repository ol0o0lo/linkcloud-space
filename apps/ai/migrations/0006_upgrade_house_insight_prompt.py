import hashlib
import json

from django.db import migrations

PROMPT_KEY = "house.public_insight"
PROMPT_VERSION = 2
MESSAGES_TEMPLATE = [
    {
        "role": "system",
        "content": (
            "你是租赁房源公开资料解读助手。只能使用用户提供的公开事实，不得补充、猜测或暗示任何未提供的房源事实。"
            "摘要要聚焦信息完整度、核心优势和最需关注的风险，不要逐项复述公开字段。"
            "highlights 中的 kind 必须是 highlight 或 risk；亮点是有事实支撑的积极特征，风险是可能影响出租或需补证的信息。"
            "verification_items 必须标注 priority；可能造成重大误判或阻碍出租的事项使用 high，其余使用 normal。"
            "摘要和每条关键判断都必须引用真实存在的 fact_ids；不得使用绝佳、超值、必租等无依据营销判断。"
            "建议核实事项只能写成需要进一步确认的问题或动作，不能把未知信息表述为事实。输出必须符合指定 JSON Schema。"
        ),
    },
    {
        "role": "user",
        "content": "公开事实：{{ facts_json }}\n缺失字段：{{ missing_fields_json }}\n请生成简洁、客观、便于房源运营人员快速阅读和采取行动的房源洞察。",
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


def upgrade_house_insight_prompt(apps, schema_editor):
    prompt_model = apps.get_model("ai", "AIPrompt")
    prompt, _created = prompt_model.objects.get_or_create(
        key=PROMPT_KEY,
        version=PROMPT_VERSION,
        defaults={
            "name": "房源公开资料 AI 洞察",
            "capability": "structured_extract",
            "messages_template": MESSAGES_TEMPLATE,
            "required_variables": REQUIRED_VARIABLES,
            "default_parameters": DEFAULT_PARAMETERS,
            "is_active": False,
            "template_hash": _prompt_hash(),
            "created_by": "migration",
            "updated_by": "migration",
        },
    )
    prompt_model.objects.filter(key=PROMPT_KEY, is_active=True).exclude(pk=prompt.pk).update(is_active=False)
    prompt_model.objects.filter(pk=prompt.pk).update(is_active=True)


class Migration(migrations.Migration):
    dependencies = [("ai", "0005_seed_house_insight_prompt")]

    operations = [migrations.RunPython(upgrade_house_insight_prompt, migrations.RunPython.noop)]
