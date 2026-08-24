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
        session["organization_data"] = json.dumps({"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True})
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
            data=json.dumps(
                {
                    "name": "Engineering",
                    "phone": "13800138000",
                    "wechat": "acme-service",
                    "address": "深圳市南山区科技园",
                    "business_hours": "周一至周日 09:00-21:00",
                    "members": [self.user.pk],
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(Team.objects.count(), 1)
        team = Team.objects.get()
        self.assertEqual(team.name, "Engineering")
        self.assertEqual(team.phone, "13800138000")
        self.assertEqual(team.wechat, "acme-service")
        self.assertEqual(team.address, "深圳市南山区科技园")
        self.assertEqual(team.business_hours, "周一至周日 09:00-21:00")
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
            data=json.dumps(
                {
                    "name": "Platform",
                    "phone": "0755-12345678",
                    "wechat": "platform-service",
                    "address": "深圳市福田区中心路",
                    "business_hours": "工作日 09:00-18:00",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        team.refresh_from_db()
        self.assertEqual(team.name, "Platform")
        self.assertEqual(team.phone, "0755-12345678")
        self.assertEqual(team.wechat, "platform-service")
        self.assertEqual(team.address, "深圳市福田区中心路")
        self.assertEqual(team.business_hours, "工作日 09:00-18:00")

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

    def test_add_team_member_is_idempotent(self):
        employee = User.objects.create_user(username="employee", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=employee)
        team = baker.make("teams.Team", organization=self.org)
        self._login()

        first = self.client.post(f"/api/teams/{team.pk}/members/{employee.pk}/")
        second = self.client.post(f"/api/teams/{team.pk}/members/{employee.pk}/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(api_data(first)["changed"])
        self.assertFalse(api_data(second)["changed"])
        self.assertEqual(team.members.filter(pk=employee.pk).count(), 1)

    def test_remove_team_member_is_idempotent_and_cleans_team_role_bindings(self):
        employee = User.objects.create_user(username="removable-employee", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=employee)
        team = baker.make("teams.Team", organization=self.org)
        team.members.add(employee)
        group = make_access_group("employee_team_role", AccessScope.TEAM, [("teams", "team_view")])
        binding = bind_team_role(team, employee, group)
        self._login()

        first = self.client.delete(f"/api/teams/{team.pk}/members/{employee.pk}/")
        second = self.client.delete(f"/api/teams/{team.pk}/members/{employee.pk}/")

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(api_data(first)["changed"])
        self.assertFalse(api_data(second)["changed"])
        self.assertFalse(team.members.filter(pk=employee.pk).exists())
        self.assertFalse(type(binding).objects.filter(pk=binding.pk).exists())

    def test_add_team_member_rejects_user_from_other_organization(self):
        outsider = User.objects.create_user(username="outsider", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", user=outsider)
        team = baker.make("teams.Team", organization=self.org)
        self._login()

        response = self.client.post(f"/api/teams/{team.pk}/members/{outsider.pk}/")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(team.members.filter(pk=outsider.pk).exists())

    def test_replacing_team_members_cleans_removed_member_role_bindings(self):
        employee = User.objects.create_user(username="replaced-employee", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=employee)
        team = baker.make("teams.Team", organization=self.org)
        team.members.add(employee)
        group = make_access_group("replaced_employee_team_role", AccessScope.TEAM, [("teams", "team_view")])
        binding = bind_team_role(team, employee, group)
        self._login()

        response = self.client.patch(
            _detail_url(team.pk),
            data=json.dumps({"members": []}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(team.members.filter(pk=employee.pk).exists())
        self.assertFalse(type(binding).objects.filter(pk=binding.pk).exists())

    def test_destroy(self):
        team = baker.make("teams.Team", name="Engineering", organization=self.org)
        self._login()
        resp = self.client.delete(_detail_url(team.pk))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(api_data(resp), {})
        self.assertFalse(Team.objects.filter(pk=team.pk).exists())
