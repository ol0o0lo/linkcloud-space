import logging

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Case, Count, F, IntegerField, Q, Value, When
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.organizations.models import OrganizationMember
from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, TaskPriority, WorkTaskStatus
from apps.team_operations.models import AnnouncementReceipt, TaskAssignment, TeamAnnouncement, WorkTask

logger = logging.getLogger(__name__)

ANNOUNCEMENT_CATEGORY = "team.announcement"
TASK_ASSIGNED_CATEGORY = "team.task.assigned"
TASK_COMPLETED_CATEGORY = "team.task.completed"
TASK_REJECTED_CATEGORY = "team.task.rejected"
TASK_CANCELLED_CATEGORY = "team.task.cancelled"


class TeamOperationsError(ValueError):
    pass


def _announcement_users(announcement: TeamAnnouncement):
    if announcement.team_id:
        return list(
            announcement.team.members.filter(
                is_active=True,
                organizationmember__organization=announcement.organization,
            )
            .distinct()
            .order_by("pk")
        )
    return [
        membership.user for membership in OrganizationMember.objects.filter(organization=announcement.organization, user__is_active=True).select_related("user").order_by("user_id")
    ]


def _safe_notify(*args, **kwargs) -> list[Notification]:
    try:
        return notify(*args, **kwargs)
    except Exception:
        logger.exception("团队运营业务已保存，但通知投递失败。")
        return []


def publish_announcement(announcement: TeamAnnouncement, *, actor) -> TeamAnnouncement:
    with transaction.atomic():
        announcement = TeamAnnouncement.objects.select_for_update().get(pk=announcement.pk)
        if announcement.status == AnnouncementStatus.PUBLISHED:
            return announcement
        if announcement.status == AnnouncementStatus.WITHDRAWN:
            raise TeamOperationsError("已撤回公告不能再次发布。")

        recipients = _announcement_users(announcement)
        published_at = timezone.now()
        if announcement.expires_at and announcement.expires_at <= published_at:
            raise TeamOperationsError("公告过期时间必须晚于发布时间。")

        announcement.status = AnnouncementStatus.PUBLISHED
        announcement.published_by = actor
        announcement.published_at = published_at
        announcement.updated_by = actor.username
        announcement.save(update_fields=["status", "published_by", "published_at", "updated_by", "updated_at"])
        AnnouncementReceipt.objects.bulk_create(
            [AnnouncementReceipt(announcement=announcement, recipient=recipient) for recipient in recipients],
            ignore_conflicts=True,
        )

    _safe_notify(
        recipients,
        title=announcement.title,
        body=announcement.body,
        organization=announcement.organization,
        actor=actor,
        target=announcement,
        category=ANNOUNCEMENT_CATEGORY,
        url=f"/dashboard/rental/workbench/announcements?announcement_id={announcement.pk}",
        data={
            "kind": "announcement",
            "announcement_id": announcement.pk,
            "require_acknowledgement": announcement.require_acknowledgement,
        },
        expires_at=announcement.expires_at,
    )
    return announcement


def withdraw_announcement(announcement: TeamAnnouncement, *, actor) -> TeamAnnouncement:
    with transaction.atomic():
        announcement = TeamAnnouncement.objects.select_for_update().select_related("organization").get(pk=announcement.pk)
        if announcement.status == AnnouncementStatus.WITHDRAWN:
            return announcement
        if announcement.status != AnnouncementStatus.PUBLISHED:
            raise TeamOperationsError("只有已发布公告可以撤回。")
        withdrawn_at = timezone.now()
        announcement.status = AnnouncementStatus.WITHDRAWN
        announcement.updated_by = actor.username
        announcement.save(update_fields=["status", "updated_by", "updated_at"])
        content_type = ContentType.objects.get_for_model(announcement)
        Notification.objects.filter(
            organization=announcement.organization,
            target_content_type=content_type,
            target_object_id=announcement.pk,
        ).update(
            actor=actor,
            title="团队公告已撤回",
            body="",
            url=None,
            data={"kind": "announcement", "announcement_id": announcement.pk, "withdrawn": True},
            read_at=withdrawn_at,
            updated_at=withdrawn_at,
        )
        return announcement


def acknowledge_announcement(announcement: TeamAnnouncement, *, user) -> AnnouncementReceipt:
    with transaction.atomic():
        announcement = TeamAnnouncement.objects.select_for_update().select_related("organization").get(pk=announcement.pk)
        if announcement.status != AnnouncementStatus.PUBLISHED:
            raise TeamOperationsError("只能确认已发布公告。")
        if announcement.is_expired:
            raise TeamOperationsError("公告已过期。")
        if not announcement.require_acknowledgement:
            raise TeamOperationsError("该公告无需确认。")

        receipt = AnnouncementReceipt.objects.select_for_update().filter(announcement=announcement, recipient=user).first()
        if receipt is None:
            raise TeamOperationsError("您不是该公告的接收人。")
        acknowledged_at = timezone.now()
        if receipt.acknowledged_at is None:
            receipt.acknowledged_at = acknowledged_at
            receipt.save(update_fields=["acknowledged_at", "updated_at"])

        content_type = ContentType.objects.get_for_model(announcement)
        Notification.objects.filter(
            recipient=user,
            organization=announcement.organization,
            target_content_type=content_type,
            target_object_id=announcement.pk,
            read_at__isnull=True,
        ).update(read_at=acknowledged_at)
    return receipt


def create_work_task(
    *,
    organization,
    actor,
    assignees,
    team=None,
    title: str,
    description: str = "",
    task_type: str = "general",
    priority: str = "normal",
    due_at=None,
    url: str = "",
    data: dict | None = None,
) -> WorkTask:
    assignees = list(dict.fromkeys(assignees))
    if not assignees:
        raise TeamOperationsError("至少需要一名任务执行人。")

    with transaction.atomic():
        task = WorkTask.objects.create(
            organization=organization,
            team=team,
            title=title,
            description=description,
            task_type=task_type,
            priority=priority,
            due_at=due_at,
            creator=actor,
            url=url,
            data=data or {},
            created_by=actor.username,
            updated_by=actor.username,
        )
        assignments = [TaskAssignment.objects.create(task=task, assignee=assignee) for assignee in assignees]

    for assignment in assignments:
        _mark_assignment_notification_read(assignment)
        _safe_notify(
            [assignment.assignee],
            title=f"新任务：{task.title}",
            body=task.description,
            organization=organization,
            actor=actor,
            target=assignment,
            category=TASK_ASSIGNED_CATEGORY,
            url=task.url or f"/dashboard/rental/workbench/tasks?assignment_id={assignment.pk}",
            data={
                "kind": "task",
                "task_id": task.pk,
                "assignment_id": assignment.pk,
                "priority": task.priority,
                "due_at": task.due_at.isoformat() if task.due_at else None,
            },
        )
    return task


def _mark_assignment_notification_read(assignment: TaskAssignment) -> None:
    content_type = ContentType.objects.get_for_model(assignment)
    Notification.objects.filter(
        recipient=assignment.assignee,
        organization=assignment.task.organization,
        target_content_type=content_type,
        target_object_id=assignment.pk,
        read_at__isnull=True,
    ).update(read_at=timezone.now())


def _notify_task_creator(assignment: TaskAssignment, *, actor, category: str, title: str) -> None:
    creator = assignment.task.creator
    if creator is None or creator.pk == actor.pk:
        return
    _safe_notify(
        [creator],
        title=title,
        body=f"{actor.get_full_name() or actor.username}：{assignment.task.title}",
        organization=assignment.task.organization,
        actor=actor,
        target=assignment,
        category=category,
        url=f"/dashboard/rental/workbench/tasks?task_id={assignment.task_id}",
        data={"kind": "task", "task_id": assignment.task_id, "assignment_id": assignment.pk},
    )


def transition_assignment(assignment: TaskAssignment, *, actor, action: str, result: str = "") -> TaskAssignment:
    with transaction.atomic():
        task_id = TaskAssignment.objects.only("task_id").get(pk=assignment.pk).task_id
        task = WorkTask.objects.select_for_update().select_related("organization").get(pk=task_id)
        assignment = TaskAssignment.objects.select_for_update().select_related("assignee").get(pk=assignment.pk)
        assignment.task = task
        if assignment.assignee_id != actor.pk:
            raise TeamOperationsError("只能处理分配给自己的任务。")
        now = timezone.now()
        if action == "accept":
            if assignment.status != TaskAssignmentStatus.PENDING:
                raise TeamOperationsError("只有待接受任务可以接受。")
            assignment.status = TaskAssignmentStatus.IN_PROGRESS
            assignment.accepted_at = now
            update_fields = ["status", "accepted_at", "updated_at"]
        elif action == "complete":
            if assignment.status != TaskAssignmentStatus.IN_PROGRESS:
                raise TeamOperationsError("只有进行中的任务可以完成。")
            assignment.status = TaskAssignmentStatus.COMPLETED
            assignment.completed_at = now
            assignment.result = result
            update_fields = ["status", "completed_at", "result", "updated_at"]
        elif action == "reject":
            if assignment.status != TaskAssignmentStatus.PENDING:
                raise TeamOperationsError("只有待接受任务可以拒绝。")
            assignment.status = TaskAssignmentStatus.REJECTED
            assignment.rejected_at = now
            assignment.result = result
            update_fields = ["status", "rejected_at", "result", "updated_at"]
        else:
            raise TeamOperationsError("不支持的任务操作。")
        assignment.save(update_fields=update_fields)

        if action == "complete" and not task.assignments.exclude(status=TaskAssignmentStatus.COMPLETED).exists():
            task.status = WorkTaskStatus.COMPLETED
            task.completed_at = now
            task.updated_by = actor.username
            task.save(update_fields=["status", "completed_at", "updated_by", "updated_at"])

    _mark_assignment_notification_read(assignment)
    if action == "complete":
        _notify_task_creator(assignment, actor=actor, category=TASK_COMPLETED_CATEGORY, title="任务已完成")
    elif action == "reject":
        _notify_task_creator(assignment, actor=actor, category=TASK_REJECTED_CATEGORY, title="任务已拒绝")
    return assignment


def cancel_work_task(task: WorkTask, *, actor) -> WorkTask:
    with transaction.atomic():
        task = WorkTask.objects.select_for_update().select_related("organization").get(pk=task.pk)
        if task.status == WorkTaskStatus.CANCELLED:
            return task
        if task.status == WorkTaskStatus.COMPLETED:
            raise TeamOperationsError("已完成任务不能取消。")
        cancelled_at = timezone.now()
        task.status = WorkTaskStatus.CANCELLED
        task.cancelled_at = cancelled_at
        task.updated_by = actor.username
        task.save(update_fields=["status", "cancelled_at", "updated_by", "updated_at"])
        assignments = list(task.assignments.filter(status__in=(TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS)).select_related("assignee"))
        task.assignments.filter(pk__in=[item.pk for item in assignments]).update(status=TaskAssignmentStatus.CANCELLED, updated_at=cancelled_at)

    for assignment in assignments:
        _safe_notify(
            [assignment.assignee],
            title=f"任务已取消：{task.title}",
            organization=task.organization,
            actor=actor,
            target=assignment,
            category=TASK_CANCELLED_CATEGORY,
            url=f"/dashboard/rental/workbench/tasks?assignment_id={assignment.pk}",
            data={"kind": "task", "task_id": task.pk, "assignment_id": assignment.pk},
        )
    return task


def daily_dashboard(*, organization, user) -> dict:
    now = timezone.now()
    today = timezone.localdate()
    assignments = TaskAssignment.objects.filter(task__organization=organization, assignee=user).select_related("task", "task__team")
    open_statuses = (TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS)
    priority_order = Case(
        When(task__priority=TaskPriority.URGENT, then=Value(0)),
        When(task__priority=TaskPriority.HIGH, then=Value(1)),
        default=Value(2),
        output_field=IntegerField(),
    )
    urgent_items = list(
        assignments.filter(status__in=open_statuses).annotate(priority_order=priority_order).order_by(F("task__due_at").asc(nulls_last=True), "priority_order", "-created_at")[:5]
    )
    counts = assignments.aggregate(
        pending_acceptance=Count("pk", filter=Q(status=TaskAssignmentStatus.PENDING)),
        in_progress=Count("pk", filter=Q(status=TaskAssignmentStatus.IN_PROGRESS)),
        due_today=Count("pk", filter=Q(status__in=open_statuses, task__due_at__date=today)),
        overdue=Count("pk", filter=Q(status__in=open_statuses, task__due_at__lt=now)),
        completed_today=Count("pk", filter=Q(status=TaskAssignmentStatus.COMPLETED, completed_at__date=today)),
    )
    pending_announcements = AnnouncementReceipt.objects.filter(
        announcement__organization=organization,
        announcement__status=AnnouncementStatus.PUBLISHED,
        announcement__require_acknowledgement=True,
        recipient=user,
        acknowledged_at__isnull=True,
    ).filter(Q(announcement__expires_at__isnull=True) | Q(announcement__expires_at__gt=now))
    return {
        **counts,
        "unacknowledged_announcements": pending_announcements.distinct().count(),
        "urgent_items": urgent_items,
    }
