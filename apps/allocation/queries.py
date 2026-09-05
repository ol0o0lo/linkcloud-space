from decimal import Decimal

from django.db.models import Count, DecimalField, Max, Q, Sum, Value
from django.db.models.functions import Coalesce

from apps.allocation.constants import AccrualEntryType
from apps.allocation.models import AccrualEntry, AllocationRequest


def allocation_requests_for_org(organization):
    return (
        AllocationRequest.objects.filter(organization=organization)
        .select_related("team", "submitted_by", "reviewed_by", "voided_by")
        .prefetch_related("items", "shares__beneficiary_user")
    )


def scope_allocation_requests(qs, *, user, view_all: bool):
    if view_all:
        return qs
    return qs.filter(Q(submitted_by=user) | Q(shares__beneficiary_user=user)).distinct()


def accrual_entries_for_org(organization):
    return AccrualEntry.objects.filter(organization=organization).select_related(
        "beneficiary_user",
        "created_by",
        "allocation_share__allocation_request",
        "reversal_of",
        "reversal_of__allocation_share__allocation_request",
        "reversal",
    )


def scope_accrual_entries(qs, *, user, view_all: bool):
    return qs if view_all else qs.filter(beneficiary_user=user)


def monthly_accrual_totals_for_org(organization, *, user=None, view_all: bool = True):
    qs = AccrualEntry.objects.filter(organization=organization)
    if not view_all:
        qs = qs.filter(beneficiary_user=user)
    zero = Value(Decimal("0.00"), output_field=DecimalField(max_digits=14, decimal_places=2))
    return (
        qs.values("beneficiary_user_id", "effective_month")
        .annotate(
            beneficiary_name_snapshot=Max("beneficiary_name_snapshot"),
            allocation_amount=Coalesce(Sum("amount", filter=Q(entry_type=AccrualEntryType.ALLOCATION)), zero),
            manual_increase_amount=Coalesce(Sum("amount", filter=Q(entry_type=AccrualEntryType.MANUAL_INCREASE)), zero),
            manual_decrease_amount=Coalesce(Sum("amount", filter=Q(entry_type=AccrualEntryType.MANUAL_DECREASE)), zero),
            reversal_amount=Coalesce(Sum("amount", filter=Q(entry_type=AccrualEntryType.REVERSAL)), zero),
            total_amount=Coalesce(Sum("amount"), zero),
            entry_count=Count("id"),
        )
        .order_by("-effective_month", "beneficiary_name_snapshot", "beneficiary_user_id")
    )
