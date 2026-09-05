from datetime import timedelta

from django.core.exceptions import PermissionDenied
from django.db.models import BooleanField, Case, Count, Exists, F, IntegerField, OuterRef, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import TeamOperationsPermission
from apps.access.models import TeamGroupBinding
from apps.access.permissions import require_org_permission, require_team_permission
from apps.access.services import has_permission
from apps.accounts.models import User
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.organizations.models import OrganizationMember
from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, TaskPriority, WorkTaskStatus
from apps.team_operations.models import AnnouncementReceipt, TaskAssignment, TeamAnnouncement, WorkTask
from apps.team_operations.schemas import (
    AnnouncementIn,
    AnnouncementOut,
    AnnouncementReceiptOut,
    DailyDashboardOut,
    TaskActionIn,
    TaskAssignmentOut,
    TaskAssignmentSummaryOut,
    TeamOperationsCapabilitiesOut,
    UserSummaryOut,
    WorkTaskIn,
    WorkTaskOut,
    WorkTaskSummaryOut,
)
from apps.team_operations.services import (
    TeamOperationsError,
    acknowledge_announcement,
    cancel_work_task,
    create_work_task,
    daily_dashboard,
    publish_announcement,
    transition_assignment,
    withdraw_announcement,
)
from apps.teams.models import Team

router = Router(tags=["团队运营"])


def _current_org(request):
    org = require_org_selected(request)
    if not OrganizationMember.objects.filter(organization=org, user=request.user).exists():
        raise PermissionDenied("你已不是当前所选组织的成员。")
    return org


def _managed_team_ids(user, org, permission_key: str) -> list[int] | None:
    if has_permission(user, org, permission_key):
        return None
    app_label, codename = permission_key.split(".", 1)
    return list(
        TeamGroupBinding.objects.filter(
            team__organization=org,
            team__members=user,
            user=user,
            group__access_role__is_active=True,
            group__permissions__content_type__app_label=app_label,
            group__permissions__codename=codename,
        )
        .values_list("team_id", flat=True)
        .distinct()
        .order_by("team_id")
    )


def _annotate_can_manage(qs, managed_team_ids: list[int] | None):
    if managed_team_ids is None:
        return qs.annotate(can_manage=Value(True, output_field=BooleanField()))
    if not managed_team_ids:
        return qs.annotate(can_manage=Value(False, output_field=BooleanField()))
    return qs.annotate(
        can_manage=Case(
            When(team_id__in=managed_team_ids, then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        )
    )


def _require_scope_permission(request, team: Team | None, permission_key: str):
    if team is None:
        return require_org_permission(request, permission_key)
    return require_team_permission(request, team.pk, permission_key)


def _team_for_payload(org, team_id: int | None) -> Team | None:
    if team_id is None:
        return None
    return get_object_or_404(Team, pk=team_id, organization=org)


def _announcement_qs(request):
    org = _current_org(request)
    receipt_qs = AnnouncementReceipt.objects.filter(announcement_id=OuterRef("pk"), recipient=request.user)
    qs = (
        TeamAnnouncement.objects.filter(organization=org)
        .select_related("team", "published_by")
        .annotate(
            is_recipient=Exists(receipt_qs),
            is_acknowledged=Exists(receipt_qs.filter(acknowledged_at__isnull=False)),
            recipient_count=Count("receipts", distinct=True),
            acknowledged_count=Count("receipts", filter=Q(receipts__acknowledged_at__isnull=False), distinct=True),
        )
    )
    managed_team_ids = _managed_team_ids(request.user, org, TeamOperationsPermission.ANNOUNCEMENT_MANAGE)
    qs = _annotate_can_manage(qs, managed_team_ids)
    if managed_team_ids is None:
        return qs
    visible_published = Q(status=AnnouncementStatus.PUBLISHED, receipts__recipient=request.user)
    return qs.filter(visible_published | Q(team_id__in=managed_team_ids)).distinct()


@router.get("/announcements/", response=list[AnnouncementOut], summary="获取团队公告列表")
@paginate(LegacyPagination)
def list_announcements(
    request,
    team_id: int | None = Query(None),
    status: str | None = Query(None),
    keyword: str | None = Query(None),
):
    qs = _announcement_qs(request)
    if team_id is not None:
        qs = qs.filter(team_id=team_id)
    if status:
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(Q(title__icontains=keyword) | Q(body__icontains=keyword))
    return qs.order_by("-created_at")


@router.post("/announcements/", response={201: AnnouncementOut}, summary="创建团队公告")
def create_announcement(request, payload: AnnouncementIn):
    org = _current_org(request)
    team = _team_for_payload(org, payload.team_id)
    _require_scope_permission(request, team, TeamOperationsPermission.ANNOUNCEMENT_MANAGE)
    announcement = TeamAnnouncement.objects.create(
        organization=org,
        team=team,
        title=payload.title,
        body=payload.body,
        require_acknowledgement=payload.require_acknowledgement,
        expires_at=payload.expires_at,
        created_by=request.user.username,
        updated_by=request.user.username,
    )
    return Status(201, announcement)


@router.get("/announcements/{announcement_id}/", response=AnnouncementOut, summary="获取团队公告详情")
def get_announcement(request, announcement_id: int):
    return get_object_or_404(_announcement_qs(request), pk=announcement_id)


def _require_announcement_manage(request, announcement: TeamAnnouncement) -> None:
    _require_scope_permission(request, announcement.team, TeamOperationsPermission.ANNOUNCEMENT_MANAGE)


@router.post("/announcements/{announcement_id}/publish/", response=AnnouncementOut, summary="发布团队公告")
def publish_announcement_endpoint(request, announcement_id: int):
    announcement = get_object_or_404(TeamAnnouncement.objects.select_related("organization", "team"), pk=announcement_id, organization=_current_org(request))
    _require_announcement_manage(request, announcement)
    try:
        publish_announcement(announcement, actor=request.user)
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc
    return get_object_or_404(_announcement_qs(request), pk=announcement_id)


@router.post("/announcements/{announcement_id}/withdraw/", response=AnnouncementOut, summary="撤回团队公告")
def withdraw_announcement_endpoint(request, announcement_id: int):
    announcement = get_object_or_404(TeamAnnouncement.objects.select_related("team"), pk=announcement_id, organization=_current_org(request))
    _require_announcement_manage(request, announcement)
    try:
        withdraw_announcement(announcement, actor=request.user)
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc
    return get_object_or_404(_announcement_qs(request), pk=announcement_id)


@router.post("/announcements/{announcement_id}/acknowledge/", response=AnnouncementReceiptOut, summary="确认团队公告")
def acknowledge_announcement_endpoint(request, announcement_id: int):
    announcement = get_object_or_404(_announcement_qs(request), pk=announcement_id)
    try:
        return acknowledge_announcement(announcement, user=request.user)
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc


def _task_qs(request):
    org = _current_org(request)
    qs = WorkTask.objects.filter(organization=org).select_related("team", "creator").prefetch_related("assignments__assignee", "assignments__task__team")
    managed_team_ids = _managed_team_ids(request.user, org, TeamOperationsPermission.TASK_MANAGE)
    qs = _annotate_can_manage(qs, managed_team_ids)
    if managed_team_ids is None:
        return qs
    return qs.filter(Q(team_id__in=managed_team_ids) | Q(assignments__assignee=request.user) | Q(creator=request.user)).distinct()


def _filter_task_dimensions(qs, *, team_id: int | None = None, priority: str | None = None, keyword: str | None = None):
    if team_id is not None:
        qs = qs.filter(team_id=team_id)
    if priority:
        qs = qs.filter(priority=priority)
    if keyword:
        qs = qs.filter(Q(title__icontains=keyword) | Q(description__icontains=keyword))
    return qs


def _filter_task_due_state(qs, due_state: str | None):
    if not due_state:
        return qs
    now = timezone.now()
    if due_state == "due_soon":
        return qs.filter(status=WorkTaskStatus.ACTIVE, due_at__gt=now, due_at__lte=now + timedelta(hours=24))
    if due_state == "overdue":
        return qs.filter(status=WorkTaskStatus.ACTIVE, due_at__lt=now)
    raise HttpError(422, "不支持的截止状态。")


@router.get("/tasks/", response=list[WorkTaskOut], summary="获取团队任务列表")
@paginate(LegacyPagination)
def list_tasks(
    request,
    team_id: int | None = Query(None),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    keyword: str | None = Query(None),
    due_state: str | None = Query(None),
    mine: bool | None = Query(None),
):
    qs = _filter_task_dimensions(_task_qs(request), team_id=team_id, priority=priority, keyword=keyword)
    if status:
        qs = qs.filter(status=status)
    qs = _filter_task_due_state(qs, due_state)
    if mine:
        qs = qs.filter(assignments__assignee=request.user)
    return qs.order_by("-created_at").distinct()


@router.get("/tasks/summary/", response=WorkTaskSummaryOut, summary="获取团队任务统计")
def get_task_summary(
    request,
    team_id: int | None = Query(None),
    priority: str | None = Query(None),
    keyword: str | None = Query(None),
):
    now = timezone.now()
    due_soon_at = now + timedelta(hours=24)
    qs = _filter_task_dimensions(_task_qs(request), team_id=team_id, priority=priority, keyword=keyword)
    return qs.aggregate(
        total=Count("pk", distinct=True),
        active=Count("pk", filter=Q(status=WorkTaskStatus.ACTIVE), distinct=True),
        due_soon=Count(
            "pk",
            filter=Q(status=WorkTaskStatus.ACTIVE, due_at__gt=now, due_at__lte=due_soon_at),
            distinct=True,
        ),
        overdue=Count("pk", filter=Q(status=WorkTaskStatus.ACTIVE, due_at__lt=now), distinct=True),
    )


@router.get("/capabilities/", response=TeamOperationsCapabilitiesOut, summary="获取团队运营权限范围")
def get_capabilities(request):
    org = _current_org(request)
    announcement_team_ids = _managed_team_ids(request.user, org, TeamOperationsPermission.ANNOUNCEMENT_MANAGE)
    task_team_ids = _managed_team_ids(request.user, org, TeamOperationsPermission.TASK_MANAGE)
    return {
        "announcement_organization_manage": announcement_team_ids is None,
        "announcement_team_ids": announcement_team_ids or [],
        "task_organization_manage": task_team_ids is None,
        "task_team_ids": task_team_ids or [],
    }


@router.get("/task-assignees/", response=list[UserSummaryOut], summary="获取可分配任务的成员")
@paginate(LegacyPagination)
def list_task_assignees(
    request,
    team_id: int | None = Query(None),
    keyword: str | None = Query(None),
):
    org = _current_org(request)
    team = _team_for_payload(org, team_id)
    _require_scope_permission(request, team, TeamOperationsPermission.TASK_MANAGE)
    qs = User.objects.filter(is_active=True, organizationmember__organization=org)
    if team is not None:
        qs = qs.filter(teams=team)
    if keyword:
        qs = qs.filter(Q(username__icontains=keyword) | Q(first_name__icontains=keyword) | Q(last_name__icontains=keyword) | Q(email__icontains=keyword))
    return qs.distinct().order_by("username", "pk")


def _validate_assignees(org, team: Team | None, assignee_ids: list[int]) -> list[User]:
    assignee_ids = list(dict.fromkeys(assignee_ids))
    users = list(
        User.objects.filter(
            pk__in=assignee_ids,
            is_active=True,
            organizationmember__organization=org,
        )
        .distinct()
        .order_by("pk")
    )
    found_ids = {user.pk for user in users}
    missing = sorted(set(assignee_ids) - found_ids)
    if missing:
        raise HttpError(422, f"以下执行人不属于当前组织：{missing}")
    if team is not None:
        team_user_ids = set(team.members.filter(pk__in=assignee_ids).values_list("pk", flat=True))
        missing_team_ids = sorted(set(assignee_ids) - team_user_ids)
        if missing_team_ids:
            raise HttpError(422, f"以下执行人不属于所选团队：{missing_team_ids}")
    return users


@router.post("/tasks/", response={201: WorkTaskOut}, summary="创建团队任务")
def create_task(request, payload: WorkTaskIn):
    org = _current_org(request)
    team = _team_for_payload(org, payload.team_id)
    _require_scope_permission(request, team, TeamOperationsPermission.TASK_MANAGE)
    assignees = _validate_assignees(org, team, payload.assignee_ids)
    try:
        task = create_work_task(
            organization=org,
            actor=request.user,
            assignees=assignees,
            team=team,
            title=payload.title,
            description=payload.description,
            task_type=payload.task_type,
            priority=payload.priority,
            due_at=payload.due_at,
            url=payload.url,
            data=payload.data,
        )
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc
    return Status(201, WorkTask.objects.select_related("team", "creator").prefetch_related("assignments__assignee").get(pk=task.pk))


@router.get("/tasks/{task_id}/", response=WorkTaskOut, summary="获取团队任务详情")
def get_task(request, task_id: int):
    return get_object_or_404(_task_qs(request), pk=task_id)


def _require_task_manage(request, task: WorkTask) -> None:
    _require_scope_permission(request, task.team, TeamOperationsPermission.TASK_MANAGE)


@router.post("/tasks/{task_id}/cancel/", response=WorkTaskOut, summary="取消团队任务")
def cancel_task(request, task_id: int):
    task = get_object_or_404(WorkTask.objects.select_related("team"), pk=task_id, organization=_current_org(request))
    _require_task_manage(request, task)
    try:
        return cancel_work_task(task, actor=request.user)
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc


@router.get("/task-assignments/", response=list[TaskAssignmentOut], summary="获取我的任务分配列表")
@paginate(LegacyPagination)
def list_task_assignments(
    request,
    status: str | None = Query(None),
    team_id: int | None = Query(None),
    priority: str | None = Query(None),
    keyword: str | None = Query(None),
    due_state: str | None = Query(None),
    overdue: bool | None = Query(None),
):
    qs = _filter_assignment_dimensions(
        _assignment_qs(request),
        team_id=team_id,
        priority=priority,
        keyword=keyword,
    )
    if status:
        qs = qs.filter(status=status)
    if overdue:
        qs = qs.filter(status__in=(TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS), task__due_at__lt=timezone.now())
    qs = _filter_assignment_due_state(qs, due_state)
    now = timezone.now()
    return qs.annotate(
        overdue_order=Case(
            When(status__in=(TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS), task__due_at__lt=now, then=Value(0)),
            default=Value(1),
            output_field=IntegerField(),
        ),
        priority_order=Case(
            When(task__priority=TaskPriority.URGENT, then=Value(0)),
            When(task__priority=TaskPriority.HIGH, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        ),
    ).order_by("overdue_order", F("task__due_at").asc(nulls_last=True), "priority_order", "-created_at")


def _assignment_qs(request):
    org = _current_org(request)
    return TaskAssignment.objects.filter(task__organization=org, assignee=request.user).select_related("task", "task__team", "task__creator", "assignee")


def _filter_assignment_dimensions(qs, *, team_id: int | None = None, priority: str | None = None, keyword: str | None = None):
    if team_id is not None:
        qs = qs.filter(task__team_id=team_id)
    if priority:
        qs = qs.filter(task__priority=priority)
    if keyword:
        qs = qs.filter(Q(task__title__icontains=keyword) | Q(task__description__icontains=keyword))
    return qs


def _filter_assignment_due_state(qs, due_state: str | None):
    if not due_state:
        return qs
    open_statuses = (TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS)
    now = timezone.now()
    if due_state == "due_soon":
        return qs.filter(status__in=open_statuses, task__due_at__gt=now, task__due_at__lte=now + timedelta(hours=24))
    if due_state == "overdue":
        return qs.filter(status__in=open_statuses, task__due_at__lt=now)
    raise HttpError(422, "不支持的截止状态。")


@router.get("/task-assignments/summary/", response=TaskAssignmentSummaryOut, summary="获取我的任务统计")
def get_task_assignment_summary(
    request,
    team_id: int | None = Query(None),
    priority: str | None = Query(None),
    keyword: str | None = Query(None),
):
    now = timezone.now()
    due_soon_at = now + timedelta(hours=24)
    open_statuses = (TaskAssignmentStatus.PENDING, TaskAssignmentStatus.IN_PROGRESS)
    qs = _filter_assignment_dimensions(_assignment_qs(request), team_id=team_id, priority=priority, keyword=keyword)
    return qs.aggregate(
        pending=Count("pk", filter=Q(status=TaskAssignmentStatus.PENDING)),
        in_progress=Count("pk", filter=Q(status=TaskAssignmentStatus.IN_PROGRESS)),
        due_soon=Count("pk", filter=Q(status__in=open_statuses, task__due_at__gt=now, task__due_at__lte=due_soon_at)),
        overdue=Count("pk", filter=Q(status__in=open_statuses, task__due_at__lt=now)),
    )


def _assignment_for_user(request, assignment_id: int) -> TaskAssignment:
    org = _current_org(request)
    return get_object_or_404(
        TaskAssignment.objects.select_related("task__organization", "task__team", "task__creator", "assignee"),
        pk=assignment_id,
        task__organization=org,
        assignee=request.user,
    )


@router.get("/task-assignments/{assignment_id}/", response=TaskAssignmentOut, summary="获取我的任务分配详情")
def get_task_assignment(request, assignment_id: int):
    return _assignment_for_user(request, assignment_id)


def _transition(request, assignment_id: int, action: str, payload: TaskActionIn):
    assignment = _assignment_for_user(request, assignment_id)
    try:
        return transition_assignment(assignment, actor=request.user, action=action, result=payload.result)
    except TeamOperationsError as exc:
        raise HttpError(422, str(exc)) from exc


@router.post("/task-assignments/{assignment_id}/accept/", response=TaskAssignmentOut, summary="接受任务")
def accept_task_assignment(request, assignment_id: int, payload: TaskActionIn):
    return _transition(request, assignment_id, "accept", payload)


@router.post("/task-assignments/{assignment_id}/complete/", response=TaskAssignmentOut, summary="完成任务")
def complete_task_assignment(request, assignment_id: int, payload: TaskActionIn):
    return _transition(request, assignment_id, "complete", payload)


@router.post("/task-assignments/{assignment_id}/reject/", response=TaskAssignmentOut, summary="拒绝任务")
def reject_task_assignment(request, assignment_id: int, payload: TaskActionIn):
    return _transition(request, assignment_id, "reject", payload)


@router.get("/dashboard/daily/", response=DailyDashboardOut, summary="获取个人日常任务看板")
def get_daily_dashboard(request):
    org = _current_org(request)
    return daily_dashboard(organization=org, user=request.user)
