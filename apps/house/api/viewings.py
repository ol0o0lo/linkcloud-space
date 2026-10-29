from typing import Literal

from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.queries.viewings import list_viewing_records as query_list_viewing_records
from apps.house.queries.viewings import viewing_records_for_organization
from apps.house.schemas.viewings import ViewingRecordIn, ViewingRecordOut, ViewingRecordPatchIn
from apps.house.services.viewings import create_viewing_record as perform_create_viewing_record
from apps.house.services.viewings import update_viewing as perform_update_viewing

router = Router(tags=["房源/管理"])


@router.get("/viewing-records/", response=list[ViewingRecordOut], summary="获取带看记录列表")
@paginate(LegacyPagination)
def list_viewing_records(
    request,
    house_id: int | None = Query(None),
    status: str | None = Query(None),
    pending_lease: bool | None = Query(None),
    contact_missing: bool | None = Query(None),
    keyword: str | None = Query(None),
    today: bool = Query(False),
    unassigned: bool = Query(False),
    scope: Literal["mine", "all"] | None = Query(None),
):
    org = require_org_selected(request)
    return query_list_viewing_records(
        org=org,
        house_id=house_id,
        status=status,
        pending_lease=pending_lease,
        contact_missing=contact_missing,
        keyword=keyword,
        today=today,
        unassigned=unassigned,
        actor=request.user,
        scope=scope,
    )


@router.get("/viewing-records/{record_id}/", response=ViewingRecordOut, summary="获取带看记录详情")
def get_viewing_record(request, record_id: int):
    org = require_org_selected(request)
    return get_object_or_404(viewing_records_for_organization(org, actor=request.user), pk=record_id)


@router.post("/viewing-records/", response={201: ViewingRecordOut}, summary="创建带看记录")
def create_viewing_record(request, payload: ViewingRecordIn):
    org = require_org_selected(request)
    return Status(201, perform_create_viewing_record(organization=org, actor=request.user, data=payload.model_dump()))


@router.patch("/viewing-records/{record_id}/", response=ViewingRecordOut, summary="更新带看记录")
def patch_viewing_record(request, record_id: int, payload: ViewingRecordPatchIn):
    org = require_org_selected(request)
    return perform_update_viewing(organization=org, actor=request.user, record_id=record_id, data=payload.model_dump(exclude_unset=True))
