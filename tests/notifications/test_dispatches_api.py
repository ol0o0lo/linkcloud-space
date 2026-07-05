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


def _detail_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/"


def _notifications_url(pk: int) -> str:
    return f"/api/notification-dispatches/{pk}/notifications/"


def set_session_org(client, org):
    session = client.session
    session["organization_data"] = json.dumps(
        {"pk": org.pk, "id": org.pk, "name": org.name, "slug": org.slug, "is_owner": False}
    )
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

    def _post_json(self, data):
        return self.client.post(DISPATCHES_URL, data=json.dumps(data), content_type="application/json")

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

    def test_superuser_cannot_create_organization_dispatch_for_missing_org(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_platform_admin()
        missing_org_id = self.other_org.pk + 10000

        resp = self._post_json({"scope": "organization", "scope_ids": [self.org.pk, missing_org_id], "title": "Nope"})

        assert resp.status_code == 400
        body = api_error(resp)
        assert "organization" in body["message"].lower()
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
        assert "user" in body["message"].lower()
        assert str(missing_user_id) in body["message"]
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

    def test_tenant_owner_cannot_target_outsider(self, monkeypatch):
        delay = Mock()
        monkeypatch.setattr("apps.notifications.api.dispatch_notification.delay", delay)
        self._login_tenant_owner()

        resp = self._post_json({"scope": "users", "scope_ids": [self.outsider.pk], "title": "Nope"})

        assert resp.status_code == 403
        api_error(resp)
        assert NotificationDispatch.objects.count() == 0
        delay.assert_not_called()

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
