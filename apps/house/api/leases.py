from ninja import Query, Router, Status
from ninja.errors import HttpError
from ninja.pagination import paginate

from apps.access.constants import AllocationPermission
from apps.access.permissions import require_org_permission
from apps.allocation.exceptions import AllocationInvalidException
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
    LeaseAllocationPreviewIn,
    LeaseAllocationPreviewOut,
    LeaseAllocationReviewIn,
    LeaseAllocationSubmitIn,
    LeaseAllocationVoidIn,
    LeaseAllocationWithdrawIn,
    LeaseIn,
    LeaseOut,
    LeasePatchIn,
    RegisterSigningIn,
)
from apps.house.services.allocations import preview_lease_allocation, review_lease_allocation, submit_lease_allocation, void_lease_allocation, withdraw_lease_allocation
from apps.house.services.leases import create_lease as perform_create_lease
from apps.house.services.leases import register_signing
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
    return query_list_leases(org=org, house_id=house_id, status=status, contract_missing=contract_missing, keyword=keyword, actor=request.user)


@router.post("/leases/", response={201: LeaseOut}, summary="创建租约")
def create_lease(request, payload: LeaseIn):
    org = require_org_selected(request)
    return Status(201, perform_create_lease(organization=org, data=payload.model_dump(), actor=request.user))


@router.post("/leases/deal-signing/", response={201: LeaseAllocationOut}, include_in_schema=False, summary="已停用的联合签约入口")
def deal_signing(request, payload: DealSigningWithAllocationIn):
    raise HttpError(410, "联合签约入口已停用，请先独立登记成交，再预览确认并提交收益申请。")


@router.post("/leases/register-signing/", response={201: LeaseOut}, summary="独立登记成交")
def post_register_signing(request, payload: RegisterSigningIn):
    lease_data = payload.lease.model_dump()
    if payload.source_inquiry_id is not None:
        if lease_data.get("source_inquiry_id") not in (None, payload.source_inquiry_id):
            raise AllocationInvalidException("来源咨询不一致。")
        lease_data["source_inquiry_id"] = payload.source_inquiry_id
    return Status(
        201,
        register_signing(
            organization=require_org_selected(request), actor=request.user, lease_data=lease_data, team_id=payload.team_id, client_request_id=payload.client_request_id
        ),
    )


@router.get("/leases/{lease_id}/allocations/", response=list[LeaseAllocationOut], summary="获取租约全部收益申请历史")
@paginate(LegacyPagination)
def lease_allocation_history(request, lease_id: int):
    org = require_org_selected(request)
    query_get_lease(org=org, lease_id=lease_id, actor=request.user)
    return query_list_lease_allocations(org=org, actor=request.user).filter(lease_id=lease_id)


@router.post("/leases/{lease_id}/allocations/", response={201: LeaseAllocationOut}, summary="提交或重提租约收益申请")
def post_lease_allocation(request, lease_id: int, payload: LeaseAllocationSubmitIn):
    return Status(
        201, submit_lease_allocation(organization=require_org_permission(request, AllocationPermission.SUBMIT), actor=request.user, lease_id=lease_id, **payload.model_dump())
    )


@router.post("/leases/{lease_id}/allocations/preview/", response=LeaseAllocationPreviewOut, summary="预览首次或纠错申请金额")
def post_preview_allocation(request, lease_id: int, payload: LeaseAllocationPreviewIn):
    return preview_lease_allocation(organization=require_org_permission(request, AllocationPermission.SUBMIT), actor=request.user, lease_id=lease_id, **payload.model_dump())


@router.post("/leases/{lease_id}/allocations/{request_id}/withdraw/", response=AllocationRequestOut, summary="撤回指定待审核申请")
def post_withdraw_allocation(request, lease_id: int, request_id: int, payload: LeaseAllocationWithdrawIn):
    return withdraw_lease_allocation(organization=require_org_selected(request), actor=request.user, lease_id=lease_id, request_id=request_id, reason=payload.reason)


@router.post("/leases/{lease_id}/allocations/{request_id}/review/", response=AllocationRequestOut, summary="审核指定收益申请")
def post_review_allocation(request, lease_id: int, request_id: int, payload: LeaseAllocationReviewIn):
    return review_lease_allocation(
        organization=require_org_permission(request, AllocationPermission.REVIEW),
        reviewer=request.user,
        lease_id=lease_id,
        request_id=request_id,
        approved=payload.decision == "approve",
        reason=payload.reason,
    )


@router.post("/leases/{lease_id}/allocations/{request_id}/void/", response=AllocationRequestOut, summary="作废指定已确认申请")
def post_void_allocation(request, lease_id: int, request_id: int, payload: LeaseAllocationVoidIn):
    return void_lease_allocation(
        organization=require_org_permission(request, AllocationPermission.VOID), actor=request.user, lease_id=lease_id, request_id=request_id, reason=payload.reason
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
    return query_get_lease(org=org, lease_id=lease_id, actor=request.user)


@router.get("/leases/{lease_id}/allocation/", response=LeaseAllocationOut, summary="获取租约收益分配申请")
def get_lease_allocation_request(request, lease_id: int):
    org = require_org_selected(request)
    return get_visible_lease_allocation(org=org, actor=request.user, lease_id=lease_id)


@router.post("/leases/{lease_id}/allocation/review/", response=AllocationRequestOut, summary="审核租约收益分配申请")
def review_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationReviewIn):
    org = require_org_permission(request, AllocationPermission.REVIEW)
    if payload.request_id is None:
        raise AllocationInvalidException("请刷新页面并指定收益申请编号。")
    return review_lease_allocation(
        organization=org,
        lease_id=lease_id,
        reviewer=request.user,
        approved=payload.decision == "approve",
        reason=payload.reason,
        request_id=payload.request_id,
    )


@router.post("/leases/{lease_id}/allocation/void/", response=AllocationRequestOut, summary="作废租约收益分配申请")
def void_lease_allocation_request(request, lease_id: int, payload: LeaseAllocationVoidIn):
    org = require_org_permission(request, AllocationPermission.VOID)
    if payload.request_id is None:
        raise AllocationInvalidException("请刷新页面并指定收益申请编号。")
    return void_lease_allocation(organization=org, lease_id=lease_id, actor=request.user, reason=payload.reason, request_id=payload.request_id)


@router.patch("/leases/{lease_id}/", response=LeaseOut, summary="更新租约")
def patch_lease(request, lease_id: int, payload: LeasePatchIn):
    org = require_org_selected(request)
    return perform_update_lease(organization=org, lease_id=lease_id, data=payload.model_dump(exclude_unset=True), actor=request.user)
