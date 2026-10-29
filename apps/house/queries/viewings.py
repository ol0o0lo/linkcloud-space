from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import OuterRef, Q, Subquery
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.house.constants import ViewingRecordStatus
from apps.house.models import Lease, ViewingRecord
from apps.organizations.models import OrganizationMember


def viewing_records_for_tenant(user):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    receptionist = OrganizationMember.objects.filter(organization_id=OuterRef("organization_id"), user_id=OuterRef("assigned_to_id"), user__is_active=True)
    return (
        ViewingRecord.objects.filter(Q(contact__user=user) | Q(source_inquiry__user=user))
        .select_related("organization", "house__building__estate", "house__building__organization", "assigned_to")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]), receptionist_name=Subquery(receptionist.values("employee_name")[:1]))
    )


def get_viewing_record_in_org(record_id: int, org, actor=None, for_update=False):
    qs = viewing_records_for_organization(org, actor=actor)
    if for_update:
        qs = qs.select_for_update(of=("self",))
    return get_object_or_404(qs, pk=record_id)


def viewing_records_for_organization(org, actor=None):
    signed_lease_qs = Lease.objects.filter(source_viewing_record_id=OuterRef("pk")).order_by("id")
    qs = (
        ViewingRecord.objects.filter(organization=org)
        .select_related("house__building__estate", "contact", "assigned_to")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )
    if actor is not None:
        from apps.house.queries.customers import can_manage_customers, require_customer_member

        require_customer_member(organization=org, actor=actor)
        if not can_manage_customers(organization=org, actor=actor):
            qs = qs.filter(Q(source_inquiry__isnull=True) & (Q(assigned_to=actor) | Q(contact__customer_profile__assigned_to=actor)) | Q(source_inquiry__assigned_to=actor))
    return qs


def list_viewing_records(*, org, house_id, status, pending_lease, contact_missing, keyword, today=False, unassigned=False, actor=None, scope=None):
    qs = viewing_records_for_organization(org, actor=actor).order_by("-scheduled_at", "-id")
    if today:
        local_timezone = ZoneInfo(actor.timezone) if actor else timezone.get_current_timezone()
        day = timezone.localdate(timezone=local_timezone)
        start = timezone.make_aware(datetime.combine(day, time.min), timezone=local_timezone)
        end = timezone.make_aware(datetime.combine(day + timedelta(days=1), time.min), timezone=local_timezone)
        qs = qs.filter(scheduled_at__gte=start, scheduled_at__lt=end, is_active=True)
    if unassigned:
        qs = qs.filter(assigned_to__isnull=True, is_active=True)
    if scope == "mine":
        qs = qs.filter(assigned_to=actor)
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
