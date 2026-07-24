from django.contrib import admin

from apps.team_operations.models import AnnouncementReceipt, TaskAssignment, TeamAnnouncement, WorkTask


@admin.register(TeamAnnouncement)
class TeamAnnouncementAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "team", "status", "require_acknowledgement", "published_at", "created_at")
    list_filter = ("organization", "team", "status", "require_acknowledgement")
    search_fields = ("title", "body")
    raw_id_fields = ("organization", "team", "published_by")


@admin.register(AnnouncementReceipt)
class AnnouncementReceiptAdmin(admin.ModelAdmin):
    list_display = ("announcement", "recipient", "acknowledged_at", "created_at")
    list_filter = ("announcement__organization", "acknowledged_at")
    search_fields = ("announcement__title", "recipient__username")
    autocomplete_fields = ("announcement", "recipient")


@admin.register(WorkTask)
class WorkTaskAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "team", "priority", "status", "due_at", "creator", "created_at")
    list_filter = ("organization", "team", "priority", "status")
    search_fields = ("title", "description")
    raw_id_fields = ("organization", "team", "creator")


@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ("task", "assignee", "status", "accepted_at", "completed_at", "created_at")
    list_filter = ("task__organization", "status")
    search_fields = ("task__title", "assignee__username")
    autocomplete_fields = ("task", "assignee")
