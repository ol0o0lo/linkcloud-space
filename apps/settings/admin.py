from django.contrib import admin

from apps.settings.models import DefaultSetting, OrganizationSetting, TeamSetting, UserSetting


@admin.register(DefaultSetting)
class DefaultSettingAdmin(admin.ModelAdmin):
    list_display = ("key", "value_type", "description", "modified")
    search_fields = ("key", "description")
    readonly_fields = ("created", "modified", "updated_by")

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(OrganizationSetting)
class OrganizationSettingAdmin(admin.ModelAdmin):
    list_display = ("organization", "setting", "modified")
    list_select_related = ("organization", "setting")
    search_fields = ("organization__name", "setting__key")


@admin.register(TeamSetting)
class TeamSettingAdmin(admin.ModelAdmin):
    list_display = ("team", "setting", "modified")
    list_select_related = ("team", "setting")


@admin.register(UserSetting)
class UserSettingAdmin(admin.ModelAdmin):
    list_display = ("user", "key", "modified")
    search_fields = ("user__username", "key")
