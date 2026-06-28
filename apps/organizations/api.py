import re

from django.apps import apps
from django.conf import settings
from django.db import models, transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Path, Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import OrganizationPermission
from apps.access.permissions import require_org_permission
from apps.access.services import assign_org_role
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated, require_org_owner
from apps.organizations.hooks import post_create_organization, pre_create_organization
from apps.organizations.models import Organization, OrganizationInvite, OrganizationMember
from apps.organizations.schemas import (
    InviteIn,
    InviteOut,
    MemberIn,
    MemberOut,
    MemberPatchIn,
    MemberSearchOut,
    OrganizationCreateIn,
    OrganizationCreateOut,
    OrganizationOut,
    OrganizationPatchIn,
    OrganizationStatusPatchIn,
    OrganizationUsageOut,
    OrgSelectOut,
    PublicInviteOut,
    SetPrimaryOut,
    SettingsOut,
    SettingsPatchIn,
    SuccessOut,
    SwitchListItemOut,
    TransferOwnerIn,
)
from apps.organizations.session import remove_org, save_counts, save_org_data
from apps.teams.models import Team

orgs_router = Router(tags=["租户/基础"])
members_router = Router(tags=["租户/成员"])
invites_router = Router(tags=["租户/邀请"])
public_invites_router = Router(tags=["租户/公开邀请"])
settings_router = Router(tags=["租户/档案"])


# ---------------------------------------------------------------------------
# Organizations
# ---------------------------------------------------------------------------


@orgs_router.post("/", response={201: OrganizationCreateOut}, summary="创建租户")
def create_organization(request, payload: OrganizationCreateIn):
    """创建一个新租户，并将当前用户设置为租户 owner 与 primary 成员。"""
    require_authenticated(request)
    pre_create_organization(request)
    with transaction.atomic():
        org = Organization.objects.create(name=payload.name, slug=payload.slug)
        OrganizationMember.objects.create(organization=org, user=request.user, is_owner=True, is_primary=True)
        post_create_organization(request, org)
    save_org_data(request, org)
    return Status(201, {"id": org.pk, "name": org.name, "slug": org.slug})


def _selected_owner_org(request, slug: str) -> Organization:
    org = require_org_owner(request)
    if org.slug != slug:
        raise HttpError(403, "Select this organization before managing it.")
    return org


@orgs_router.get("/switch-list/", response=list[SwitchListItemOut], summary="获取租户切换列表")
def switch_list(request):
    """返回当前用户所属租户列表及当前选中、主租户状态。"""
    require_authenticated(request)
    orgs = Organization.objects.filter(organizationmember__user=request.user).annotate(
        is_primary=models.Subquery(
            OrganizationMember.objects.filter(
                organization=models.OuterRef("pk"),
                user=request.user,
            ).values("is_primary")[:1]
        )
    )
    current_slug = request.org.slug if request.org else None
    return [
        {
            "id": org.pk,
            "name": org.name,
            "slug": org.slug,
            "is_primary": bool(org.is_primary),
            "is_current": org.slug == current_slug,
        }
        for org in orgs
    ]


@orgs_router.post("/signout/", response=SuccessOut, summary="退出当前租户")
def signout(request):
    """清除当前会话中的租户上下文选择。"""
    require_authenticated(request)
    remove_org(request)
    return {"success": True}


@orgs_router.get("/{slug}/", response=OrganizationOut, summary="获取租户详情")
def get_organization(request, slug: str):
    """返回当前选中租户的完整资料，用于后台资料页初始化。"""
    return _selected_owner_org(request, slug)


@orgs_router.patch("/{slug}/", response=OrganizationOut, summary="更新租户资料和限制")
def patch_organization(request, slug: str, payload: OrganizationPatchIn):
    """更新当前选中租户的基础资料、账单邮箱和成员/团队上限。"""
    org = _selected_owner_org(request, slug)
    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(org, field, value)
    org.full_clean()
    org.save()
    save_org_data(request, org)
    return org


@orgs_router.patch("/{slug}/status/", response=OrganizationOut, summary="归档或恢复租户")
def patch_organization_status(request, slug: str, payload: OrganizationStatusPatchIn):
    """通过 is_active 控制租户是否可用；禁用时记录 archived_at，恢复时清空。"""
    org = _selected_owner_org(request, slug)
    org.is_active = payload.is_active
    org.archived_at = None if payload.is_active else timezone.now()
    org.save(update_fields=["is_active", "archived_at", "updated_at"])
    save_org_data(request, org)
    return org


@orgs_router.post("/{slug}/transfer-owner/", response=SuccessOut, summary="转移租户 owner")
def transfer_owner(request, slug: str, payload: TransferOwnerIn):
    """将当前 owner 身份转移给同租户的另一个成员。"""
    org = _selected_owner_org(request, slug)
    with transaction.atomic():
        new_owner = get_object_or_404(OrganizationMember.objects.select_for_update(), organization=org, user_id=payload.user)
        current_owner = get_object_or_404(OrganizationMember.objects.select_for_update(), organization=org, user=request.user)
        if new_owner.user_id == request.user.pk:
            raise HttpError(400, "The selected user is already the current owner.")
        updated_at = timezone.now()
        new_owner.is_owner = True
        new_owner.updated_at = updated_at
        current_owner.is_owner = False
        current_owner.updated_at = updated_at
        OrganizationMember.objects.bulk_update([new_owner, current_owner], ["is_owner", "updated_at"])
    save_org_data(request, org)
    save_counts(request)
    return {"success": True}


@orgs_router.get("/{slug}/usage/", response=OrganizationUsageOut, summary="获取租户用量")
def get_organization_usage(request, slug: str):
    """返回当前租户成员数、团队数及对应上限。"""
    org = _selected_owner_org(request, slug)
    return {
        "member_count": OrganizationMember.objects.filter(organization=org).count(),
        "team_count": Team.objects.filter(organization=org).count(),
        "member_limit": org.member_limit,
        "team_limit": org.team_limit,
    }


@orgs_router.post("/{slug}/select/", response=OrgSelectOut, summary="切换当前租户")
def select_org(request, slug: str = Path(..., description="租户 slug。")):
    """将当前会话切换到指定 slug 对应的租户。"""
    require_authenticated(request)
    org = get_object_or_404(Organization, slug=slug)
    if not org.is_member(request.user):
        raise HttpError(403, "Not a member.")
    save_org_data(request, org)
    return {"id": org.pk, "slug": org.slug, "name": org.name, "is_owner": org.is_owner(request.user)}


@orgs_router.post("/{slug}/set-primary/", response=SetPrimaryOut, summary="设置主租户")
def set_primary(request, slug: str = Path(..., description="租户 slug。")):
    """将指定租户设置为当前用户的主租户。"""
    require_authenticated(request)
    org = get_object_or_404(Organization, slug=slug)
    with transaction.atomic():
        membership = OrganizationMember.objects.select_for_update().filter(user=request.user, organization=org).first()
        if membership is None:
            raise HttpError(403, "Not a member.")
        if membership.is_primary:
            membership.is_primary = False
            membership.save(update_fields=["is_primary"])
            return {"success": True, "is_primary": False}
        OrganizationMember.objects.filter(user=request.user, is_primary=True).update(is_primary=False)
        membership.is_primary = True
        membership.save(update_fields=["is_primary"])
    return {"success": True, "is_primary": True}


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


def _members_qs(request):
    return OrganizationMember.objects.select_related("user", "organization").filter_by_org(request).order_by("user__username")


@members_router.get("/", response=list[MemberOut], summary="获取租户成员列表")
@paginate(LegacyPagination)
def list_members(request, keyword: str | None = Query(None, description="按姓名、用户名或邮箱搜索成员。")):
    """返回当前租户成员列表，支持按姓名、用户名和邮箱搜索。"""
    require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    qs = _members_qs(request)
    if keyword:
        qs = qs.filter(
            Q(user__first_name__icontains=keyword) | Q(user__last_name__icontains=keyword) | Q(user__username__icontains=keyword) | Q(user__email__icontains=keyword)
        )
    return qs


@members_router.get("/search/", response=list[MemberSearchOut], summary="搜索可添加成员")
def search_members(request, keyword: str = Query("", description="待搜索的用户关键字。")):
    """搜索尚未加入当前租户且未被邀请的可添加用户。"""
    org = require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    user_model = apps.get_model(settings.AUTH_USER_MODEL)
    qs = user_model.objects.filter(is_active=True)
    qs = qs.exclude(pk__in=OrganizationMember.objects.filter(organization=org).values_list("user_id", flat=True))
    qs = qs.exclude(pk__in=OrganizationInvite.objects.filter(organization=org).filter(invitee__isnull=False).values_list("invitee_id", flat=True))
    if len(keyword) > 2:
        items = [item.strip() for item in re.split(r"\s+", keyword)]
        q_obj = Q()
        for item in items:
            for fn in ("first_name", "last_name", "username", "email"):
                q_obj |= Q(**{f"{fn}__icontains": item})
        qs = qs.filter(q_obj)
    qs = qs[:10]
    return [
        {
            "pk": u.pk,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "username": u.username,
            "email": u.email,
            "avatar_url": u.avatar_url,
        }
        for u in qs
    ]


@members_router.post("/", response={201: MemberOut}, summary="添加租户成员")
def create_member(request, payload: MemberIn):
    """向当前租户新增一个成员，并可选择是否授予 owner 身份。"""
    org = require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    membership = OrganizationMember.objects.create(organization=org, user_id=payload.user, is_owner=payload.is_owner)
    return Status(201, membership)


@members_router.get("/{member_id}/", response=MemberOut, summary="获取租户成员详情")
def get_member(request, member_id: int):
    """返回当前租户内单个成员的详细信息。"""
    require_org_permission(request, OrganizationPermission.MEMBER_VIEW)
    return get_object_or_404(_members_qs(request), pk=member_id)


@members_router.patch("/{member_id}/", response=MemberOut, summary="更新租户成员")
def patch_member(request, member_id: int, payload: MemberPatchIn):
    """更新成员 owner 状态等可编辑信息。"""
    require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    membership = get_object_or_404(_members_qs(request), pk=member_id)
    was_owner = membership.is_owner
    if payload.is_owner is not None:
        membership.is_owner = payload.is_owner
        membership.save(update_fields=["is_owner", "updated_at"])
        if not was_owner and membership.is_owner:
            membership.send_owner_email(sending_user=request.user)
    return membership


@members_router.delete("/{member_id}/", response={200: dict}, summary="移除租户成员")
def delete_member(request, member_id: int):
    """将指定成员从当前租户移除，不允许移除自己。"""
    require_org_permission(request, OrganizationPermission.MEMBER_MANAGE)
    membership = get_object_or_404(_members_qs(request), pk=member_id)
    if membership.user.pk == request.user.pk:
        raise HttpError(400, "You're not allowed to remove yourself from the organization.")
    membership.send_removal_email(sending_user=request.user)
    membership.delete()
    return Status(200, {})


# ---------------------------------------------------------------------------
# Invites
# ---------------------------------------------------------------------------


def _invites_qs(request):
    return OrganizationInvite.objects.select_related("organization", "sender", "invitee").filter_by_org(request).order_by("-created_at")


@invites_router.get("/", response=list[InviteOut], summary="获取租户邀请列表")
@paginate(LegacyPagination)
def list_invites(request):
    """返回当前租户的邀请记录列表。"""
    require_org_permission(request, OrganizationPermission.INVITE_MANAGE)
    return _invites_qs(request)


@invites_router.post("/", response={201: InviteOut}, summary="创建租户邀请")
def create_invite(request, payload: InviteIn):
    """向指定邮箱或用户发送加入当前租户的邀请。"""
    org = require_org_permission(request, OrganizationPermission.INVITE_MANAGE)
    with transaction.atomic():
        invite = OrganizationInvite.objects.create(
            organization=org,
            sender=request.user,
            invitee_email=payload.invitee_email,
            invitee_id=payload.invitee,
            is_owner=payload.is_owner and request.user.is_superuser,
            access_role_id=payload.access_role,
        )
        transaction.on_commit(invite.send_invite)
    return Status(201, invite)


@invites_router.get("/{invite_id}/", response=InviteOut, summary="获取租户邀请详情")
def get_invite(request, invite_id: int):
    """返回当前租户某条邀请记录的详情。"""
    require_org_permission(request, OrganizationPermission.INVITE_MANAGE)
    return get_object_or_404(_invites_qs(request), pk=invite_id)


@invites_router.post("/{invite_id}/resend/", response=SuccessOut, summary="重发租户邀请")
def resend_invite(request, invite_id: int):
    """重新发送当前租户内某条待处理邀请。"""
    require_org_permission(request, OrganizationPermission.INVITE_MANAGE)
    invite = get_object_or_404(_invites_qs(request), pk=invite_id)
    with transaction.atomic():
        invite.reissue(sender=request.user)
        transaction.on_commit(invite.send_invite)
    return {"success": True}


@invites_router.delete("/{invite_id}/", response={200: dict}, summary="取消租户邀请")
def delete_invite(request, invite_id: int):
    """取消一条未处理的租户邀请。"""
    require_org_permission(request, OrganizationPermission.INVITE_MANAGE)
    invite = get_object_or_404(_invites_qs(request), pk=invite_id)
    with transaction.atomic():
        transaction.on_commit(invite.send_cancellation)
        invite.delete()
    return Status(200, {})


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@settings_router.get("/", response=SettingsOut, summary="获取租户资料")
def get_settings(request):
    """返回当前租户资料页所需的基础信息。"""
    org = require_org_permission(request, OrganizationPermission.SETTING_MANAGE)
    return {"billing_email": org.billing_email or ""}


@settings_router.patch("/update_settings/", response=SettingsOut, summary="更新租户资料")
def update_settings(request, payload: SettingsPatchIn):
    """更新当前租户的基础资料字段。"""
    org = require_org_permission(request, OrganizationPermission.SETTING_MANAGE)
    data = payload.dict(exclude_unset=True)
    for field, value in data.items():
        setattr(org, field, value)
    org.save()
    return {"billing_email": org.billing_email or ""}


# ---------------------------------------------------------------------------
# Public invite lookup (unauthenticated; the email link lands here before sign-in)
# ---------------------------------------------------------------------------


@public_invites_router.get("/{key}/", response=PublicInviteOut, auth=None, summary="获取公开邀请信息")
def get_invite_by_key(request, key: str = Path(..., description="邀请 key。")):
    """根据邀请 key 查询公开邀请详情，供登录前后的接受页展示。"""
    invite = get_object_or_404(OrganizationInvite.objects.select_related("organization", "sender"), key=key)
    is_already_member = bool(request.user.is_authenticated and invite.organization.is_member(request.user))
    return {
        "organization_name": invite.organization.name,
        "sender_name": invite.sender.get_full_name() or invite.sender.email,
        "invitee_email": invite.invitee_email or "",
        "is_expired": invite.is_expired,
        "is_already_member": is_already_member,
    }


@public_invites_router.post("/{key}/accept/", response=SuccessOut, summary="接受公开邀请")
def accept_invite_by_key(request, key: str = Path(..., description="邀请 key。")):
    """接受租户邀请并将当前用户加入对应租户。"""
    require_authenticated(request)
    invite = get_object_or_404(OrganizationInvite.objects.select_related("organization", "sender"), key=key)
    if invite.is_expired:
        raise HttpError(410, "This invite has expired.")
    if invite.invitee_email and invite.invitee_email.lower() != request.user.email.lower():
        raise HttpError(403, "This invitation was sent to a different email address.")
    if invite.organization.is_member(request.user):
        raise HttpError(409, "You're already a member of this organization.")
    is_owner = invite.is_owner and invite.organization.is_owner(invite.sender)
    with transaction.atomic():
        OrganizationMember.objects.get_or_create(organization=invite.organization, user=request.user, is_owner=is_owner)
        if invite.access_role_id:
            assign_org_role(invite.organization, request.user, invite.access_role)
        invite.delete()
    save_counts(request)
    save_org_data(request, invite.organization)
    return {"success": True}


@public_invites_router.post("/{key}/decline/", response=SuccessOut, summary="拒绝公开邀请")
def decline_invite_by_key(request, key: str = Path(..., description="邀请 key。")):
    """拒绝并删除当前用户对应的租户邀请。"""
    require_authenticated(request)
    invite = get_object_or_404(OrganizationInvite.objects, key=key)
    if invite.invitee_email and invite.invitee_email.lower() != request.user.email.lower():
        raise HttpError(403, "This invitation was sent to a different email address.")
    invite.delete()
    return {"success": True}
