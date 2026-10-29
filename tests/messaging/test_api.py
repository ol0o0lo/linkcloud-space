import json
from uuid import uuid4

from django.db import connection
from django.test.utils import CaptureQueriesContext

import pytest

from apps.messaging import services
from apps.messaging.contracts import ParticipantSpec
from apps.messaging.models import Conversation, ConversationMember, Message
from tests.api_helpers import api_data, api_error

pytestmark = pytest.mark.django_db


def base_url(organization):
    return f"/api/messaging/organizations/{organization.slug}"


def org_headers(organization):
    return {"HTTP_X_ORG_SLUG": organization.slug}


def post_message(client, organization, conversation_id, *, content="你好", client_message_id=None, **headers):
    return client.post(
        f"{base_url(organization)}/conversations/{conversation_id}/messages/",
        {"client_message_id": str(client_message_id or uuid4()), "content": content},
        content_type="application/json",
        **headers,
    )


@pytest.mark.parametrize("raw_content", [" " + "字" * 2000 + " ", "a\r\n" * 800], ids=["trimmed_limit", "normalized_crlf"])
def test_http_validates_message_length_after_normalizing_content(client, messaging_context, make_conversation, raw_content):
    ctx = messaging_context
    conversation = make_conversation()
    client.force_login(ctx.alice)
    response = post_message(client, ctx.org, conversation.pk, content=raw_content, **org_headers(ctx.org))
    assert response.status_code == 201
    expected = raw_content.replace("\r\n", "\n").strip()
    assert api_data(response)["content"] == expected
    assert Message.objects.get(conversation=conversation).content == expected


def test_anonymous_messaging_requests_require_authentication(client, messaging_context):
    response = client.get(f"{base_url(messaging_context.org)}/conversations/")
    assert response.status_code == 401
    assert api_error(response)["error"] == "UNAUTHORIZED"


def test_conversation_list_does_not_query_per_participant(client, messaging_context, make_conversation):
    ctx = messaging_context
    make_conversation()
    client.force_login(ctx.alice)
    url = f"{base_url(ctx.org)}/conversations/"
    headers = org_headers(ctx.org)
    assert client.get(url, **headers).status_code == 200
    with CaptureQueriesContext(connection) as one:
        assert api_data(client.get(url, **headers))["total"] == 1
    for index in range(8):
        make_conversation(conversation_key=f"query-count:{index}")
    with CaptureQueriesContext(connection) as many:
        assert api_data(client.get(url, **headers))["total"] == 9
    assert len(many) <= len(one) + 1, (len(one), len(many))


def test_direct_creation_is_reused_and_peers_only_expose_current_active_members(client, messaging_context):
    ctx = messaging_context
    client.force_login(ctx.alice)
    ctx.owner.is_active = False
    ctx.owner.save(update_fields=["is_active"])
    headers = org_headers(ctx.org)
    peers = api_data(client.get(f"{base_url(ctx.org)}/peers/", **headers))
    assert {"items", "total", "page", "page_size"} == set(peers)
    assert [peer["user_id"] for peer in peers["items"]] == [ctx.bob.pk]
    assert set(peers["items"][0]) == {"user_id", "display_name", "avatar_url"}

    url = f"{base_url(ctx.org)}/conversations/direct/"
    first = client.post(url, {"peer_user_id": ctx.bob.pk}, content_type="application/json", **headers)
    second = client.post(url, {"peer_user_id": ctx.bob.pk}, content_type="application/json", **headers)
    assert first.status_code in (200, 201)
    assert second.status_code in (200, 201)
    assert api_data(first)["id"] == api_data(second)["id"]
    assert api_data(first)["namespace"] == "im.direct"
    assert Conversation.objects.count() == 1


def test_session_organization_never_grants_personal_mode_access_and_header_must_match_url(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    client.force_login(ctx.alice)
    session = client.session
    session["organization_data"] = json.dumps({"pk": ctx.org.pk, "id": ctx.org.pk, "name": ctx.org.name, "slug": ctx.org.slug, "is_owner": False})
    session.save()
    url = f"{base_url(ctx.org)}/conversations/{conversation.pk}/"

    assert api_data(client.get(f"{base_url(ctx.org)}/conversations/"))["items"] == []
    assert client.get(url).status_code == 404
    assert client.get(url, **org_headers(ctx.other_org)).status_code == 404
    assert client.get(f"{base_url(ctx.other_org)}/conversations/{conversation.pk}/", **org_headers(ctx.other_org)).status_code == 404
    assert client.get(url, **org_headers(ctx.org)).status_code == 200


def test_external_participant_cannot_self_authorize_direct_or_generic_conversation(client, messaging_context):
    ctx = messaging_context
    client.force_login(ctx.external_a)
    payload = {"peer_user_id": ctx.alice.pk, "access_kind": "business_party", "namespace": "im.direct", "participants": [ctx.external_a.pk, ctx.alice.pk]}
    url = f"{base_url(ctx.org)}/conversations"
    assert client.post(f"{url}/direct/", payload, content_type="application/json").status_code == 404
    assert client.post(f"{url}/direct/", payload, content_type="application/json", **org_headers(ctx.org)).status_code == 404
    assert client.post(f"{url}/", payload, content_type="application/json").status_code == 405
    assert not Conversation.objects.exists()
    assert not ConversationMember.objects.exists()


def test_both_external_participants_use_personal_mode_and_cannot_switch_access_kind(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation(
        actor=ctx.external_a,
        participants=[ParticipantSpec(ctx.external_a.pk, "business_party"), ParticipantSpec(ctx.external_b.pk, "business_party")],
    )
    url = f"{base_url(ctx.org)}/conversations/{conversation.pk}"
    client.force_login(ctx.external_a)
    sent = post_message(client, ctx.org, conversation.pk)
    assert sent.status_code == 201
    assert client.get(f"{url}/", **org_headers(ctx.org)).status_code == 404
    client.force_login(ctx.external_b)
    assert api_data(client.get(f"{url}/"))["unread_count"] == 1
    assert len(api_data(client.get(f"{url}/messages/"))["items"]) == 1
    assert api_data(client.get(f"{base_url(ctx.org)}/unread-count/")) == {"message_count": 1, "conversation_count": 1}
    assert client.get(f"{base_url(ctx.other_org)}/conversations/{conversation.pk}/").status_code == 404


def test_owner_has_no_conversation_bypass_and_denied_requests_use_not_found(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    ctx.owner.is_superuser = True
    ctx.owner.save(update_fields=["is_superuser"])
    client.force_login(ctx.owner)
    headers = org_headers(ctx.org)
    url = f"{base_url(ctx.org)}/conversations/{conversation.pk}"
    responses = [
        client.get(f"{url}/", **headers),
        client.get(f"{url}/messages/", **headers),
        post_message(client, ctx.org, conversation.pk, **headers),
        client.patch(f"{url}/read/", {"last_read_seq": 0}, content_type="application/json", **headers),
    ]
    for response in responses:
        assert response.status_code == 404
        assert api_error(response)["error"] == "CONVERSATION_NOT_FOUND"
    assert api_data(client.get(f"{base_url(ctx.org)}/conversations/", **headers))["items"] == []


def test_message_post_returns_created_then_same_message_on_retry_and_conflict_for_changed_content(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    client.force_login(ctx.alice)
    headers = org_headers(ctx.org)
    client_id = uuid4()
    first = post_message(client, ctx.org, conversation.pk, client_message_id=client_id, content="  消息  ", **headers)
    assert first.status_code == 201
    first_data = api_data(first)
    assert set(first_data) == {"id", "conversation_id", "seq", "sender_member_id", "client_message_id", "content", "created_at", "message_type", "payload", "media"}
    assert first_data["message_type"] == "text" and first_data["payload"] == {} and first_data["media"] == []
    assert first_data["content"] == "消息"
    assert first_data["seq"] == 1
    retry = post_message(client, ctx.org, conversation.pk, client_message_id=client_id, content="消息", **headers)
    assert retry.status_code == 200
    assert api_data(retry) == first_data
    conflict = post_message(client, ctx.org, conversation.pk, client_message_id=client_id, content="修改", **headers)
    assert conflict.status_code == 409
    assert api_error(conflict)["error"] == "MESSAGE_IDEMPOTENCY_CONFLICT"
    assert Message.objects.count() == 1


def test_message_history_and_incremental_pagination_use_sequence_and_minimal_envelope(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    for index in range(6):
        services.send_message(
            actor=ctx.bob,
            organization=ctx.org,
            access_kind="organization_member",
            conversation_id=conversation.pk,
            client_message_id=uuid4(),
            content=f"消息 {index}",
        )
    client.force_login(ctx.alice)
    headers = org_headers(ctx.org)
    url = f"{base_url(ctx.org)}/conversations/{conversation.pk}/messages/"
    cases = [
        ({"page": 1, "page_size": 2}, [6, 5], 6),
        ({"page": 2, "page_size": 2}, [4, 3], 6),
        ({"before_seq": 4, "page": 1, "page_size": 2}, [3, 2], 3),
        ({"after_seq": 2, "page": 1, "page_size": 2}, [3, 4], 4),
        ({"after_seq": 4, "page": 1, "page_size": 2}, [5, 6], 2),
        ({"after_seq": 6, "page": 1, "page_size": 2}, [], 0),
    ]
    for params, sequences, total in cases:
        response = client.get(url, params, **headers)
        assert response.status_code == 200
        data = api_data(response)
        assert set(data) == {"items", "total", "page", "page_size"}
        assert (data["page"], data["page_size"], data["total"]) == (params["page"], 2, total)
        assert [item["seq"] for item in data["items"]] == sequences
    for params in ({"before_seq": 3, "after_seq": 1}, {"before_seq": 0}, {"after_seq": -1}):
        response = client.get(url, params, **headers)
        assert response.status_code == 400


def test_namespace_filter_applies_consistently_to_list_and_unread_counts(client, messaging_context, make_conversation):
    ctx = messaging_context
    first = make_conversation()
    second = make_conversation(namespace="vehicles.inquiry")
    other_tenant = make_conversation(organization=ctx.other_org)
    for conversation in (first, second, other_tenant):
        services.send_message(
            actor=ctx.bob, organization=conversation.organization, access_kind="organization_member", conversation_id=conversation.pk, client_message_id=uuid4(), content="未读"
        )
    client.force_login(ctx.alice)
    headers = org_headers(ctx.org)
    for namespace, ids, count in ((None, {first.pk, second.pk}, 2), (first.namespace, {first.pk}, 1), ("unknown.namespace", set(), 0)):
        params = {"namespace": namespace} if namespace else {}
        conversations = api_data(client.get(f"{base_url(ctx.org)}/conversations/", params, **headers))
        counts = api_data(client.get(f"{base_url(ctx.org)}/unread-count/", params, **headers))
        assert {item["id"] for item in conversations["items"]} == ids
        assert counts == {"message_count": count, "conversation_count": count}


def test_personal_organization_discovery_only_lists_active_authorized_business_conversations(client, messaging_context, make_conversation):
    ctx = messaging_context
    first = make_conversation(actor=ctx.external_a, participants=[ParticipantSpec(ctx.external_a.pk, "business_party"), ParticipantSpec(ctx.external_b.pk, "business_party")])
    second = make_conversation(
        actor=ctx.external_a,
        namespace="vehicles.inquiry",
        participants=[ParticipantSpec(ctx.external_a.pk, "business_party"), ParticipantSpec(ctx.external_b.pk, "business_party")],
    )
    for conversation in (first, second):
        services.send_message(
            actor=ctx.external_b, organization=ctx.org, access_kind="business_party", conversation_id=conversation.pk, client_message_id=uuid4(), content="外部未读"
        )
    revoked = make_conversation(
        actor=ctx.external_a,
        organization=ctx.other_org,
        participants=[ParticipantSpec(ctx.external_a.pk, "business_party"), ParticipantSpec(ctx.external_b.pk, "business_party")],
    )
    services.revoke_participant(organization=ctx.other_org, conversation_id=revoked.pk, user_id=ctx.external_a.pk)
    client.force_login(ctx.external_a)
    url = "/api/messaging/personal/organizations/"
    data = api_data(client.get(url, {"page": 1, "page_size": 10}))
    assert set(data) == {"items", "total", "page", "page_size"}
    assert data["total"] == 1
    assert data["items"][0]["slug"] == ctx.org.slug
    assert data["items"][0]["unread_count"] == 2
    assert client.get(url, **org_headers(ctx.org)).status_code == 400
    assert api_data(client.get(url, {"namespace": first.namespace}))["items"][0]["unread_count"] == 1
    assert api_data(client.get(url, {"namespace": "unknown.namespace"}))["items"] == []


def test_detail_read_and_closed_state_share_current_participant_permissions(client, messaging_context, make_conversation):
    ctx = messaging_context
    conversation = make_conversation()
    services.send_message(actor=ctx.bob, organization=ctx.org, access_kind="organization_member", conversation_id=conversation.pk, client_message_id=uuid4(), content="未读")
    client.force_login(ctx.alice)
    headers = org_headers(ctx.org)
    url = f"{base_url(ctx.org)}/conversations/{conversation.pk}"
    detail = api_data(client.get(f"{url}/", **headers))
    assert detail["organization"] == {"id": ctx.org.pk, "slug": ctx.org.slug, "name": ctx.org.name}
    assert detail["unread_count"] == 1
    assert detail["can_send"] is True
    assert detail["last_message"]["seq"] == 1
    assert {member["user_id"] for member in detail["members"]} == {ctx.alice.pk, ctx.bob.pk}
    read = client.patch(f"{url}/read/", {"last_read_seq": 1}, content_type="application/json", **headers)
    assert read.status_code == 200
    assert api_data(read) == {"last_read_seq": 1, "unread_count": 0}
    services.close_context_conversations(organization=ctx.org, namespace=conversation.namespace, context_key=conversation.context_key)
    detail = api_data(client.get(f"{url}/", **headers))
    assert detail["can_send"] is False
    assert detail["send_block_reason"]
    assert client.get(f"{url}/messages/", **headers).status_code == 200
    assert post_message(client, ctx.org, conversation.pk, **headers).status_code == 409


@pytest.mark.parametrize("inactive_target", ["actor", "organization"])
def test_inactive_actor_or_organization_cannot_read_or_send(client, messaging_context, make_conversation, inactive_target):
    ctx = messaging_context
    conversation = make_conversation()
    client.force_login(ctx.alice)
    target = ctx.alice if inactive_target == "actor" else ctx.org
    target.is_active = False
    target.save(update_fields=["is_active"])
    headers = org_headers(ctx.org)
    response = client.get(f"{base_url(ctx.org)}/conversations/{conversation.pk}/", **headers)
    assert response.status_code in (401, 404)
    response = post_message(client, ctx.org, conversation.pk, **headers)
    assert response.status_code in (401, 404)
    assert not Message.objects.exists()
