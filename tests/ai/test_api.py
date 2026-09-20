import json

import pytest
from model_bakery import baker

from apps.ai.models import AIConversation, AIInvocation, AIMessage
from apps.ai.runtime.contracts import AIErrorCode, AIProviderError, AIStreamChunk
from tests.ai.factories import FakeProvider
from tests.api_helpers import api_data


def set_session_org(client, org):
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": True})
    session.save()


@pytest.mark.django_db
def test_conversation_list_is_tenant_and_owner_scoped(client, org_owner):
    other = baker.make("accounts.User")
    other_org = baker.make("organizations.Organization")
    baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization, title="mine")
    baker.make(AIConversation, owner=org_owner.user, organization=other_org, title="other org")
    baker.make(AIConversation, owner=other, organization=org_owner.organization, title="other user")
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    response = client.get("/api/ai/conversations/", {"scope": "organization"})
    assert response.status_code == 200
    assert [item["title"] for item in api_data(response)["items"]] == ["mine"]


@pytest.mark.django_db
@pytest.mark.usefixtures("enabled_ai_chat_runtime")
def test_normal_and_stream_messages_are_persisted(client, org_owner):
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    conversation = baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization)
    response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/",
        data=json.dumps({"content": "帮我比较通勤与租金", "idempotency_key": "chat-1"}),
        content_type="application/json",
    )
    assert response.status_code == 200
    assert AIMessage.objects.filter(conversation=conversation, role="assistant").count() == 1

    stream_response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/stream/",
        data=json.dumps({"content": "继续", "idempotency_key": "chat-2"}),
        content_type="application/json",
    )
    body = b"".join(stream_response.streaming_content).decode()
    assert stream_response.status_code == 200
    assert [line for line in body.splitlines() if line.startswith("event:")] == ["event: start", "event: delta", "event: delta", "event: usage", "event: done"]
    invocation = AIInvocation.objects.filter(execution_mode="stream").get()
    assert invocation.status == "succeeded"
    assert AIMessage.objects.filter(conversation=conversation, role="assistant").count() == 2


@pytest.mark.django_db
@pytest.mark.usefixtures("enabled_ai_chat_runtime")
def test_stream_does_not_fallback_after_first_delta(client, org_owner):
    FakeProvider.stream_responses = [
        [
            AIStreamChunk(event="delta", text="部分"),
            AIProviderError(AIErrorCode.TIMEOUT, "超时", retryable=True),
        ]
    ]
    client.force_login(org_owner.user)
    set_session_org(client, org_owner.organization)
    conversation = baker.make(AIConversation, owner=org_owner.user, organization=org_owner.organization)
    response = client.post(
        f"/api/ai/conversations/{conversation.pk}/messages/stream/",
        data=json.dumps({"content": "继续", "idempotency_key": "interrupted"}),
        content_type="application/json",
    )
    body = b"".join(response.streaming_content).decode()
    assert [line for line in body.splitlines() if line.startswith("event:")] == ["event: start", "event: delta", "event: error"]
    invocation = AIInvocation.objects.get(execution_mode="stream")
    assert invocation.status == "interrupted"
    assert AIMessage.objects.filter(conversation=conversation, role="assistant").count() == 0
