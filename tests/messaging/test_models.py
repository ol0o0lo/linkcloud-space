from uuid import uuid4

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models.deletion import RestrictedError

import pytest

from apps.messaging import services
from apps.messaging.models import ConversationMember, Message

pytestmark = pytest.mark.django_db


def create_message(ctx, conversation):
    return services.send_message(
        actor=ctx.alice,
        organization=ctx.org,
        access_kind="organization_member",
        conversation_id=conversation.pk,
        client_message_id=uuid4(),
        content="保留的历史消息",
    )[0]


def test_database_enforces_message_sequence_and_sender_scoped_idempotency(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    first = create_message(ctx, conversation)
    cases = [(first.seq, uuid4()), (2, first.client_message_id), (0, uuid4())]
    for seq, client_id in cases:
        with pytest.raises(IntegrityError), transaction.atomic():
            Message.objects.create(conversation=conversation, sender_member=first.sender_member, seq=seq, client_message_id=client_id, content="重复或无效位置")
    assert Message.objects.count() == 1


def test_cross_conversation_sender_and_last_message_are_rejected(messaging_context, make_conversation):
    ctx = messaging_context
    first_conversation = make_conversation()
    second_conversation = make_conversation(conversation_key="other-pair")
    first_message = create_message(ctx, first_conversation)
    message = Message(conversation=second_conversation, sender_member=first_message.sender_member, seq=1, client_message_id=uuid4(), content="错误归属")
    with pytest.raises(ValidationError):
        message.full_clean()
    second_conversation.last_message = first_message
    with pytest.raises(ValidationError):
        second_conversation.full_clean()


def test_account_deletion_retains_sender_snapshot_and_message(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    message = create_message(ctx, conversation)
    member = message.sender_member
    snapshot = member.display_name_snapshot
    assert snapshot
    with pytest.raises(RestrictedError):
        member.delete()
    ctx.alice.delete()

    member.refresh_from_db()
    message.refresh_from_db()
    assert member.user_id is None
    assert member.display_name_snapshot == snapshot
    assert message.sender_member_id == member.pk
    assert ConversationMember.objects.filter(conversation=conversation).count() == 2
    assert services.get_conversation(actor=ctx.bob, organization=ctx.org, access_kind="organization_member", conversation_id=conversation.pk).can_send is False


def test_whole_conversation_deletion_collects_restricted_sender_and_messages(messaging_context, make_conversation):
    conversation = make_conversation()
    message = create_message(messaging_context, conversation)
    member_id = message.sender_member_id
    message_id = message.pk
    conversation.delete()
    assert not ConversationMember.objects.filter(pk=member_id).exists()
    assert not Message.objects.filter(pk=message_id).exists()


@pytest.mark.parametrize("identity_field", ["organization", "namespace", "conversation_key", "context_key"])
def test_conversation_identity_is_immutable(messaging_context, make_conversation, identity_field):
    ctx = messaging_context
    conversation = make_conversation()
    setattr(conversation, identity_field, ctx.other_org if identity_field == "organization" else "changed.value")
    with pytest.raises(ValidationError):
        conversation.full_clean()
