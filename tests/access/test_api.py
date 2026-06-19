import importlib
import json

from django.apps import apps
from django.contrib.auth import user_logged_in
from django.test import TestCase

from model_bakery import baker

from apps.access.constants import AccessPermission, FinancePermission
from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding
from apps.accounts.models import User
from apps.organizations.signals import user_logged_in_receiver
from tests.access.helpers import bind_team_role, make_access_group, make_permission
from tests.api_helpers import api_data, api_error


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
        keys = {item["key"] for item in api_data(resp)}
        self.assertIn(FinancePermission.BILL_VIEW, keys)

    def test_owner_can_list_seeded_permissions_with_chinese_names(self):
        seed_system_roles = importlib.import_module("apps.access.migrations.0002_seed_system_roles")
        seed_finance_permissions = importlib.import_module("apps.access.migrations.0003_seed_finance_permissions")

        seed_system_roles.seed_roles(apps, None)
        seed_finance_permissions.seed_finance_permissions(apps, None)

        resp = self.client.get("/api/access/permissions/")

        self.assertEqual(resp.status_code, 200)
        names_by_key = {item["key"]: item["name"] for item in api_data(resp)}
        self.assertEqual(names_by_key[AccessPermission.ROLE_MANAGE], "管理访问角色")
        self.assertEqual(names_by_key[FinancePermission.BILL_REFUND], "退款账单")

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
        roles = api_data(roles_resp)
        bindings = api_data(bindings_resp)
        role_codes = {item["code"] for item in roles}
        self.assertIn("org_admin_test", role_codes)
        self.assertIn("custom_role", role_codes)
        self.assertEqual(bindings[0]["role"]["code"], "custom_role")
        self.assertEqual(bindings[0]["user"]["id"], self.member.pk)
        self.assertTrue(any(item["id"] == system_role.access_role.pk for item in roles))

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
        binding_id = api_data(create_resp)["id"]
        self.assertTrue(OrganizationGroupBinding.objects.filter(pk=binding_id).exists())

        delete_resp = self.client.delete(f"/api/access/organization-bindings/{binding_id}/")

        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(api_data(delete_resp), {})
        self.assertFalse(OrganizationGroupBinding.objects.filter(pk=binding_id).exists())

    def test_owner_can_create_update_and_delete_custom_org_role(self):
        system_role = make_access_group(
            "org_finance_copy_source",
            AccessRole.Scope.ORG,
            [("finance", "finance_bill_view")],
        ).access_role

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Custom finance", "copy_from": system_role.pk}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        created_role = api_data(create_resp)
        role_id = created_role["id"]
        self.assertEqual(created_role["permission_keys"], [FinancePermission.BILL_VIEW])

        patch_resp = self.client.patch(
            f"/api/access/organization-roles/{role_id}/",
            data=json.dumps({"name": "Custom finance updated", "permission_keys": []}),
            content_type="application/json",
        )
        delete_resp = self.client.delete(f"/api/access/organization-roles/{role_id}/")

        self.assertEqual(patch_resp.status_code, 200)
        patched_role = api_data(patch_resp)
        self.assertEqual(patched_role["name"], "Custom finance updated")
        self.assertEqual(patched_role["permission_keys"], [])
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(api_data(delete_resp), {})
        self.assertFalse(AccessRole.objects.filter(pk=role_id).exists())

    def test_owner_can_recreate_deleted_custom_org_role_with_same_name(self):
        create_initial_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "WMVR", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)

        original_role = AccessRole.objects.get(pk=api_data(create_initial_resp)["id"])
        delete_resp = self.client.delete(f"/api/access/organization-roles/{original_role.pk}/")
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(api_data(delete_resp), {})

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "WMVR", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        self.assertFalse(AccessRole.objects.filter(pk=original_role.pk).exists())
        recreated_role = api_data(create_resp)
        self.assertNotEqual(recreated_role["id"], original_role.pk)
        self.assertEqual(recreated_role["name"], "WMVR")
        self.assertEqual(recreated_role["permission_keys"], [])

    def test_owner_cannot_create_org_role_with_duplicate_name(self):
        create_initial_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Duplicate role", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Duplicate role", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 400)
        error = api_error(create_resp)
        self.assertEqual(error["error"], "VALIDATION_ERROR")
        self.assertIn("name", error["data"]["fields"])

    def test_owner_cannot_create_org_role_with_system_role_name(self):
        make_access_group(
            "system_same_name",
            AccessRole.Scope.ORG,
            [("finance", "finance_bill_view")],
        )

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "system_same_name", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 400)
        error = api_error(create_resp)
        self.assertEqual(error["error"], "VALIDATION_ERROR")
        self.assertIn("name", error["data"]["fields"])

    def test_owner_cannot_rename_org_role_to_duplicate_name(self):
        first_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Role A", "permission_keys": []}),
            content_type="application/json",
        )
        second_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Role B", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(first_resp.status_code, 201)
        self.assertEqual(second_resp.status_code, 201)

        patch_resp = self.client.patch(
            f"/api/access/organization-roles/{api_data(second_resp)['id']}/",
            data=json.dumps({"name": "Role A"}),
            content_type="application/json",
        )

        self.assertEqual(patch_resp.status_code, 400)
        error = api_error(patch_resp)
        self.assertEqual(error["error"], "VALIDATION_ERROR")
        self.assertIn("name", error["data"]["fields"])

    def test_owner_can_create_org_role_over_legacy_inactive_role_without_bindings(self):
        create_initial_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Legacy inactive", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)
        legacy_role = AccessRole.objects.get(pk=api_data(create_initial_resp)["id"])
        legacy_role.is_active = False
        legacy_role.save(update_fields=["is_active"])

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Legacy inactive", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        self.assertFalse(AccessRole.objects.filter(pk=legacy_role.pk).exists())
        self.assertEqual(api_data(create_resp)["name"], "Legacy inactive")

    def test_owner_cannot_create_org_role_over_referenced_legacy_inactive_role(self):
        create_initial_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Referenced inactive", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)
        legacy_role = AccessRole.objects.get(pk=api_data(create_initial_resp)["id"])
        legacy_role.is_active = False
        legacy_role.save(update_fields=["is_active"])
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.member, group=legacy_role.group)

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Referenced inactive", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 409)
        error = api_error(create_resp)
        self.assertEqual(error["error"], "ROLE_IN_USE")
        self.assertIn("role", error["data"]["fields"])
        self.assertTrue(AccessRole.objects.filter(pk=legacy_role.pk).exists())

    def test_owner_gets_validation_error_for_orphan_org_role_group_name(self):
        create_initial_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Orphan group", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)
        AccessRole.objects.get(pk=api_data(create_initial_resp)["id"]).delete()

        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Orphan group", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 400)
        self.assertEqual(api_error(create_resp)["error"], "VALIDATION_ERROR")

    def test_owner_cannot_delete_org_role_with_bindings(self):
        create_resp = self.client.post(
            "/api/access/organization-roles/",
            data=json.dumps({"name": "Referenced org role", "permission_keys": []}),
            content_type="application/json",
        )
        role = AccessRole.objects.get(pk=api_data(create_resp)["id"])
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.member, group=role.group)

        delete_resp = self.client.delete(f"/api/access/organization-roles/{role.pk}/")

        self.assertEqual(delete_resp.status_code, 409)
        self.assertEqual(
            api_error(delete_resp),
            {
                "code": 409,
                "error": "ROLE_IN_USE",
                "message": "角色仍被用户引用，无法删除。",
                "data": {"fields": {"role": ["角色仍被用户引用，无法删除。"]}},
                "timestamp": api_error(delete_resp)["timestamp"],
                "traceId": "",
            },
        )
        self.assertTrue(AccessRole.objects.filter(pk=role.pk).exists())


class TestAccessTeamAPI(AccessAPITestBase):
    def test_owner_can_create_custom_team_role(self):
        make_permission("finance", "finance_bill_view")
        resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps(
                {
                    "name": "Custom team finance",
                    "permission_keys": [FinancePermission.BILL_VIEW],
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(resp.status_code, 201)
        role = api_data(resp)
        self.assertEqual(role["scope"], AccessRole.Scope.TEAM)
        self.assertEqual(role["permission_keys"], [FinancePermission.BILL_VIEW])

    def test_owner_cannot_create_team_role_with_duplicate_name(self):
        first_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps({"name": "Team duplicate", "permission_keys": []}),
            content_type="application/json",
        )
        second_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps({"name": "Team duplicate", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(first_resp.status_code, 201)
        self.assertEqual(second_resp.status_code, 400)
        error = api_error(second_resp)
        self.assertEqual(error["error"], "VALIDATION_ERROR")
        self.assertIn("name", error["data"]["fields"])

    def test_owner_can_recreate_deleted_custom_team_role_with_same_name(self):
        create_initial_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps({"name": "Team WMVR", "permission_keys": []}),
            content_type="application/json",
        )
        self.assertEqual(create_initial_resp.status_code, 201)

        original_role = AccessRole.objects.get(pk=api_data(create_initial_resp)["id"])
        delete_resp = self.client.delete(f"/api/access/teams/{self.team.pk}/roles/{original_role.pk}/")
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(api_data(delete_resp), {})

        create_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps({"name": "Team WMVR", "permission_keys": []}),
            content_type="application/json",
        )

        self.assertEqual(create_resp.status_code, 201)
        self.assertFalse(AccessRole.objects.filter(pk=original_role.pk).exists())
        recreated_role = api_data(create_resp)
        self.assertNotEqual(recreated_role["id"], original_role.pk)
        self.assertEqual(recreated_role["name"], "Team WMVR")

    def test_owner_cannot_delete_team_role_with_bindings(self):
        create_resp = self.client.post(
            f"/api/access/teams/{self.team.pk}/roles/",
            data=json.dumps({"name": "Referenced team role", "permission_keys": []}),
            content_type="application/json",
        )
        role = AccessRole.objects.get(pk=api_data(create_resp)["id"])
        TeamGroupBinding.objects.create(team=self.team, user=self.member, group=role.group)

        delete_resp = self.client.delete(f"/api/access/teams/{self.team.pk}/roles/{role.pk}/")

        self.assertEqual(delete_resp.status_code, 409)
        self.assertEqual(
            api_error(delete_resp),
            {
                "code": 409,
                "error": "ROLE_IN_USE",
                "message": "角色仍被用户引用，无法删除。",
                "data": {"fields": {"role": ["角色仍被用户引用，无法删除。"]}},
                "timestamp": api_error(delete_resp)["timestamp"],
                "traceId": "",
            },
        )
        self.assertTrue(AccessRole.objects.filter(pk=role.pk).exists())

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
        role_codes = {item["code"] for item in api_data(roles_resp)}
        self.assertIn("team_manager_api_test", role_codes)
        self.assertIn("team_staff_api_test", role_codes)

        binding_id = api_data(create_resp)["id"]
        self.assertTrue(TeamGroupBinding.objects.filter(pk=binding_id, user=teammate).exists())

        list_resp = self.client.get(f"/api/access/teams/{self.team.pk}/bindings/")
        self.assertEqual(list_resp.status_code, 200)
        self.assertEqual(api_data(list_resp)[1]["role"]["code"], "team_staff_api_test")

        delete_resp = self.client.delete(f"/api/access/teams/{self.team.pk}/bindings/{binding_id}/")
        self.assertEqual(delete_resp.status_code, 200)
        self.assertEqual(api_data(delete_resp), {})
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
