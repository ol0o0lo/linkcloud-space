from django.contrib import admin
from django.contrib.auth.models import Group

from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding


@admin.register(AccessRole)
class AccessRoleAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "scope", "organization", "is_system", "is_active")
    list_filter = ("scope", "is_system", "is_active", "organization")
    search_fields = ("name", "code", "group__name")


@admin.register(OrganizationGroupBinding)
class OrganizationGroupBindingAdmin(admin.ModelAdmin):
    list_display = ("organization", "user", "group")
    list_filter = ("organization", "group")
    raw_id_fields = ("organization", "user")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "group":
            kwargs["queryset"] = Group.objects.filter(access_role__scope=AccessRole.Scope.ORG)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(TeamGroupBinding)
class TeamGroupBindingAdmin(admin.ModelAdmin):
    list_display = ("team", "user", "group")
    list_filter = ("team__organization", "group")
    raw_id_fields = ("team", "user")

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "group":
            kwargs["queryset"] = Group.objects.filter(access_role__scope=AccessRole.Scope.TEAM)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)
