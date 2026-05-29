from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404

from apps.access.services import has_permission
from apps.base.permissions import require_authenticated, require_org_selected
from apps.teams.models import Team


def require_org_permission(request, permission_key: str):
    require_authenticated(request)
    org = require_org_selected(request)
    if not has_permission(request.user, org, permission_key):
        raise PermissionDenied("You do not have permission to perform this action.")
    return org


def require_team_permission(request, team_id: int, permission_key: str):
    require_authenticated(request)
    org = require_org_selected(request)
    team = get_object_or_404(Team, pk=team_id, organization=org)
    if not has_permission(request.user, org, permission_key, team=team):
        raise PermissionDenied("You do not have permission to perform this action.")
    return team
