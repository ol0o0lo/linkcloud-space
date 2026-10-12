from typing import Literal

from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_authenticated
from apps.house.constants import ViewingRecordStatus
from apps.house.queries.leases import leases_for_tenant
from apps.house.queries.public import get_public_houses_queryset
from apps.house.queries.viewings import viewing_records_for_tenant
from apps.house.schemas.tenant import TenantContactRequestIn, TenantContactRequestOut, TenantLeaseOut, TenantViewingRecordIn, TenantViewingRecordOut
from apps.house.services.contacts import (
    TenantContactConflict,
    TenantContactRecipientUnavailable,
    TenantContactValidationError,
    send_tenant_contact_request,
)
from apps.house.services.viewings import book_viewing as perform_book_viewing
from apps.house.services.viewings import cancel_viewing as perform_cancel_viewing

tenant_router = Router(tags=["房源/租客"])


@tenant_router.get("/viewing-records/", response=list[TenantViewingRecordOut], summary="获取租客个人带看记录")
@paginate(LegacyPagination)
def list_tenant_viewing_records(request, scope: Literal["current", "history"] | None = Query(None)):
    require_authenticated(request)
    qs = viewing_records_for_tenant(request.user)
    if scope == "current":
        qs = qs.filter(status=ViewingRecordStatus.SCHEDULED)
    elif scope == "history":
        qs = qs.exclude(status=ViewingRecordStatus.SCHEDULED)
    return qs.order_by("-scheduled_at", "-id")


@tenant_router.post("/contact/", response={201: TenantContactRequestOut}, summary="租客发送预约联系方式")
def create_tenant_contact_request(request, payload: TenantContactRequestIn):
    require_authenticated(request)
    house = get_object_or_404(get_public_houses_queryset(), pk=payload.house_id)
    try:
        notification = send_tenant_contact_request(
            house=house,
            user=request.user,
            channels=payload.channels,
            phone=payload.phone,
            wechat=payload.wechat,
        )
    except TenantContactValidationError as exc:
        raise HttpError(422, str(exc)) from exc
    except TenantContactRecipientUnavailable as exc:
        raise HttpError(409, str(exc)) from exc
    return Status(201, {"notification_id": notification.pk})


@tenant_router.get("/viewing-records/{viewing_record_id}/", response=TenantViewingRecordOut, summary="获取租客个人带看详情")
def get_tenant_viewing_record(request, viewing_record_id: int):
    require_authenticated(request)
    return get_object_or_404(viewing_records_for_tenant(request.user), pk=viewing_record_id)


@tenant_router.post("/viewing-records/{viewing_record_id}/cancel/", response=TenantViewingRecordOut, summary="取消租客个人带看预约")
def cancel_tenant_viewing_record(request, viewing_record_id: int):
    require_authenticated(request)
    return perform_cancel_viewing(user=request.user, viewing_record_id=viewing_record_id)


@tenant_router.get("/leases/", response=list[TenantLeaseOut], summary="获取租客个人租约")
@paginate(LegacyPagination)
def list_tenant_leases(request):
    require_authenticated(request)
    return leases_for_tenant(request.user).order_by("-start_date", "-id")


@tenant_router.get("/leases/{lease_id}/", response=TenantLeaseOut, summary="获取租客个人租约详情")
def get_tenant_lease(request, lease_id: int):
    require_authenticated(request)
    return get_object_or_404(leases_for_tenant(request.user), pk=lease_id)


@tenant_router.post("/viewing-records/", response={201: TenantViewingRecordOut}, summary="租客预约看房")
def create_tenant_viewing_record(request, payload: TenantViewingRecordIn):
    require_authenticated(request)
    try:
        record = perform_book_viewing(user=request.user, house_id=payload.house_id, scheduled_at=payload.scheduled_at, notes=payload.notes)
    except TenantContactConflict as exc:
        raise HttpError(409, str(exc)) from exc
    return Status(201, record)
