import json
from unittest.mock import Mock

import pytest
from model_bakery import baker

from apps.accounts.models import User
from apps.notifications.constants import NotificationDispatchScope, NotificationDispatchStatus
from apps.notifications.models import Notification, NotificationDispatch
from apps.organizations.models import OrganizationMember
from tests.api_helpers import api_data, api_error

DISPATCHES_URL = "/api/notification-dispatches/"
DISPATCH_TARGETS_URL = "/api/notification-dispatches/targets/"


def _detail_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/"


def _notifications_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/notifications/"


def set_session_org(client, org):
    session = client.session
    session["organization_data"] = json.dumps({"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": False})
    session.save()


@pytest.mark.django_db
class TestNotificationDispatchAPI:
    @pytest.fixture(autouse=True)
    def _setup(self, client):
        self.client = client
        self.superuser = User.objects.create_superuser(username="platform-admin", password="secret")  # noqa: S106
        self.owner = User.objects.create_user(username="tenant-owner", password="secret")  # noqa: S106
        self.member = User.objects.create_user(username="member", password="secret")  # noqa: S106
        self.outsider = User.objects.create_user(username="outsider", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization")
        self.other_org = baker.make("organizations.Organization")
        OrganizationMember.objects.create(organization=self.org, user=self.owner, is_owner=True)
        OrganizationMember.objects.create(organization=self.org, user=self.member)
        OrganizationMember.objects.create(organization=self.other_org, user=self.outsider)

    def _post_json(self, data, *, management_context=None):
        url = DISPATCHES_URL if management_context is None else f"{DISPATCHES_URL}?management_context={management_context}"
        return self.client.post(url, data=json.dumps(data), content_type="application/json")

    def _login_platform_admin(self):
        self.client.force_login(self.superuser)

    def _login_tenant_owner(self):
        self.client.force_login(self.owner)
        set_session_org(self.client, self.org)

    def test_superuser_can_create_platform_dispatch(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_platform_admin()

        resp = self._post_json(
            {
                "scope": "platform",
                "scope_ids": [],
                "category": "ops",
                "title": "Hello everyone",
                "body": "Body",
                "url": "/dashboard/",
                "data": {"source": "api"},
            }
        )

        assert resp.status_code == 200
        body = api_data(resp)
        dispatch = NotificationDispatch.objects.get(pk=body["id"])
        assert dispatch.owner_organization_id is None
        assert dispatch.scope == NotificationDispatchScope.PLATFORM
        assert body["scope__mapping"] == str(NotificationDispatchScope(body["scope"]).label)
        assert body["status__mapping"] == str(NotificationDispatchStatus(body["status"]).label)
        assert dispatch.created_by == self.superuser.username
        delay.assert_called_once_with(dispatch.pk)

    def test_create_dispatch_rejects_unsafe_url(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_platform_admin()

        resp = self._post_json(
            {
                "scope": "platform",
                "scope_ids": [],
                "title": "Unsafe",
                "url": "javascript:alert(1)",
            }
        )

        assert resp.status_code == 400
        assert "url" in api_error(resp)["data"]["fields"]
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_superuser_cannot_create_organization_dispatch_for_missing_org(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_platform_admin()
        missing_org_id = self.other_org.pk + 10000

        resp = self._post_json({"scope": "organization", "scope_ids": [self.org.pk, missing_org_id], "title": "Nope"})

        assert resp.status_code == 400
        body = api_error(resp)
        assert "未知组织" in body["message"]
        assert str(missing_org_id) in body["message"]
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_superuser_cannot_create_users_dispatch_for_missing_user(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_platform_admin()
        missing_user_id = self.outsider.pk + 10000

        resp = self._post_json({"scope": "users", "scope_ids": [self.member.pk, missing_user_id], "title": "Nope"})

        assert resp.status_code == 400
        body = api_error(resp)
        assert "未知用户" in body["message"]
        assert str(missing_user_id) in body["message"]
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_superuser_can_search_active_organization_targets(self):
        self.org.name = "Alpha Cloud"
        self.org.slug = "alpha-cloud"
        self.org.save(update_fields=["name", "slug", "updated_at"])
        inactive_org = baker.make(
            "organizations.Organization",
            name="Alpha Archived",
            slug="alpha-archived",
            is_active=False,
        )
        self._login_platform_admin()

        resp = self.client.get(
            DISPATCH_TARGETS_URL,
            {"scope": "organization", "keyword": "alpha", "page": 1, "page_size": 20},
        )

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["total"] == 1
        assert body["items"] == [
            {
                "id": self.org.pk,
                "label": "Alpha Cloud",
                "description": "alpha-cloud",
                "avatar_url": None,
            }
        ]
        assert inactive_org.pk not in [item["id"] for item in body["items"]]

    def test_superuser_can_search_active_user_targets(self):
        matching_user = User.objects.create_user(
            username="target-alice",
            email="alice-target@example.com",
            first_name="Alice",
            last_name="Target",
            password="secret",  # noqa: S106
        )
        User.objects.create_user(
            username="target-inactive",
            email="inactive-target@example.com",
            first_name="Inactive",
            last_name="Target",
            password="secret",  # noqa: S106
            is_active=False,
        )
        self._login_platform_admin()

        resp = self.client.get(
            DISPATCH_TARGETS_URL,
            {"scope": "users", "keyword": "alice-target@example.com", "page": 1, "page_size": 20},
        )

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["total"] == 1
        assert body["items"] == [
            {
                "id": matching_user.pk,
                "label": "Alice Target",
                "description": "target-alice · alice-target@example.com",
                "avatar_url": None,
            }
        ]

    def test_superuser_can_create_team_dispatch_in_selected_organization(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        team = baker.make("teams.Team", organization=self.org, name="Selected Team")
        self._login_platform_admin()
        set_session_org(self.client, self.org)

        resp = self._post_json(
            {"scope": "teams", "scope_ids": [team.pk], "title": "Team update"},
            management_context="tenant",
        )

        assert resp.status_code == 200
        dispatch = NotificationDispatch.objects.get(pk=api_data(resp)["id"])
        assert dispatch.owner_organization_id == self.org.pk
        assert dispatch.scope == NotificationDispatchScope.TEAMS
        assert dispatch.scope_ids == [team.pk]
        delay.assert_called_once_with(dispatch.pk)

    def test_superuser_tenant_context_limits_list_detail_and_delivery_rows(self):
        current_dispatch = NotificationDispatch.objects.create(
            owner_organization=self.org,
            scope=NotificationDispatchScope.USERS,
            scope_ids=[self.member.pk],
            title="Current tenant",
        )
        other_dispatch = NotificationDispatch.objects.create(
            owner_organization=self.other_org,
            scope=NotificationDispatchScope.USERS,
            scope_ids=[self.outsider.pk],
            title="Other tenant",
        )
        NotificationDispatch.objects.create(scope=NotificationDispatchScope.PLATFORM, scope_ids=[], title="Platform")
        current_notification = baker.make(
            Notification,
            dispatch=current_dispatch,
            recipient=self.member,
            organization=self.org,
            title="Current row",
        )
        baker.make(
            Notification,
            dispatch=current_dispatch,
            recipient=self.outsider,
            organization=self.other_org,
            title="Cross-tenant row",
        )
        self._login_platform_admin()
        set_session_org(self.client, self.org)

        list_resp = self.client.get(DISPATCHES_URL, {"management_context": "tenant"})
        other_detail_resp = self.client.get(_detail_url(other_dispatch.pk), {"management_context": "tenant"})
        rows_resp = self.client.get(_notifications_url(current_dispatch.pk), {"management_context": "tenant"})

        assert list_resp.status_code == 200
        assert [row["id"] for row in api_data(list_resp)["items"]] == [current_dispatch.pk]
        assert other_detail_resp.status_code == 404
        assert rows_resp.status_code == 200
        assert [row["id"] for row in api_data(rows_resp)["items"]] == [current_notification.pk]

    def test_superuser_tenant_context_limits_target_candidates_to_selected_org(self):
        current_team = baker.make("teams.Team", organization=self.org, name="Current Team")
        baker.make("teams.Team", organization=self.other_org, name="Other Team")
        self.member.first_name = "Current"
        self.member.last_name = "Member"
        self.member.save(update_fields=["first_name", "last_name"])
        self._login_platform_admin()
        set_session_org(self.client, self.org)

        org_resp = self.client.get(
            DISPATCH_TARGETS_URL,
            {"scope": "organization", "management_context": "tenant"},
        )
        team_resp = self.client.get(
            DISPATCH_TARGETS_URL,
            {"scope": "teams", "management_context": "tenant"},
        )
        user_resp = self.client.get(
            DISPATCH_TARGETS_URL,
            {"scope": "users", "keyword": "current", "management_context": "tenant"},
        )

        assert org_resp.status_code == 200
        assert [item["id"] for item in api_data(org_resp)["items"]] == [self.org.pk]
        assert team_resp.status_code == 200
        assert [item["id"] for item in api_data(team_resp)["items"]] == [current_team.pk]
        assert user_resp.status_code == 200
        assert [item["id"] for item in api_data(user_resp)["items"]] == [self.member.pk]

    def test_superuser_tenant_context_rejects_cross_tenant_and_platform_scopes(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        other_team = baker.make("teams.Team", organization=self.other_org)
        self._login_platform_admin()
        set_session_org(self.client, self.org)

        payloads = [
            {"scope": "platform", "scope_ids": [], "title": "No platform"},
            {"scope": "organization", "scope_ids": [self.other_org.pk], "title": "No other org"},
            {"scope": "teams", "scope_ids": [other_team.pk], "title": "No other team"},
            {"scope": "users", "scope_ids": [self.outsider.pk], "title": "No outsider"},
        ]

        responses = [self._post_json(payload, management_context="tenant") for payload in payloads]

        assert [response.status_code for response in responses] == [403, 403, 403, 403]
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_tenant_owner_cannot_create_platform_dispatch(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_tenant_owner()

        resp = self._post_json({"scope": "platform", "scope_ids": [], "title": "Nope"})

        assert resp.status_code == 403
        api_error(resp)
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_tenant_owner_cannot_use_platform_management_context(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_tenant_owner()

        resp = self._post_json(
            {"scope": "users", "scope_ids": [self.member.pk], "title": "Nope"},
            management_context="platform",
        )

        assert resp.status_code == 403
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_tenant_owner_can_create_users_dispatch_for_org_member(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_tenant_owner()

        resp = self._post_json({"scope": "users", "scope_ids": [self.member.pk], "title": "Team update"})

        assert resp.status_code == 200
        body = api_data(resp)
        dispatch = NotificationDispatch.objects.get(pk=body["id"])
        assert dispatch.owner_organization_id == self.org.pk
        assert dispatch.scope_ids == [self.member.pk]
        assert dispatch.created_by == self.owner.username
        delay.assert_called_once_with(dispatch.pk)

    def test_tenant_owner_can_create_team_dispatch_for_current_org(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        team = baker.make("teams.Team", organization=self.org, name="Operations")
        self._login_tenant_owner()

        resp = self._post_json({"scope": "teams", "scope_ids": [team.pk, team.pk], "title": "Team update"})

        assert resp.status_code == 200
        dispatch = NotificationDispatch.objects.get(pk=api_data(resp)["id"])
        assert dispatch.owner_organization_id == self.org.pk
        assert dispatch.scope == NotificationDispatchScope.TEAMS
        assert dispatch.scope_ids == [team.pk]
        delay.assert_called_once_with(dispatch.pk)

    def test_tenant_owner_cannot_target_team_from_other_org(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        other_team = baker.make("teams.Team", organization=self.other_org, name="Other Team")
        self._login_tenant_owner()

        resp = self._post_json({"scope": "teams", "scope_ids": [other_team.pk], "title": "Nope"})

        assert resp.status_code == 403
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_tenant_owner_cannot_target_outsider(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_tenant_owner()

        resp = self._post_json({"scope": "users", "scope_ids": [self.outsider.pk], "title": "Nope"})

        assert resp.status_code == 403
        api_error(resp)
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

    def test_tenant_owner_target_candidates_are_limited_to_current_org(self):
        self.org.name = "Current Organization"
        self.org.slug = "current-organization"
        self.org.save(update_fields=["name", "slug", "updated_at"])
        self.member.first_name = "Current"
        self.member.last_name = "Member"
        self.member.email = "current-member@example.com"
        self.member.save(update_fields=["first_name", "last_name", "email"])
        inactive_member = User.objects.create_user(username="inactive-member", password="secret", is_active=False)  # noqa: S106
        OrganizationMember.objects.create(organization=self.org, user=inactive_member)
        current_team = baker.make("teams.Team", organization=self.org, name="Current Team")
        baker.make("teams.Team", organization=self.other_org, name="Other Team")
        self._login_tenant_owner()

        org_resp = self.client.get(DISPATCH_TARGETS_URL, {"scope": "organization", "page": 1, "page_size": 20})
        team_resp = self.client.get(DISPATCH_TARGETS_URL, {"scope": "teams", "keyword": "current", "page": 1, "page_size": 20})
        user_resp = self.client.get(DISPATCH_TARGETS_URL, {"scope": "users", "keyword": "member", "page": 1, "page_size": 20})

        assert org_resp.status_code == 200
        org_body = api_data(org_resp)
        assert org_body["items"] == [
            {
                "id": self.org.pk,
                "label": "Current Organization",
                "description": "current-organization",
                "avatar_url": None,
            }
        ]

        assert team_resp.status_code == 200
        team_body = api_data(team_resp)
        assert team_body["items"] == [
            {
                "id": current_team.pk,
                "label": "Current Team",
                "description": "Current Organization",
                "avatar_url": None,
            }
        ]

        assert user_resp.status_code == 200
        user_body = api_data(user_resp)
        assert [item["id"] for item in user_body["items"]] == [self.member.pk]
        assert self.outsider.pk not in [item["id"] for item in user_body["items"]]
        assert inactive_member.pk not in [item["id"] for item in user_body["items"]]

    def test_non_owner_cannot_list_dispatch_targets(self):
        self.client.force_login(self.member)
        set_session_org(self.client, self.org)

        resp = self.client.get(DISPATCH_TARGETS_URL, {"scope": "users"})

        assert resp.status_code == 403
        api_error(resp)

    def test_tenant_owner_list_is_limited_to_current_org_owned_dispatches(self):
        mine = NotificationDispatch.objects.create(owner_organization=self.org, scope=NotificationDispatchScope.USERS, scope_ids=[self.member.pk], title="Mine")
        NotificationDispatch.objects.create(owner_organization=self.other_org, scope=NotificationDispatchScope.USERS, scope_ids=[self.outsider.pk], title="Other org")
        NotificationDispatch.objects.create(scope=NotificationDispatchScope.PLATFORM, scope_ids=[], title="Platform")
        self._login_tenant_owner()

        resp = self.client.get(DISPATCHES_URL)

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["total"] == 1
        row = body["items"][0]
        assert row["id"] == mine.pk
        assert row["scope__mapping"] == str(NotificationDispatchScope(row["scope"]).label)
        assert row["status__mapping"] == str(NotificationDispatchStatus(row["status"]).label)

    def test_tenant_owner_can_get_accessible_dispatch_detail(self):
        dispatch = NotificationDispatch.objects.create(owner_organization=self.org, scope=NotificationDispatchScope.USERS, scope_ids=[self.member.pk], title="Mine")
        self._login_tenant_owner()

        resp = self.client.get(_detail_url(dispatch.pk))

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["id"] == dispatch.pk
        assert body["owner_organization_id"] == self.org.pk
        assert body["title"] == "Mine"
        assert body["scope__mapping"] == str(NotificationDispatchScope(body["scope"]).label)
        assert body["status__mapping"] == str(NotificationDispatchStatus(body["status"]).label)

    def test_tenant_owner_can_list_delivery_rows_for_accessible_dispatch(self):
        dispatch = NotificationDispatch.objects.create(owner_organization=self.org, scope=NotificationDispatchScope.USERS, scope_ids=[self.member.pk], title="Mine")
        notification = baker.make(Notification, dispatch=dispatch, recipient=self.member, organization=self.org, title="Delivered")
        baker.make(Notification, dispatch=dispatch, recipient=self.outsider, organization=self.other_org, title="Outsider")
        self._login_tenant_owner()

        resp = self.client.get(_notifications_url(dispatch.pk))

        assert resp.status_code == 200
        body = api_data(resp)
        assert body["total"] == 1
        assert [row["id"] for row in body["items"]] == [notification.pk]
