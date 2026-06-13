from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    fieldsets = BaseUserAdmin.fieldsets + (
        ("手机号", {"fields": ("phone_country_code", "phone_national_number", "phone_verified")}),
    )
    list_display = ("username", "email", "phone", "phone_verified", "is_staff")
    search_fields = ("username", "email", "phone_country_code", "phone_national_number")
