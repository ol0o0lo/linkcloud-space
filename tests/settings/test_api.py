import json

import pytest
from model_bakery import baker

from apps.access.models import AccessRole
from apps.accounts.models import User
from apps.organizations.models import OrganizationMember
from apps.settings.models import DefaultSetting, OrganizationSetting
from tests.access.helpers import bind_org_role, bind_team_role, make_access_group
from tests.api_helpers import api_data

ORG_LIST_URL = "/api/settings/org/"
USER_LIST_URL = "/api/settings/user/"


def org_detail_url(key):
    return f"/api/settings/org/{key}/"


def team_list_url(team_id):
    return f"/api/settings/teams/{team_id}/"


def team_detail_url(team_id, key):
    return f"/api/settings/teams/{team_id}/{key}/"


def user_detail_url(key):
    return f"/api/settings/user/{key}/"


def set_session_org(client, org, is_owner=False):
    session = client.session
    session["organization_data"] = json.dumps(
        {"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": is_owner}
    )
    session.save()


def put_json(client, url, data):
    return client.put(url, data=json.dumps(data), content_type="application/json")


@pytest.fixture
def default_text(db):
    return DefaultSetting.objects.create(
        key="site_name", value="My SaaS", value_type="text", description="站点名称", category="general"
    )


@pytest.fixture
def default_password(db):
    return DefaultSetting.objects.create(
        key="api_secret", value="raw_secret", value_type="password", description="API 密钥"
    )


@pytest.fixture
def org(db):
    return baker.make("organizations.Organization")


@pytest.fixture
def owner(db, org):
    user = User.objects.create_user(username="owner", password="secret")  # noqa: S106
    OrganizationMember.objects.create(organization=org, user=user, is_owner=True)
    return user


@pytest.fixture
def member(db, org):
    user = User.objects.create_user(username="member", password="secret")  # noqa: S106
    OrganizationMember.objects.create(organization=org, user=user, is_owner=False)
    return user


@pytest.mark.django_db
class TestOrgSettingList:
    def test_requires_login(self, client, default_text, org):
        resp = client.get(ORG_LIST_URL)
        assert resp.status_code in (401, 403)

    def test_member_without_view_permission_cannot_list(self, client, default_text, org, member):
        client.force_login(member)
        set_session_org(client, org)
        resp = client.get(ORG_LIST_URL)
        assert resp.status_code == 403

    def test_member_with_view_permission_can_list(self, client, default_text, org, member):
        group = make_access_group(
            "org_settings_viewer",
            AccessRole.Scope.ORG,
            [("settings", "org_setting_view")],
        )
        bind_org_role(org, member, group)
        client.force_login(member)
        set_session_org(client, org)
        resp = client.get(ORG_LIST_URL)
        assert resp.status_code == 200
        data = api_data(resp)
        assert any(item["key"] == "site_name" for item in data)

    def test_response_includes_description_and_value_type(self, client, default_text, org, member):
        group = make_access_group(
            "org_settings_viewer_details",
            AccessRole.Scope.ORG,
            [("settings", "org_setting_view")],
        )
        bind_org_role(org, member, group)
        client.force_login(member)
        set_session_org(client, org)
        resp = client.get(ORG_LIST_URL)
        item = next(i for i in api_data(resp) if i["key"] == "site_name")
        assert item["description"] == "站点名称"
        assert item["value_type"] == "text"
        assert item["category"] == "general"
        assert item["is_customized"] is False

    def test_password_value_masked(self, client, default_password, org, member):
        group = make_access_group(
            "org_settings_viewer_password",
            AccessRole.Scope.ORG,
            [("settings", "org_setting_view")],
        )
        bind_org_role(org, member, group)
        client.force_login(member)
        set_session_org(client, org)
        resp = client.get(ORG_LIST_URL)
        item = next(i for i in api_data(resp) if i["key"] == "api_secret")
        assert item["value"] == "********"


@pytest.mark.django_db
class TestOrgSettingDetail:
    def test_owner_can_put(self, client, default_text, org, owner):
        client.force_login(owner)
        set_session_org(client, org, is_owner=True)
        resp = put_json(client, org_detail_url("site_name"), {"value": "New Name"})
        assert resp.status_code == 200
        data = api_data(resp)
        assert data["value"] == "New Name"
        assert data["is_customized"] is True

    def test_member_cannot_put(self, client, default_text, org, member):
        client.force_login(member)
        set_session_org(client, org, is_owner=False)
        resp = put_json(client, org_detail_url("site_name"), {"value": "Hack"})
        assert resp.status_code == 403

    def test_owner_can_delete(self, client, default_text, org, owner):
        OrganizationSetting.objects.create(organization=org, setting=default_text, value="Custom")
        client.force_login(owner)
        set_session_org(client, org, is_owner=True)
        resp = client.delete(org_detail_url("site_name"))
        assert resp.status_code == 200
        assert api_data(resp) == {}
        assert not OrganizationSetting.objects.filter(organization=org).exists()

    def test_delete_nonexistent_returns_404(self, client, default_text, org, owner):
        client.force_login(owner)
        set_session_org(client, org, is_owner=True)
        resp = client.delete(org_detail_url("site_name"))
        assert resp.status_code == 404

    def test_unknown_key_returns_404(self, client, org, owner, db):
        client.force_login(owner)
        set_session_org(client, org, is_owner=True)
        resp = client.get(org_detail_url("nonexistent"))
        assert resp.status_code == 404


@pytest.mark.django_db
class TestTeamSettingDetail:
    def test_team_viewer_can_list_bound_team_settings(self, client, default_text, org, member):
        team = baker.make("teams.Team", organization=org)
        team.members.add(member)
        group = make_access_group(
            "team_settings_viewer",
            AccessRole.Scope.TEAM,
            [("settings", "team_setting_view")],
        )
        bind_team_role(team, member, group)
        client.force_login(member)
        set_session_org(client, org)

        resp = client.get(team_list_url(team.pk))

        assert resp.status_code == 200

    def test_team_member_without_view_permission_cannot_list_team_settings(self, client, default_text, org, member):
        team = baker.make("teams.Team", organization=org)
        team.members.add(member)
        client.force_login(member)
        set_session_org(client, org)

        resp = client.get(team_list_url(team.pk))

        assert resp.status_code == 403

    def test_team_manager_can_put_bound_team_setting(self, client, default_text, org, member):
        team = baker.make("teams.Team", organization=org)
        team.members.add(member)
        group = make_access_group(
            "team_manager_for_settings",
            AccessRole.Scope.TEAM,
            [("settings", "team_setting_manage")],
        )
        bind_team_role(team, member, group)
        client.force_login(member)
        set_session_org(client, org)

        resp = put_json(client, team_detail_url(team.pk, "site_name"), {"value": "Team Name"})

        assert resp.status_code == 200
        assert api_data(resp)["value"] == "Team Name"

    def test_team_manager_cannot_put_other_team_setting(self, client, default_text, org, member):
        team = baker.make("teams.Team", organization=org)
        other_team = baker.make("teams.Team", organization=org)
        team.members.add(member)
        other_team.members.add(member)
        group = make_access_group(
            "team_manager_for_settings_other",
            AccessRole.Scope.TEAM,
            [("settings", "team_setting_manage")],
        )
        bind_team_role(team, member, group)
        client.force_login(member)
        set_session_org(client, org)

        resp = put_json(client, team_detail_url(other_team.pk, "site_name"), {"value": "Other Team"})

        assert resp.status_code == 403


@pytest.mark.django_db
class TestUserSettings:
    @pytest.fixture
    def user(self, db):
        return User.objects.create_user(username="alice", password="secret")  # noqa: S106

    def test_requires_login(self, client):
        resp = client.get(USER_LIST_URL)
        assert resp.status_code in (401, 403)

    def test_list_empty_initially(self, client, user):
        client.force_login(user)
        resp = client.get(USER_LIST_URL)
        assert resp.status_code == 200
        assert api_data(resp) == []

    def test_put_and_get(self, client, user):
        client.force_login(user)
        put_json(client, user_detail_url("onboarding_done"), {"value": True})
        resp = client.get(user_detail_url("onboarding_done"))
        assert resp.status_code == 200
        assert api_data(resp)["value"] is True

    def test_delete(self, client, user):
        client.force_login(user)
        put_json(client, user_detail_url("theme"), {"value": "dark"})
        resp = client.delete(user_detail_url("theme"))
        assert resp.status_code == 200
        assert api_data(resp) == {}
        resp = client.get(user_detail_url("theme"))
        assert resp.status_code == 404

    def test_cannot_access_other_user_setting(self, client, db):
        alice = User.objects.create_user(username="alice2", password="secret")  # noqa: S106
        bob = User.objects.create_user(username="bob2", password="secret")  # noqa: S106
        client.force_login(alice)
        put_json(client, user_detail_url("secret_pref"), {"value": "alice_value"})
        client.force_login(bob)
        resp = client.get(user_detail_url("secret_pref"))
        assert resp.status_code == 404
