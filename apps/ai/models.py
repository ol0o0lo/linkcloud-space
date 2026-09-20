import hashlib
import json

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

from apps.ai.runtime.contracts import AICapability, AIExecutionMode, AIInvocationStatus, AIRetentionPolicy, AIStructuredOutputMode
from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin


def enum_choices(enum_type):
    return [(item.value, item.value) for item in enum_type]


class AIProviderConfig(BaseModelMixin):
    code = models.SlugField(max_length=50, unique=True, verbose_name="供应商编码")
    name = models.CharField(max_length=100, verbose_name="供应商名称")
    adapter = models.CharField(max_length=50, default="openai_compatible", verbose_name="适配器")
    base_url = models.URLField(max_length=500, verbose_name="接口地址")
    api_key_env = models.CharField(
        max_length=100,
        validators=[RegexValidator(r"^[A-Z][A-Z0-9_]*$", "密钥环境变量名必须使用大写字母、数字和下划线。")],
        verbose_name="密钥环境变量名",
    )
    enabled = models.BooleanField(default=True, verbose_name="是否启用")
    timeout_seconds = models.PositiveIntegerField(default=60, verbose_name="超时秒数")
    extra = models.JSONField(default=dict, blank=True, verbose_name="兼容参数")

    class Meta:
        db_table = "ai_provider_config"
        ordering = ["code"]
        verbose_name = "AI 供应商"
        verbose_name_plural = "AI 供应商"

    def __str__(self):
        return self.name

    def clean(self):
        super().clean()
        from apps.ai.runtime.providers import PROVIDERS

        if self.adapter not in PROVIDERS:
            raise ValidationError({"adapter": "未知的 AI Provider 适配器。"})
        if not isinstance(self.extra, dict):
            raise ValidationError({"extra": "供应商兼容参数必须是 JSON 对象。"})
        if set(self.extra) - {"default_query"}:
            raise ValidationError({"extra": "首期兼容参数只允许 default_query。"})
        default_query = self.extra.get("default_query", {})
        if not isinstance(default_query, dict):
            raise ValidationError({"extra": "default_query 必须是 JSON 对象。"})
        secret_fragments = ("key", "token", "secret", "authorization")
        if any(fragment in str(key).lower() for key in default_query for fragment in secret_fragments):
            raise ValidationError({"extra": "供应商兼容参数不得保存密钥或令牌。"})


class AIModel(BaseModelMixin):
    provider = models.ForeignKey(AIProviderConfig, on_delete=models.PROTECT, related_name="models", verbose_name="供应商")
    model_name = models.CharField(max_length=150, verbose_name="供应商模型名")
    display_name = models.CharField(max_length=150, verbose_name="显示名称")
    enabled = models.BooleanField(default=True, verbose_name="是否启用")
    supports_streaming = models.BooleanField(default=True, verbose_name="支持流式")
    structured_output_mode = models.CharField(
        max_length=20,
        choices=enum_choices(AIStructuredOutputMode),
        default=AIStructuredOutputMode.NONE.value,
        verbose_name="结构化输出模式",
    )
    context_window = models.PositiveIntegerField(default=8192, verbose_name="上下文窗口")
    max_output_tokens = models.PositiveIntegerField(default=4096, verbose_name="最大输出 Token")
    default_parameters = models.JSONField(default=dict, blank=True, verbose_name="默认参数")
    input_price_per_million = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="百万输入 Token 单价")
    output_price_per_million = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="百万输出 Token 单价")
    currency = models.CharField(max_length=3, default="USD", verbose_name="币种")
    price_updated_at = models.DateTimeField(null=True, blank=True, verbose_name="价格更新时间")

    class Meta:
        db_table = "ai_model"
        ordering = ["provider__code", "model_name"]
        verbose_name = "AI 模型"
        verbose_name_plural = "AI 模型"
        constraints = [models.UniqueConstraint(fields=("provider", "model_name"), name="ai_model_provider_name_unique")]

    def __str__(self):
        return self.display_name


class AIModelRoute(BaseModelMixin):
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), verbose_name="能力")
    model = models.ForeignKey(AIModel, on_delete=models.CASCADE, related_name="routes", verbose_name="模型")
    priority = models.PositiveSmallIntegerField(default=100, verbose_name="优先级")
    enabled = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        db_table = "ai_model_route"
        ordering = ["capability", "priority", "pk"]
        verbose_name = "AI 模型路由"
        verbose_name_plural = "AI 模型路由"
        constraints = [
            models.UniqueConstraint(fields=("capability", "model"), name="ai_route_capability_model_unique"),
            models.UniqueConstraint(fields=("capability", "priority"), name="ai_route_capability_priority_unique"),
        ]

    def __str__(self):
        return f"{self.capability} -> {self.model}"


class AIPrompt(BaseModelMixin):
    key = models.CharField(
        max_length=100,
        validators=[RegexValidator(r"^[a-z0-9][a-z0-9_.-]*$", "Prompt key 只能包含小写字母、数字、点、下划线和连字符。")],
        verbose_name="Prompt key",
    )
    version = models.PositiveIntegerField(verbose_name="版本")
    name = models.CharField(max_length=150, verbose_name="名称")
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), verbose_name="能力")
    messages_template = models.JSONField(default=list, verbose_name="消息模板")
    required_variables = models.JSONField(default=list, blank=True, verbose_name="必填变量")
    default_parameters = models.JSONField(default=dict, blank=True, verbose_name="默认参数")
    is_active = models.BooleanField(default=False, verbose_name="是否启用")
    template_hash = models.CharField(max_length=64, editable=False, verbose_name="模板哈希")

    IMMUTABLE_FIELDS = ("key", "version", "messages_template", "required_variables", "default_parameters", "capability")

    class Meta:
        db_table = "ai_prompt"
        ordering = ["key", "-version"]
        verbose_name = "AI Prompt"
        verbose_name_plural = "AI Prompt"
        constraints = [
            models.UniqueConstraint(fields=("key", "version"), name="ai_prompt_key_version_unique"),
            models.UniqueConstraint(fields=("key",), condition=Q(is_active=True), name="ai_prompt_one_active_version"),
        ]

    def __str__(self):
        return f"{self.key}@{self.version}"

    def _calculate_hash(self) -> str:
        payload = {
            "capability": self.capability,
            "messages_template": self.messages_template,
            "required_variables": self.required_variables,
            "default_parameters": self.default_parameters,
        }
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()
        return hashlib.sha256(encoded).hexdigest()

    def clean(self):
        super().clean()
        if not isinstance(self.messages_template, list) or not self.messages_template:
            raise ValidationError({"messages_template": "消息模板必须是非空列表。"})
        if not isinstance(self.required_variables, list) or not all(isinstance(item, str) and item for item in self.required_variables):
            raise ValidationError({"required_variables": "必填变量必须是字符串列表。"})
        if not isinstance(self.default_parameters, dict):
            raise ValidationError({"default_parameters": "默认参数必须是 JSON 对象。"})
        if self.pk:
            previous = type(self).objects.get(pk=self.pk)
            is_used = AIInvocation.objects.filter(prompt_key=previous.key, prompt_version=previous.version).exists()
            if is_used and any(getattr(previous, field) != getattr(self, field) for field in self.IMMUTABLE_FIELDS):
                raise ValidationError("该 Prompt 版本已产生调用记录，模板内容不可修改。")

    def save(self, *args, **kwargs):
        self.template_hash = self._calculate_hash()
        self.full_clean()
        return super().save(*args, **kwargs)


class AIConversation(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="ai_conversations",
        verbose_name="组织",
    )
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_conversations", verbose_name="所有者")
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), default=AICapability.CHAT.value, verbose_name="能力")
    title = models.CharField(max_length=120, blank=True, default="", verbose_name="标题")
    status = models.CharField(max_length=20, choices=(("active", "active"), ("archived", "archived")), default="active", verbose_name="状态")
    last_message_at = models.DateTimeField(null=True, blank=True, verbose_name="最后消息时间")

    class Meta:
        db_table = "ai_conversation"
        ordering = ["-last_message_at", "-created_at"]
        verbose_name = "AI 对话"
        verbose_name_plural = "AI 对话"

    def __str__(self):
        return self.title or f"AI 对话 #{self.pk}"


class AIInvocation(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey(
        "organizations.Organization",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_invocations",
        verbose_name="组织",
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="ai_invocations",
        verbose_name="调用人",
    )
    conversation = models.ForeignKey(
        AIConversation,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invocations",
        verbose_name="对话",
    )
    capability = models.CharField(max_length=40, choices=enum_choices(AICapability), verbose_name="能力")
    source_app = models.CharField(max_length=80, verbose_name="来源模块")
    target_type = models.CharField(max_length=80, blank=True, default="", verbose_name="业务对象类型")
    target_id = models.CharField(max_length=100, blank=True, default="", verbose_name="业务对象 ID")
    execution_mode = models.CharField(max_length=20, choices=enum_choices(AIExecutionMode), verbose_name="执行模式")
    status = models.CharField(max_length=20, choices=enum_choices(AIInvocationStatus), db_index=True, verbose_name="状态")
    idempotency_key = models.CharField(max_length=128, blank=True, default="", verbose_name="幂等键")
    prompt_key = models.CharField(max_length=100, blank=True, default="", verbose_name="Prompt key")
    prompt_version = models.PositiveIntegerField(null=True, blank=True, verbose_name="Prompt 版本")
    prompt_hash = models.CharField(max_length=64, blank=True, default="", verbose_name="Prompt 哈希")
    provider_code = models.CharField(max_length=50, blank=True, default="", verbose_name="供应商")
    model_name = models.CharField(max_length=150, blank=True, default="", verbose_name="模型")
    input_tokens = models.PositiveIntegerField(null=True, blank=True, verbose_name="输入 Token")
    output_tokens = models.PositiveIntegerField(null=True, blank=True, verbose_name="输出 Token")
    total_tokens = models.PositiveIntegerField(null=True, blank=True, verbose_name="总 Token")
    usage_status = models.CharField(max_length=20, choices=(("reported", "reported"), ("unavailable", "unavailable")), default="unavailable", verbose_name="用量状态")
    input_price_snapshot = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="输入单价快照")
    output_price_snapshot = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="输出单价快照")
    estimated_cost = models.DecimalField(max_digits=20, decimal_places=8, null=True, blank=True, verbose_name="预估费用")
    currency = models.CharField(max_length=3, blank=True, default="", verbose_name="币种")
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="结束时间")
    first_token_ms = models.PositiveIntegerField(null=True, blank=True, verbose_name="首 Token 耗时")
    duration_ms = models.PositiveIntegerField(null=True, blank=True, verbose_name="总耗时")
    error_type = models.CharField(max_length=50, blank=True, default="", verbose_name="错误类型")
    error_code = models.CharField(max_length=100, blank=True, default="", verbose_name="错误码")
    error_summary = models.CharField(max_length=500, blank=True, default="", verbose_name="错误摘要")
    provider_request_id = models.CharField(max_length=150, blank=True, default="", verbose_name="供应商请求 ID")
    retention_policy = models.CharField(max_length=30, choices=enum_choices(AIRetentionPolicy), verbose_name="保留策略")
    content_hash = models.CharField(max_length=64, blank=True, default="", verbose_name="正文哈希")
    safe_summary = models.JSONField(default=dict, blank=True, verbose_name="脱敏摘要")
    attempts = models.JSONField(default=list, blank=True, verbose_name="调用尝试")
    input_payload = models.JSONField(default=dict, blank=True, verbose_name="输入正文")
    output_payload = models.JSONField(default=dict, blank=True, verbose_name="输出正文")
    content_expires_at = models.DateTimeField(null=True, blank=True, db_index=True, verbose_name="正文过期时间")

    class Meta:
        db_table = "ai_invocation"
        ordering = ["-created_at"]
        verbose_name = "AI 调用"
        verbose_name_plural = "AI 调用"
        indexes = [
            models.Index(fields=("organization", "created_at"), name="ai_inv_org_created_idx"),
            models.Index(fields=("actor", "created_at"), name="ai_inv_actor_created_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "actor", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=False, actor__isnull=False) & ~Q(idempotency_key=""),
                name="ai_invocation_org_actor_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("actor", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=True, actor__isnull=False) & ~Q(idempotency_key=""),
                name="ai_invocation_personal_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("organization", "source_app", "idempotency_key"),
                condition=Q(organization__isnull=False, actor__isnull=True) & ~Q(idempotency_key=""),
                name="ai_invocation_org_system_idempotency_unique",
            ),
            models.UniqueConstraint(
                fields=("source_app", "idempotency_key"),
                condition=Q(organization__isnull=True, actor__isnull=True) & ~Q(idempotency_key=""),
                name="ai_invocation_global_system_idempotency_unique",
            ),
        ]

    def __str__(self):
        return f"{self.capability} #{self.pk}"


class AIMessage(CreateUpdateTimeModelMixin):
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name="messages", verbose_name="对话")
    role = models.CharField(max_length=20, choices=(("system", "system"), ("user", "user"), ("assistant", "assistant")), verbose_name="角色")
    content = models.TextField(verbose_name="正文")
    content_json = models.JSONField(null=True, blank=True, verbose_name="结构化正文")
    client_message_key = models.CharField(max_length=128, blank=True, default="", verbose_name="客户端消息键")
    invocation = models.OneToOneField(
        AIInvocation,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="assistant_message",
        verbose_name="调用记录",
    )
    token_count = models.PositiveIntegerField(null=True, blank=True, verbose_name="Token 数")

    class Meta:
        db_table = "ai_message"
        ordering = ["created_at", "pk"]
        verbose_name = "AI 消息"
        verbose_name_plural = "AI 消息"
        constraints = [
            models.UniqueConstraint(
                fields=("conversation", "client_message_key"),
                condition=~Q(client_message_key=""),
                name="ai_message_conversation_client_key_unique",
            )
        ]

    def __str__(self):
        return f"{self.role} #{self.pk}"
