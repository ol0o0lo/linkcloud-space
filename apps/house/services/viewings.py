from __future__ import annotations

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.shortcuts import get_object_or_404

from apps.base.exceptions import ConflictException
from apps.house.constants import ContactRole, ViewingRecordStatus
from apps.house.models import ViewingRecord
from apps.house.queries.properties import get_house_in_org
from apps.house.queries.public import get_public_houses_queryset
from apps.house.queries.viewings import viewing_records_for_organization, viewing_records_for_tenant
from apps.house.services.contacts import (
    get_contact_for_new_business,
    get_or_bind_tenant_contact,
    validate_assignee_in_org,
)


@transaction.atomic
def create_viewing_record(*, organization, data: dict):
    org = organization
    data = dict(data)
    house_id = data.pop("house_id")
    contact_id = data.pop("contact_id", None)
    validate_assignee_in_org(data.get("assigned_to_id"), org)
    data["house"] = get_house_in_org(house_id, org)
    if contact_id is not None:
        data["contact"] = get_contact_for_new_business(contact_id, org, ContactRole.TENANT)
    record = ViewingRecord.objects.create(organization=org, **data)
    return record


@transaction.atomic
def update_viewing(*, organization, record_id: int, data: dict):
    org = organization
    record = get_object_or_404(viewing_records_for_organization(org).select_for_update(of=("self",)), pk=record_id)
    data = dict(data)
    if "house_id" in data:
        record.house = get_house_in_org(data.pop("house_id"), org)
    if "contact_id" in data:
        contact_id = data.pop("contact_id")
        if contact_id is None:
            record.contact = None
        elif contact_id != record.contact_id:
            record.contact = get_contact_for_new_business(contact_id, org, ContactRole.TENANT)
    if "assigned_to_id" in data:
        validate_assignee_in_org(data["assigned_to_id"], org)
    for field, value in data.items():
        setattr(record, field, value)
    record.save()
    return record


@transaction.atomic
def book_viewing(*, user, house_id: int, scheduled_at, notes: str = ""):
    if not user.phone_verified or not user.phone:
        raise PermissionDenied("预约看房前请先验证手机号。")
    house = get_object_or_404(get_public_houses_queryset(), pk=house_id)
    contact = get_or_bind_tenant_contact(organization=house.building.organization, user=user)
    record = create_viewing_record(
        data=dict(
            house_id=house.pk,
            contact_id=contact.pk,
            customer_name=contact.name,
            customer_phone=user.phone,
            scheduled_at=scheduled_at,
            notes=notes,
        ),
        organization=house.building.organization,
    )
    return record


@transaction.atomic
def cancel_viewing(*, user, viewing_record_id: int):
    record = get_object_or_404(viewing_records_for_tenant(user).select_for_update(of=("self",)), pk=viewing_record_id)
    if record.status != ViewingRecordStatus.SCHEDULED:
        raise ConflictException("只有已预约的带看可以取消。")
    record.status = ViewingRecordStatus.CANCELED
    record.save(update_fields=["status", "updated_at"])
    return record
