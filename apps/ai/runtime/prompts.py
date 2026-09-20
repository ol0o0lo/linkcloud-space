from dataclasses import dataclass
from typing import Any

from django.template import Context, Engine

from apps.ai.models import AIPrompt
from apps.ai.runtime.contracts import AICapability, AIChatMessage, AIErrorCode, AIExecutionError


@dataclass(frozen=True, slots=True)
class PromptSnapshot:
    key: str
    version: int
    capability: AICapability
    template_hash: str
    messages: tuple[AIChatMessage, ...]
    parameters: dict[str, Any]


def resolve_prompt(prompt_key: str, *, variables: dict[str, Any], version: int | None = None) -> PromptSnapshot:
    query = AIPrompt.objects.filter(key=prompt_key)
    query = query.filter(version=version) if version is not None else query.filter(is_active=True)
    prompt = query.first()
    if prompt is None:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "未找到可用的 Prompt 配置。")

    missing = sorted(set(prompt.required_variables) - set(variables))
    if missing:
        raise AIExecutionError(AIErrorCode.INVALID_REQUEST, f"Prompt 缺少变量：{', '.join(missing)}")

    engine = Engine(debug=False, string_if_invalid="")
    rendered = []
    for item in prompt.messages_template:
        if not isinstance(item, dict):
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 消息模板格式无效。")
        role = item.get("role")
        content = item.get("content")
        if role not in {"system", "user", "assistant"} or not isinstance(content, str):
            raise AIExecutionError(AIErrorCode.INVALID_REQUEST, "Prompt 消息模板格式无效。")
        rendered.append(AIChatMessage(role=role, content=engine.from_string(content).render(Context(variables, autoescape=False))))

    return PromptSnapshot(
        key=prompt.key,
        version=prompt.version,
        capability=AICapability(prompt.capability),
        template_hash=prompt.template_hash,
        messages=tuple(rendered),
        parameters=dict(prompt.default_parameters),
    )
