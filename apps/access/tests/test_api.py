import json

from django.contrib.auth import user_logged_in
from django.test import TestCase

from model_bakery import baker

from apps.access.constants import AccessPermission, FinancePermission
from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding
from apps.access.tests.helpers import bind_team_role, make_access_group, make_permission
from apps.accounts.models import User
from apps.organizations.signals import user_logged_in_receiver


class AccessAPITestBase(TestCase):
    @classmethod
    def setUpClass(cls):
        user_logged_in.disconnect(user_logged_in_receiver)
        super().setUpClass()

    def setUp(self):
        self.owner = User.objects.create_user(username="owner", password="secret")  # noqa: S106
        self.member = User.objects.create_user(username="member", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization")
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.owner, is_owner=True)
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.member, is_owner=False)
        self.team = baker.make("teams.Team", organization=self.org)
        self.team.members.add(self.owner, self.member)
        self.client.force_login(self.owner)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": True}
        )
        session.save()


class TestAccessOrgAPI(AccessAPITestBase):
    def test_owner_can_list_permissions(self):
        make_access_group(
            "permission_list_role",
            AccessRole.Scope.ORG,
            [("finance", "finance_bill_view")],
        )

        resp = self.client.get("/api/access/permissions/")

        self.assertEqual(resp.status_code, 200)
        keys = {item["key"] for item in resp.json()}
        self.assertIn(FinancePermission.BILL_VIEW, keys)

    def test_owner_can_list_org_roles_and_bindings(self):
        system_role = make_access_group(
            "org_admin_test",
            AccessRole.Scope.ORG,
            [("organizations", "member_manage")],
        )
        custom_role = make_access_group(
            "custom_role",
            AccessRole.Scope.ORG,
            [("organizations", "member_view")],
            organization=self.org,
        )
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.member, group=custom_role)

        roles_resp = self.client.get("/api/access/organization-roles/")
        bindings_resp = self.client.get("/api/access/organization-bindings/")

        self.assertEqual(roles_resp.status_code, 200)
        self.assertEqual(bindings_resp.status_code, 200)
        role_codes = {item["code"] for item in roles_resp.json()}
        self.assertIn("org_admin_test", role_codes)
        self.assertIn("custom_role", role_codes)
        self.assertEqual(bindings_resp.json()[0]["role"]["code"], "custom_role")
        self.assertEqual(bindings_resp.json()[0]["user"]["id"], self.member.pk)
        self.assertTrue(any(item["id"] == system_role.access_role.pk for item in roles_resp.json()))

    def test_owner_can_create_and_delete_org_binding(self):
        role_group = make_access_group(
            "org_admin_binding_test",
            AccessRole.Scope.ORG,
            [("organizations", "member_manage")],
        )

        create_resp = self.client.post(
            "/api/access/organization-bindings/",
            data=json.dumps({"user": self.member.pk, "role": role_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        binding_id = create_resp.json()["id"]
        self.assertTrue(OrganizationGroupBinding.objects.filter(pk=binding_id).exists())

        delete_resp = self.client.delete(f"/api/access/organization-bindings/{binding_id}/")

        self.assertEqual(delete_resp.status_code, 204)
        self.assertFalse(OrganizationGroupBinding.objects.filter(pk=binding_id).exists())

    def test_owner_can_create_update_and_deactivate_custom_org_role(self):
        system_role = make_access_group(
            "org_finance_copy_source",
            AccessRole.Scope.ORG,
            [("finance", "finance_bill_view")],
        ).access_role

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"code": "custom_finance", "name": "Custom finance", "copy_from": system_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        role_id = create_resp.json()["id"]
        self.assertEqual(create_resp.json()["permission_keys"], [FinancePermission.BILL_VIEW])

        patch_resp = self.client.patch(
            f"/api/access/organization-roles/{role_id}/",
            data=json.dumps({"name": "Custom finance updated", "permission_keys": []}),
            content_type="application/json",
        )
        delete_resp = self.client.delete(f"/api/access/organization-roles/{role_id}/")

        self.assertEqual(patch_resp.status_code, 200)
        self.assertEqual(patch_resp.json()["name"], "Custom finance updated")
        self.assertEqual(patch_resp.json()["permission_keys"], [])
        self.assertEqual(delete_resp.status_code, 204)
        self.assertFalse(AccessRole.objects.get(pk=role_id).is_active)


class TestAccessTeamAPI(AccessAPITestBase):
    def test_owner_can_create_custom_team_role(self):
        make_permission("finance", "finance_bill_view")
        resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps(
                {
                    "code": "custom_team_finance",
                    "name": "Custom team finance",
                    "permission_keys": [FinancePermission.BILL_VIEW],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["scope"], AccessRole.Scope.TEAM)
        self.assertEqual(resp.json()["permission_keys"], [FinancePermission.BILL_VIEW])

    def test_team_manager_can_list_roles_and_manage_bindings_for_own_team(self):
        manager = User.objects.create_user(username="manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="teammate", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        self.team.members.add(manager, teammate)
        team_manager_group = make_access_group(
            "team_manager_api_test",
            AccessRole.Scope.TEAM,
            [("access", "team_role_manage"), ("access", "team_role_view"), ("teams", "team_view")],
        )
        team_staff_group = make_access_group(
            "team_staff_api_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_view")],
        )
        bind_team_role(self.team, manager, team_manager_group)

        self.client.force_login(manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        roles_resp = self.client.get(f"/api/access/teams/{self.team.pk}/roles/")
        create_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/bindings/",
            data=json.dumps({"user": teammate.pk, "role": team_staff_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(roles_resp.status_code, 200)
        self.assertEqual(create_resp.status_code, 201)
        role_codes = {item["code"] for item in roles_resp.json()}
        self.assertIn("team_manager_api_test", role_codes)
        self.assertIn("team_staff_api_test", role_codes)

        binding_id = create_resp.json()["id"]
        self.assertTrue(TeamGroupBinding.objects.filter(pk=binding_id, user=teammate).exists())

        list_resp = self.client.get(f"/api/access/teams/{self.team.pk}/bindings/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(list_resp.json()[1]["role"]["code"], "team_staff_api_test")

        delete_resp = self.client.delete(f"/api/access/teams/{self.team.pk}/bindings/{binding_id}/")
        self.assertEqual(delete_resp.status_code, 204)
        self.assertFalse(TeamGroupBinding.objects.filter(pk=binding_id).exists())

    def test_team_member_manager_cannot_assign_team_roles_without_role_manage_permission(self):
        manager = User.objects.create_user(username="role-limited-manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="role-limited-teammate", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        self.team.members.add(manager, teammate)
        team_manager_group = make_access_group(
            "team_member_manager_limited_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_member_manage"), ("teams", "team_view")],
        )
        team_staff_group = make_access_group(
            "team_staff_limited_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_view")],
        )
        bind_team_role(self.team, manager, team_manager_group)

        self.client.force_login(manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/bindings/",
            data=json.dumps({"user": teammate.pk, "role": team_staff_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)

    def test_team_role_manager_can_assign_team_roles_for_own_team(self):
        manager = User.objects.create_user(username="role-manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="role-managed-teammate", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        self.team.members.add(manager, teammate)
        role_manager_group = make_access_group(
            "team_role_manager_api_test",
            AccessRole.Scope.TEAM,
            [
                tuple(AccessPermission.TEAM_ROLE_MANAGE.split(".", 1)),
                tuple(AccessPermission.TEAM_ROLE_VIEW.split(".", 1)),
            ],
        )
        team_staff_group = make_access_group(
            "team_staff_role_manager_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_view")],
        )
        bind_team_role(self.team, manager, role_manager_group)

        self.client.force_login(manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/bindings/",
            data=json.dumps({"user": teammate.pk, "role": team_staff_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(TeamGroupBinding.objects.filter(team=self.team, user=teammate).exists())

    def test_org_member_manager_cannot_assign_org_roles_without_role_manage_permission(self):
        member_manager = User.objects.create_user(username="org-member-manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="org-role-teammate", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=member_manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        member_manager_group = make_access_group(
            "org_member_manager_limited_test",
            AccessRole.Scope.ORG,
            [("organizations", "member_manage"), ("organizations", "member_view")],
        )
        org_admin_group = make_access_group(
            "org_admin_assignment_target_test",
            AccessRole.Scope.ORG,
            [("organizations", "member_manage")],
        )
        OrganizationGroupBinding.objects.create(organization=self.org, user=member_manager, group=member_manager_group)

        self.client.force_login(member_manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        resp = self.client.post(
            "/api/access/organization-bindings/",
            data=json.dumps({"user": teammate.pk, "role": org_admin_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)

    def test_org_role_manager_can_assign_org_roles(self):
        role_manager = User.objects.create_user(username="org-role-manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="org-role-managed-teammate", password="secret")  # noqa: S106
        baker.make("organizations.OrganizationMember", organization=self.org, user=role_manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        role_manager_group = make_access_group(
            "org_role_manager_api_test",
            AccessRole.Scope.ORG,
            [tuple(AccessPermission.ROLE_MANAGE.split(".", 1)), tuple(AccessPermission.ROLE_VIEW.split(".", 1))],
        )
        org_viewer_group = make_access_group(
            "org_viewer_assignment_target_test",
            AccessRole.Scope.ORG,
            [("organizations", "member_view")],
        )
        OrganizationGroupBinding.objects.create(organization=self.org, user=role_manager, group=role_manager_group)

        self.client.force_login(role_manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        resp = self.client.post(
            "/api/access/organization-bindings/",
            data=json.dumps({"user": teammate.pk, "role": org_viewer_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertTrue(OrganizationGroupBinding.objects.filter(organization=self.org, user=teammate).exists())

    def test_team_role_manager_cannot_manage_other_team_bindings(self):
        manager = User.objects.create_user(username="other-manager", password="secret")  # noqa: S106
        teammate = User.objects.create_user(username="other-teammate", password="secret")  # noqa: S106
        other_team = baker.make("teams.Team", organization=self.org)
        baker.make("organizations.OrganizationMember", organization=self.org, user=manager, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=teammate, is_owner=False)
        self.team.members.add(manager)
        other_team.members.add(manager, teammate)
        team_manager_group = make_access_group(
            "team_manager_other_team_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_member_manage"), ("teams", "team_view")],
        )
        team_staff_group = make_access_group(
            "team_staff_other_team_test",
            AccessRole.Scope.TEAM,
            [("teams", "team_view")],
        )
        bind_team_role(self.team, manager, team_manager_group)

        self.client.force_login(manager)
        session = self.client.session
        session["organization_data"] = json.dumps(
            {"pk": self.org.pk, "id": self.org.pk, "name": self.org.name, "slug": self.org.slug, "is_owner": False}
        )
        session.save()

        resp = self.client.post(
            f"/api/access/teams/{other_team.pk}/bindings/",
            data=json.dumps({"user": teammate.pk, "role": team_staff_group.access_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 403)
