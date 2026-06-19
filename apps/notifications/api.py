from dataclasses import asdict

from django.shortcuts import get_object_or_404
from django.utils import timezone

from ninja import Path, Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.notifications.categories import get_categories, get_category
from apps.notifications.constants import NotificationChannel
from apps.notifications.models import Notification, NotificationDispatch, NotificationPreference
from apps.notifications.schemas import (
    BulkActionIn,
    BulkResultOut,
    NotificationDispatchIn,
    NotificationDispatchOut,
    NotificationOut,
    NotificationPatchIn,
    NotificationPreferenceOut,
    NotificationPreferencePatchIn,
    UnreadCountOut,
)
from apps.notifications.tasks import dispatch_notification
from apps.organizations.models import OrganizationMember

router = Router(tags=["通知/消息"])
dispatches_router = Router(tags=["通知分发"])


def _base_qs(request):
    return Notification.objects.filter_by_org(request).select_related("actor")


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
        "in_app": pref.in_app if pref is not None else NotificationChannel.IN_APP in cat.default_channels,
        "email": pref.email if pref is not None else NotificationChannel.EMAIL in cat.default_channels,
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


def _dispatch_qs(request):
    if request.user.is_superuser:
        return NotificationDispatch.objects.all()

    org_id = _current_owned_org_id(request)
    if org_id is None:
        raise HttpError(403, "Only organization owners can manage notification dispatches.")
    return NotificationDispatch.objects.filter(owner_organization_id=org_id)


def _validate_dispatch_scope(request, payload: NotificationDispatchIn) -> int | None:
    if request.user.is_superuser:
        return None

    org_id = _current_owned_org_id(request)
    if org_id is None:
        raise HttpError(403, "Only organization owners can manage notification dispatches.")

    if payload.scope == NotificationDispatch.Scope.PLATFORM:
        raise HttpError(403, "Tenant owners cannot create platform notification dispatches.")

    if payload.scope == NotificationDispatch.Scope.ORGANIZATION:
        if payload.scope_ids != [org_id]:
            raise HttpError(403, "Tenant organization dispatches must target the current organization.")
        return org_id

    target_user_ids = set(payload.scope_ids)
    member_user_ids = set(
        OrganizationMember.objects.filter(organization_id=org_id, user_id__in=target_user_ids).values_list("user_id", flat=True)
    )
    if member_user_ids != target_user_ids:
        raise HttpError(403, "Tenant user dispatches can only target current organization members.")
    return org_id


@dispatches_router.get("/", response=list[NotificationDispatchOut], summary="获取通知分发列表")
@paginate(LegacyPagination)
def list_dispatches(request):
    """返回当前管理员可访问的通知分发列表。"""
    return _dispatch_qs(request)


@dispatches_router.post("/", response=NotificationDispatchOut, summary="创建通知分发")
def create_dispatch(request, payload: NotificationDispatchIn):
    """创建通知分发记录，并异步入队执行。"""
    owner_org_id = _validate_dispatch_scope(request, payload)
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
def get_dispatch(request, dispatch_id: int):
    """返回当前管理员可访问的单条通知分发详情。"""
    return get_object_or_404(_dispatch_qs(request), pk=dispatch_id)


@dispatches_router.get("/{dispatch_id}/notifications/", response=list[NotificationOut], summary="获取通知分发投递明细")
@paginate(LegacyPagination)
def list_dispatch_notifications(request, dispatch_id: int):
    """返回当前管理员可访问的通知分发投递行。"""
    dispatch = get_object_or_404(_dispatch_qs(request), pk=dispatch_id)
    qs = dispatch.notifications.select_related("actor")
    if not request.user.is_superuser:
        qs = qs.filter(organization_id=dispatch.owner_organization_id)
    return qs
