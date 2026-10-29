from unittest.mock import patch
from uuid import uuid4

from django.db import transaction

import pytest

from apps.base.exceptions import AppException
from apps.messaging import services
from apps.messaging.contracts import ParticipantSpec
from apps.messaging.models import Conversation, ConversationMember, Message
from apps.notifications.models import Notification
from apps.organizations.models import OrganizationMember

pytestmark = pytest.mark.django_db


def send(ctx, conversation, *, actor=None, access_kind="organization_member", client_message_id=None, content="你好"):
    return services.send_message(
        actor=actor or ctx.alice,
        organization=conversation.organization,
        access_kind=access_kind,
        conversation_id=conversation.pk,
        client_message_id=client_message_id or uuid4(),
        content=content,
    )


def test_structured_message_retry_checks_type_and_payload(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    options = {
        "actor": ctx.alice,
        "organization": ctx.org,
        "access_kind": "organization_member",
        "conversation_id": conversation.pk,
        "client_message_id": uuid4(),
        "content": "卡片摘要",
    }
    first, created = services.send_message(**options, message_type="testing.card", payload={"value": "original"})
    replay, replay_created = services.send_message(**options, message_type="testing.card", payload={"value": "original"})
    assert created and not replay_created and first.pk == replay.pk
    assert first.message_type == "testing.card" and first.payload == {"value": "original"}
    for change in ({"message_type": "testing.card", "payload": {"value": "changed"}}, {"message_type": "text"}):
        with pytest.raises(AppException) as exc:
            services.send_message(**options, **change)
        assert exc.value.error == "MESSAGE_IDEMPOTENCY_CONFLICT"
    assert Message.objects.filter(conversation=conversation).count() == 1


@pytest.mark.parametrize("payload", [{"value": float("nan")}, {"value": "字" * 6000}, ["invalid"]])
def test_invalid_card_payload_never_creates_message(messaging_context, make_conversation, payload):
    ctx = messaging_context
    conversation = make_conversation()
    with pytest.raises(AppException):
        services.send_message(
            actor=ctx.alice,
            organization=ctx.org,
            access_kind="organization_member",
            conversation_id=conversation.pk,
            client_message_id=uuid4(),
            content="卡片",
            message_type="testing.card",
            payload=payload,
        )
    assert not Message.objects.exists()


@pytest.mark.parametrize("context_key", ["550e8400-e29b-41d4-a716-446655440000", "order:SO20261024001", "listing:001"])
def test_namespace_and_tenant_keep_opaque_keys_independent(messaging_context, make_conversation, context_key):
    ctx = messaging_context
    first = make_conversation(context_key=context_key)
    other_namespace = make_conversation(namespace="vehicles.inquiry", context_key=context_key)
    other_org = make_conversation(organization=ctx.other_org, context_key=context_key)

    assert len({first.pk, other_namespace.pk, other_org.pk}) == 3
    assert {first.context_key, other_namespace.context_key, other_org.context_key} == {context_key}
    assert first.conversation_key == other_namespace.conversation_key == other_org.conversation_key


def test_two_external_participants_can_exchange_messages_without_organization_notifications(messaging_context, make_conversation, django_capture_on_commit_callbacks):
    ctx = messaging_context
    conversation = make_conversation(
        actor=ctx.external_a,
        participants=[ParticipantSpec(ctx.external_a.pk, "business_party"), ParticipantSpec(ctx.external_b.pk, "business_party")],
    )
    with django_capture_on_commit_callbacks(execute=True):
        message, created = send(ctx, conversation, actor=ctx.external_a, access_kind="business_party")

    assert created is True
    assert message.seq == 1
    assert services.get_unread_counts(actor=ctx.external_b, organization=ctx.org, access_kind="business_party") == {"message_count": 1, "conversation_count": 1}
    assert not Notification.objects.filter(category="messaging.message").exists()
    assert not OrganizationMember.objects.filter(user__in=[ctx.external_a, ctx.external_b]).exists()


def test_existing_key_is_order_independent_and_rejects_changed_identity(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    reversed_participants = [ParticipantSpec(ctx.bob.pk, "organization_member"), ParticipantSpec(ctx.alice.pk, "organization_member")]
    assert make_conversation(actor=ctx.bob, participants=reversed_participants).pk == conversation.pk

    conflicts = [
        {"context_key": "resource:2"},
        {"participants": [ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.owner.pk, "organization_member")]},
        {"participants": [ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.bob.pk, "business_party")]},
    ]
    for change in conflicts:
        with pytest.raises(AppException) as exc:
            make_conversation(**change)
        assert exc.value.error == "CONVERSATION_KEY_CONFLICT"
    assert Conversation.objects.count() == 1
    assert ConversationMember.objects.filter(conversation=conversation).count() == 2


def test_reserved_direct_namespace_requires_canonical_key_members_and_empty_context(messaging_context, make_conversation):
    ctx = messaging_context
    direct = services.get_or_create_direct_conversation(actor=ctx.alice, organization=ctx.org, peer_user_id=ctx.bob.pk)
    assert services.get_or_create_direct_conversation(actor=ctx.bob, organization=ctx.org, peer_user_id=ctx.alice.pk).pk == direct.pk
    assert make_conversation(namespace="im.direct", conversation_key=direct.conversation_key, context_key="").pk == direct.pk

    for change in (
        {"conversation_key": "arbitrary-pair"},
        {"context_key": "resource:1"},
        {"participants": [ParticipantSpec(ctx.alice.pk, "business_party"), ParticipantSpec(ctx.bob.pk, "business_party")]},
        {"participants": [ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.external_a.pk, "organization_member")]},
    ):
        kwargs = {"namespace": "im.direct", "conversation_key": direct.conversation_key, "context_key": "", **change}
        with pytest.raises(AppException):
            make_conversation(**kwargs)
    assert Conversation.objects.count() == 1


@pytest.mark.parametrize("invalid", [{"namespace": "Not.Valid"}, {"namespace": "a..b"}, {"conversation_key": ""}, {"context_key": 123}])
def test_invalid_scope_never_creates_partial_conversation(make_conversation, invalid):
    with pytest.raises(AppException) as exc:
        make_conversation(**invalid)
    assert exc.value.error == "CONVERSATION_SCOPE_INVALID"
    assert not Conversation.objects.exists()
    assert not ConversationMember.objects.exists()


def test_actor_and_all_participants_must_be_valid(messaging_context, make_conversation):
    ctx = messaging_context
    with pytest.raises(AppException):
        make_conversation(actor=ctx.owner)
    with pytest.raises(AppException):
        make_conversation(participants=[ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.alice.pk, "organization_member")])
    with pytest.raises(AppException):
        make_conversation(participants=[ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.external_a.pk, "organization_member")])
    ctx.bob.is_active = False
    ctx.bob.save(update_fields=["is_active"])
    with pytest.raises(AppException):
        make_conversation()
    assert not Conversation.objects.exists()


def test_messages_are_normalized_sequential_and_retries_are_idempotent(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    client_id = uuid4()
    first, created = send(ctx, conversation, client_message_id=client_id, content="  你好\r\n世界  ")
    retry, retry_created = send(ctx, conversation, client_message_id=client_id, content="你好\n世界")
    second, second_created = send(ctx, conversation, actor=ctx.bob, client_message_id=client_id, content="另一人可用相同 UUID")

    assert (created, retry_created, second_created) == (True, False, True)
    assert retry.pk == first.pk
    assert first.content == "你好\n世界"
    assert [first.seq, second.seq] == [1, 2]
    conversation.refresh_from_db()
    assert (conversation.last_message_seq, conversation.last_message_id, conversation.last_message_at) == (2, second.pk, second.created_at)
    with pytest.raises(AppException) as exc:
        send(ctx, conversation, client_message_id=client_id, content="修改正文")
    assert exc.value.error == "MESSAGE_IDEMPOTENCY_CONFLICT"
    assert Message.objects.count() == 2


@pytest.mark.parametrize("content", [" \r\n ", "字" * 2001])
def test_invalid_content_does_not_advance_message_sequence(messaging_context, make_conversation, content):
    ctx = messaging_context
    conversation = make_conversation()
    with pytest.raises(AppException) as exc:
        send(ctx, conversation, content=content)
    assert exc.value.error == "MESSAGE_CONTENT_INVALID"
    conversation.refresh_from_db()
    assert conversation.last_message_seq == 0
    assert conversation.last_message_id is None
    assert not Message.objects.exists()


def test_rollback_keeps_sequence_and_client_id_available_for_retry(messaging_context, make_conversation, django_capture_on_commit_callbacks):
    ctx = messaging_context
    conversation = make_conversation()
    client_id = uuid4()
    with (
        patch("apps.messaging.notifications.notify") as notify,
        django_capture_on_commit_callbacks(execute=True),
        pytest.raises(RuntimeError, match="rollback"),
        transaction.atomic(),
    ):
        send(ctx, conversation, client_message_id=client_id)
        raise RuntimeError("rollback")
    notify.assert_not_called()
    conversation.refresh_from_db()
    assert conversation.last_message_seq == 0
    assert not Message.objects.exists()
    message, created = send(ctx, conversation, client_message_id=client_id)
    assert created is True
    assert message.seq == 1


def test_authorized_retry_survives_close_but_new_send_is_blocked(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    client_id = uuid4()
    message, _created = send(ctx, conversation, client_message_id=client_id)
    services.close_context_conversations(organization=ctx.org, namespace=conversation.namespace, context_key=conversation.context_key)

    replay, created = send(ctx, conversation, client_message_id=client_id)
    assert (replay.pk, created) == (message.pk, False)
    with pytest.raises(AppException) as exc:
        send(ctx, conversation)
    assert exc.value.error == "CONVERSATION_CLOSED"
    assert list(services.list_messages(actor=ctx.alice, organization=ctx.org, access_kind="organization_member", conversation_id=conversation.pk)) == [message]


def test_read_positions_never_regress_and_unread_excludes_own_messages(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    send(ctx, conversation, actor=ctx.bob, content="对方第一条")
    send(ctx, conversation, content="自己的消息")
    send(ctx, conversation, actor=ctx.bob, content="对方第二条")
    args = {"actor": ctx.alice, "organization": ctx.org, "access_kind": "organization_member", "conversation_id": conversation.pk}
    assert ConversationMember.objects.get(conversation=conversation, user=ctx.alice).last_read_seq == 0
    assert services.get_unread_counts(actor=ctx.alice, organization=ctx.org, access_kind="organization_member") == {"message_count": 2, "conversation_count": 1}

    assert services.mark_read(**args, last_read_seq=2).last_read_seq == 2
    assert services.mark_read(**args, last_read_seq=1).last_read_seq == 2
    assert services.get_unread_counts(actor=ctx.alice, organization=ctx.org, access_kind="organization_member") == {"message_count": 1, "conversation_count": 1}
    for position in (-1, 4):
        with pytest.raises(AppException) as exc:
            services.mark_read(**args, last_read_seq=position)
        assert exc.value.error == "READ_POSITION_INVALID"
    assert services.mark_read(**args, last_read_seq=3).last_read_seq == 3


def test_access_checks_tenant_mode_owner_and_current_membership(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    args = {"actor": ctx.alice, "organization": ctx.org, "access_kind": "organization_member", "conversation_id": conversation.pk}
    for changed in ({"organization": ctx.other_org}, {"actor": ctx.owner}, {"actor": ctx.outsider}, {"access_kind": "business_party"}):
        with pytest.raises(AppException) as exc:
            services.get_conversation(**(args | changed))
        assert exc.value.code == 404
    OrganizationMember.objects.filter(organization=ctx.org, user=ctx.alice).delete()
    for operation in (
        lambda: services.get_conversation(**args),
        lambda: services.list_messages(**args),
        lambda: services.mark_read(**args, last_read_seq=0),
        lambda: send(ctx, conversation),
        lambda: list(services.list_conversations(actor=ctx.alice, organization=ctx.org, access_kind="organization_member")),
        lambda: services.get_unread_counts(actor=ctx.alice, organization=ctx.org, access_kind="organization_member"),
    ):
        with pytest.raises(AppException) as exc:
            operation()
        assert exc.value.code == 404


def test_revoked_peer_blocks_new_messages_but_keeps_other_participant_history(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    first, _created = send(ctx, conversation)
    services.revoke_participant(organization=ctx.org, conversation_id=conversation.pk, user_id=ctx.bob.pk)
    assert services.get_conversation(actor=ctx.alice, organization=ctx.org, access_kind="organization_member", conversation_id=conversation.pk).pk == conversation.pk
    replay, created = send(ctx, conversation, client_message_id=first.client_message_id)
    assert (replay.pk, created) == (first.pk, False)
    with pytest.raises(AppException) as exc:
        send(ctx, conversation)
    assert exc.value.error == "CONVERSATION_PEER_UNAVAILABLE"
    with pytest.raises(AppException) as exc:
        services.get_conversation(actor=ctx.bob, organization=ctx.org, access_kind="organization_member", conversation_id=conversation.pk)
    assert exc.value.code == 404
    assert Message.objects.get().pk == first.pk
    assert services.get_unread_counts(actor=ctx.bob, organization=ctx.org, access_kind="organization_member") == {"message_count": 0, "conversation_count": 0}


def test_revoked_external_authorization_never_falls_back_to_organization_membership(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation(participants=[ParticipantSpec(ctx.alice.pk, "business_party"), ParticipantSpec(ctx.bob.pk, "organization_member")])
    send(ctx, conversation, actor=ctx.bob)
    services.revoke_participant(organization=ctx.org, conversation_id=conversation.pk, user_id=ctx.alice.pk)

    for access_kind in ("business_party", "organization_member"):
        with pytest.raises(AppException) as exc:
            services.get_conversation(actor=ctx.alice, organization=ctx.org, access_kind=access_kind, conversation_id=conversation.pk)
        assert exc.value.code == 404
        assert services.get_unread_counts(actor=ctx.alice, organization=ctx.org, access_kind=access_kind) == {"message_count": 0, "conversation_count": 0}


def test_context_closure_scopes_tenant_namespace_and_nonempty_key(messaging_context, make_conversation):
    ctx = messaging_context
    target = make_conversation()
    other_namespace = make_conversation(namespace="vehicles.inquiry")
    other_org = make_conversation(organization=ctx.other_org)
    other_context = make_conversation(conversation_key="inquiry:2", context_key="resource:2")
    services.close_context_conversations(organization=ctx.org, namespace=target.namespace, context_key=target.context_key)
    target.refresh_from_db()
    assert target.status == "closed"
    for conversation in (other_namespace, other_org, other_context):
        conversation.refresh_from_db()
        assert conversation.status == "active"
    with pytest.raises(AppException):
        services.close_context_conversations(organization=ctx.org, namespace=target.namespace, context_key="")


def test_notification_failure_cannot_fail_committed_message_or_repeat_on_retry(messaging_context, make_conversation, django_capture_on_commit_callbacks):
    ctx = messaging_context
    conversation = make_conversation()
    client_id = uuid4()
    with patch("apps.messaging.notifications.notify", side_effect=RuntimeError("notification unavailable")) as notify, django_capture_on_commit_callbacks(execute=True):
        message, created = send(ctx, conversation, client_message_id=client_id)
    assert created is True
    assert Message.objects.get(pk=message.pk).seq == 1
    assert notify.call_count == 1
    with patch("apps.messaging.notifications.notify") as notify, django_capture_on_commit_callbacks(execute=True):
        replay, created = send(ctx, conversation, client_message_id=client_id)
    assert replay.pk == message.pk
    assert created is False
    notify.assert_not_called()


def test_successful_notification_keeps_correct_tenant_and_omits_chat_content(messaging_context, make_conversation, django_capture_on_commit_callbacks):
    ctx = messaging_context
    conversation = make_conversation()
    private_content = "这是一段不应复制到提醒中的聊天正文"
    with django_capture_on_commit_callbacks(execute=True):
        message, _created = send(ctx, conversation, content=private_content)

    notification = Notification.objects.get(category="messaging.message")
    assert notification.organization_id == ctx.org.pk
    assert notification.recipient_id == ctx.bob.pk
    assert notification.target == conversation
    assert notification.data == {"conversation_id": conversation.pk, "message_seq": message.seq, "organization_slug": ctx.org.slug}
    assert f"organization_slug={ctx.org.slug}" in notification.url
    assert private_content not in notification.title + notification.body
