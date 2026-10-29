"""通用聊天公共服务；业务资源授权由调用方完成。"""

import json
import re
from collections.abc import Sequence
from functools import partial
from uuid import UUID

from django.db import transaction
from django.db.models import BigIntegerField, Count, Exists, F, OuterRef, Prefetch, Q, Subquery, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.accounts.models import User
from apps.base.exceptions import AuthException
from apps.messaging import notifications
from apps.messaging.constants import DIRECT_NAMESPACE, MAX_CONTENT_LENGTH, ConversationStatus, ParticipantAccessKind
from apps.messaging.contracts import ParticipantSpec
from apps.messaging.exceptions import (
    ConversationClosed,
    ConversationKeyConflict,
    ConversationNotFound,
    ConversationPeerUnavailable,
    InvalidConversationScope,
    InvalidMessageContent,
    InvalidReadPosition,
    MessageIdempotencyConflict,
)
from apps.messaging.models import Conversation, ConversationMember, Message
from apps.organizations.models import Organization, OrganizationMember


def _require_actor(actor):
    if not getattr(actor, "is_authenticated", False) or not User.objects.filter(pk=actor.pk, is_active=True).exists():
        raise AuthException()


def _require_organization(organization):
    org = Organization.objects.filter(pk=getattr(organization, "pk", None), is_active=True).first()
    if org is None:
        raise ConversationNotFound()
    return org


def _require_scope(*, actor, organization, access_kind):
    _require_actor(actor)
    org = _require_organization(organization)
    if access_kind not in ParticipantAccessKind.values:
        raise ConversationNotFound()
    if access_kind == ParticipantAccessKind.ORGANIZATION_MEMBER and not OrganizationMember.objects.filter(organization=org, user=actor).exists():
        raise ConversationNotFound()
    return org


def _validate_namespace(namespace):
    if not isinstance(namespace, str) or len(namespace) > 64 or not re.fullmatch(r"[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*", namespace):
        raise InvalidConversationScope("业务命名空间格式无效。")


def _validate_key(value, maximum, *, allow_empty=False):
    if not isinstance(value, str) or len(value) > maximum or "\x00" in value or (not value.strip() and not (allow_empty and value == "")):
        raise InvalidConversationScope()


def _member_queryset():
    membership = OrganizationMember.objects.filter(organization_id=OuterRef("conversation__organization_id"), user_id=OuterRef("user_id"))
    return ConversationMember.objects.select_related("user").annotate(_is_org_member=Exists(membership))


def _conversation_queryset(*, actor, organization, access_kind, namespace=None):
    mine = ConversationMember.objects.filter(conversation_id=OuterRef("pk"), user=actor, access_kind=access_kind, revoked_at__isnull=True)
    bad_members = (
        _member_queryset()
        .filter(conversation_id=OuterRef("pk"))
        .filter(Q(revoked_at__isnull=False) | Q(user__isnull=True) | Q(user__is_active=False) | Q(access_kind=ParticipantAccessKind.ORGANIZATION_MEMBER, _is_org_member=False))
    )
    member_count = ConversationMember.objects.filter(conversation_id=OuterRef("pk")).order_by().values("conversation_id").annotate(total=Count("pk")).values("total")
    qs = (
        Conversation.objects.filter(organization=organization)
        .annotate(
            my_member_id=Subquery(mine.values("pk")[:1]),
            my_last_read_seq=Subquery(mine.values("last_read_seq")[:1]),
            _has_unavailable_member=Exists(bad_members),
            _member_count=Subquery(member_count[:1]),
        )
        .filter(my_member_id__isnull=False)
    )
    if namespace is not None:
        _validate_namespace(namespace)
        qs = qs.filter(namespace=namespace)
    unread = (
        Message.objects.filter(conversation_id=OuterRef("pk"), seq__gt=OuterRef("my_last_read_seq"))
        .exclude(sender_member_id=OuterRef("my_member_id"))
        .order_by()
        .values("conversation_id")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return (
        qs.annotate(unread_count=Coalesce(Subquery(unread[:1]), 0, output_field=BigIntegerField()))
        .select_related("organization", "last_message")
        .prefetch_related(Prefetch("members", queryset=_member_queryset()))
        .order_by(F("last_message_at").desc(nulls_last=True), "-pk")
    )


def get_or_create_conversation(*, actor, organization, namespace, conversation_key, participants: Sequence[ParticipantSpec], context_key=""):
    """由受信任业务服务调用；HTTP 客户端不能自行授予 business_party 资格。"""
    _require_actor(actor)
    org = _require_organization(organization)
    _validate_namespace(namespace)
    _validate_key(conversation_key, 192)
    _validate_key(context_key, 128, allow_empty=True)
    specs = list(participants)
    if len(specs) != 2 or any(not isinstance(spec, ParticipantSpec) or spec.access_kind not in ParticipantAccessKind.values for spec in specs):
        raise InvalidConversationScope("单聊必须有两个具有明确参与方式的账号。")
    expected = {spec.user_id: spec.access_kind for spec in specs}
    if len(expected) != 2 or actor.pk not in expected:
        raise InvalidConversationScope("发起人必须是两个不同参与账号之一。")
    users = {user.pk: user for user in User.objects.filter(pk__in=expected, is_active=True)}
    if len(users) != 2:
        raise InvalidConversationScope("参与账号不存在或已停用。")
    required_members = {spec.user_id for spec in specs if spec.access_kind == ParticipantAccessKind.ORGANIZATION_MEMBER}
    actual_members = set(OrganizationMember.objects.filter(organization=org, user_id__in=required_members).values_list("user_id", flat=True))
    if actual_members != required_members:
        raise ConversationNotFound()
    if namespace == DIRECT_NAMESPACE:
        canonical_key = ":".join(str(pk) for pk in sorted(expected))
        if required_members != set(expected) or context_key or conversation_key != canonical_key:
            raise InvalidConversationScope("组织单聊必须使用规范用户对和真实组织成员。")

    with transaction.atomic():
        conversation, created = Conversation.objects.get_or_create(organization=org, namespace=namespace, conversation_key=conversation_key, defaults={"context_key": context_key})
        if created:
            ConversationMember.objects.bulk_create(
                [
                    ConversationMember(
                        conversation=conversation,
                        user=users[spec.user_id],
                        access_kind=spec.access_kind,
                        display_name_snapshot=(users[spec.user_id].get_full_name().strip() or users[spec.user_id].username)[:150],
                    )
                    for spec in specs
                ]
            )
        else:
            conversation = Conversation.objects.select_for_update().get(pk=conversation.pk)
            existing = dict(conversation.members.values_list("user_id", "access_kind"))
            if conversation.context_key != context_key or existing != expected:
                raise ConversationKeyConflict()
    return get_conversation(actor=actor, organization=org, access_kind=expected[actor.pk], conversation_id=conversation.pk)


def get_or_create_direct_conversation(*, actor, organization, peer_user_id):
    org = _require_scope(actor=actor, organization=organization, access_kind=ParticipantAccessKind.ORGANIZATION_MEMBER)
    return get_or_create_conversation(
        actor=actor,
        organization=org,
        namespace=DIRECT_NAMESPACE,
        conversation_key=":".join(str(pk) for pk in sorted((actor.pk, peer_user_id))),
        participants=[
            ParticipantSpec(actor.pk, ParticipantAccessKind.ORGANIZATION_MEMBER),
            ParticipantSpec(peer_user_id, ParticipantAccessKind.ORGANIZATION_MEMBER),
        ],
    )


def list_direct_peers(*, actor, organization, keyword=""):
    org = _require_scope(actor=actor, organization=organization, access_kind=ParticipantAccessKind.ORGANIZATION_MEMBER)
    peers = User.objects.filter(is_active=True, pk__in=OrganizationMember.objects.filter(organization=org).values("user_id")).exclude(pk=actor.pk)
    if keyword:
        peers = peers.filter(Q(username__icontains=keyword) | Q(first_name__icontains=keyword) | Q(last_name__icontains=keyword))
    return peers.order_by("username", "pk")


def list_personal_organizations(*, actor, namespace=None):
    _require_actor(actor)
    filters = {
        "conversation__members__user": actor,
        "conversation__members__access_kind": ParticipantAccessKind.BUSINESS_PARTY,
        "conversation__members__revoked_at__isnull": True,
    }
    memberships = ConversationMember.objects.filter(
        user=actor, access_kind=ParticipantAccessKind.BUSINESS_PARTY, revoked_at__isnull=True, conversation__organization__is_active=True
    )
    if namespace is not None:
        _validate_namespace(namespace)
        memberships = memberships.filter(conversation__namespace=namespace)
        filters["conversation__namespace"] = namespace
    unread = (
        Message.objects.filter(**filters, conversation__organization_id=OuterRef("pk"), seq__gt=F("conversation__members__last_read_seq"))
        .exclude(sender_member_id=F("conversation__members__pk"))
        .order_by()
        .values("conversation__organization_id")
        .annotate(total=Count("pk"))
        .values("total")
    )
    return (
        Organization.objects.filter(is_active=True, pk__in=memberships.values("conversation__organization_id"))
        .annotate(unread_count=Coalesce(Subquery(unread[:1]), 0, output_field=BigIntegerField()))
        .order_by("name", "pk")
    )


def list_conversations(*, actor, organization, access_kind, namespace=None):
    org = _require_scope(actor=actor, organization=organization, access_kind=access_kind)
    return _conversation_queryset(actor=actor, organization=org, access_kind=access_kind, namespace=namespace)


def get_conversation(*, actor, organization, access_kind, conversation_id):
    conversation = list_conversations(actor=actor, organization=organization, access_kind=access_kind).filter(pk=conversation_id).first()
    if conversation is None:
        raise ConversationNotFound()
    return conversation


def list_messages(*, actor, organization, access_kind, conversation_id, before_seq=None, after_seq=None):
    conversation = get_conversation(actor=actor, organization=organization, access_kind=access_kind, conversation_id=conversation_id)
    if (before_seq is not None and (before_seq < 1 or after_seq is not None)) or (after_seq is not None and after_seq < 0):
        raise InvalidReadPosition()
    messages = Message.objects.filter(conversation=conversation)
    if before_seq is not None:
        messages = messages.filter(seq__lt=before_seq)
    if after_seq is not None:
        return messages.filter(seq__gt=after_seq).order_by("seq")
    return messages.order_by("-seq")


def _locked_access(*, actor, organization, access_kind, conversation_id):
    org = _require_scope(actor=actor, organization=organization, access_kind=access_kind)
    conversation = Conversation.objects.select_for_update().filter(pk=conversation_id, organization=org).first()
    if conversation is None:
        raise ConversationNotFound()
    member = ConversationMember.objects.filter(conversation=conversation, user=actor, access_kind=access_kind, revoked_at__isnull=True).first()
    if member is None:
        raise ConversationNotFound()
    return conversation, member


def _participants_available(conversation):
    members = list(_member_queryset().filter(conversation=conversation))
    return len(members) == 2 and all(
        member.user_id is not None and member.user.is_active and member.revoked_at is None and (member.access_kind == ParticipantAccessKind.BUSINESS_PARTY or member._is_org_member)
        for member in members
    )


def _message_request_id(client_message_id):
    try:
        return UUID(str(client_message_id))
    except (ValueError, TypeError, AttributeError) as exc:
        raise InvalidMessageContent("消息请求标识无效。") from exc


def find_sent_message(*, actor, organization, access_kind, namespace, context_key, client_message_id):
    """供业务发送入口按原始请求恢复结果，查找范围仍受租户和本人会话权限限制。"""
    org = _require_scope(actor=actor, organization=organization, access_kind=access_kind)
    _validate_namespace(namespace)
    _validate_key(context_key, 128)
    message = (
        Message.objects.filter(
            conversation__organization=org,
            conversation__namespace=namespace,
            conversation__context_key=context_key,
            sender_member__user=actor,
            client_message_id=_message_request_id(client_message_id),
        )
        .select_related("conversation")
        .order_by("pk")
        .first()
    )
    if message is not None:
        message.conversation = get_conversation(actor=actor, organization=org, access_kind=access_kind, conversation_id=message.conversation_id)
    return message


def send_message(*, actor, organization, access_kind, conversation_id, client_message_id, content, message_type="text", payload=None, media=None):
    if not isinstance(content, str):
        raise InvalidMessageContent()
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not normalized or len(normalized) > MAX_CONTENT_LENGTH or "\x00" in normalized:
        raise InvalidMessageContent()
    payload = {} if payload is None else payload
    if not isinstance(message_type, str) or not re.fullmatch(r"[a-z][a-z0-9_.]{0,63}", message_type) or not isinstance(payload, dict):
        raise InvalidMessageContent("消息类型或卡片数据格式无效。")
    try:
        if len(json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()) > 16384:
            raise ValueError("payload too large")
        media = Message._meta.get_field("media").clean_media_refs(media or [])
    except (TypeError, ValueError, OverflowError) as exc:
        raise InvalidMessageContent("消息卡片数据或关联图片无效。") from exc
    if message_type == "text" and (payload or media):
        raise InvalidMessageContent("文字消息不能携带卡片数据。")
    request_id = _message_request_id(client_message_id)
    with transaction.atomic():
        conversation, member = _locked_access(actor=actor, organization=organization, access_kind=access_kind, conversation_id=conversation_id)
        existing = Message.objects.filter(conversation=conversation, sender_member=member, client_message_id=request_id).first()
        if existing:
            if existing.content != normalized or existing.message_type != message_type or existing.payload != payload or existing.media != media:
                raise MessageIdempotencyConflict()
            return existing, False
        if conversation.status != ConversationStatus.ACTIVE:
            raise ConversationClosed()
        if not _participants_available(conversation):
            raise ConversationPeerUnavailable()
        message = Message.objects.create(
            conversation=conversation,
            sender_member=member,
            seq=conversation.last_message_seq + 1,
            client_message_id=request_id,
            content=normalized,
            message_type=message_type,
            payload=payload,
            media=media,
        )
        conversation.last_message_seq = message.seq
        conversation.last_message = message
        conversation.last_message_at = message.created_at
        conversation.save(update_fields=("last_message_seq", "last_message", "last_message_at", "updated_at"))
        transaction.on_commit(partial(notifications.notify_new_message, message.pk), robust=True)
    return message, True


def mark_read(*, actor, organization, access_kind, conversation_id, last_read_seq):
    with transaction.atomic():
        conversation, member = _locked_access(actor=actor, organization=organization, access_kind=access_kind, conversation_id=conversation_id)
        if not isinstance(last_read_seq, int) or isinstance(last_read_seq, bool) or last_read_seq < 0 or last_read_seq > conversation.last_message_seq:
            raise InvalidReadPosition()
        if last_read_seq > member.last_read_seq:
            member.last_read_seq = last_read_seq
            member.save(update_fields=("last_read_seq", "updated_at"))
        member.unread_count = Message.objects.filter(conversation=conversation, seq__gt=member.last_read_seq).exclude(sender_member=member).count()
    return member


def get_unread_counts(*, actor, organization, access_kind, namespace=None):
    conversations = list_conversations(actor=actor, organization=organization, access_kind=access_kind, namespace=namespace)
    result = conversations.aggregate(message_count=Coalesce(Sum("unread_count"), 0), conversation_count=Count("pk", filter=Q(unread_count__gt=0)))
    return result


def revoke_participant(*, organization, conversation_id, user_id):
    org = _require_organization(organization)
    with transaction.atomic():
        conversation = Conversation.objects.select_for_update().filter(organization=org, pk=conversation_id).first()
        if conversation is None:
            raise ConversationNotFound()
        return ConversationMember.objects.filter(conversation=conversation, user_id=user_id, revoked_at__isnull=True).update(revoked_at=timezone.now(), updated_at=timezone.now())


def close_context_conversations(*, organization, namespace, context_key):
    org = _require_organization(organization)
    _validate_namespace(namespace)
    _validate_key(context_key, 128)
    with transaction.atomic():
        ids = list(Conversation.objects.select_for_update().filter(organization=org, namespace=namespace, context_key=context_key).order_by("pk").values_list("pk", flat=True))
        return Conversation.objects.filter(pk__in=ids).exclude(status=ConversationStatus.CLOSED).update(status=ConversationStatus.CLOSED, updated_at=timezone.now())


def user_has_messaging_history(*, user):
    return ConversationMember.objects.filter(user=user).exists()
