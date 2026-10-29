from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

from django.db import connections

import pytest

from apps.messaging import services
from apps.messaging.contracts import ParticipantSpec
from apps.messaging.models import Conversation, ConversationMember, Message

pytestmark = pytest.mark.django_db(transaction=True)


def run_concurrently(operation, workers=4):
    """每个线程持有独立 PostgreSQL 连接，在数据库事务上竞争同一资源。"""
    assert connections["default"].vendor == "postgresql", "消息并发保障必须使用 PostgreSQL 验证"
    barrier = Barrier(workers)

    def run(index):
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                backend_pid = cursor.fetchone()[0]
            barrier.wait(timeout=15)
            return backend_pid, operation(index)
        finally:
            connections.close_all()

    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = [executor.submit(run, index) for index in range(workers)]
        results = [future.result(timeout=30) for future in futures]
    assert len({pid for pid, _result in results}) == workers
    return [result for _pid, result in results]


def test_concurrent_creation_returns_one_complete_conversation(messaging_context):
    ctx = messaging_context

    def create(_index):
        return services.get_or_create_conversation(
            actor=ctx.alice,
            organization=ctx.org,
            namespace="testing.concurrent",
            conversation_key="same-pair",
            context_key="opaque:one",
            participants=[ParticipantSpec(ctx.alice.pk, "organization_member"), ParticipantSpec(ctx.bob.pk, "organization_member")],
        ).pk

    ids = run_concurrently(create)
    assert len(set(ids)) == 1
    assert Conversation.objects.count() == 1
    assert ConversationMember.objects.filter(conversation_id=ids[0]).count() == 2


def test_concurrent_messages_allocate_contiguous_sequence_and_correct_last_message(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()

    def send(index):
        message, created = services.send_message(
            actor=ctx.alice if index % 2 else ctx.bob,
            organization=ctx.org,
            access_kind="organization_member",
            conversation_id=conversation.pk,
            client_message_id=uuid4(),
            content=f"并发消息 {index}",
        )
        assert created is True
        return message.seq

    sequences = run_concurrently(send)
    assert sorted(sequences) == [1, 2, 3, 4]
    conversation.refresh_from_db()
    assert conversation.last_message_seq == 4
    assert conversation.last_message.seq == 4
    assert conversation.last_message_at == conversation.last_message.created_at
    assert list(Message.objects.filter(conversation=conversation).order_by("seq").values_list("seq", flat=True)) == [1, 2, 3, 4]


def test_concurrent_identical_client_message_id_creates_exactly_one_message(messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    client_id = uuid4()

    def send(_index):
        message, created = services.send_message(
            actor=ctx.alice,
            organization=ctx.org,
            access_kind="organization_member",
            conversation_id=conversation.pk,
            client_message_id=client_id,
            content="同一个发送操作",
        )
        return message.pk, created

    results = run_concurrently(send)
    assert len({pk for pk, _created in results}) == 1
    assert sum(created for _pk, created in results) == 1
    conversation.refresh_from_db()
    assert conversation.last_message_seq == 1
    assert Message.objects.filter(conversation=conversation).count() == 1
