from django.contrib import admin

from apps.subscriptions.models import (
    InvoiceRequest,
    OrganizationInvoiceProfile,
    Plan,
    PlanEntitlement,
    PlanPrice,
    SaaSOrder,
    Subscription,
    SubscriptionAuditLog,
    SubscriptionSettings,
)


class NoPhysicalDeleteAdmin(admin.ModelAdmin):
    """订阅、支付与配置记录只允许保留或停用，不允许后台物理删除。"""

    def has_delete_permission(self, request, obj=None):
        return False


class PlanPriceInline(admin.TabularInline):
    model = PlanPrice
    extra = 0
    fields = ("billing_cycle", "version", "amount", "is_current", "display_note", "published_by", "created_at")
    readonly_fields = ("created_at",)


class PlanEntitlementInline(admin.TabularInline):
    model = PlanEntitlement
    extra = 0
    fields = ("version", "member_limit", "team_limit", "house_limit", "house_counting_rule", "feature_flags", "is_current", "published_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Plan)
class PlanAdmin(NoPhysicalDeleteAdmin):
    list_display = ("code", "name", "display_order", "is_active")
    list_editable = ("display_order", "is_active")
    search_fields = ("code", "name")
    inlines = (PlanPriceInline, PlanEntitlementInline)

    def get_readonly_fields(self, request, obj=None):
        return ("code",) if obj else ()


@admin.register(SubscriptionSettings)
class SubscriptionSettingsAdmin(NoPhysicalDeleteAdmin):
    list_display = ("organization_creation_limit", "updated_at")

    def has_add_permission(self, request):
        return not SubscriptionSettings.objects.exists()


@admin.register(Subscription)
class SubscriptionAdmin(NoPhysicalDeleteAdmin):
    list_display = ("organization", "kind", "status", "billing_cycle", "ends_at")
    list_filter = ("kind", "status", "billing_cycle")
    search_fields = ("organization__name", "organization__slug")
    readonly_fields = tuple(field.name for field in Subscription._meta.fields)


@admin.register(SaaSOrder)
class SaaSOrderAdmin(NoPhysicalDeleteAdmin):
    list_display = ("order_no", "organization", "order_type", "status", "payable_amount", "refund_status", "created_at")
    list_filter = ("order_type", "status", "refund_status", "billing_cycle")
    search_fields = ("order_no", "organization__name", "organization__slug")
    readonly_fields = tuple(field.name for field in SaaSOrder._meta.fields)


@admin.register(OrganizationInvoiceProfile)
class OrganizationInvoiceProfileAdmin(NoPhysicalDeleteAdmin):
    list_display = ("organization", "title", "tax_number", "recipient_email")
    search_fields = ("organization__name", "title", "tax_number")


@admin.register(InvoiceRequest)
class InvoiceRequestAdmin(NoPhysicalDeleteAdmin):
    list_display = ("order", "status", "invoice_number", "issued_at", "created_at")
    list_filter = ("status",)
    search_fields = ("order__order_no", "invoice_number", "order__organization__name")


@admin.register(SubscriptionAuditLog)
class SubscriptionAuditLogAdmin(NoPhysicalDeleteAdmin):
    list_display = ("action", "organization", "target_type", "target_id", "actor", "created_at")
    list_filter = ("action", "target_type")
    search_fields = ("organization__name", "target_id")
    readonly_fields = tuple(field.name for field in SubscriptionAuditLog._meta.fields)
