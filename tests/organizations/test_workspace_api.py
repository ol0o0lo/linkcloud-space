import json
from datetime import timedelta

from django.contrib.auth import user_logged_in
from django.test import TestCase
from django.utils import timezone

from model_bakery import baker

from apps.access.constants import AccessScope
from apps.accounts.models import User
from apps.house.models import PropertyResponsibility
from apps.organizations.models import OrganizationInvite
from apps.organizations.signals import user_logged_in_receiver
from tests.access.helpers import bind_org_role, make_access_group
from tests.api_helpers import api_data


class TestOrganizationWorkspaceAPI(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.user = User.objects.create_user(username="workspace-owner", email="owner@example.com", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization", name="链云空间")
        self.owner_member = baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=True)

    def _login(self, *, is_owner=True):
        self.client.force_login(self.user)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": is_owner}
        )
        session.save()

    def test_navigation_returns_counts_and_lightweight_teams(self):
        team = baker.make("teams.Team", organization=self.org, name="租赁运营组")
        team.members.add(self.user)
        OrganizationInvite.objects.create(organization=self.org, sender=self.user, invitee_email="guest@example.com")
        self._login()

        response = self.client.get("/api/organization-workspace/navigation/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertEqual(payload["organization"]["id"], self.org.pk)
        self.assertEqual(payload["member_count"], 1)
        self.assertEqual(payload["owner_count"], 1)
        self.assertEqual(payload["team_count"], 1)
        self.assertEqual(payload["pending_invite_count"], 1)
        self.assertEqual(payload["unassigned_responsibility_count"], 1)
        self.assertEqual(payload["teams"][0], {"id": team.pk, "name": "租赁运营组", "member_count": 1})
        self.assertNotIn("member_details", payload["teams"][0])
        self.assertEqual(
            payload["capabilities"],
            {
                "member_manage": True,
                "invite_manage": True,
                "role_view": True,
                "role_manage": True,
                "team_create": True,
                "responsibility_manage": True,
                "team_update_ids": [team.pk],
                "team_delete_ids": [team.pk],
                "team_member_manage_ids": [team.pk],
                "team_role_view_ids": [team.pk],
                "team_role_manage_ids": [team.pk],
            },
        )

    def test_navigation_hides_invite_count_without_invite_permission(self):
        viewer = User.objects.create_user(username="workspace-viewer", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=viewer, is_owner=False)
        group = make_access_group("workspace_member_view", AccessScope.ORG, [("organizations", "member_view")])
        bind_org_role(self.org, viewer, group)
        OrganizationInvite.objects.create(organization=self.org, sender=self.user, invitee_email="guest@example.com")
        self.user = viewer
        self._login(is_owner=False)

        response = self.client.get("/api/organization-workspace/navigation/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertIsNone(payload["pending_invite_count"])
        self.assertFalse(payload["capabilities"]["member_manage"])
        self.assertFalse(payload["capabilities"]["invite_manage"])
        self.assertFalse(payload["capabilities"]["role_view"])
        self.assertFalse(payload["capabilities"]["role_manage"])
        self.assertFalse(payload["capabilities"]["team_create"])
        self.assertFalse(payload["capabilities"]["responsibility_manage"])

    def test_navigation_only_counts_unexpired_invites(self):
        active_invite = OrganizationInvite.objects.create(
            organization=self.org,
            sender=self.user,
            invitee_email="active@example.com",
        )
        expired_invite = OrganizationInvite.objects.create(
            organization=self.org,
            sender=self.user,
            invitee_email="expired@example.com",
        )
        OrganizationInvite.objects.filter(pk=expired_invite.pk).update(
            created_at=timezone.now()
            - timedelta(days=OrganizationInvite.expired_in_days + 1)
        )
        self._login()

        response = self.client.get("/api/organization-workspace/navigation/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response)["pending_invite_count"], 1)
        self.assertFalse(active_invite.is_expired)

    def test_member_directory_filters_team_and_ungrouped_members(self):
        grouped_user = User.objects.create_user(username="grouped", password="secret")  # noqa: S106
        ungrouped_user = User.objects.create_user(username="ungrouped", password="secret")  # noqa: S106
        grouped = baker.make("organizations.OrganizationMember", organization=self.org, user=grouped_user)
        ungrouped = baker.make("organizations.OrganizationMember", organization=self.org, user=ungrouped_user)
        team = baker.make("teams.Team", organization=self.org, name="资产组")
        team.members.add(grouped_user)
        self._login()

        team_response = self.client.get("/api/organization-workspace/members/", {"page": 1, "page_size": 20, "team_id": team.pk})
        ungrouped_response = self.client.get("/api/organization-workspace/members/", {"page": 1, "page_size": 20, "ungrouped": "true"})

        self.assertEqual([item["member_id"] for item in api_data(team_response)["items"]], [grouped.pk])
        self.assertEqual({item["member_id"] for item in api_data(ungrouped_response)["items"]}, {self.owner_member.pk, ungrouped.pk})

    def test_member_detail_includes_team_tags_and_responsibility_state(self):
        employee = User.objects.create_user(username="responsible", password="secret")  # noqa: S106
        member = baker.make("organizations.OrganizationMember", organization=self.org, user=employee)
        team = baker.make("teams.Team", organization=self.org, name="资产管理组")
        team.members.add(employee)
        estate = baker.make("house.Estate", organization=self.org)
        PropertyResponsibility.objects.create(organization=self.org, member=member, estate=estate)
        self._login()

        response = self.client.get(f"/api/organization-workspace/members/{member.pk}/")

        self.assertEqual(response.status_code, 200)
        payload = api_data(response)
        self.assertTrue(payload["has_responsibility"])
        self.assertEqual(payload["teams"], [{"id": team.pk, "name": "资产管理组", "member_count": 1}])

    def test_search_deduplicates_member_and_returns_team_tags(self):
        employee = User.objects.create_user(username="alice", first_name="Alice", password="secret")  # noqa: S106
        member = baker.make("organizations.OrganizationMember", organization=self.org, user=employee)
        first = baker.make("teams.Team", organization=self.org, name="运营一组")
        second = baker.make("teams.Team", organization=self.org, name="运营二组")
        first.members.add(employee)
        second.members.add(employee)
        self._login()

        response = self.client.get("/api/organization-workspace/search/", {"keyword": "Alice"})

        self.assertEqual(response.status_code, 200)
        members = api_data(response)["members"]
        self.assertEqual([item["member_id"] for item in members], [member.pk])
        self.assertEqual({item["name"] for item in members[0]["teams"]}, {"运营一组", "运营二组"})
