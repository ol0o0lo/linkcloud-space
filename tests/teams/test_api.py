import json

from django.contrib.auth import user_logged_in
from django.test import TestCase

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.accounts.models import User
from apps.organizations.signals import user_logged_in_receiver
from apps.teams.models import Team
from tests.access.helpers import bind_org_role, bind_team_role, make_access_group
from tests.api_helpers import api_data

LIST_URL = "/api/teams/"


def _detail_url(pk: int) -> str:
    return f"/api/teams/{pk}/"


class TestTeamAPI(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(username="owner", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)

    def _login(self):
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True}
        )
        session.save()

    def test_list(self):
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        baker.make("teams.Team", name="Other Org Team")
        self._login()
        resp = self.client.get(LIST_URL)
        self.assertEqual(resp.status_code, 200)
        body = api_data(resp)
        self.assertEqual(len(body["items"]), 1)
        self.assertEqual(body["items"][0]["id"], team.pk)
        self.assertEqual(body["total"], 1)
        self.assertEqual(body["page"], 1)

    def test_list_q_search(self):
        baker.make("teams.Team", name="Engineering", organization=self.org)
        baker.make("teams.Team", name="Designers", organization=self.org)
        self._login()
        resp = self.client.get(LIST_URL, {"keyword": "design"})
        names = [r["name"] for r in api_data(resp)["items"]]
        self.assertEqual(names, ["Designers"])

    def test_list_ignores_inactive_team_view_role(self):
        self.user = User.objects.create_user(username="inactive-role-user", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=False)
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        team.members.add(self.user)
        group = make_access_group(
            "inactive_team_view_role",
            AccessScope.TEAM,
            [("teams", "team_view")],
        )
        group.access_role.is_active = False
        group.access_role.save(update_fields=["is_active"])
        bind_team_role(team, self.user, group)
        self._login()

        resp = self.client.get(LIST_URL)

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["total"], 0)

    def test_create(self):
        self._login()
        resp = self.client.post(
            LIST_URL,
            data=json.dumps({"name": "Engineering", "members": [self.user.pk]}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Team.objects.count(), 1)
        team = Team.objects.get()
        self.assertEqual(team.name, "Engineering")
        self.assertEqual(team.organization, self.org)
        self.assertIn(self.user, team.members.all())

    def test_org_admin_can_create(self):
        self.user = User.objects.create_user(username="admin", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=False)
        group = make_access_group(
            "org_admin_for_teams",
            AccessScope.ORG,
            [("teams", "team_create")],
        )
        bind_org_role(self.org, self.user, group)
        self._login()

        resp = self.client.post(
            LIST_URL,
            data=json.dumps({"name": "Operations", "members": [self.user.pk]}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Team.objects.filter(name="Operations", organization=self.org).exists())

    def test_retrieve(self):
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        self._login()
        resp = self.client.get(_detail_url(team.pk))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp)["name"], "Engineering")

    def test_update(self):
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        self._login()
        resp = self.client.patch(
            _detail_url(team.pk),
            data=json.dumps({"name": "Platform"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        team.refresh_from_db()
        self.assertEqual(team.name, "Platform")

    def test_team_manager_can_update_bound_team_only(self):
        self.user = User.objects.create_user(username="manager", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=False)
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        other_team = baker.make("teams.Team", name="Support", organization=self.org)
        team.members.add(self.user)
        other_team.members.add(self.user)
        group = make_access_group(
            "team_manager_for_update",
            AccessScope.TEAM,
            [("teams", "team_update")],
        )
        bind_team_role(team, self.user, group)
        self._login()

        resp = self.client.patch(
            _detail_url(team.pk),
            data=json.dumps({"name": "Platform"}),
            content_type="application/json",
        )
        denied = self.client.patch(
            _detail_url(other_team.pk),
            data=json.dumps({"name": "Customer Success"}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(denied.status_code, 403)
        team.refresh_from_db()
        other_team.refresh_from_db()
        self.assertEqual(team.name, "Platform")
        self.assertEqual(other_team.name, "Support")

    def test_team_finance_cannot_manage_team_members(self):
        self.user = User.objects.create_user(username="finance", password="secret")  # noqa: S106
        other_user = User.objects.create_user(username="staff", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=other_user, is_owner=False)
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        team.members.add(self.user)
        group = make_access_group(
            "team_finance_without_member_manage",
            AccessScope.TEAM,
            [("settings", "team_setting_manage")],
        )
        bind_team_role(team, self.user, group)
        self._login()

        resp = self.client.patch(
            _detail_url(team.pk),
            data=json.dumps({"members": [self.user.pk, other_user.pk]}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)
        self.assertNotIn(other_user, team.members.all())

    def test_destroy(self):
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        self._login()
        resp = self.client.delete(_detail_url(team.pk))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.assertFalse(Team.objects.filter(pk=team.pk).exists())
