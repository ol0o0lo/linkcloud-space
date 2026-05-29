from django.core.management import call_command
from django.test import TestCase

from model_bakery import baker

from apps.access.constants import AccessRoleCode
from apps.access.models import AccessRole, TeamGroupBinding
from apps.access.tests.helpers import make_access_group
from apps.accounts.models import User


class BackfillAccessRolesCommandTests(TestCase):
    def test_backfills_team_members_to_team_staff(self):
        user = User.objects.create_user(username="staff", password="secret")  # noqa: S106
        org = baker.make("organizations.Organization")
        team = baker.make("teams.Team", organization=org)
        baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=False)
        team.members.add(user)
        role = make_access_group(AccessRoleCode.TEAM_STAFF, AccessRole.Scope.TEAM, [("teams", "team_view")]).access_role

        call_command("backfill_access_roles")

        self.assertTrue(TeamGroupBinding.objects.filter(team=team, user=user, group=role.group).exists())

    def test_dry_run_does_not_create_bindings(self):
        user = User.objects.create_user(username="dry-run-staff", password="secret")  # noqa: S106
        org = baker.make("organizations.Organization")
        team = baker.make("teams.Team", organization=org)
        baker.make("organizations.OrganizationMember", organization=org, user=user, is_owner=False)
        team.members.add(user)
        make_access_group(AccessRoleCode.TEAM_STAFF, AccessRole.Scope.TEAM, [("teams", "team_view")])

        call_command("backfill_access_roles", "--dry-run")

        self.assertFalse(TeamGroupBinding.objects.exists())
