from django.core.management import call_command
from django.test import TestCase

from model_bakery import baker

from apps.access.constants import (
    ALL_PERMISSION_ENUMS,
    ALL_PERMISSION_KEYS,
    SYSTEM_ROLE_DEFINITIONS,
    AccessPermission,
    AccessRoleCode,
    AccessScope,
    FinancePermission,
    TeamPermission,
)
from apps.access.models import AccessRole, TeamGroupBinding
from apps.access.sync import build_permission_registry, sync_access_permissions
from apps.accounts.models import User


class BackfillAccessRolesCommandTests(TestCase):
    def test_backfills_team_members_to_team_staff(self):
        user = User.objects.create_user(username="staff", password="secret")  # noqa: S106
        org = baker.make("organizations.Organization")
        team = baker.make("teams.Team", organization=org)
        baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=False)
        team.members.add(user)
        role = AccessRole.objects.get(code=AccessRoleCode.TEAM_STAFF, is_system=True)

        call_command("backfill_access_roles")

        self.assertTrue(TeamGroupBinding.objects.filter(team=team, user=user, group=role.group).exists())

    def test_dry_run_does_not_create_bindings(self):
        user = User.objects.create_user(username="dry-run-staff", password="secret")  # noqa: S106
        org = baker.make("organizations.Organization")
        team = baker.make("teams.Team", organization=org)
        baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=False)
        team.members.add(user)

        call_command("backfill_access_roles", "--dry-run")

        self.assertFalse(TeamGroupBinding.objects.exists())


class SyncAccessPermissionsTests(TestCase):
    def test_permission_enums_are_discovered_automatically(self):
        permission_enum_names = {enum.__name__ for enum in ALL_PERMISSION_ENUMS}

        self.assertIn("AccessPermission", permission_enum_names)
        self.assertIn("OrganizationPermission", permission_enum_names)
        self.assertIn("TeamPermission", permission_enum_names)
        self.assertIn("SettingsPermission", permission_enum_names)
        self.assertIn("FinancePermission", permission_enum_names)
        self.assertTrue(ALL_PERMISSION_ENUMS)

    def test_permission_registry_is_built_from_constants(self):
        permission_registry = build_permission_registry()

        self.assertEqual(permission_registry["access"][0], ("role_view", AccessPermission.ROLE_VIEW.label))
        self.assertEqual(
            permission_registry["finance"][-1],
            ("finance_report_export", FinancePermission.REPORT_EXPORT.label),
        )

    def test_system_role_registry_is_built_from_constants(self):
        system_role_registry = SYSTEM_ROLE_DEFINITIONS

        self.assertEqual(system_role_registry[AccessRoleCode.ORG_ADMIN]["name"], SYSTEM_ROLE_DEFINITIONS[AccessRoleCode.ORG_ADMIN]["name"])
        self.assertEqual(system_role_registry[AccessRoleCode.ORG_ADMIN]["permissions"], list(ALL_PERMISSION_KEYS))
        self.assertEqual(
            system_role_registry[AccessRoleCode.TEAM_STAFF]["permissions"],
            SYSTEM_ROLE_DEFINITIONS[AccessRoleCode.TEAM_STAFF]["permissions"],
        )

    def test_sync_creates_new_permissions_from_registry(self):
        permission_registry = {"demo": [("demo_view", "查看演示权限")]}

        sync_access_permissions(permission_registry=permission_registry, role_registry={})

        from django.contrib.auth.models import Permission

        permission = Permission.objects.get(content_type__app_label="demo", codename="demo_view")
        self.assertEqual(permission.content_type.model, "accesspermission")
        self.assertEqual(permission.name, "查看演示权限")

    def test_sync_updates_existing_permission_name(self):
        permission_registry = {"access": [("role_manage", "管理访问角色")]}

        sync_access_permissions(permission_registry={"access": [("role_manage", "旧名称")]}, role_registry={})
        sync_access_permissions(permission_registry=permission_registry, role_registry={})

        from django.contrib.auth.models import Permission

        permission = Permission.objects.get(content_type__app_label="access", codename="role_manage")
        self.assertEqual(permission.name, "管理访问角色")

    def test_sync_creates_and_updates_system_roles(self):
        permission_registry = {"access": [("role_view", "查看访问角色"), ("role_manage", "管理访问角色")]}
        role_registry = {
            AccessRoleCode.ORG_ADMIN: {
                "scope": AccessScope.ORG,
                "name": AccessRoleCode.ORG_ADMIN.label,
                "permissions": [AccessPermission.ROLE_VIEW, AccessPermission.ROLE_MANAGE],
            }
        }

        sync_access_permissions(permission_registry=permission_registry, role_registry=role_registry)
        sync_access_permissions(
            permission_registry=permission_registry,
            role_registry={
                AccessRoleCode.ORG_ADMIN: {
                    "scope": AccessScope.ORG,
                    "name": AccessRoleCode.ORG_ADMIN.label,
                    "permissions": [AccessPermission.ROLE_VIEW, AccessPermission.ROLE_MANAGE],
                }
            },
        )

        role = AccessRole.objects.get(code="org_admin", organization__isnull=True)
        permission_keys = {f"{permission.content_type.app_label}.{permission.codename}" for permission in role.group.permissions.select_related("content_type")}
        self.assertEqual(permission_keys, {AccessPermission.ROLE_VIEW, AccessPermission.ROLE_MANAGE})
        self.assertTrue(role.is_system)

    def test_sync_assigns_specific_permission_keys(self):
        permission_registry = {
            "teams": [
                ("team_view", "查看团队"),
                ("team_update", "更新团队"),
            ]
        }
        role_registry = {
            AccessRoleCode.TEAM_MANAGER: {
                "scope": AccessScope.TEAM,
                "name": AccessRoleCode.TEAM_MANAGER.label,
                "permissions": [TeamPermission.VIEW, TeamPermission.UPDATE],
            }
        }

        sync_access_permissions(permission_registry=permission_registry, role_registry=role_registry)

        role = AccessRole.objects.get(code=AccessRoleCode.TEAM_MANAGER, organization__isnull=True)
        permission_keys = {f"{permission.content_type.app_label}.{permission.codename}" for permission in role.group.permissions.select_related("content_type")}
        self.assertEqual(permission_keys, {TeamPermission.VIEW, TeamPermission.UPDATE})

    def test_sync_command_runs(self):
        call_command("sync_access_permissions")

        self.assertTrue(AccessRole.objects.filter(code=AccessRoleCode.ORG_ADMIN, is_system=True).exists())
