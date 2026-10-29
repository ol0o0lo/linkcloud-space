import logging

from django.db import transaction

from apps.messaging.constants import ParticipantAccessKind
from apps.messaging.models import Message
from apps.notifications.services import notify
from apps.organizations.models import OrganizationMember

logger = logging.getLogger(__name__)


def notify_new_message(message_id):
    """事务提交后的可选提醒；失败不能改变聊天保存结果。"""
    try:
        message = Message.objects.select_related("conversation__organization", "sender_member__user").filter(pk=message_id).first()
        if message is None or not message.conversation.organization.is_active:
            return
        conversation = message.conversation
        members = conversation.members.filter(access_kind=ParticipantAccessKind.ORGANIZATION_MEMBER, revoked_at__isnull=True, user__is_active=True).exclude(
            pk=message.sender_member_id
        )
        recipients = [
            member.user for member in members.select_related("user") if OrganizationMember.objects.filter(organization=conversation.organization, user_id=member.user_id).exists()
        ]
        if not recipients:
            return
        slug = conversation.organization.slug
        with transaction.atomic():
            notify(
                recipients,
                organization=conversation.organization,
                actor=message.sender_member.user,
                target=conversation,
                category="messaging.message",
                title="收到新的聊天消息",
                body="你有一条新的聊天消息，点击进入会话。",
                url=f"/pages/messages/conversation?id={conversation.pk}&organization_slug={slug}",
                data={"conversation_id": conversation.pk, "message_seq": message.seq, "organization_slug": slug},
            )
    except Exception:
        logger.exception("聊天补充提醒生成失败", extra={"message_id": message_id})
