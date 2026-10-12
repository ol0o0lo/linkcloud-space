from __future__ import annotations

from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404

from apps.access.constants import AllocationPermission
from apps.access.services import has_permission
from apps.allocation.exceptions import AllocationInvalidException
from apps.house.models import Lease, LeaseAllocation
from apps.organizations.models import OrganizationMember


def leases_for_tenant(user):
    return Lease.objects.filter(tenant__user=user).select_related("organization", "house__building__estate", "house__building__organization")


def list_leases(*, org, house_id, status, contract_missing, keyword):
    qs = Lease.objects.filter(organization=org).select_related("house__building__estate", "tenant", "source_viewing_record").order_by("-start_date", "-id")
    if house_id:
        qs = qs.filter(house_id=house_id)
    if status:
        qs = qs.filter(status=status)
    if keyword:
        qs = qs.filter(
            Q(house__room_number__icontains=keyword)
            | Q(house__building__name__icontains=keyword)
            | Q(house__building__estate__name__icontains=keyword)
            | Q(house__building__estate__display_name__icontains=keyword)
            | Q(tenant__name__icontains=keyword)
            | Q(tenant__phone__icontains=keyword)
        )
    if contract_missing:
        qs = qs.filter(contract_files=[])
    return qs


def get_lease(*, org, lease_id):
    return get_object_or_404(Lease.objects.select_related("house__building__estate", "tenant", "source_viewing_record"), pk=lease_id, organization=org)


def get_lease_allocation(*, organization, lease_id: int) -> LeaseAllocation:
    try:
        return (
            LeaseAllocation.objects.select_related(
                "lease__house__building__estate",
                "lease__tenant",
                "lease__source_viewing_record",
                "allocation_request__organization",
                "allocation_request__submitted_by",
                "allocation_request__reviewed_by",
                "allocation_request__voided_by",
                "allocation_request__team",
            )
            .prefetch_related("allocation_request__items", "allocation_request__shares__beneficiary_user")
            .get(lease_id=lease_id, lease__organization=organization)
        )
    except LeaseAllocation.DoesNotExist:
        raise AllocationInvalidException("该租约尚未提交分配申请。") from None


def list_lease_allocations(*, org, actor, status=None, keyword=None, submitted_by_id=None, beneficiary_user_id=None):
    if not OrganizationMember.objects.filter(organization=org, user=actor, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")
    qs = (
        LeaseAllocation.objects.filter(lease__organization=org)
        .select_related(
            "lease__house__building__estate",
            "lease__tenant",
            "lease__source_viewing_record",
            "allocation_request__organization",
            "allocation_request__team",
            "allocation_request__submitted_by",
            "allocation_request__reviewed_by",
            "allocation_request__voided_by",
        )
        .prefetch_related("allocation_request__items", "allocation_request__shares__beneficiary_user")
        .order_by("-allocation_request__submitted_at", "-pk")
    )
    if not has_permission(actor, org, AllocationPermission.VIEW):
        qs = qs.filter(Q(allocation_request__submitted_by=actor) | Q(allocation_request__shares__beneficiary_user=actor)).distinct()
    if status:
        qs = qs.filter(allocation_request__status=status)
    if submitted_by_id:
        qs = qs.filter(allocation_request__submitted_by_id=submitted_by_id)
    if beneficiary_user_id:
        qs = qs.filter(allocation_request__shares__beneficiary_user_id=beneficiary_user_id).distinct()
    if keyword:
        qs = qs.filter(
            Q(lease__house__room_number__icontains=keyword)
            | Q(lease__house__building__name__icontains=keyword)
            | Q(lease__house__building__estate__name__icontains=keyword)
            | Q(lease__house__building__estate__display_name__icontains=keyword)
            | Q(lease__tenant__name__icontains=keyword)
            | Q(allocation_request__submitted_by_name_snapshot__icontains=keyword)
            | Q(allocation_request__shares__beneficiary_name_snapshot__icontains=keyword)
        ).distinct()
    return qs


def get_visible_lease_allocation(*, org, actor, lease_id):
    if not OrganizationMember.objects.filter(organization=org, user=actor, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")
    link = get_lease_allocation(organization=org, lease_id=lease_id)
    allocation_request = link.allocation_request
    can_view = has_permission(actor, org, AllocationPermission.VIEW) or allocation_request.submitted_by_id == actor.pk
    if not can_view:
        can_view = allocation_request.shares.filter(beneficiary_user=actor).exists()
    if not can_view:
        raise PermissionDenied("你没有查看该收益申请的权限。")
    return link
