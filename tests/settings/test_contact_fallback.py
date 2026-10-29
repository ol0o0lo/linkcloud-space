import importlib
from types import SimpleNamespace
from uuid import uuid4

from django.apps import apps as django_apps

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.house.constants import HouseStatus
from apps.house.models import Building, House, HouseInquiry, PropertyResponsibility
from apps.house.queries.responsibilities import resolve_contact_recipient
from apps.house.services.settings import CONTACT_FALLBACK_MEMBER_SETTING_KEY
from apps.messaging.models import ConversationMember
from apps.notifications.models import Notification
from apps.organizations.models import Organization, OrganizationMember
from apps.settings.models import DefaultSetting, OrganizationSetting
from apps.settings.service import get_all_team_settings, set_org_setting
from tests.api_helpers import api_data

pytestmark = pytest.mark.django_db


@pytest.fixture
def fallback_context(client):
    migration = importlib.import_module("apps.settings.migrations.0016_property_rental_contact_fallback_member")
    migration.ensure_contact_fallback_member_setting(django_apps, None)
    org = baker.make(Organization, slug="fallback-setting", is_active=True)
    owner = baker.make(User, username="fallback-owner", is_active=True)
    owner_member = baker.make(OrganizationMember, organization=org, user=owner, is_owner=True)
    member = baker.make(OrganizationMember, organization=org, user__is_active=True, employee_name="接待员工")
    inactive = baker.make(OrganizationMember, organization=org, user__is_active=False)
    outsider = baker.make(OrganizationMember, user__is_active=True)
    building = Building.objects.create(organization=org, name="兜底接待测试楼栋", address="测试路 1 号", floors=5)
    house = House.objects.create(building=building, room_number="101", status=HouseStatus.LISTED)
    client.force_login(owner)
    client.defaults["HTTP_X_ORG_SLUG"] = org.slug
    return SimpleNamespace(
        client=client,
        org=org,
        owner=owner,
        owner_member=owner_member,
        member=member,
        inactive=inactive,
        outsider=outsider,
        house=house,
        setting=DefaultSetting.objects.get(key=CONTACT_FALLBACK_MEMBER_SETTING_KEY),
        url=f"/api/settings/org/{CONTACT_FALLBACK_MEMBER_SETTING_KEY}/",
    )


def put_fallback(ctx, value):
    return ctx.client.put(ctx.url, {"value": value}, content_type="application/json")


def contact(ctx):
    return ctx.client.post(
        "/api/house/tenant/contact/",
        {"house_id": ctx.house.pk, "client_message_id": str(uuid4()), "channels": ["wechat"], "wechat": "fallback-test"},
        content_type="application/json",
    )


def test_fallback_options_only_include_active_organization_members(fallback_context):
    ctx = fallback_context
    detail = api_data(ctx.client.get(ctx.url))
    listing = next(item for item in api_data(ctx.client.get("/api/settings/org/")) if item["key"] == CONTACT_FALLBACK_MEMBER_SETTING_KEY)
    assert detail == listing
    assert detail["value"] == 0 and detail["widget"] == "select"
    assert detail["ui"]["options"][0] == {"label": "自动转给组织管理员", "value": 0}
    assert {item["value"] for item in detail["ui"]["options"]} == {0, ctx.owner_member.pk, ctx.member.pk}
    assert resolve_contact_recipient(ctx.house) == ctx.owner
    team = baker.make("teams.Team", organization=ctx.org)
    assert not any(item["key"] == CONTACT_FALLBACK_MEMBER_SETTING_KEY for item in get_all_team_settings(team))


def test_configured_fallback_is_saved_read_back_and_receives_owner_contact(fallback_context, django_capture_on_commit_callbacks):
    ctx = fallback_context
    response = put_fallback(ctx, ctx.member.pk)
    assert response.status_code == 200, response.content
    assert api_data(ctx.client.get(ctx.url))["value"] == ctx.member.pk
    assert OrganizationSetting.objects.get(organization=ctx.org, setting=ctx.setting).value == ctx.member.pk
    with django_capture_on_commit_callbacks(execute=True):
        response = contact(ctx)
    assert response.status_code == 201, response.content
    payload = api_data(response)
    assert HouseInquiry.objects.get(pk=payload["inquiry_id"]).assigned_to_id == ctx.member.user_id
    assert set(ConversationMember.objects.filter(conversation_id=payload["conversation"]["id"]).values_list("user_id", flat=True)) == {ctx.owner.pk, ctx.member.user_id}
    assert Notification.objects.get(category="messaging.message").recipient_id == ctx.member.user_id


@pytest.mark.parametrize("value", [True, -1, "1", None, 999999999])
def test_invalid_fallback_value_is_rejected(fallback_context, value):
    ctx = fallback_context
    ctx.client.raise_request_exception = False
    response = put_fallback(ctx, value)
    assert response.status_code == 400, response.content
    assert not OrganizationSetting.objects.filter(organization=ctx.org, setting=ctx.setting).exists()


@pytest.mark.parametrize("member_kind", ["inactive", "outsider"])
def test_unavailable_or_foreign_fallback_member_is_rejected(fallback_context, member_kind):
    ctx = fallback_context
    ctx.client.raise_request_exception = False
    response = put_fallback(ctx, getattr(ctx, member_kind).pk)
    assert response.status_code == 400, response.content
    assert not OrganizationSetting.objects.filter(organization=ctx.org, setting=ctx.setting).exists()


def test_setting_management_permission_is_required(fallback_context):
    ctx = fallback_context
    ctx.client.force_login(ctx.member.user)
    assert put_fallback(ctx, ctx.member.pk).status_code == 403


def test_property_responsibility_takes_precedence_over_fallback(fallback_context):
    ctx = fallback_context
    set_org_setting(ctx.org, CONTACT_FALLBACK_MEMBER_SETTING_KEY, ctx.member.pk)
    PropertyResponsibility.objects.create(organization=ctx.org, member=ctx.owner_member, building=ctx.house.building)
    assert resolve_contact_recipient(ctx.house) == ctx.owner


def test_inactive_or_foreign_configured_fallback_returns_to_owner(fallback_context):
    ctx = fallback_context
    set_org_setting(ctx.org, CONTACT_FALLBACK_MEMBER_SETTING_KEY, ctx.member.pk)
    ctx.member.user.is_active = False
    ctx.member.user.save(update_fields=["is_active"])
    assert resolve_contact_recipient(ctx.house) == ctx.owner
    OrganizationSetting.objects.filter(organization=ctx.org, setting=ctx.setting).update(value=ctx.outsider.pk)
    assert resolve_contact_recipient(ctx.house) == ctx.owner
    assert put_fallback(ctx, 0).status_code == 200
    assert resolve_contact_recipient(ctx.house) == ctx.owner


def test_existing_inquiry_keeps_original_active_agent_after_setting_changes(fallback_context, django_capture_on_commit_callbacks):
    ctx = fallback_context
    set_org_setting(ctx.org, CONTACT_FALLBACK_MEMBER_SETTING_KEY, ctx.member.pk)
    with django_capture_on_commit_callbacks(execute=True):
        first = api_data(contact(ctx))
    new_member = baker.make(OrganizationMember, organization=ctx.org, user__is_active=True)
    set_org_setting(ctx.org, CONTACT_FALLBACK_MEMBER_SETTING_KEY, new_member.pk)
    with django_capture_on_commit_callbacks(execute=True):
        second = api_data(contact(ctx))
    assert first["conversation"]["id"] == second["conversation"]["id"]
    assert HouseInquiry.objects.get(pk=second["inquiry_id"]).assigned_to_id == ctx.member.user_id


def test_setting_registration_preserves_configured_default_value(fallback_context):
    ctx = fallback_context
    ctx.setting.value = ctx.member.pk
    ctx.setting.save(update_fields=["value"])
    migration = importlib.import_module("apps.settings.migrations.0016_property_rental_contact_fallback_member")
    migration.ensure_contact_fallback_member_setting(django_apps, None)
    ctx.setting.refresh_from_db()
    assert ctx.setting.value == ctx.member.pk
