from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import PermissionDenied
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.access.constants import AllocationPermission, OrganizationPermission
from apps.access.services import has_permission
from apps.allocation.constants import AllocationRequestStatus
from apps.allocation.queries import allocation_requests_for_org, scope_allocation_requests
from apps.house.constants import ContactRole, CustomerStage, ViewingRecordStatus
from apps.house.models import Contact, ViewingRecord
from apps.organizations.models import OrganizationMember


def can_manage_customers(*, organization, actor):
    return has_permission(actor, organization, OrganizationPermission.MEMBER_MANAGE)


def require_customer_member(*, organization, actor):
    if not OrganizationMember.objects.filter(organization=organization, user=actor, user__is_active=True).exists():
        raise PermissionDenied("你不是当前组织的有效成员。")


def visible_contacts(*, organization, actor):
    require_customer_member(organization=organization, actor=actor)
    qs = Contact.objects.filter(organization=organization)
    if not can_manage_customers(organization=organization, actor=actor):
        qs = qs.filter(Q(customer_profile__isnull=True) | Q(customer_profile__assigned_to=actor) | Q(roles__contains=[ContactRole.LANDLORD]))
    return qs


def customers_for_actor(*, organization, actor, scope="all", keyword=None, stage=None):
    require_customer_member(organization=organization, actor=actor)
    qs = (
        Contact.objects.filter(organization=organization, roles__contains=[ContactRole.TENANT])
        .select_related("customer_profile__assigned_to")
        .order_by("-customer_profile__updated_at", "-id")
    )
    if scope == "mine" or not can_manage_customers(organization=organization, actor=actor):
        qs = qs.filter(customer_profile__assigned_to=actor)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(phone__icontains=keyword) | Q(email__icontains=keyword) | Q(customer_profile__wechat__icontains=keyword))
    if stage == CustomerStage.NEW:
        qs = qs.filter(Q(customer_profile__stage=stage) | Q(customer_profile__isnull=True), is_active=True)
    elif stage:
        qs = qs.filter(customer_profile__stage=stage)
    return qs


def get_customer(*, organization, actor, contact_id, for_update=False):
    qs = customers_for_actor(organization=organization, actor=actor)
    if for_update:
        # Lock the base row separately: PostgreSQL cannot lock grouped/nullable joined rows.
        contact = get_object_or_404(Contact.objects.select_for_update(), pk=contact_id, organization=organization)
        if not qs.filter(pk=contact.pk).exists():
            raise PermissionDenied("你没有处理该客户的权限。")
        return contact
    return get_object_or_404(qs, pk=contact_id)


def prepare_customer(contact):
    profile = getattr(contact, "customer_profile", None)
    stage = profile.stage if profile else CustomerStage.NEW
    result = {field: getattr(contact, field) for field in ("id", "name", "phone", "email", "notes", "is_active")}
    result.update(
        stage=stage,
        stage_label=CustomerStage.get_choice_label(stage),
        assigned_to_id=profile.assigned_to_id if profile else None,
        assigned_to_name=(profile.assigned_to.get_full_name() or profile.assigned_to.username) if profile and profile.assigned_to_id else "",
        source=profile.source if profile else "",
        wechat=profile.wechat if profile else "",
        min_rent=str(profile.min_rent) if profile and profile.min_rent is not None else None,
        max_rent=str(profile.max_rent) if profile and profile.max_rent is not None else None,
        preferred_region=profile.preferred_region if profile else "",
        bedrooms=profile.bedrooms if profile else None,
        move_in_date=profile.move_in_date if profile else None,
    )
    return result


def customer_workbench(*, organization, actor):
    customers = customers_for_actor(organization=organization, actor=actor)
    manager = can_manage_customers(organization=organization, actor=actor)
    actor_timezone = ZoneInfo(actor.timezone)
    today = timezone.localdate(timezone=actor_timezone)
    start = timezone.make_aware(datetime.combine(today, time.min), actor_timezone)
    end = timezone.make_aware(datetime.combine(today + timedelta(days=1), time.min), actor_timezone)
    viewings = ViewingRecord.objects.filter(organization=organization, is_active=True, status=ViewingRecordStatus.SCHEDULED)
    if not manager:
        viewings = viewings.filter(assigned_to=actor)
    from apps.house.services.inquiries import inquiries_for_actor

    inquiries = inquiries_for_actor(organization=organization, actor=actor).filter(status="new")
    return {
        "new_customers": customers.filter(Q(customer_profile__stage=CustomerStage.NEW) | Q(customer_profile__isnull=True), is_active=True).count(),
        "new_inquiries": inquiries.count(),
        "today_viewings": viewings.filter(scheduled_at__gte=start, scheduled_at__lt=end).count(),
        "unassigned_viewings": viewings.filter(assigned_to__isnull=True).count() if manager else 0,
        "pending_allocations": scope_allocation_requests(
            allocation_requests_for_org(organization), user=actor, view_all=has_permission(actor, organization, AllocationPermission.VIEW)
        )
        .filter(status=AllocationRequestStatus.PENDING)
        .count(),
        "items": [
            {"inquiry_id": inquiry.pk, "house_id": inquiry.house_id, "customer_name": inquiry.customer_name, "phone": inquiry.phone, "status": inquiry.status}
            for inquiry in inquiries.order_by("created_at", "pk")[:10]
        ],
    }
