from datetime import date

from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404

from ninja import Query, Router, Status
from ninja.pagination import paginate

from apps.access.constants import AllocationPermission
from apps.access.permissions import require_org_permission
from apps.access.services import has_permission
from apps.allocation.models import AccrualEntry
from apps.allocation.queries import (
    accrual_entries_for_org,
    allocation_requests_for_org,
    monthly_accrual_totals_for_org,
    scope_accrual_entries,
    scope_allocation_requests,
)
from apps.allocation.schemas import (
    AccrualEntryOut,
    AllocationBeneficiaryOut,
    AllocationCapabilitiesOut,
    AllocationRequestOut,
    ManualAccrualEntryIn,
    MonthlyAccrualTotalOut,
)
from apps.allocation.services import create_manual_entry, user_name_snapshot
from apps.base.ninja_pagination import LegacyPagination
from apps.base.permissions import require_org_selected
from apps.organizations.models import OrganizationMember
from apps.teams.models import Team

router = Router(tags=["收益分配"])


def _allocation_context(request):
    organization = require_org_selected(request)
    if not OrganizationMember.objects.filter(organization=organization, user=request.user, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")
    view_all = has_permission(request.user, organization, AllocationPermission.VIEW)
    return organization, view_all


@router.get("/capabilities/", response=AllocationCapabilitiesOut, summary="获取收益分配能力")
def get_allocation_capabilities(request):
    organization, view_all = _allocation_context(request)
    teams = Team.objects.filter(organization=organization, members=request.user).order_by("name", "pk")
    return {
        "submit": has_permission(request.user, organization, AllocationPermission.SUBMIT),
        "change_beneficiaries": has_permission(request.user, organization, AllocationPermission.CHANGE_BENEFICIARIES),
        "view_scope": "organization" if view_all else "self",
        "review": has_permission(request.user, organization, AllocationPermission.REVIEW),
        "adjust": has_permission(request.user, organization, AllocationPermission.ADJUST),
        "void": has_permission(request.user, organization, AllocationPermission.VOID),
        "signing_teams": list(teams.values("id", "name")),
    }


@router.get("/beneficiaries/", response=list[AllocationBeneficiaryOut], summary="搜索收益受益人")
@paginate(LegacyPagination)
def list_allocation_beneficiaries(request, keyword: str | None = Query(None)):
    organization, _view_all = _allocation_context(request)
    can_select = any(
        has_permission(request.user, organization, permission)
        for permission in (
            AllocationPermission.VIEW,
            AllocationPermission.CHANGE_BENEFICIARIES,
            AllocationPermission.ADJUST,
        )
    )
    if not can_select:
        raise PermissionDenied("你没有选择收益受益人的权限。")
    qs = OrganizationMember.objects.filter(organization=organization, user__is_active=True).select_related("user")
    if keyword:
        qs = qs.filter(
            Q(user__first_name__icontains=keyword)
            | Q(user__last_name__icontains=keyword)
            | Q(user__username__icontains=keyword)
            | Q(user__email__icontains=keyword)
        )
    return [{"user_id": membership.user_id, "name": user_name_snapshot(membership.user)} for membership in qs.order_by("user__first_name", "user__username", "pk")]


@router.get("/requests/", response=list[AllocationRequestOut], summary="获取分配申请列表")
@paginate(LegacyPagination)
def list_allocation_requests(
    request,
    status: str | None = Query(None),
    submitted_by_id: int | None = Query(None),
    beneficiary_user_id: int | None = Query(None),
):
    organization, view_all = _allocation_context(request)
    qs = scope_allocation_requests(allocation_requests_for_org(organization), user=request.user, view_all=view_all)
    if status:
        qs = qs.filter(status=status)
    if submitted_by_id:
        qs = qs.filter(submitted_by_id=submitted_by_id)
    if beneficiary_user_id:
        qs = qs.filter(shares__beneficiary_user_id=beneficiary_user_id).distinct()
    return qs


@router.get("/requests/{allocation_request_id}/", response=AllocationRequestOut, summary="获取分配申请详情")
def get_allocation_request(request, allocation_request_id: int):
    organization, view_all = _allocation_context(request)
    qs = scope_allocation_requests(allocation_requests_for_org(organization), user=request.user, view_all=view_all)
    return get_object_or_404(qs, pk=allocation_request_id)


@router.get("/entries/", response=list[AccrualEntryOut], summary="获取应计收益流水")
@paginate(LegacyPagination)
def list_accrual_entries(
    request,
    beneficiary_user_id: int | None = Query(None),
    entry_type: str | None = Query(None),
    effective_month: date | None = Query(None),
    effective_from: date | None = Query(None),
    effective_to: date | None = Query(None),
):
    organization, view_all = _allocation_context(request)
    qs = scope_accrual_entries(accrual_entries_for_org(organization), user=request.user, view_all=view_all)
    if beneficiary_user_id:
        if not view_all and beneficiary_user_id != request.user.pk:
            raise PermissionDenied("你只能查看自己的收益流水。")
        qs = qs.filter(beneficiary_user_id=beneficiary_user_id)
    if entry_type:
        qs = qs.filter(entry_type=entry_type)
    if effective_month:
        qs = qs.filter(effective_month=effective_month.replace(day=1))
    if effective_from:
        qs = qs.filter(effective_at__date__gte=effective_from)
    if effective_to:
        qs = qs.filter(effective_at__date__lte=effective_to)
    return qs


@router.get("/monthly-totals/", response=list[MonthlyAccrualTotalOut], summary="按员工和月份汇总应计收益")
@paginate(LegacyPagination)
def list_monthly_accrual_totals(
    request,
    beneficiary_user_id: int | None = Query(None),
    effective_month: date | None = Query(None),
):
    organization, view_all = _allocation_context(request)
    if beneficiary_user_id and not view_all and beneficiary_user_id != request.user.pk:
        raise PermissionDenied("你只能查看自己的月度收益。")
    qs = monthly_accrual_totals_for_org(organization, user=request.user, view_all=view_all)
    if beneficiary_user_id:
        qs = qs.filter(beneficiary_user_id=beneficiary_user_id)
    if effective_month:
        qs = qs.filter(effective_month=effective_month.replace(day=1))
    return qs


@router.post("/manual-entries/", response={201: AccrualEntryOut}, summary="创建人工应计收益调整")
def create_manual_accrual_entry(request, payload: ManualAccrualEntryIn):
    organization = require_org_permission(request, AllocationPermission.ADJUST)
    membership = get_object_or_404(
        OrganizationMember.objects.select_related("user"),
        organization=organization,
        user_id=payload.beneficiary_user_id,
        user__is_active=True,
    )
    entry = create_manual_entry(
        organization=organization,
        beneficiary_user=membership.user,
        entry_type=payload.entry_type,
        amount=payload.amount,
        effective_month=payload.effective_month,
        reason=payload.reason,
        actor=request.user,
    )
    return Status(201, AccrualEntry.objects.select_related("beneficiary_user", "created_by").get(pk=entry.pk))
