from django.core.exceptions import ValidationError

import pytest
from model_bakery import baker

from apps.ai.models import AIInvocation
from apps.ai.runtime.contracts import AICapability, AIErrorCode, AIExecutionError
from apps.ai.runtime.prompts import resolve_prompt


@pytest.mark.django_db
def test_used_prompt_cannot_be_changed():
    prompt = baker.make(
        "ai.AIPrompt",
        key="general.chat",
        version=1,
        name="通用对话",
        capability=AICapability.CHAT.value,
        messages_template=[{"role": "system", "content": "你好 {{ name }}"}],
        required_variables=["name"],
        is_active=True,
    )
    baker.make(
        AIInvocation,
        capability=AICapability.CHAT.value,
        execution_mode="sync",
        status="succeeded",
        source_app="test",
        retention_policy="metadata_only",
        prompt_key=prompt.key,
        prompt_version=prompt.version,
    )
    prompt.messages_template = [{"role": "system", "content": "已修改"}]
    with pytest.raises(ValidationError, match="已产生调用记录"):
        prompt.save()


@pytest.mark.django_db
def test_prompt_renders_and_checks_required_variables():
    baker.make(
        "ai.AIPrompt",
        key="house.summary",
        version=2,
        name="房源摘要",
        capability=AICapability.TEXT_GENERATION.value,
        messages_template=[{"role": "system", "content": "为 {{ estate_name }} 生成摘要"}],
        required_variables=["estate_name"],
        is_active=True,
    )
    snapshot = resolve_prompt("house.summary", variables={"estate_name": "星河花园"})
    assert snapshot.version == 2
    assert snapshot.messages[0].content == "为 星河花园 生成摘要"
    with pytest.raises(AIExecutionError) as exc_info:
        resolve_prompt("house.summary", variables={})
    assert exc_info.value.code == AIErrorCode.INVALID_REQUEST
