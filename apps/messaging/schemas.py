from datetime import datetime
from typing import Literal
from uuid import UUID

from ninja import Schema
from pydantic import Field

from apps.media.schemas import ResolvedMediaRefOut
from apps.messaging.constants import ConversationStatus, SendBlockReason


class MessagingOrganizationOut(Schema):
    id: int
    slug: str
    name: str


class MessagingPersonalOrganizationOut(MessagingOrganizationOut):
    unread_count: int


class MessagingPeerOut(Schema):
    user_id: int
    display_name: str
    avatar_url: str | None = None

    @staticmethod
    def resolve_user_id(obj):
        return obj.pk

    @staticmethod
    def resolve_display_name(obj):
        return obj.get_full_name().strip() or obj.username


class MessagingMemberOut(Schema):
    id: int
    user_id: int | None
    display_name: str
    avatar_url: str | None = None
    access_kind: Literal["organization_member", "business_party"]

    @staticmethod
    def resolve_display_name(obj):
        return (obj.user.get_full_name().strip() or obj.user.username) if obj.user_id else obj.display_name_snapshot

    @staticmethod
    def resolve_avatar_url(obj):
        return obj.user.avatar_url if obj.user_id else None


class MessagingMessageOut(Schema):
    id: int
    conversation_id: int
    seq: int
    sender_member_id: int
    client_message_id: UUID
    content: str
    message_type: str = "text"
    payload: dict = Field(default_factory=dict)
    media: list[ResolvedMediaRefOut] = Field(default_factory=list)
    created_at: datetime

    @staticmethod
    def resolve_media(obj):
        return obj.media_resolved


class MessagingLastMessageOut(Schema):
    id: int
    seq: int
    sender_member_id: int
    preview: str
    created_at: datetime

    @staticmethod
    def resolve_preview(obj):
        if obj.message_type == "house.contact":
            return "[联系方式]"
        if obj.message_type == "house.listing":
            return f"[房源] {obj.payload.get('title', '')}"[:100]
        return obj.content[:100]


class MessagingConversationOut(Schema):
    id: int
    organization: MessagingOrganizationOut
    namespace: str
    context_key: str
    status: Literal["active", "closed"]
    status__mapping: str
    members: list[MessagingMemberOut]
    last_message: MessagingLastMessageOut | None = None
    my_member_id: int
    my_last_read_seq: int
    unread_count: int
    can_send: bool
    send_block_reason: str
    send_block_reason__mapping: str

    @staticmethod
    def resolve_members(obj):
        return list(obj.members.all())

    @staticmethod
    def resolve_status__mapping(obj):
        return ConversationStatus.get_choice_label(obj.status)

    @staticmethod
    def resolve_send_block_reason__mapping(obj):
        return SendBlockReason.get_choice_label(obj.send_block_reason)


class MessagingDirectIn(Schema):
    peer_user_id: int = Field(gt=0)


class MessagingMessageIn(Schema):
    client_message_id: UUID
    content: str


class MessagingReadIn(Schema):
    last_read_seq: int = Field(ge=0)


class MessagingReadOut(Schema):
    last_read_seq: int
    unread_count: int


class MessagingUnreadCountOut(Schema):
    message_count: int
    conversation_count: int
