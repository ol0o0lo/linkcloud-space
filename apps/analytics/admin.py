from django.contrib import admin

from apps.analytics.models import AnalyticsEvent


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("event_name", "target_type", "target_id", "organization", "source", "occurred_at")
    list_filter = ("event_name", "target_type", "source")
    search_fields = ("target_id", "visitor_key", "idempotency_key")
    readonly_fields = tuple(field.name for field in AnalyticsEvent._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
