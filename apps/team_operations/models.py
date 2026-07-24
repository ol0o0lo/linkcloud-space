from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, TaskPriority, WorkTaskStatus


class TeamAnnouncement(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="team_announcements")
    team = models.ForeignKey("teams.Team", null=True, blank=True, on_delete=models.SET_NULL, related_name="announcements")
    title = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=20, choices=AnnouncementStatus.choices, default=AnnouncementStatus.DRAFT)
    require_acknowledgement = models.BooleanField(default=False)
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="published_team_announcements")
    published_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("organization", "status", "-created_at"), name="team_ann_org_status_idx"),
            models.Index(fields=("team", "status", "-created_at"), name="team_ann_team_status_idx"),
        ]

    def clean(self):
        super().clean()
        if self.team_id and self.team.organization_id != self.organization_id:
            raise ValidationError({"team": "公告团队必须属于当前组织。"})
        if self.expires_at and self.published_at and self.expires_at <= self.published_at:
            raise ValidationError({"expires_at": "公告过期时间必须晚于发布时间。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and self.expires_at <= timezone.now())

    def __str__(self):
        """返回公告标题。"""
        return self.title


class AnnouncementReceipt(CreateUpdateTimeModelMixin):
    announcement = models.ForeignKey(TeamAnnouncement, on_delete=models.CASCADE, related_name="receipts")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="announcement_receipts")
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [models.UniqueConstraint(fields=("announcement", "recipient"), name="team_ann_receipt_unique")]
        indexes = [models.Index(fields=("recipient", "acknowledged_at", "-created_at"), name="team_ann_recipient_idx")]

    def clean(self):
        super().clean()
        if self.announcement_id and self.recipient_id:
            from apps.organizations.models import OrganizationMember

            if not OrganizationMember.objects.filter(organization_id=self.announcement.organization_id, user_id=self.recipient_id).exists():
                raise ValidationError({"recipient": "公告接收人必须属于公告组织。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class WorkTask(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="work_tasks")
    team = models.ForeignKey("teams.Team", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_tasks")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    task_type = models.CharField(max_length=64, default="general")
    priority = models.CharField(max_length=20, choices=TaskPriority.choices, default=TaskPriority.NORMAL)
    status = models.CharField(max_length=20, choices=WorkTaskStatus.choices, default=WorkTaskStatus.ACTIVE)
    due_at = models.DateTimeField(null=True, blank=True)
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_work_tasks")
    url = models.CharField(max_length=500, blank=True, default="")
    data = models.JSONField(default=dict, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("organization", "status", "due_at"), name="work_task_org_status_idx"),
            models.Index(fields=("team", "status", "due_at"), name="work_task_team_status_idx"),
        ]

    def clean(self):
        super().clean()
        if self.team_id and self.team.organization_id != self.organization_id:
            raise ValidationError({"team": "任务团队必须属于当前组织。"})
        if not isinstance(self.data, dict):
            raise ValidationError({"data": "任务扩展数据必须是对象。"})

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self):
        """返回任务标题。"""
        return self.title


class TaskAssignment(CreateUpdateTimeModelMixin):
    task = models.ForeignKey(WorkTask, on_delete=models.CASCADE, related_name="assignments")
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_assignments")
    status = models.CharField(max_length=20, choices=TaskAssignmentStatus.choices, default=TaskAssignmentStatus.PENDING)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)
    result = models.TextField(blank=True)

    class Meta:
        ordering = ("task__due_at", "-created_at")
        constraints = [models.UniqueConstraint(fields=("task", "assignee"), name="work_task_assignee_unique")]
        indexes = [models.Index(fields=("assignee", "status", "-created_at"), name="task_assignment_user_idx")]

    def clean(self):
        super().clean()
        if self.task_id and self.assignee_id and self._assignment_scope_changed():
            from apps.organizations.models import OrganizationMember

            if not OrganizationMember.objects.filter(organization_id=self.task.organization_id, user_id=self.assignee_id).exists():
                raise ValidationError({"assignee": "任务执行人必须属于任务组织。"})
            if self.task.team_id and not self.task.team.members.filter(pk=self.assignee_id).exists():
                raise ValidationError({"assignee": "团队任务只能分配给该团队成员。"})

    def _assignment_scope_changed(self) -> bool:
        if self._state.adding or self.pk is None:
            return True
        original = type(self).objects.filter(pk=self.pk).values("task_id", "assignee_id").first()
        return original is None or original["task_id"] != self.task_id or original["assignee_id"] != self.assignee_id

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    @property
    def is_overdue(self) -> bool:
        return bool(self.task.due_at and self.task.due_at < timezone.now() and self.status in {TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS})

    def __str__(self):
        """返回任务与执行人的可读标识。"""
        return f"{self.task} / {self.assignee}"
