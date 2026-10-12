from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.access.constants import AllocationPermission
from apps.access.permissions import require_org_permission
from apps.allocation.schemas import AllocationRequestOut
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.house.queries.leases import get_lease as query_get_lease
from apps.house.queries.leases import get_visible_lease_allocation
from apps.house.queries.leases import list_lease_allocations as query_list_lease_allocations
from apps.house.queries.leases import list_leases as query_list_leases
from apps.house.schemas.leases import (
    DealSigningWithAllocationIn,
    LeaseAllocationOut,
    LeaseAllocationReviewIn,
    LeaseAllocationVoidIn,
    LeaseIn,
    LeaseOut,
    LeasePatchIn,
)
from apps.house.services.allocations import review_lease_allocation, sign_lease, void_lease_allocation
from apps.house.services.leases import create_lease as perform_create_lease
from apps.house.services.leases import update_lease as perform_update_lease

router = Router(tags=["房源/管理"])


@router.get("/leases/", response=list[LeaseOut], summary="获取租约列表")
@paginate(LegacyPagination)
def list_leases(
    request,
    house_id: int | None = Query(None),
    status: str | None = Query(None),
    contract_missing: bool | None = Query(None),
    keyword: str | None = Query(None),
):
    org = require_org_selected(request)
    return query_list_leases(org=org, house_id=house_id, status=status, contract_missing=contract_missing, keyword=keyword)


@router.post("/leases/", response={201: LeaseOut}, summary="创建租约")
def create_lease(request, payload: LeaseIn):
    org = require_org_selected(request)
    return Status(201, perform_create_lease(organization=org, data=payload.model_dump()))


@router.post("/leases/deal-signing/", response={201: LeaseAllocationOut}, summary="登记签约并提交收益分配申请")
def deal_signing(request, payload: DealSigningWithAllocationIn):
    org = require_org_permission(request, AllocationPermission.SUBMIT)
    return Status(
        201, sign_lease(organization=org, actor=request.user, lease_data=payload.lease.model_dump(), beneficiary_user_ids=payload.beneficiary_user_ids, team_id=payload.team_id)
    )


@router.get("/lease-allocations/", response=list[LeaseAllocationOut], summary="获取租约收益分配申请列表")
@paginate(LegacyPagination)
def list_lease_allocations(
    request,
    status: str | None = Query(None),
    keyword: str | None = Query(None),
    submitted_by_id: int | None = Query(None),
    beneficiary_user_id: int | None = Query(None),
):
    org = require_org_selected(request)
    return query_list_lease_allocations(
        org=org,
        actor=request.user,
        status=status,
        keyword=keyword,
        submitted_by_id=submitted_by_id,
        beneficiary_user_id=beneficiary_user_id,
    )


@router.get("/leases/{lease_id}/", response=LeaseOut, summary="获取租约详情")
def get_lease(request, lease_id: int):
    org = require_org_selected(request)
    return query_get_lease(org=org, lease_id=lease_id)


@router.get("/leases/{lease_id}/allocation/", response=LeaseAllocationOut, summary="获取租约收益分配申请")
def get_lease_allocation_request(request, lease_id: int):
    org = require_org_selected(request)
    return get_visible_lease_allocation(org=org, actor=request.user, lease_id=lease_id)


@router.post("/leases/{lease_id}/allocation/review/", response=AllocationRequestOut, summary="审核租约收益分配申请")
def review_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationReviewIn):
    org = require_org_permission(request, AllocationPermission.REVIEW)
    return review_lease_allocation(
        organization=org,
        lease_id=lease_id,
        reviewer=request.user,
        approved=payload.decision == "approve",
        reason=payload.reason,
    )


@router.post("/leases/{lease_id}/allocation/void/", response=AllocationRequestOut, summary="作废租约收益分配申请")
def void_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationVoidIn):
    org = require_org_permission(request, AllocationPermission.VOID)
    return void_lease_allocation(organization=org, lease_id=lease_id, actor=request.user, reason=payload.reason)


@router.patch("/leases/{lease_id}/", response=LeaseOut, summary="更新租约")
def patch_lease(request, lease_id: int, payload: LeasePatchIn):
    org = require_org_selected(request)
    return perform_update_lease(organization=org, lease_id=lease_id, data=payload.model_dump(exclude_unset=True))
