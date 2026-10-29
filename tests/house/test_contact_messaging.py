from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import ContactRole, HouseStatus
from apps.house.models import Building, Contact, House, HouseInquiry, PropertyResponsibility
from apps.house.services.contacts import send_tenant_contact_request
from apps.media.models import MediaFile
from apps.messaging.models import Conversation, ConversationMember, Message
from apps.notifications.models import Notification
from apps.organizations.models import Organization, OrganizationMember
from apps.settings.models import UserSetting
from tests.api_helpers import api_data

pytestmark = pytest.mark.django_db


def test_legacy_contact_backfill_is_limited_to_the_original_contact_template(contact_context):
    from importlib import import_module

    from django.apps import apps
    from django.db import connection

    from apps.messaging.services import send_message

    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    request_id = str(uuid4())
    sent = api_data(share_contact(ctx, conversation_id, channels=["wechat"], wechat="legacy-card", client_message_id=request_id))
    Message.objects.filter(pk=sent["id"]).update(message_type="text", payload={})
    agent_message, _ = send_message(
        actor=ctx.agent,
        organization=ctx.org,
        access_kind="organization_member",
        conversation_id=conversation_id,
        client_message_id=uuid4(),
        content=sent["content"],
    )
    ordinary, _ = send_message(
        actor=ctx.tenant,
        organization=ctx.org,
        access_kind="business_party",
        conversation_id=conversation_id,
        client_message_id=uuid4(),
        content=sent["content"] + "\n这是普通补充说明",
    )
    migration = import_module("apps.messaging.migrations.0002_message_cards")
    migration.convert_contact_messages(apps, SimpleNamespace(connection=connection))
    restored = Message.objects.get(pk=sent["id"])
    assert restored.message_type == "house.contact" and restored.payload == {"house_id": ctx.house.pk, "phone": "", "wechat": "legacy-card"}
    agent_message.refresh_from_db()
    ordinary.refresh_from_db()
    assert agent_message.message_type == ordinary.message_type == "text"
    replay = share_contact(ctx, conversation_id, channels=["wechat"], wechat="legacy-card", client_message_id=request_id)
    assert replay.status_code == 200 and api_data(replay)["id"] == restored.pk


def start_chat(ctx):
    return ctx.client.post("/api/house/tenant/chat/", {"house_id": ctx.house.pk}, content_type="application/json")


def share_contact(ctx, conversation_id, **payload):
    return ctx.client.post(f"/api/house/tenant/conversations/{conversation_id}/contact/", {"client_message_id": str(uuid4()), **payload}, content_type="application/json")


@pytest.fixture
def contact_context(client):
    tenant = baker.make(User, username="contact-chat-tenant", is_active=True)
    tenant.set_phone_number("+8613800138001", verified=True)
    tenant.save(update_fields=["phone_country_code", "phone_national_number", "phone_verified"])
    agent = baker.make(User, username="contact-chat-agent", is_active=True)
    organization = baker.make(Organization, name="联系组织", slug="contact-chat", is_active=True)
    member = baker.make(OrganizationMember, organization=organization, user=agent, is_owner=True)
    building = Building.objects.create(organization=organization, name="动态公寓名称", address="不可复制的内部地址", floors=5)
    landlord = Contact.objects.create(organization=organization, name="不可复制的房东姓名", phone="13900139000", roles=[ContactRole.LANDLORD])
    house = House.objects.create(building=building, landlord=landlord, room_number="不可复制的房号", status=HouseStatus.LISTED)
    client.force_login(tenant)
    return SimpleNamespace(client=client, tenant=tenant, agent=agent, org=organization, member=member, house=house)


def post_contact(ctx, *, client_message_id=None, channels=None, **contact):
    return ctx.client.post(
        "/api/house/tenant/contact/",
        {
            "house_id": ctx.house.pk,
            "client_message_id": str(client_message_id or uuid4()),
            "channels": channels or ["wechat"],
            **contact,
        },
        content_type="application/json",
    )


def test_direct_chat_does_not_copy_private_contact_details_or_send_messages(contact_context):
    ctx = contact_context
    Contact.objects.create(organization=ctx.org, user=ctx.tenant, name="已知客户", phone="13900139000", roles=[ContactRole.TENANT])
    UserSetting.objects.create(user=ctx.tenant, key="internal.house.contact.v1", value={"phone": "+8613800138001", "wechat": "private-wechat", "channels": ["phone", "wechat"]})
    first, second = start_chat(ctx), start_chat(ctx)
    assert first.status_code == second.status_code == 200
    assert api_data(first)["id"] == api_data(second)["id"]
    inquiry = HouseInquiry.objects.get(user=ctx.tenant, house=ctx.house)
    assert not inquiry.phone and not inquiry.wechat and inquiry.contact_id is None
    assert not Message.objects.exists() and not Notification.objects.exists()
    assert Conversation.objects.count() == 1


def test_direct_chat_without_recipient_rolls_back_inquiry(contact_context):
    ctx = contact_context
    ctx.agent.is_active = False
    ctx.agent.save(update_fields=["is_active"])
    assert start_chat(ctx).status_code == 409
    assert not HouseInquiry.objects.exists() and not Conversation.objects.exists()


def test_share_contact_is_bound_to_current_conversation_and_retries_are_idempotent(contact_context):
    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    inquiry = HouseInquiry.objects.get(user=ctx.tenant)
    other_agent = baker.make(User, is_active=True)
    other_member = baker.make(OrganizationMember, organization=ctx.org, user=other_agent)
    PropertyResponsibility.objects.create(organization=ctx.org, building=ctx.house.building, member=other_member)
    inquiry.assigned_to = other_agent
    inquiry.save(update_fields=["assigned_to"])
    payload = {"channels": ["phone"], "phone": "138 0013 8001", "wechat": "unselected-private", "client_message_id": str(uuid4())}
    first = share_contact(ctx, conversation_id, **payload)
    replay = share_contact(ctx, conversation_id, **payload)
    assert first.status_code == replay.status_code == 200
    assert api_data(first)["id"] == api_data(replay)["id"]
    assert api_data(first)["conversation_id"] == conversation_id
    assert "+8613800138001" in api_data(first)["content"] and "unselected-private" not in api_data(first)["content"]
    assert api_data(first)["message_type"] == "house.contact"
    assert api_data(first)["payload"] == {"house_id": ctx.house.pk, "phone": "+8613800138001", "wechat": ""}
    inquiry.refresh_from_db()
    assert inquiry.phone == "+8613800138001" and not inquiry.wechat
    assert not UserSetting.objects.filter(user=ctx.tenant).exists()
    assert Message.objects.count() == Conversation.objects.count() == 1


def test_contact_card_persists_in_history_for_both_participants(contact_context):
    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    sent = api_data(share_contact(ctx, conversation_id, channels=["wechat"], wechat="card-wechat", phone="unselected"))
    ctx.client.force_login(ctx.agent)
    history = api_data(ctx.client.get(f"/api/messaging/organizations/{ctx.org.slug}/conversations/{conversation_id}/messages/", HTTP_X_ORG_SLUG=ctx.org.slug))
    assert history["items"][0]["message_type"] == "house.contact"
    assert history["items"][0]["payload"] == sent["payload"] == {"house_id": ctx.house.pk, "phone": "", "wechat": "card-wechat"}
    assert (
        api_data(ctx.client.get(f"/api/messaging/organizations/{ctx.org.slug}/conversations/{conversation_id}/", HTTP_X_ORG_SLUG=ctx.org.slug))["last_message"]["preview"]
        == "[联系方式]"
    )


def test_house_card_uses_server_snapshot_stable_media_and_idempotent_request(contact_context):
    ctx = contact_context
    media = baker.make(
        MediaFile, file=f"uploads/orgs/{ctx.org.pk}/house-card-test.png", file_size=32, resource_type="house_image", original_filename="cover.png", uploader=ctx.agent
    )
    ctx.house.images = [{"media_id": media.pk, "media_type": "image"}]
    ctx.house.bedrooms, ctx.house.living_rooms = 1, 0
    ctx.house.save(update_fields=["images", "bedrooms", "living_rooms", "updated_at"])
    conversation_id = api_data(start_chat(ctx))["id"]
    url = f"/api/house/messaging/organizations/{ctx.org.slug}/conversations/{conversation_id}/house/"
    request_id = str(uuid4())
    body = {"house_id": ctx.house.pk, "client_message_id": request_id, "title": "客户端伪造标题", "asking_rent": "1", "cover_url": "https://invalid.example/cover.jpg"}
    first = ctx.client.post(url, body, content_type="application/json")
    assert first.status_code == 201, first.content
    data = api_data(first)
    assert data["message_type"] == "house.listing" and data["payload"]["house_id"] == ctx.house.pk
    assert "客户端伪造" not in data["payload"]["title"] and "不可复制的房东姓名" not in str(data["payload"])
    assert data["media"][0]["media_id"] == media.pk
    stored = Message.objects.get(pk=data["id"])
    assert "url" not in stored.media[0] and "cover_url" not in stored.payload
    ctx.house.status = HouseStatus.RENTED
    ctx.house.save(update_fields=["status", "updated_at"])
    replay = ctx.client.post(url, body, content_type="application/json")
    assert replay.status_code == 200 and api_data(replay)["id"] == data["id"]
    assert ctx.client.post(url, {**body, "client_message_id": str(uuid4())}, content_type="application/json").status_code == 404


def test_house_card_requires_conversation_membership_and_matching_tenant_scope(contact_context):
    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    url = f"/api/house/messaging/organizations/{ctx.org.slug}/conversations/{conversation_id}/house/"
    body = {"house_id": ctx.house.pk, "client_message_id": str(uuid4())}
    ctx.client.force_login(baker.make(User, is_active=True))
    assert ctx.client.post(url, body, content_type="application/json").status_code == 404
    ctx.client.force_login(ctx.agent)
    assert ctx.client.post(url, body, content_type="application/json").status_code == 404
    assert ctx.client.post(url, body, content_type="application/json", HTTP_X_ORG_SLUG="wrong").status_code == 404
    assert ctx.client.post(url, body, content_type="application/json", HTTP_X_ORG_SLUG=ctx.org.slug).status_code == 201


@pytest.mark.parametrize("query", ["", "?Expires=123&Signature=temporary"])
def test_house_card_only_snapshots_unsigned_legacy_image_urls(contact_context, query):
    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    url = f"/api/house/messaging/organizations/{ctx.org.slug}/conversations/{conversation_id}/house/"
    image_url = "https://example.invalid/public-cover.jpg" + query
    with patch("apps.house.services.messaging.migration_media_for", return_value=[{"field": "images", "media_type": "image", "media_file_id": None, "url": image_url}]):
        response = ctx.client.post(url, {"house_id": ctx.house.pk, "client_message_id": str(uuid4())}, content_type="application/json")
    assert response.status_code == 201
    payload = api_data(response)["payload"]
    assert payload.get("cover_url") == (image_url if not query else None)


def test_share_contact_rejects_another_user_and_never_falls_back_to_account_phone(contact_context):
    ctx = contact_context
    conversation_id = api_data(start_chat(ctx))["id"]
    assert share_contact(ctx, conversation_id, channels=["phone"], phone="").status_code == 422
    ctx.client.force_login(baker.make(User, is_active=True))
    assert share_contact(ctx, conversation_id, channels=["wechat"], wechat="not-a-participant").status_code == 404
    assert not Message.objects.exists()


def test_contact_personal_setting_validates_and_updates_without_sharing(contact_context):
    ctx = contact_context
    url = "/api/settings/user/internal.house.contact.v1/"
    saved = ctx.client.put(url, {"value": {"phone": "138 0013 8001", "wechat": " my-wechat "}}, content_type="application/json")
    assert saved.status_code == 200
    assert api_data(ctx.client.get(url))["value"] == {"phone": "+8613800138001", "wechat": "my-wechat", "channels": []}
    assert ctx.client.put(url, {"value": {"phone": "invalid"}}, content_type="application/json").status_code == 422
    cleared = ctx.client.put(url, {"value": {"phone": "", "wechat": ""}}, content_type="application/json")
    assert cleared.status_code == 200
    assert api_data(ctx.client.get(url))["value"]["phone"] == ""
    assert not HouseInquiry.objects.exists() and not Message.objects.exists()


def test_contact_response_opens_real_personal_conversation_without_organization_membership(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, client_message_id=client_id, wechat="tenant-chat")

    assert response.status_code == 201, response.content
    payload = api_data(response)
    assert set(payload) == {"notification_id", "inquiry_id", "conversation", "message"}
    assert payload["notification_id"] is None
    message = Message.objects.get(pk=payload["message"]["id"])
    conversation = message.conversation
    assert message.client_message_id == client_id
    assert payload["message"]["client_message_id"] == str(client_id)
    assert payload["conversation"]["id"] == conversation.pk
    assert payload["conversation"]["namespace"] == "real_estate.inquiry"
    assert payload["conversation"]["context_key"] == f"listing:{ctx.house.pk}"
    assert payload["conversation"]["can_send"] is True
    assert payload["conversation"]["last_message"]["id"] == message.pk
    assert dict(ConversationMember.objects.filter(conversation=conversation).values_list("user_id", "access_kind")) == {
        ctx.tenant.pk: "business_party",
        ctx.agent.pk: "organization_member",
    }
    assert not OrganizationMember.objects.filter(user=ctx.tenant).exists()
    assert HouseInquiry.objects.get(pk=payload["inquiry_id"]).assigned_to_id == ctx.agent.pk
    base_url = f"/api/messaging/organizations/{ctx.org.slug}/conversations/{conversation.pk}/"
    assert ctx.client.get(base_url).status_code == 200
    history = api_data(ctx.client.get(f"{base_url}messages/"))
    assert [item["id"] for item in history["items"]] == [message.pk]
    organizations = api_data(ctx.client.get("/api/messaging/personal/organizations/", {"namespace": "real_estate.inquiry"}))
    assert [item["id"] for item in organizations["items"]] == [ctx.org.pk]
    notification = Notification.objects.get(category="messaging.message")
    assert notification.recipient_id == ctx.agent.pk
    assert notification.target == conversation
    assert not Notification.objects.filter(category="house.contact").exists()


def test_contact_uses_house_organization_even_when_session_selects_another_tenant(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    other_org = baker.make(Organization, slug="contact-chat-unrelated", is_active=True)
    baker.make(OrganizationMember, organization=other_org, user=ctx.tenant, is_primary=True)
    ctx.client.force_login(ctx.tenant)
    with django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, wechat="cross-session-context")

    assert response.status_code == 201, response.content
    payload = api_data(response)
    assert payload["conversation"]["organization"]["id"] == ctx.org.pk
    assert HouseInquiry.objects.get(pk=payload["inquiry_id"]).organization_id == ctx.org.pk
    assert Notification.objects.get(category="messaging.message").organization_id == ctx.org.pk
    assert not Conversation.objects.filter(organization=other_org).exists()
    assert not OrganizationMember.objects.filter(organization=ctx.org, user=ctx.tenant).exists()


@pytest.mark.parametrize(
    ("channels", "expected", "excluded"),
    [(["phone"], "+8613800138001", "private-unselected-wechat"), (["wechat"], "private-unselected-wechat", "+8613800138001")],
)
def test_contact_message_contains_only_selected_normalized_contact_details(contact_context, channels, expected, excluded):
    ctx = contact_context
    response = post_contact(ctx, channels=channels, phone="138 0013 8001", wechat=" private-unselected-wechat ")

    assert response.status_code == 201, response.content
    content = Message.objects.get(pk=api_data(response)["message"]["id"]).content
    assert str(ctx.house.pk) in content
    assert expected in content
    assert excluded not in content
    assert "动态公寓名称" not in content
    assert "不可复制的内部地址" not in content
    assert "不可复制的房东姓名" not in content
    assert "不可复制的房号" not in content


def test_contact_uuid_replay_normalizes_values_and_ignores_dynamic_resource_names(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        first = post_contact(ctx, client_message_id=client_id, channels=["wechat", "phone"], phone="138 0013 8001", wechat=" same-wechat ")
    assert first.status_code == 201, first.content
    ctx.house.building.name = "更新后的动态公寓名称"
    ctx.house.building.save(update_fields=["name", "updated_at"])
    with django_capture_on_commit_callbacks(execute=True):
        replay = post_contact(ctx, client_message_id=client_id, channels=["phone", "wechat"], phone="+8613800138001", wechat="same-wechat")

    assert replay.status_code == 201, replay.content
    assert api_data(replay)["message"]["id"] == api_data(first)["message"]["id"]
    assert api_data(replay)["conversation"]["id"] == api_data(first)["conversation"]["id"]
    assert api_data(replay)["inquiry_id"] == api_data(first)["inquiry_id"]
    assert Message.objects.count() == 1
    assert Conversation.objects.count() == 1
    assert HouseInquiry.objects.count() == 1
    assert Notification.objects.filter(category="messaging.message").count() == 1
    assert not Notification.objects.filter(category="house.contact").exists()


def test_contact_uuid_conflict_does_not_change_saved_inquiry_preferences_or_message(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        first = post_contact(ctx, client_message_id=client_id, wechat="original-wechat")
    assert first.status_code == 201, first.content
    with django_capture_on_commit_callbacks(execute=True):
        conflict = post_contact(ctx, client_message_id=client_id, wechat="different-wechat")

    assert conflict.status_code == 409, conflict.content
    assert HouseInquiry.objects.get(pk=api_data(first)["inquiry_id"]).wechat == "original-wechat"
    assert UserSetting.objects.get(user=ctx.tenant, key="internal.house.contact.v1").value["wechat"] == "original-wechat"
    assert Message.objects.count() == 1
    assert Notification.objects.filter(category="messaging.message").count() == 1


def test_new_contact_uuid_adds_message_but_reuses_conversation_and_crm_inquiry(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    with django_capture_on_commit_callbacks(execute=True):
        first = post_contact(ctx, wechat="first-wechat")
        second = post_contact(ctx, wechat="second-wechat")

    assert first.status_code == second.status_code == 201
    assert api_data(second)["inquiry_id"] == api_data(first)["inquiry_id"]
    assert api_data(second)["conversation"]["id"] == api_data(first)["conversation"]["id"]
    assert api_data(second)["message"]["id"] != api_data(first)["message"]["id"]
    assert list(Message.objects.values_list("seq", flat=True)) == [1, 2]
    assert HouseInquiry.objects.count() == Conversation.objects.count() == 1
    assert not Contact.objects.filter(organization=ctx.org, roles__contains=[ContactRole.TENANT]).exists()
    assert Notification.objects.filter(category="messaging.message").count() == 2


def test_existing_inquiry_assignee_remains_receiver_when_property_responsibility_changes(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        first = post_contact(ctx, client_message_id=client_id, wechat="assigned-wechat")
    assert first.status_code == 201, first.content
    new_agent = baker.make(User, is_active=True)
    new_member = baker.make(OrganizationMember, organization=ctx.org, user=new_agent)
    PropertyResponsibility.objects.create(organization=ctx.org, member=new_member, landlord=ctx.house.landlord)
    with django_capture_on_commit_callbacks(execute=True):
        replay = post_contact(ctx, client_message_id=client_id, wechat="assigned-wechat")
        second = post_contact(ctx, wechat="next-wechat")

    assert replay.status_code == second.status_code == 201
    assert api_data(replay)["message"]["id"] == api_data(first)["message"]["id"]
    assert api_data(second)["conversation"]["id"] == api_data(first)["conversation"]["id"]
    assert set(Notification.objects.values_list("recipient_id", flat=True)) == {ctx.agent.pk}
    assert HouseInquiry.objects.get(pk=api_data(first)["inquiry_id"]).assigned_to_id == ctx.agent.pk


def test_contact_uuid_replays_original_message_after_crm_reassignment(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with django_capture_on_commit_callbacks(execute=True):
        first = post_contact(ctx, client_message_id=client_id, wechat="before-reassignment")
    assert first.status_code == 201, first.content
    new_agent = baker.make(User, is_active=True)
    baker.make(OrganizationMember, organization=ctx.org, user=new_agent)
    HouseInquiry.objects.filter(pk=api_data(first)["inquiry_id"]).update(assigned_to=new_agent)
    with django_capture_on_commit_callbacks(execute=True):
        replay = post_contact(ctx, client_message_id=client_id, wechat="before-reassignment")

    assert replay.status_code == 201, replay.content
    assert api_data(replay)["message"]["id"] == api_data(first)["message"]["id"]
    assert api_data(replay)["conversation"]["id"] == api_data(first)["conversation"]["id"]
    assert Message.objects.count() == Conversation.objects.count() == 1
    assert Notification.objects.filter(category="messaging.message").count() == 1


def test_inactive_property_recipient_falls_back_to_available_owner(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    inactive = baker.make(User, is_active=False)
    inactive_member = baker.make(OrganizationMember, organization=ctx.org, user=inactive)
    PropertyResponsibility.objects.create(organization=ctx.org, member=inactive_member, landlord=ctx.house.landlord)
    with django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, wechat="available-owner")

    assert response.status_code == 201, response.content
    assert HouseInquiry.objects.get(pk=api_data(response)["inquiry_id"]).assigned_to_id == ctx.agent.pk
    assert not ConversationMember.objects.filter(user=inactive).exists()
    assert Notification.objects.get(category="messaging.message").recipient_id == ctx.agent.pk


def test_no_available_recipient_saves_inquiry_and_preferences_without_empty_chat(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    ctx.agent.is_active = False
    ctx.agent.save(update_fields=["is_active"])
    with django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, wechat="no-agent-wechat")

    assert response.status_code == 201, response.content
    payload = api_data(response)
    assert payload["notification_id"] is payload["conversation"] is payload["message"] is None
    inquiry = HouseInquiry.objects.get(pk=payload["inquiry_id"])
    assert inquiry.wechat == "no-agent-wechat"
    assert inquiry.assigned_to_id is None
    assert UserSetting.objects.get(user=ctx.tenant, key="internal.house.contact.v1").value["wechat"] == "no-agent-wechat"
    assert not Conversation.objects.exists()
    assert not Message.objects.exists()
    assert not Notification.objects.exists()


def test_contact_cannot_create_self_chat_or_partial_business_data(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    ctx.member.user = ctx.tenant
    ctx.member.save(update_fields=["user", "updated_at"])
    with django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, wechat="self-contact")

    assert response.status_code == 409, response.content
    assert not HouseInquiry.objects.exists()
    assert not UserSetting.objects.filter(user=ctx.tenant, key="internal.house.contact.v1").exists()
    assert not Conversation.objects.exists()
    assert not Message.objects.exists()
    assert not Notification.objects.exists()


def test_contact_notification_failure_keeps_message_and_does_not_repeat_on_uuid_retry(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    client_id = uuid4()
    with patch("apps.messaging.notifications.notify", side_effect=RuntimeError("notification unavailable")) as notify, django_capture_on_commit_callbacks(execute=True):
        response = post_contact(ctx, client_message_id=client_id, wechat="saved-without-reminder")
    assert response.status_code == 201, response.content
    assert notify.call_count == 1
    message_id = api_data(response)["message"]["id"]
    assert Message.objects.get(pk=message_id).content
    assert HouseInquiry.objects.filter(pk=api_data(response)["inquiry_id"]).exists()
    with patch("apps.messaging.notifications.notify") as notify, django_capture_on_commit_callbacks(execute=True):
        replay = post_contact(ctx, client_message_id=client_id, wechat="saved-without-reminder")
    assert replay.status_code == 201, replay.content
    assert api_data(replay)["message"]["id"] == message_id
    assert Message.objects.count() == 1
    notify.assert_not_called()


def test_contact_message_write_failure_rolls_back_inquiry_chat_and_preferences(contact_context, django_capture_on_commit_callbacks):
    ctx = contact_context
    with (
        patch("apps.messaging.models.Message.objects.create", side_effect=RuntimeError("message storage unavailable")),
        django_capture_on_commit_callbacks(execute=True),
        pytest.raises(RuntimeError, match="message storage unavailable"),
    ):
        send_tenant_contact_request(house=ctx.house, user=ctx.tenant, channels=["wechat"], wechat="must-rollback", client_message_id=uuid4())
    assert not HouseInquiry.objects.exists()
    assert not Conversation.objects.exists()
    assert not Message.objects.exists()
    assert not UserSetting.objects.filter(user=ctx.tenant, key="internal.house.contact.v1").exists()
    assert not Notification.objects.exists()


def test_contact_service_keeps_inquiry_return_contract_and_generates_uuid_for_legacy_call(contact_context):
    ctx = contact_context
    inquiry = send_tenant_contact_request(house=ctx.house, user=ctx.tenant, channels=["wechat"], wechat="legacy-call")

    assert isinstance(inquiry, HouseInquiry)
    assert inquiry.notification_id is None
    assert inquiry.conversation.pk == inquiry.message.conversation_id
    assert isinstance(inquiry.message.client_message_id, UUID)
    assert Message.objects.get(pk=inquiry.message.pk).sender_member.user_id == ctx.tenant.pk


def test_contact_rejects_invalid_client_uuid_before_creating_business_data(contact_context):
    ctx = contact_context
    response = post_contact(ctx, client_message_id="not-a-uuid", wechat="invalid-id")

    assert response.status_code == 400, response.content
    assert not HouseInquiry.objects.exists()
    assert not Conversation.objects.exists()
    assert not Message.objects.exists()
