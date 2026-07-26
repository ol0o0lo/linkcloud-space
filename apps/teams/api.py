from django.db import transaction

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.access.constants import TeamPermission
from apps.access.permissions import require_org_permission, require_team_permission
from apps.access.services import has_permission
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_selected
from apps.organizations.models import OrganizationMember
from apps.teams.hooks import post_create_team, pre_create_team
from apps.teams.models import Team
from apps.teams.schemas import TeamIn, TeamOut, TeamPatchIn

router = Router(tags=["团队/基础"])


def _team_qs(request):
    return Team.objects.filter_by_org(request).prefetch_related("members").order_by("name")


def _validate_members(member_ids: list[int], org) -> list[int]:
    if not member_ids:
        return []
    org_user_ids = set(OrganizationMember.objects.filter(organization=org).values_list("user_id", flat=True))
    invalid = [pk for pk in member_ids if pk not in org_user_ids]
    if invalid:
        from django.core.exceptions import ValidationError

        raise ValidationError({"members": [f"User id {pk} is not a member of this organization." for pk in invalid]})
    return member_ids


@router.get("/", response=list[TeamOut], summary="获取团队列表")
@paginate(LegacyPagination)
def list_teams(request, keyword: str | None = Query(None, description="按团队名称搜索。")):
    """返回当前租户下用户可见的团队列表，支持按名称搜索。"""
    require_authenticated(request)
    org = require_org_selected(request)
    qs = _team_qs(request)
    if not has_permission(request.user, org, TeamPermission.VIEW):
        qs = qs.filter(
            teamgroupbinding__user=request.user,
            teamgroupbinding__group__access_role__is_active=True,
            teamgroupbinding__group__permissions__content_type__app_label="teams",
            teamgroupbinding__group__permissions__codename="team_view",
        )
    if keyword:
        qs = qs.filter(name__icontains=keyword)
    return qs.distinct()


@router.post("/", response={201: TeamOut}, summary="创建团队")
def create_team(request, payload: TeamIn):
    """在当前租户下创建一个新团队，并可设置初始成员。"""
    org = require_org_permission(request, TeamPermission.CREATE)
    from apps.subscriptions.entitlements import EntitlementService

    EntitlementService.check_can_add(org, "team")
    member_ids = _validate_members(payload.members, org)
    pre_create_team(request)
    with transaction.atomic():
        team = Team.objects.create(
            organization=org,
            name=payload.name,
            phone=payload.phone,
            wechat=payload.wechat,
            address=payload.address,
            business_hours=payload.business_hours,
        )
        if member_ids:
            team.members.set(member_ids)
        post_create_team(request, team)
    return Status(201, team)


@router.get("/{team_id}/", response=TeamOut, summary="获取团队详情")
def get_team(request, team_id: int):
    """返回当前用户有权限访问的单个团队详情。"""
    return require_team_permission(request, team_id, TeamPermission.VIEW)


@router.patch("/{team_id}/", response=TeamOut, summary="更新团队")
def patch_team(request, team_id: int, payload: TeamPatchIn):
    """更新团队资料或成员列表，成员变更需要额外的成员管理权限。"""
    team = require_team_permission(request, team_id, TeamPermission.UPDATE)
    org = team.organization
    data = payload.dict(exclude_unset=True, exclude={"members"})
    if data:
        for field, value in data.items():
            setattr(team, field, value)
        team.save(update_fields=[*data, "updated_at"])
    if payload.members is not None:
        require_team_permission(request, team_id, TeamPermission.MEMBER_MANAGE)
        member_ids = _validate_members(payload.members, org)
        team.members.set(member_ids)
    return team


@router.delete("/{team_id}/", response={200: dict}, summary="删除团队")
def delete_team(request, team_id: int):
    """删除指定团队。"""
    team = require_team_permission(request, team_id, TeamPermission.DELETE)
    team.delete()
    return Status(200, {})
