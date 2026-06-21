from django.contrib import admin

from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting


@admin.register(DefaultSetting)
class DefaultSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "label", "value_type", "widget", "description", "updated_at")
    search_fields = ("key", "label", "description")
    readonly_fields = ("created_at", "updated_at", "created_by", "updated_by")

    def save_model(self, request, obj, form, change):
        username = request.user.get_username()
        if not change:
            obj.created_by = username
        obj.updated_by = username
        super().save_model(request, obj, form, change)


@admin.register(OrganizationSetting)
class OrganizationSettingAdmin(admin.ModelAdmin):
    list_display = ("organization", "setting", "updated_at")
    list_select_related = ("organization", "setting")
    search_fields = ("organization__name", "setting__key")


@admin.register(TeamSetting)
class TeamSettingAdmin(admin.ModelAdmin):
    list_display = ("team", "setting", "updated_at")
    list_select_related = ("team", "setting")


@admin.register(UserSetting)
class UserSettingAdmin(admin.ModelAdmin):
    list_display = ("user", "key", "updated_at")
    search_fields = ("user__username", "key")
