from django.contrib import admin, messages
from django.db import transaction
from django.utils import timezone

from apps.ai.models import AIConversation, AIInvocation, AIMessage, AIModel, AIModelRoute, AIPrompt, AIProviderConfig
from apps.ai.runtime.providers import get_provider_api_key


class SuperuserConfigAdmin(admin.ModelAdmin):
    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(SuperuserConfigAdmin):
    list_display = ("code", "name", "adapter", "enabled", "key_configured", "timeout_seconds")
    search_fields = ("code", "name")
    list_filter = ("enabled", "adapter")

    @admin.display(boolean=True, description="密钥已配置")
    def key_configured(self, obj):
        return bool(get_provider_api_key(obj.api_key_env))


@admin.register(AIModel)
class AIModelAdmin(SuperuserConfigAdmin):
    list_display = ("display_name", "provider", "model_name", "enabled", "supports_streaming", "structured_output_mode")
    list_filter = ("enabled", "supports_streaming", "structured_output_mode", "provider")
    search_fields = ("display_name", "model_name")


@admin.register(AIModelRoute)
class AIModelRouteAdmin(SuperuserConfigAdmin):
    list_display = ("capability", "model", "priority", "enabled")
    list_filter = ("capability", "enabled")
    ordering = ("capability", "priority")


@admin.register(AIPrompt)
class AIPromptAdmin(SuperuserConfigAdmin):
    list_display = ("key", "version", "name", "capability", "is_active", "template_hash")
    list_filter = ("capability", "is_active")
    search_fields = ("key", "name")
    readonly_fields = ("template_hash", "is_active")
    actions = ("activate_prompt",)

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user.get_username()
        if not change:
            obj.created_by = request.user.get_username()
        super().save_model(request, obj, form, change)

    @admin.action(description="启用选中的 Prompt 版本")
    def activate_prompt(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "每次只能启用一个 Prompt 版本。", level=messages.ERROR)
            return
        with transaction.atomic():
            prompt = AIPrompt.objects.select_for_update().get(pk=queryset.values_list("pk", flat=True).get())
            has_route = AIModelRoute.objects.filter(
                capability=prompt.capability,
                enabled=True,
                model__enabled=True,
                model__provider__enabled=True,
            ).exists()
            if not has_route:
                self.message_user(request, "该 capability 尚无可用模型路由，不能启用 Prompt。", level=messages.ERROR)
                return
            now = timezone.now()
            AIPrompt.objects.filter(key=prompt.key, is_active=True).exclude(pk=prompt.pk).update(is_active=False, updated_at=now)
            AIPrompt.objects.filter(pk=prompt.pk).update(is_active=True, updated_by=request.user.get_username(), updated_at=now)

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj and AIInvocation.objects.filter(prompt_key=obj.key, prompt_version=obj.version).exists():
            fields.extend(["key", "version", "capability", "messages_template", "required_variables", "default_parameters"])
        return tuple(fields)


class ReadOnlyAuditAdmin(SuperuserConfigAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return tuple(field.name for field in self.model._meta.fields)


@admin.register(AIInvocation)
class AIInvocationAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "created_at", "organization", "actor", "capability", "status", "provider_code", "model_name", "total_tokens", "estimated_cost", "duration_ms")
    list_filter = ("status", "capability", "provider_code", "execution_mode", "retention_policy")
    search_fields = ("idempotency_key", "target_id", "provider_request_id")
    exclude = ("input_payload", "output_payload")

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("organization", "actor").defer("input_payload", "output_payload")


@admin.register(AIConversation)
class AIConversationAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "owner", "organization", "status", "last_message_at", "created_at")
    list_filter = ("status",)
    search_fields = ("title", "owner__username")


@admin.register(AIMessage)
class AIMessageAdmin(ReadOnlyAuditAdmin):
    list_display = ("id", "conversation", "role", "invocation", "created_at")
    list_filter = ("role",)
    search_fields = ("conversation__title",)
    exclude = ("content", "content_json")
