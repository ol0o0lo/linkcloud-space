from __future__ import annotations

from django.db.models import OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404

from apps.house.constants import ViewingRecordStatus
from apps.house.models import Lease, ViewingRecord


def viewing_records_for_tenant(user):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    return (
        ViewingRecord.objects.filter(contact__user=user)
        .select_related("organization", "house__building__estate", "house__building__organization")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )


def get_viewing_record_in_org(record_id: int, org):
    return get_object_or_404(ViewingRecord, pk=record_id, organization=org)


def viewing_records_for_organization(org):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    return (
        ViewingRecord.objects.filter(organization=org)
        .select_related("house__building__estate", "contact", "assigned_to")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )


def list_viewing_records(*, org, house_id, status, pending_lease, contact_missing, keyword):
    qs = viewing_records_for_organization(org).order_by("-scheduled_at", "-id")
    if house_id:
        qs = qs.filter(house_id=house_id)
    if status:
        qs = qs.filter(status=status)
    if pending_lease:
        qs = qs.filter(status=ViewingRecordStatus.CONVERTED, converted_leases__isnull=True)
    if contact_missing is not None:
        qs = qs.filter(contact__isnull=contact_missing)
    if keyword:
        qs = qs.filter(
            Q(customer_name__icontains=keyword)
            | Q(customer_phone__icontains=keyword)
            | Q(contact__name__icontains=keyword)
            | Q(contact__phone__icontains=keyword)
            | Q(house__room_number__icontains=keyword)
            | Q(house__building__name__icontains=keyword)
            | Q(house__building__estate__name__icontains=keyword)
            | Q(house__building__estate__display_name__icontains=keyword)
        )
    return qs
