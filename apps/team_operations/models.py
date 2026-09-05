from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.base.mixins import BaseModelMixin, CreateUpdateTimeModelMixin
from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, TaskPriority, WorkTaskStatus


class TeamAnnouncement(BaseModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="team_announcements", verbose_name="所属组织")
    team = models.ForeignKey("teams.Team", null=True, blank=True, on_delete=models.SET_NULL, related_name="announcements", verbose_name="团队")
    title = models.CharField(max_length=255, verbose_name="标题")
    body = models.TextField(verbose_name="正文")
    status = models.CharField(max_length=20, choices=AnnouncementStatus.choices, default=AnnouncementStatus.DRAFT, verbose_name="状态")
    require_acknowledgement = models.BooleanField(default=False, verbose_name="是否要求确认")
    published_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="published_team_announcements", verbose_name="发布人")
    published_at = models.DateTimeField(null=True, blank=True, verbose_name="发布时间")
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name="过期时间")

    class Meta:
        verbose_name = "团队公告"
        verbose_name_plural = "团队公告"
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
    announcement = models.ForeignKey(TeamAnnouncement, on_delete=models.CASCADE, related_name="receipts", verbose_name="公告")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="announcement_receipts", verbose_name="接收人")
    acknowledged_at = models.DateTimeField(null=True, blank=True, verbose_name="确认时间")

    class Meta:
        verbose_name = "公告接收记录"
        verbose_name_plural = "公告接收记录"
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
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="work_tasks", verbose_name="所属组织")
    team = models.ForeignKey("teams.Team", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_tasks", verbose_name="团队")
    title = models.CharField(max_length=255, verbose_name="标题")
    description = models.TextField(blank=True, verbose_name="描述")
    task_type = models.CharField(max_length=64, default="general", verbose_name="任务类型")
    priority = models.CharField(max_length=20, choices=TaskPriority.choices, default=TaskPriority.NORMAL, verbose_name="优先级")
    status = models.CharField(max_length=20, choices=WorkTaskStatus.choices, default=WorkTaskStatus.ACTIVE, verbose_name="状态")
    due_at = models.DateTimeField(null=True, blank=True, verbose_name="截止时间")
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="created_work_tasks", verbose_name="创建人")
    url = models.CharField(max_length=500, blank=True, default="", verbose_name="链接地址")
    data = models.JSONField(default=dict, blank=True, verbose_name="扩展数据")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="完成时间")
    cancelled_at = models.DateTimeField(null=True, blank=True, verbose_name="取消时间")

    class Meta:
        verbose_name = "工作任务"
        verbose_name_plural = "工作任务"
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
    task = models.ForeignKey(WorkTask, on_delete=models.CASCADE, related_name="assignments", verbose_name="任务")
    assignee = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_assignments", verbose_name="执行人")
    status = models.CharField(max_length=20, choices=TaskAssignmentStatus.choices, default=TaskAssignmentStatus.PENDING, verbose_name="状态")
    accepted_at = models.DateTimeField(null=True, blank=True, verbose_name="接受时间")
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name="完成时间")
    rejected_at = models.DateTimeField(null=True, blank=True, verbose_name="拒绝时间")
    result = models.TextField(blank=True, verbose_name="处理结果")

    class Meta:
        verbose_name = "任务分配"
        verbose_name_plural = "任务分配"
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
