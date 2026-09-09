from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AccountMerge, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (("手机号", {"fields": ("phone_country_code", "phone_national_number", "phone_verified")}),)
    list_display = ("username", "email", "phone", "phone_verified", "is_staff")
    search_fields = ("username", "email", "phone_country_code", "phone_national_number")


@admin.register(AccountMerge)
class AccountMergeAdmin(admin.ModelAdmin):
    list_display = ("source_user", "target_user", "identity_provider", "trigger", "merged_at")
    search_fields = ("source_user__username", "target_user__username")
    readonly_fields = ("source_user", "target_user", "reason", "identity_provider", "trigger", "migration_summary", "merged_at")
