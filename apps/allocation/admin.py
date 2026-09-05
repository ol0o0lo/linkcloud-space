from django.contrib import admin

from apps.allocation.models import AccrualEntry, AllocationItem, AllocationRequest, AllocationShare


class ReadOnlyAdminMixin:
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class AllocationItemInline(admin.TabularInline):
    model = AllocationItem
    extra = 0
    can_delete = False
    readonly_fields = ("name", "effect", "amount", "sort_order", "remark")

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class AllocationShareInline(admin.TabularInline):
    model = AllocationShare
    extra = 0
    can_delete = False
    readonly_fields = ("beneficiary_user", "beneficiary_name_snapshot", "weight_bp", "attributed_basis_amount", "allocated_amount", "sort_order", "remark")

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(AllocationRequest)
class AllocationRequestAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "organization", "status", "basis_amount", "distributable_amount", "submitted_by", "submitted_at", "expires_at")
    list_filter = ("organization", "status", "distribution_method")
    search_fields = ("submitted_by__username", "submitted_by_name_snapshot")
    readonly_fields = tuple(field.name for field in AllocationRequest._meta.fields)
    inlines = (AllocationItemInline, AllocationShareInline)


@admin.register(AccrualEntry)
class AccrualEntryAdmin(ReadOnlyAdminMixin, admin.ModelAdmin):
    list_display = ("id", "organization", "beneficiary_user", "entry_type", "amount", "effective_month", "created_at")
    list_filter = ("organization", "entry_type", "effective_month")
    search_fields = ("beneficiary_user__username", "beneficiary_name_snapshot", "reason")
    readonly_fields = tuple(field.name for field in AccrualEntry._meta.fields)
