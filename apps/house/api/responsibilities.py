from django.shortcuts import get_object_or_404

from ninja import Query, Router
from ninja.pagination import paginate

from apps.access.constants import OrganizationPermission, TeamPermission
from apps.access.permissions import require_org_permission, require_team_permission
from apps.base.ninja_pagination import LegacyPagination
from apps.house.queries.responsibilities import list_responsibility_members, responsibility_members, summarize_responsibility_members
from apps.house.schemas.responsibilities import PropertyResponsibilityMemberOut, PropertyResponsibilitySummaryOut, PropertyResponsibilityUpdateIn
from apps.house.services.responsibilities import replace_responsibilities as perform_replace_responsibilities

router = Router(tags=["房源/管理"])


@router.get("/staff-responsibilities/", response=list[PropertyResponsibilityMemberOut], summary="获取员工房源职责列表")
@paginate(LegacyPagination)
def list_staff_responsibilities(
    request,
    keyword: str | None = Query(None),
    team_id: int | None = Query(None),
    unassigned: bool = Query(False),
    member_id: int | None = Query(None),
):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    team = require_team_permission(request, team_id, TeamPermission.VIEW) if team_id is not None else None
    return list_responsibility_members(organization=org, keyword=keyword, team=team, unassigned=unassigned, member_id=member_id)


@router.get("/staff-responsibilities/summary/", response=PropertyResponsibilitySummaryOut, summary="获取团队员工房源职责汇总")
def get_staff_responsibility_summary(request, team_id: int = Query(...)):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    team = require_team_permission(request, team_id, TeamPermission.VIEW)
    return summarize_responsibility_members(organization=org, team=team)


@router.get("/staff-responsibilities/{member_id}/", response=PropertyResponsibilityMemberOut, summary="获取员工房源职责")
def get_staff_responsibility(request, member_id: int):
    org = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    return get_object_or_404(responsibility_members(org), pk=member_id)


@router.put("/staff-responsibilities/{member_id}/", response=PropertyResponsibilityMemberOut, summary="替换员工房源职责")
def replace_staff_responsibilities(request, member_id: int, payload: PropertyResponsibilityUpdateIn):
    org = require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    return perform_replace_responsibilities(organization=org, actor=request.user, member_id=member_id, **payload.model_dump())
