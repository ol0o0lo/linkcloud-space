from datetime import datetime

from ninja import Schema
from pydantic import Field

from apps.team_operations.constants import AnnouncementStatus, TaskAssignmentStatus, TaskPriority, WorkTaskStatus


def _label(enum_cls, value: str) -> str:
    return enum_cls.get_choice_label(value)


class UserSummaryOut(Schema):
    id: int
    username: str
    full_name: str

    @staticmethod
    def resolve_full_name(obj) -> str:
        value = getattr(obj, "full_name", "")
        if value:
            return value
        get_full_name = getattr(obj, "get_full_name", None)
        if get_full_name is None:
            return getattr(obj, "username", "")
        return (get_full_name() or "").strip() or obj.username


class AnnouncementIn(Schema):
    team_id: int | None = Field(None, description="团队 ID；为空时表示整个组织。")
    title: str
    body: str
    require_acknowledgement: bool = False
    expires_at: datetime | None = None


class AnnouncementOut(Schema):
    id: int
    organization_id: int
    team_id: int | None = None
    team_name: str | None = None
    title: str
    body: str
    status: str
    status__mapping: str
    require_acknowledgement: bool
    published_by: UserSummaryOut | None = None
    published_at: datetime | None = None
    expires_at: datetime | None = None
    is_recipient: bool = False
    is_acknowledged: bool = False
    can_manage: bool = False
    recipient_count: int = 0
    acknowledged_count: int = 0
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_team_name(obj) -> str | None:
        return obj.team.name if obj.team_id else None

    @staticmethod
    def resolve_status__mapping(obj) -> str:
        return _label(AnnouncementStatus, obj.status)

    @staticmethod
    def resolve_published_by(obj) -> UserSummaryOut | None:
        if obj.published_by is None:
            return None
        return UserSummaryOut(
            id=obj.published_by_id,
            username=obj.published_by.username,
            full_name=(obj.published_by.get_full_name() or "").strip() or obj.published_by.username,
        )


class AnnouncementReceiptOut(Schema):
    announcement_id: int
    recipient_id: int
    acknowledged_at: datetime | None = None


class TaskAssignmentOut(Schema):
    id: int
    task_id: int
    task_title: str
    task_description: str
    task_type: str
    priority: str
    priority__mapping: str
    task_status: str
    task_status__mapping: str
    team_id: int | None = None
    team_name: str | None = None
    assignee: UserSummaryOut
    status: str
    status__mapping: str
    due_at: datetime | None = None
    is_overdue: bool
    accepted_at: datetime | None = None
    completed_at: datetime | None = None
    rejected_at: datetime | None = None
    result: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_task_title(obj) -> str:
        return obj.task.title

    @staticmethod
    def resolve_task_description(obj) -> str:
        return obj.task.description

    @staticmethod
    def resolve_task_type(obj) -> str:
        return obj.task.task_type

    @staticmethod
    def resolve_priority(obj) -> str:
        return obj.task.priority

    @staticmethod
    def resolve_priority__mapping(obj) -> str:
        return _label(TaskPriority, obj.task.priority)

    @staticmethod
    def resolve_task_status(obj) -> str:
        return obj.task.status

    @staticmethod
    def resolve_task_status__mapping(obj) -> str:
        return _label(WorkTaskStatus, obj.task.status)

    @staticmethod
    def resolve_team_id(obj) -> int | None:
        return obj.task.team_id

    @staticmethod
    def resolve_team_name(obj) -> str | None:
        return obj.task.team.name if obj.task.team_id else None

    @staticmethod
    def resolve_assignee(obj) -> UserSummaryOut:
        return UserSummaryOut(
            id=obj.assignee_id,
            username=obj.assignee.username,
            full_name=(obj.assignee.get_full_name() or "").strip() or obj.assignee.username,
        )

    @staticmethod
    def resolve_status__mapping(obj) -> str:
        return _label(TaskAssignmentStatus, obj.status)

    @staticmethod
    def resolve_due_at(obj) -> datetime | None:
        return obj.task.due_at


class WorkTaskIn(Schema):
    team_id: int | None = Field(None, description="团队 ID；为空时表示组织级任务。")
    title: str
    description: str = ""
    task_type: str = "general"
    priority: str = TaskPriority.NORMAL
    due_at: datetime | None = None
    assignee_ids: list[int] = Field(..., min_length=1)
    url: str = ""
    data: dict = Field(default_factory=dict)


class WorkTaskOut(Schema):
    id: int
    organization_id: int
    team_id: int | None = None
    team_name: str | None = None
    title: str
    description: str
    task_type: str
    priority: str
    priority__mapping: str
    status: str
    status__mapping: str
    due_at: datetime | None = None
    creator: UserSummaryOut | None = None
    url: str
    data: dict
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    can_manage: bool = False
    assignments: list[TaskAssignmentOut] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_team_name(obj) -> str | None:
        return obj.team.name if obj.team_id else None

    @staticmethod
    def resolve_priority__mapping(obj) -> str:
        return _label(TaskPriority, obj.priority)

    @staticmethod
    def resolve_status__mapping(obj) -> str:
        return _label(WorkTaskStatus, obj.status)

    @staticmethod
    def resolve_creator(obj) -> UserSummaryOut | None:
        if obj.creator is None:
            return None
        return UserSummaryOut(
            id=obj.creator_id,
            username=obj.creator.username,
            full_name=(obj.creator.get_full_name() or "").strip() or obj.creator.username,
        )

    @staticmethod
    def resolve_assignments(obj) -> list:
        return list(obj.assignments.all())


class TaskActionIn(Schema):
    result: str = ""


class DailyDashboardOut(Schema):
    pending_acceptance: int
    in_progress: int
    due_today: int
    overdue: int
    completed_today: int
    unacknowledged_announcements: int
    urgent_items: list[TaskAssignmentOut] = Field(default_factory=list)


class TeamOperationsCapabilitiesOut(Schema):
    announcement_organization_manage: bool
    announcement_team_ids: list[int] = Field(default_factory=list)
    task_organization_manage: bool
    task_team_ids: list[int] = Field(default_factory=list)
