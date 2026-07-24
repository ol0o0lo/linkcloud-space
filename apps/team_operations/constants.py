from apps.base.enums import StrChoices


class AnnouncementStatus(StrChoices):
    DRAFT = "draft", "草稿"
    PUBLISHED = "published", "已发布"
    WITHDRAWN = "withdrawn", "已撤回"


class TaskPriority(StrChoices):
    NORMAL = "normal", "普通"
    HIGH = "high", "重要"
    URGENT = "urgent", "紧急"


class WorkTaskStatus(StrChoices):
    ACTIVE = "active", "进行中"
    COMPLETED = "completed", "已完成"
    CANCELLED = "cancelled", "已取消"


class TaskAssignmentStatus(StrChoices):
    PENDING = "pending", "待接受"
    IN_PROGRESS = "in_progress", "进行中"
    COMPLETED = "completed", "已完成"
    REJECTED = "rejected", "已拒绝"
    CANCELLED = "cancelled", "已取消"
