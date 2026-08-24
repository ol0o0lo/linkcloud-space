from apps.access.constants import TeamPermission
from apps.access.services import has_permission
from apps.teams.models import Team


def visible_teams_for_request(request, organization):
    """Return teams in the selected organization that the current user may view."""
    qs = Team.objects.filter(organization=organization)
    if has_permission(request.user, organization, TeamPermission.VIEW):
        return qs.distinct()
    return qs.filter(
        teamgroupbinding__user=request.user,
        teamgroupbinding__group__access_role__is_active=True,
        teamgroupbinding__group__permissions__content_type__app_label="teams",
        teamgroupbinding__group__permissions__codename="team_view",
    ).distinct()
