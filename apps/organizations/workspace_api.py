from datetime import timedelta

from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Query, Router
from ninja.pagination import paginate

from apps.access.constants import AccessPermission, OrganizationPermission, TeamPermission
from apps.access.permissions import require_org_permission
from apps.access.services import has_permission
from apps.base.ninja_pagination import LegacyPagination
from apps.house.models import PropertyResponsibility
from apps.organizations.models import OrganizationInvite, OrganizationMember
from apps.organizations.workspace_schemas import OrganizationNavigationOut, OrganizationSearchOut, WorkspaceMemberOut
from apps.teams.services import visible_teams_for_request

router = Router(tags=["租户/组织架构"])


def workspace_members_queryset(request, organization):
    visible_teams = visible_teams_for_request(request, organization).annotate(member_count=Count("members", distinct=True)).order_by("name", "pk")
    return (
        OrganizationMember.objects.filter(organization=organization)
        .select_related("user")
        .annotate(
            organization_team_count=Count(
                "user__teams",
                filter=Q(user__teams__organization=organization),
                distinct=True,
            ),
            has_responsibility=Exists(PropertyResponsibility.objects.filter(member_id=OuterRef("pk"))),
        )
        .prefetch_related(Prefetch("user__teams", queryset=visible_teams, to_attr="workspace_teams"))
        .order_by("user__first_name", "user__last_name", "user__username", "pk")
    )


@router.get("/navigation/", response=OrganizationNavigationOut, summary="获取组织架构导航摘要")
def get_navigation(request):
    organization = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    members = OrganizationMember.objects.filter(organization=organization)
    teams = list(visible_teams_for_request(request, organization).annotate(member_count=Count("members", distinct=True)).order_by("name", "pk"))
    ungrouped_member_count = (
        members.annotate(
            organization_team_count=Count(
                "user__teams",
                filter=Q(user__teams__organization=organization),
                distinct=True,
            )
        )
        .filter(organization_team_count=0)
        .count()
    )
    pending_invite_count = None
    if has_permission(request.user, organization, OrganizationPermission.INVITE_MANAGE):
        pending_invite_count = OrganizationInvite.objects.filter(
            organization=organization,
            created_at__gte=timezone.now() - timedelta(days=OrganizationInvite.expired_in_days),
        ).count()
    return {
        "organization": organization,
        "member_count": members.count(),
        "owner_count": members.filter(is_owner=True).count(),
        "team_count": len(teams),
        "ungrouped_member_count": ungrouped_member_count,
        "pending_invite_count": pending_invite_count,
        "unassigned_responsibility_count": members.filter(property_responsibilities__isnull=True).count(),
        "teams": teams,
        "capabilities": {
            "member_manage": has_permission(request.user, organization, OrganizationPermission.MEMBER_MANAGE),
            "invite_manage": has_permission(request.user, organization, OrganizationPermission.INVITE_MANAGE),
            "role_view": has_permission(request.user, organization, AccessPermission.ROLE_VIEW),
            "role_manage": has_permission(request.user, organization, AccessPermission.ROLE_MANAGE),
            "team_create": has_permission(request.user, organization, TeamPermission.CREATE),
            "responsibility_manage": has_permission(request.user, organization, OrganizationPermission.MEMBER_MANAGE),
            "team_update_ids": [team.pk for team in teams if has_permission(request.user, organization, TeamPermission.UPDATE, team=team)],
            "team_delete_ids": [team.pk for team in teams if has_permission(request.user, organization, TeamPermission.DELETE, team=team)],
            "team_member_manage_ids": [team.pk for team in teams if has_permission(request.user, organization, TeamPermission.MEMBER_MANAGE, team=team)],
            "team_role_view_ids": [team.pk for team in teams if has_permission(request.user, organization, AccessPermission.TEAM_ROLE_VIEW, team=team)],
            "team_role_manage_ids": [team.pk for team in teams if has_permission(request.user, organization, AccessPermission.TEAM_ROLE_MANAGE, team=team)],
        },
    }


@router.get("/members/", response=list[WorkspaceMemberOut], summary="获取组织架构成员目录")
@paginate(LegacyPagination)
def list_workspace_members(
    request,
    keyword: str | None = Query(None, description="按员工姓名、职位、账号姓名、用户名或邮箱搜索成员。"),
    team_id: int | None = Query(None, description="按可见团队筛选成员。"),
    ungrouped: bool = Query(False, description="仅返回未加入任何当前组织团队的成员。"),
):
    organization = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    qs = workspace_members_queryset(request, organization)
    if keyword:
        qs = qs.filter(
            Q(employee_name__icontains=keyword)
            | Q(job_title__icontains=keyword)
            | Q(user__first_name__icontains=keyword)
            | Q(user__last_name__icontains=keyword)
            | Q(user__username__icontains=keyword)
            | Q(user__email__icontains=keyword)
        )
    if team_id is not None:
        team = get_object_or_404(visible_teams_for_request(request, organization), pk=team_id)
        qs = qs.filter(user__teams=team)
    if ungrouped:
        qs = qs.filter(organization_team_count=0)
    return qs.distinct()


@router.get("/members/{member_id}/", response=WorkspaceMemberOut, summary="获取组织架构成员详情")
def get_workspace_member(request, member_id: int):
    organization = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    return get_object_or_404(workspace_members_queryset(request, organization), pk=member_id)


@router.get("/search/", response=OrganizationSearchOut, summary="搜索组织架构")
def search_workspace(request, keyword: str = Query("", description="团队名称、员工姓名、职位、账号姓名、用户名或邮箱。")):
    organization = require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    normalized = keyword.strip()
    if not normalized:
        return {"teams": [], "members": []}
    teams = visible_teams_for_request(request, organization).filter(name__icontains=normalized).annotate(member_count=Count("members", distinct=True)).order_by("name", "pk")[:10]
    members = (
        workspace_members_queryset(request, organization)
        .filter(
            Q(employee_name__icontains=normalized)
            | Q(job_title__icontains=normalized)
            | Q(user__first_name__icontains=normalized)
            | Q(user__last_name__icontains=normalized)
            | Q(user__username__icontains=normalized)
            | Q(user__email__icontains=normalized)
        )
        .distinct()[:20]
    )
    return {"teams": list(teams), "members": list(members)}
