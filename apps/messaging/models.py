from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q

from apps.base.mixins import CreateUpdateTimeModelMixin
from apps.media.fields import MediaRefsField
from apps.messaging.constants import ConversationStatus, ParticipantAccessKind, SendBlockReason


class Conversation(CreateUpdateTimeModelMixin):
    organization = models.ForeignKey("organizations.Organization", on_delete=models.CASCADE, related_name="conversations", verbose_name="所属组织")
    namespace = models.CharField(max_length=64, verbose_name="业务命名空间")
    conversation_key = models.CharField(max_length=192, verbose_name="会话复用键")
    context_key = models.CharField(max_length=128, blank=True, default="", verbose_name="业务关联键")
    status = models.CharField(max_length=16, choices=ConversationStatus.choices, default=ConversationStatus.ACTIVE, verbose_name="状态")
    last_message_seq = models.PositiveBigIntegerField(default=0, verbose_name="最后消息位置")
    last_message = models.ForeignKey("messaging.Message", null=True, blank=True, on_delete=models.SET_NULL, related_name="+", verbose_name="最后消息")
    last_message_at = models.DateTimeField(null=True, blank=True, verbose_name="最后消息时间")

    class Meta:
        verbose_name = "会话"
        verbose_name_plural = "会话"
        constraints = [models.UniqueConstraint(fields=("organization", "namespace", "conversation_key"), name="messaging_conversation_key_unique")]
        indexes = [
            models.Index(fields=("organization", "-last_message_at", "-id"), name="msg_org_last_message_idx"),
            models.Index(fields=("organization", "namespace", "context_key"), name="msg_org_context_idx"),
        ]

    def clean(self):
        if not self.pk:
            return
        identity_fields = ("organization_id", "namespace", "conversation_key", "context_key")
        previous = type(self).objects.filter(pk=self.pk).values(*identity_fields).first()
        if previous and any(previous[field] != getattr(self, field) for field in identity_fields):
            raise ValidationError("会话的租户、命名空间、复用键和业务关联不能修改。")
        if self.last_message_id and self.last_message.conversation_id != self.pk:
            raise ValidationError({"last_message": "最后消息必须属于当前会话。"})

    @property
    def send_block_reason(self):
        if self.status != ConversationStatus.ACTIVE:
            return SendBlockReason.CLOSED
        if getattr(self, "_has_unavailable_member", True) or getattr(self, "_member_count", 0) != 2:
            return SendBlockReason.PEER_UNAVAILABLE
        return SendBlockReason.AVAILABLE

    @property
    def can_send(self):
        return self.send_block_reason == SendBlockReason.AVAILABLE


class ConversationMember(CreateUpdateTimeModelMixin):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="members", verbose_name="会话")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="conversation_memberships", verbose_name="参与账号")
    display_name_snapshot = models.CharField(max_length=150, verbose_name="历史名称")
    access_kind = models.CharField(max_length=32, choices=ParticipantAccessKind.choices, verbose_name="参与方式")
    last_read_seq = models.PositiveBigIntegerField(default=0, verbose_name="已读位置")
    revoked_at = models.DateTimeField(null=True, blank=True, verbose_name="撤销时间")

    class Meta:
        verbose_name = "会话参与人"
        verbose_name_plural = "会话参与人"
        constraints = [
            models.UniqueConstraint(fields=("conversation", "user"), condition=Q(user__isnull=False), name="messaging_member_user_unique"),
        ]
        indexes = [models.Index(fields=("user", "access_kind", "conversation"), name="msg_user_access_conv_idx")]


class Message(CreateUpdateTimeModelMixin):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages", verbose_name="会话")
    sender_member = models.ForeignKey(ConversationMember, on_delete=models.RESTRICT, related_name="sent_messages", verbose_name="发送参与人")
    seq = models.PositiveBigIntegerField(verbose_name="会话内位置")
    client_message_id = models.UUIDField(verbose_name="客户端消息标识")
    content = models.TextField(verbose_name="正文")
    message_type = models.CharField(max_length=64, default="text", verbose_name="消息类型")
    payload = models.JSONField(default=dict, blank=True, verbose_name="消息数据")
    media = MediaRefsField(default=list, blank=True, max_items=1, verbose_name="消息图片")

    class Meta:
        verbose_name = "聊天消息"
        verbose_name_plural = "聊天消息"
        ordering = ("seq",)
        constraints = [
            models.UniqueConstraint(fields=("conversation", "seq"), name="messaging_message_seq_unique"),
            models.UniqueConstraint(fields=("conversation", "sender_member", "client_message_id"), name="messaging_message_request_unique"),
            models.CheckConstraint(condition=Q(seq__gte=1), name="messaging_message_seq_positive"),
        ]

    def clean(self):
        if self.sender_member_id and self.sender_member.conversation_id != self.conversation_id:
            raise ValidationError({"sender_member": "发送参与人必须属于当前会话。"})
