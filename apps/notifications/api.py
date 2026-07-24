from dataclasses import asdict
from typing import Literal

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Path, Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.accounts.models import User
from apps.base.ninja_pagination import LegacyPagination
from apps.notifications.categories import get_categories, get_category
from apps.notifications.constants import NotificationChannel, NotificationDispatchScope
from apps.notifications.models import Notification, NotificationDispatch, NotificationPreference
from apps.notifications.schemas import (
    BulkActionIn,
    BulkResultOut,
    NotificationDispatchIn,
    NotificationDispatchOut,
    NotificationDispatchTargetOut,
    NotificationOut,
    NotificationPatchIn,
    NotificationPreferenceOut,
    NotificationPreferencePatchIn,
    UnreadCountOut,
)
from apps.notifications.tasks import dispatch_notification
from apps.organizations.models import Organization, OrganizationMember
from apps.teams.models import Team

router = Router(tags=["通知/消息"])
dispatches_router = Router(tags=["通知分发"])
ManagementContext = Literal["auto", "platform", "tenant"]
ResolvedManagementContext = Literal["platform", "tenant"]


def _base_qs(request):
    return Notification.objects.filter_by_org(request).select_related("actor", "target_content_type")


@router.get("/", response=list[NotificationOut], summary="获取通知列表")
@paginate(LegacyPagination)
def list_notifications(request, is_read: str | None = Query(None, description="按已读状态筛选。")):
    """返回当前用户在当前租户范围内的通知列表，支持按已读状态筛选。"""
    qs = _base_qs(request)
    if is_read is not None:
        want_read = is_read.lower() in ("true", "1", "yes")
        qs = qs.filter(read_at__isnull=not want_read)
    return qs


@router.get("/unread-count/", response=UnreadCountOut, summary="获取未读通知数量")
def unread_count(request):
    """返回当前用户在当前租户下的未读通知数量。"""
    return {"count": _base_qs(request).filter(read_at__isnull=True).count()}


def _serialize_category(cat, pref) -> dict:
    return {
        **asdict(cat),
        "in_app": NotificationChannel.IN_APP in cat.required_channels or (pref.in_app if pref is not None else NotificationChannel.IN_APP in cat.default_channels),
        "email": NotificationChannel.EMAIL in cat.required_channels or (pref.email if pref is not None else NotificationChannel.EMAIL in cat.default_channels),
    }


@router.get("/preferences/", response=list[NotificationPreferenceOut], summary="获取通知偏好设置")
def list_preferences(request):
    """返回通知类别与当前用户偏好设置的合并结果。"""
    saved = {p.category: p for p in NotificationPreference.objects.filter(user=request.user)}
    return [_serialize_category(cat, saved.get(cat.key)) for cat in get_categories()]


@router.patch("/preferences/{category}/", response=NotificationPreferenceOut, summary="更新通知偏好设置")
def patch_preference(
    request,
    category: str = Path(..., description="通知类别 key。"),
    payload: NotificationPreferencePatchIn = ...,
):
    """更新某个通知类别的站内和邮件接收偏好。"""
    cat = get_category(category)
    if cat is None:
        raise HttpError(404, f"Unknown notification category: {category}")
    if payload.in_app is False and NotificationChannel.IN_APP in cat.required_channels:
        raise HttpError(422, "This notification category requires the in-app channel.")
    if payload.email is False and NotificationChannel.EMAIL in cat.required_channels:
        raise HttpError(422, "This notification category requires the email channel.")
    pref, _created = NotificationPreference.objects.get_or_create(
        user=request.user,
        category=category,
        defaults={
            "in_app": NotificationChannel.IN_APP in cat.default_channels,
            "email": NotificationChannel.EMAIL in cat.default_channels,
        },
    )
    if payload.in_app is not None:
        pref.in_app = payload.in_app
    if payload.email is not None:
        pref.email = payload.email
    if payload.in_app is not None or payload.email is not None:
        pref.save(update_fields=["in_app", "email", "updated_at"])
    return _serialize_category(cat, pref)


@router.post("/bulk/", response=BulkResultOut, summary="批量处理通知")
def bulk_action(request, payload: BulkActionIn = ...):
    """批量标记通知已读、未读或删除通知。"""
    qs = _base_qs(request)
    if payload.all_unread:
        qs = qs.filter(read_at__isnull=True)
    else:
        if not payload.ids:
            raise HttpError(400, "ids must be a non-empty list when all_unread is not set")
        qs = qs.filter(pk__in=payload.ids)

    if payload.action == "delete":
        deleted, _ = qs.delete()
        return {"deleted": deleted}

    now = timezone.now() if payload.action == "mark_read" else None
    updated = qs.update(read_at=now)
    return {"updated": updated}


@router.get("/{notification_id}/", response=NotificationOut, summary="获取通知详情")
def get_notification(request, notification_id: int):
    """返回当前用户可访问的单条通知详情。"""
    return get_object_or_404(_base_qs(request), pk=notification_id)


@router.patch("/{notification_id}/", response=NotificationOut, summary="更新通知状态")
def patch_notification(
    request,
    notification_id: int,
    payload: NotificationPatchIn,
):
    """更新单条通知的已读状态。"""
    notification = get_object_or_404(_base_qs(request), pk=notification_id)
    if payload.is_read is not None:
        notification.read_at = timezone.now() if payload.is_read else None
        notification.save(update_fields=["read_at", "updated_at"])
    return notification


@router.delete("/{notification_id}/", response={200: dict}, summary="删除通知")
def delete_notification(request, notification_id: int):
    """删除当前用户可访问的单条通知。"""
    notification = get_object_or_404(_base_qs(request), pk=notification_id)
    notification.delete()
    return Status(200, {})


def _current_owned_org_id(request) -> int | None:
    org_id = getattr(request.org, "id", None)
    if org_id is None:
        return None
    if OrganizationMember.objects.filter(organization_id=org_id, user=request.user, is_owner=True).exists():
        return org_id
    return None


def _resolve_management_context(request, management_context: ManagementContext) -> tuple[ResolvedManagementContext, int | None]:
    resolved_context = "platform" if management_context == "auto" and request.user.is_superuser else management_context
    if resolved_context == "auto":
        resolved_context = "tenant"

    if resolved_context == "platform":
        if not request.user.is_superuser:
            raise HttpError(403, "Only platform administrators can use the platform management context.")
        return "platform", None

    org_id = getattr(request.org, "id", None) if request.user.is_superuser else _current_owned_org_id(request)
    if org_id is None or not Organization.objects.filter(pk=org_id).exists():
        raise HttpError(403, "Select an organization you can manage before using the tenant management context.")
    return "tenant", org_id


def _dispatch_qs(request, management_context: ManagementContext):
    resolved_context, org_id = _resolve_management_context(request, management_context)
    if resolved_context == "platform":
        return NotificationDispatch.objects.all(), resolved_context, org_id
    return NotificationDispatch.objects.filter(owner_organization_id=org_id), resolved_context, org_id


def _validate_existing_scope_ids(payload: NotificationDispatchIn) -> None:
    target_ids = set(payload.scope_ids)
    if not target_ids:
        return

    if payload.scope == NotificationDispatchScope.ORGANIZATION:
        existing_ids = set(Organization.objects.filter(pk__in=target_ids).values_list("pk", flat=True))
        missing_ids = sorted(target_ids - existing_ids)
        if missing_ids:
            raise HttpError(400, f"Unknown organization ids: {missing_ids}")

    if payload.scope == NotificationDispatchScope.USERS:
        existing_ids = set(User.objects.filter(pk__in=target_ids).values_list("pk", flat=True))
        missing_ids = sorted(target_ids - existing_ids)
        if missing_ids:
            raise HttpError(400, f"Unknown user ids: {missing_ids}")


def _validate_dispatch_scope(request, payload: NotificationDispatchIn, management_context: ManagementContext) -> int | None:
    resolved_context, org_id = _resolve_management_context(request, management_context)
    if resolved_context == "platform":
        if payload.scope == NotificationDispatchScope.TEAMS:
            raise HttpError(403, "Team dispatches require the tenant management context.")
        _validate_existing_scope_ids(payload)
        return None

    if payload.scope == NotificationDispatchScope.PLATFORM:
        raise HttpError(403, "The tenant management context cannot create platform notification dispatches.")

    if payload.scope == NotificationDispatchScope.ORGANIZATION:
        if payload.scope_ids != [org_id]:
            raise HttpError(403, "Tenant organization dispatches must target the selected organization.")
        return org_id

    if payload.scope == NotificationDispatchScope.TEAMS:
        target_team_ids = set(payload.scope_ids)
        organization_team_ids = set(Team.objects.filter(organization_id=org_id, pk__in=target_team_ids).values_list("pk", flat=True))
        if organization_team_ids != target_team_ids:
            raise HttpError(403, "Team dispatches can only target teams in the selected organization.")
        return org_id

    target_user_ids = set(payload.scope_ids)
    member_user_ids = set(OrganizationMember.objects.filter(organization_id=org_id, user_id__in=target_user_ids).values_list("user_id", flat=True))
    if member_user_ids != target_user_ids:
        raise HttpError(403, "Tenant user dispatches can only target selected organization members.")
    return org_id


@dispatches_router.get("/targets/", response=list[NotificationDispatchTargetOut], summary="获取通知分发目标候选")
@paginate(LegacyPagination)
def list_dispatch_targets(
    request,
    scope: Literal["organization", "teams", "users"] = Query(..., description="目标范围。"),
    keyword: str = Query("", description="按名称、标识或邮箱搜索目标。"),
    management_context: ManagementContext = Query("auto", description="管理上下文：自动、平台或当前租户。"),
):
    """返回当前管理员有权选择的启用组织、当前组织团队或用户候选。"""
    resolved_context, org_id = _resolve_management_context(request, management_context)
    if resolved_context == "platform" and scope == NotificationDispatchScope.TEAMS:
        raise HttpError(403, "Team targets require the tenant management context.")

    keyword = keyword.strip()
    if scope == NotificationDispatchScope.ORGANIZATION:
        organizations = Organization.objects.filter(is_active=True)
        if resolved_context == "tenant":
            organizations = organizations.filter(pk=org_id)
        if keyword:
            organizations = organizations.filter(Q(name__icontains=keyword) | Q(slug__icontains=keyword))
        return organizations.order_by("name", "slug", "pk")

    if scope == NotificationDispatchScope.TEAMS:
        teams = Team.objects.filter(organization_id=org_id).select_related("organization")
        if keyword:
            teams = teams.filter(name__icontains=keyword)
        return teams.order_by("name", "pk")

    users = User.objects.filter(is_active=True)
    if resolved_context == "tenant":
        users = users.filter(organizationmember__organization_id=org_id)
    if keyword:
        users = users.filter(Q(first_name__icontains=keyword) | Q(last_name__icontains=keyword) | Q(username__icontains=keyword) | Q(email__icontains=keyword))
    return users.order_by("first_name", "last_name", "username", "pk")


@dispatches_router.get("/", response=list[NotificationDispatchOut], summary="获取通知分发列表")
@paginate(LegacyPagination)
def list_dispatches(
    request,
    management_context: ManagementContext = Query("auto", description="管理上下文：自动、平台或当前租户。"),
):
    """返回当前管理员可访问的通知分发列表。"""
    qs, _resolved_context, _org_id = _dispatch_qs(request, management_context)
    return qs


@dispatches_router.post("/", response=NotificationDispatchOut, summary="创建通知分发")
def create_dispatch(
    request,
    payload: NotificationDispatchIn,
    management_context: ManagementContext = Query("auto", description="管理上下文：自动、平台或当前租户。"),
):
    """创建通知分发记录，并异步入队执行。"""
    payload.scope_ids = list(dict.fromkeys(payload.scope_ids))
    owner_org_id = _validate_dispatch_scope(request, payload, management_context)
    dispatch = NotificationDispatch(
        owner_organization_id=owner_org_id,
        scope=payload.scope,
        scope_ids=payload.scope_ids,
        category=payload.category,
        title=payload.title,
        body=payload.body,
        url=payload.url,
        data=payload.data,
        created_by=request.user.username,
        updated_by=request.user.username,
    )
    dispatch.full_clean()
    dispatch.save()
    dispatch_notification.delay(dispatch.pk)
    return dispatch


@dispatches_router.get("/{dispatch_id}/", response=NotificationDispatchOut, summary="获取通知分发详情")
def get_dispatch(
    request,
    dispatch_id: int,
    management_context: ManagementContext = Query("auto", description="管理上下文：自动、平台或当前租户。"),
):
    """返回当前管理员可访问的单条通知分发详情。"""
    qs, _resolved_context, _org_id = _dispatch_qs(request, management_context)
    return get_object_or_404(qs, pk=dispatch_id)


@dispatches_router.get("/{dispatch_id}/notifications/", response=list[NotificationOut], summary="获取通知分发投递明细")
@paginate(LegacyPagination)
def list_dispatch_notifications(
    request,
    dispatch_id: int,
    management_context: ManagementContext = Query("auto", description="管理上下文：自动、平台或当前租户。"),
):
    """返回当前管理员可访问的通知分发投递行。"""
    dispatch_qs, resolved_context, org_id = _dispatch_qs(request, management_context)
    dispatch = get_object_or_404(dispatch_qs, pk=dispatch_id)
    qs = dispatch.notifications.select_related("actor")
    if resolved_context == "tenant":
        qs = qs.filter(organization_id=org_id)
    return qs
