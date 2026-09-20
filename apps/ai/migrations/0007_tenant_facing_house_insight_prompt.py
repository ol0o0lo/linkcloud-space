import hashlib
import json

from django.db import migrations

PROMPT_KEY = "house.public_insight"
PROMPT_VERSION = 3
MESSAGES_TEMPLATE = [
    {
        "role": "system",
        "content": (
            "你是面向找房租客的 AI 租房助手。只能使用用户提供的房源公开事实和缺失字段，不得使用、推断或暗示任何房东隐私、联系方式、内部备注或经营信息。"
            "输出不是字段摘要，也不是后台运营报告；不要逐项复述租金、户型、面积等全部字段，而要筛选真正影响租客判断的少量信息。"
            "conclusion 只写一句、控制在 35 至 70 个汉字，概括一个主要特点和一个最需要留意的问题；不要写房号、完整地址，不要连续罗列三个以上字段。"
            "signals 只输出 2 至 3 个最有决策价值的动态信号。label 控制在 2 至 6 个汉字，value 控制在 8 至 20 个汉字，"
            "使用租客一眼能看懂的短语，不要把 conclusion 换一种说法重复一遍；tone 只能是 positive、neutral 或 caution。"
            "appeal_points 最多 2 条，每条控制在 30 个汉字以内，只保留有公开事实支撑、对居住体验有实际价值的特点；"
            "没有可靠内容时返回空列表，不得使用‘性价比高’‘值得入手’‘宜居’等营销话术。"
            "viewing_questions 输出 1 至 3 个租客在咨询或看房时值得确认的问题，每条控制在 32 个汉字以内，"
            "以问句表达并使用问号结尾，不要写成‘补充资料’等后台任务。每个问题必须通过 fact_ids 或 missing_field_keys 引用至少一个输入来源。"
            "没有租客偏好时，不得使用‘适合你’‘你会喜欢’等个性化判断，也不得暗示了解租客的预算、家庭或通勤需求。"
            "所有 conclusion、signals 和 appeal_points 都必须引用真实存在的 fact_ids。不得生成综合评分、价格性价比判断、区域行情或无法从输入事实确认的结论。"
            "输出必须符合指定 JSON Schema。"
        ),
    },
    {
        "role": "user",
        "content": "房源公开事实：{{ facts_json }}\n尚未提供的公开字段：{{ missing_fields_json }}\n请生成简短、可信、可直接展示给找房租客的 AI 租房速览。",
    },
]
REQUIRED_VARIABLES = ["facts_json", "missing_fields_json"]
DEFAULT_PARAMETERS = {"temperature": 0.2, "max_tokens": 1000}


def _prompt_hash():
    payload = {
        "capability": "structured_extract",
        "messages_template": MESSAGES_TEMPLATE,
        "required_variables": REQUIRED_VARIABLES,
        "default_parameters": DEFAULT_PARAMETERS,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
    return hashlib.sha256(encoded).hexdigest()


def activate_tenant_facing_house_insight_prompt(apps, schema_editor):
    prompt_model = apps.get_model("ai", "AIPrompt")
    prompt, _created = prompt_model.objects.get_or_create(
        key=PROMPT_KEY,
        version=PROMPT_VERSION,
        defaults={
            "name": "租客视角房源 AI 租房速览",
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
    dependencies = [("ai", "0006_upgrade_house_insight_prompt")]

    operations = [migrations.RunPython(activate_tenant_facing_house_insight_prompt, migrations.RunPython.noop)]
