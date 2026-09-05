from django.core.management.base import BaseCommand, CommandError

from apps.access.constants import AccessRoleCode, AccessScope
from apps.access.models import AccessRole
from apps.access.services import assign_team_role
from apps.organizations.models import Organization, OrganizationMember
from apps.teams.models import Team


class Command(BaseCommand):
    help = "Backfill team_staff access role bindings for existing team members."

    def add_arguments(self, parser):
        parser.add_argument("--org", help="Limit backfill to one organization slug.")
        parser.add_argument("--dry-run", action="store_true", help="Only report how many bindings would be created.")

    def handle(self, *args, **options):
        role = (
            AccessRole.objects.filter(
                is_active=True,
                is_system=True,
                scope=AccessScope.TEAM,
                code=AccessRoleCode.TEAM_STAFF,
            )
            .select_related("group")
            .first()
        )
        if role is None:
            raise CommandError("System role team_staff does not exist.")

        orgs = Organization.objects.all()
        if options["org"]:
            orgs = orgs.filter(slug=options["org"])
        created = 0
        skipped = 0

        for team in Team.objects.filter(organization__in=orgs).prefetch_related("members"):
            org_member_ids = set(OrganizationMember.objects.filter(organization=team.organization).values_list("user_id", flat=True))
            for user in team.members.all():
                if user.pk not in org_member_ids:
                    skipped += 1
                    continue
                if options["dry_run"]:
                    if not team.teamgroupbinding_set.filter(user=user, group=role.group).exists():
                        created += 1
                    continue
                binding = assign_team_role(team, user, role)
                if binding.created_at == binding.updated_at:
                    created += 1

        self.stdout.write(self.style.SUCCESS(f"Backfill complete. created={created}, skipped={skipped}"))
