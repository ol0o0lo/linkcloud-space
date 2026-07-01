from datetime import datetime
from typing import Literal

from ninja import Schema
from pydantic import Field

from apps.notifications.constants import NotificationChannel, NotificationDispatchScope, NotificationDispatchStatus


def _obj_value(obj, field: str):
    return obj.get(field) if isinstance(obj, dict) else getattr(obj, field, None)


class NotificationActorOut(Schema):
    id: int
    username: str
    full_name: str
    avatar_url: str | None = None


class NotificationOut(Schema):
    id: int
    title: str
    body: str
    url: str | None = None
    is_read: bool
    created_at: datetime
    actor: NotificationActorOut | None = None

    @staticmethod
    def resolve_is_read(obj) -> bool:
        return obj.read_at is not None

    @staticmethod
    def resolve_actor(obj) -> NotificationActorOut | None:
        if obj.actor is None:
            return None
        full_name = (obj.actor.get_full_name() or "").strip() or obj.actor.username
        return NotificationActorOut(
            id=obj.actor.pk,
            username=obj.actor.username,
            full_name=full_name,
            avatar_url=obj.actor.avatar_url,
        )


class NotificationPatchIn(Schema):
    is_read: bool | None = Field(None, description="通知是否标记为已读。")


class UnreadCountOut(Schema):
    count: int


class BulkActionIn(Schema):
    action: Literal["mark_read", "mark_unread", "delete"] = Field(..., description="批量操作类型。")
    ids: list[int] | None = Field(None, description="要处理的通知 ID 列表。")
    all_unread: bool = Field(False, description="是否对全部未读通知执行操作。")


class BulkResultOut(Schema):
    updated: int = 0
    deleted: int = 0


class NotificationPreferenceOut(Schema):
    key: str
    label: str
    description: str = ""
    default_channels: list[str] = []
    default_channels__mapping: list[str]
    in_app: bool
    email: bool

    @staticmethod
    def resolve_default_channels__mapping(obj):
        return [NotificationChannel.get_choice_label(channel) for channel in (_obj_value(obj, "default_channels") or [])]


class NotificationPreferencePatchIn(Schema):
    in_app: bool | None = Field(None, description="是否接收站内通知。")
    email: bool | None = Field(None, description="是否接收邮件通知。")


class NotificationDispatchIn(Schema):
    scope: Literal["platform", "organization", "users"]
    scope_ids: list[int] = Field(default_factory=list)
    category: str = ""
    title: str
    body: str = ""
    url: str | None = None
    data: dict = Field(default_factory=dict)


class NotificationDispatchOut(Schema):
    id: int
    scope: str
    scope__mapping: str
    scope_ids: list[int]
    owner_organization_id: int | None = None
    category: str
    title: str
    body: str
    url: str | None = None
    data: dict
    status: str
    status__mapping: str
    target_count: int
    delivered_count: int
    error_message: str
    sent_at: datetime | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def resolve_scope__mapping(obj):
        value = _obj_value(obj, "scope")
        return NotificationDispatchScope.get_choice_label(value)

    @staticmethod
    def resolve_status__mapping(obj):
        value = _obj_value(obj, "status")
        return NotificationDispatchStatus.get_choice_label(value)
