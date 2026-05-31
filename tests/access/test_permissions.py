from django.core.exceptions import ValidationError
from django.test import TestCase

from model_bakery import baker

from apps.access.models import AccessRole, OrganizationGroupBinding, TeamGroupBinding
from apps.access.services import (
    assign_org_role,
    assign_team_role,
    has_permission,
    list_available_roles,
    list_org_role_bindings,
    list_team_role_bindings,
    remove_org_role,
    remove_team_role,
)
from apps.accounts.models import User
from tests.access.helpers import make_access_group, make_permission


def make_role(code: str, scope: str, codenames: list[str], organization=None):
    return make_access_group(
        code,
        scope,
        [("access_tests", codename) for codename in codenames],
        organization=organization,
    )


class AccessPermissionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="member", password="secret")  # noqa: S106
        self.owner = User.objects.create_user(username="owner", password="secret")  # noqa: S106
        self.outsider = User.objects.create_user(username="outsider", password="secret")  # noqa: S106
        self.org = baker.make("organizations.Organization")
        self.other_org = baker.make("organizations.Organization")
        self.team = baker.make("teams.Team", organization=self.org)
        self.other_team = baker.make("teams.Team", organization=self.other_org)
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.user, is_owner=False)
        baker.make("organizations.OrganizationMember", organization=self.org, user=self.owner, is_owner=True)
        self.team.members.add(self.user)

    def test_owner_has_all_permissions(self):
        self.assertTrue(has_permission(self.owner, self.org, "finance_bill_refund", team=self.team))

    def test_non_member_has_no_permissions(self):
        self.assertFalse(has_permission(self.outsider, self.org, "finance_bill_view", team=self.team))

    def test_org_role_applies_to_all_teams_in_org(self):
        make_permission("access_tests", "finance_bill_view")
        group = make_role("test_org_finance", AccessRole.Scope.ORG, ["finance_bill_view"])
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.user, group=group)

        self.assertTrue(has_permission(self.user, self.org, "access_tests.finance_bill_view", team=self.team))
        self.assertFalse(has_permission(self.user, self.other_org, "access_tests.finance_bill_view", team=self.other_team))

    def test_team_role_only_applies_to_bound_team(self):
        make_permission("access_tests", "finance_bill_view")
        group = make_role("test_team_finance", AccessRole.Scope.TEAM, ["finance_bill_view"])
        TeamGroupBinding.objects.create(team=self.team, user=self.user, group=group)

        other_team_in_org = baker.make("teams.Team", organization=self.org)
        other_team_in_org.members.add(self.user)

        self.assertTrue(has_permission(self.user, self.org, "access_tests.finance_bill_view", team=self.team))
        self.assertFalse(has_permission(self.user, self.org, "access_tests.finance_bill_view", team=other_team_in_org))

    def test_team_permission_does_not_cross_org(self):
        make_permission("access_tests", "finance_bill_view")
        group = make_role("test_cross_org_team_finance", AccessRole.Scope.TEAM, ["finance_bill_view"])
        TeamGroupBinding.objects.create(team=self.team, user=self.user, group=group)

        self.assertFalse(has_permission(self.user, self.org, "access_tests.finance_bill_view", team=self.other_team))

    def test_permission_lookup_requires_full_permission_key(self):
        make_permission("access_tests", "shared_codename")
        group = make_role("org_shared_permission", AccessRole.Scope.ORG, ["shared_codename"])
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.user, group=group)

        self.assertTrue(has_permission(self.user, self.org, "access_tests.shared_codename"))
        self.assertFalse(has_permission(self.user, self.org, "shared_codename"))

    def test_org_binding_requires_org_member_and_org_scope_role(self):
        make_permission("access_tests", "member_manage")
        team_group = make_role("test_team_manager", AccessRole.Scope.TEAM, ["member_manage"])

        binding = OrganizationGroupBinding(organization=self.org, user=self.user, group=team_group)
        with self.assertRaises(ValidationError):
            binding.full_clean()

        org_group = make_role("test_org_admin", AccessRole.Scope.ORG, ["member_manage"])
        outsider_binding = OrganizationGroupBinding(organization=self.org, user=self.outsider, group=org_group)
        with self.assertRaises(ValidationError):
            outsider_binding.full_clean()

    def test_team_binding_requires_team_member_and_team_scope_role(self):
        make_permission("access_tests", "team_setting_manage")
        org_group = make_role("test_binding_org_admin", AccessRole.Scope.ORG, ["team_setting_manage"])

        binding = TeamGroupBinding(team=self.team, user=self.user, group=org_group)
        with self.assertRaises(ValidationError):
            binding.full_clean()

        team_group = make_role("test_binding_team_manager", AccessRole.Scope.TEAM, ["team_setting_manage"])
        outsider_binding = TeamGroupBinding(team=self.team, user=self.outsider, group=team_group)
        with self.assertRaises(ValidationError):
            outsider_binding.full_clean()

    def test_custom_role_only_applies_to_own_org(self):
        make_permission("access_tests", "custom_report_view")
        group = make_role("custom_finance", AccessRole.Scope.ORG, ["custom_report_view"], organization=self.org)
        OrganizationGroupBinding.objects.create(organization=self.org, user=self.user, group=group)

        self.assertTrue(has_permission(self.user, self.org, "access_tests.custom_report_view"))
        self.assertFalse(has_permission(self.user, self.other_org, "access_tests.custom_report_view"))

    def test_list_available_roles_includes_system_and_custom_roles(self):
        make_role("system_org_role", AccessRole.Scope.ORG, [])
        custom_group = make_role("custom_org_role", AccessRole.Scope.ORG, [], organization=self.org)
        make_role("other_org_custom_role", AccessRole.Scope.ORG, [], organization=self.other_org)

        roles = list(list_available_roles(self.org, AccessRole.Scope.ORG))
        role_codes = [role.code for role in roles]

        self.assertIn("org_admin", role_codes)
        self.assertIn("org_finance", role_codes)
        self.assertIn("system_org_role", role_codes)
        self.assertIn("custom_org_role", role_codes)
        self.assertNotIn("other_org_custom_role", role_codes)
        self.assertEqual(custom_group.access_role.organization_id, self.org.pk)

    def test_assign_and_remove_org_role(self):
        role_group = make_role("org_role", AccessRole.Scope.ORG, [])

        binding = assign_org_role(self.org, self.user, role_group.access_role)
        duplicate = assign_org_role(self.org, self.user, role_group.access_role)

        self.assertEqual(binding.pk, duplicate.pk)
        self.assertEqual(list(list_org_role_bindings(self.org)), [binding])

        remove_org_role(binding)
        self.assertFalse(OrganizationGroupBinding.objects.filter(pk=binding.pk).exists())

    def test_assign_and_remove_team_role(self):
        role_group = make_role("team_role", AccessRole.Scope.TEAM, [])

        binding = assign_team_role(self.team, self.user, role_group.access_role)
        duplicate = assign_team_role(self.team, self.user, role_group.access_role)

        self.assertEqual(binding.pk, duplicate.pk)
        self.assertEqual(list(list_team_role_bindings(self.team)), [binding])

        remove_team_role(binding)
        self.assertFalse(TeamGroupBinding.objects.filter(pk=binding.pk).exists())

    def test_assign_role_rejects_inactive_role(self):
        role_group = make_role("inactive_org_role", AccessRole.Scope.ORG, [])
        role_group.access_role.is_active = False
        role_group.access_role.save(update_fields=["is_active"])

        with self.assertRaises(ValidationError):
            assign_org_role(self.org, self.user, role_group.access_role)
