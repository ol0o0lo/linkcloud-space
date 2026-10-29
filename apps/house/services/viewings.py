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
from apps.organizations.models import Organization


@transaction.atomic
def create_viewing_record(*, organization, data: dict, actor=None):
    org = organization
    Organization.objects.select_for_update().get(pk=org.pk)
    data = dict(data)
    house_id = data.pop("house_id")
    contact_id = data.pop("contact_id", None)
    inquiry_id = data.pop("source_inquiry_id", None)
    inquiry = None
    if inquiry_id:
        from apps.house.services.inquiries import assert_inquiry_context, get_inquiry

        inquiry = get_inquiry(organization=org, actor=actor, inquiry_id=inquiry_id, for_update=True)
        contact_id = contact_id if contact_id is not None else inquiry.contact_id
        assert_inquiry_context(inquiry=inquiry, organization=org, actor=actor, house_id=house_id, contact_id=contact_id)
        data["source_inquiry"] = inquiry
        data["assigned_to_id"] = inquiry.assigned_to_id
    validate_assignee_in_org(data.get("assigned_to_id"), org)
    data["house"] = get_house_in_org(house_id, org)
    if contact_id is not None:
        data["contact"] = get_contact_for_new_business(contact_id, org, ContactRole.TENANT, actor=actor, inquiry=inquiry, house_id=house_id)
    elif actor is not None:
        from apps.accounts.models import normalize_phone
        from apps.house.models import Contact
        from apps.house.services.customers import assert_customer_contact_access

        for contact in Contact.objects.filter(organization=org, normalized_phone=normalize_phone(data.get("customer_phone", ""))):
            assert_customer_contact_access(contact, actor=actor, organization=org, inquiry=inquiry, house_id=house_id)
    record = ViewingRecord.objects.create(organization=org, **data)
    from apps.house.services.inquiries import refresh_inquiry_after_viewing

    refresh_inquiry_after_viewing(inquiry_id)
    return record


@transaction.atomic
def update_viewing(*, organization, record_id: int, data: dict, actor=None):
    org = organization
    Organization.objects.select_for_update().get(pk=org.pk)
    from apps.house.models import HouseInquiry

    inquiry_id = ViewingRecord.objects.filter(pk=record_id, organization=org).values_list("source_inquiry_id", flat=True).first()
    if inquiry_id:
        HouseInquiry.objects.select_for_update().get(pk=inquiry_id, organization=org)
    record = get_object_or_404(viewing_records_for_organization(org, actor=actor).select_for_update(of=("self",)), pk=record_id)
    if actor is not None and record.source_inquiry_id:
        from apps.house.services.inquiries import assert_inquiry_context

        assert_inquiry_context(inquiry=record.source_inquiry, organization=org, actor=actor, house_id=record.house_id, contact_id=record.contact_id, require_open=False)
    elif actor is not None and record.contact_id:
        from apps.house.services.customers import assert_customer_contact_access

        assert_customer_contact_access(record.contact, actor=actor, organization=org, viewing=record, house_id=record.house_id)
        if any(field in data and data[field] != getattr(record, field) for field in ("house_id", "contact_id")):
            assert_customer_contact_access(record.contact, actor=actor, organization=org)
    data = dict(data)
    if "source_inquiry_id" in data and data["source_inquiry_id"] != record.source_inquiry_id:
        raise ConflictException("带看创建后不能变更来源咨询。")
    if (
        record.source_inquiry_id
        and record.source_inquiry.status in ("closed", "signed")
        and (data.get("status") == ViewingRecordStatus.SCHEDULED or "scheduled_at" in data and data["scheduled_at"] != record.scheduled_at)
    ):
        raise ConflictException("已关闭或已成交咨询不能恢复或新增预约。")
    if record.source_inquiry_id and any(field in data and data[field] != getattr(record, field) for field in ("source_inquiry_id", "house_id", "contact_id")):
        raise ConflictException("咨询带看不能更换来源咨询、房源或客户。")
    if record.source_inquiry_id and record.status != ViewingRecordStatus.SCHEDULED and "assigned_to_id" in data and data["assigned_to_id"] != record.assigned_to_id:
        raise ConflictException("已完成带看的执行人不能变更。")
    if "house_id" in data:
        record.house = get_house_in_org(data.pop("house_id"), org)
    if "contact_id" in data:
        contact_id = data.pop("contact_id")
        if contact_id is None:
            record.contact = None
        elif contact_id != record.contact_id:
            record.contact = get_contact_for_new_business(contact_id, org, ContactRole.TENANT, actor=actor)
    if "assigned_to_id" in data:
        validate_assignee_in_org(data["assigned_to_id"], org)
        if record.source_inquiry_id and data["assigned_to_id"] != record.assigned_to_id:
            raise ConflictException("咨询带看负责人请通过转派当前咨询调整。")
    if actor is not None and record.contact_id is None and data.get("customer_phone"):
        from apps.accounts.models import normalize_phone
        from apps.house.models import Contact
        from apps.house.services.customers import assert_customer_contact_access

        for contact in Contact.objects.filter(organization=org, normalized_phone=normalize_phone(data["customer_phone"])):
            assert_customer_contact_access(contact, actor=actor, organization=org)
    for field, value in data.items():
        setattr(record, field, value)
    record.save()
    from apps.house.services.inquiries import refresh_inquiry_after_viewing

    refresh_inquiry_after_viewing(record.source_inquiry_id)
    return record


@transaction.atomic
def book_viewing(*, user, house_id: int, scheduled_at, notes: str = ""):
    if not user.phone_verified or not user.phone:
        raise PermissionDenied("预约看房前请先验证手机号。")
    house = get_object_or_404(get_public_houses_queryset(), pk=house_id)
    Organization.objects.select_for_update().get(pk=house.building.organization_id)
    contact = get_or_bind_tenant_contact(organization=house.building.organization, user=user)
    from apps.house.queries.responsibilities import resolve_contact_recipient
    from apps.house.services.inquiries import record_inquiry, refresh_inquiry_after_viewing

    inquiry = record_inquiry(house=house, user=user, assigned_to=resolve_contact_recipient(house), phone=user.phone)
    if inquiry.contact_id is None:
        inquiry.contact = contact
        inquiry.save(update_fields=["contact", "updated_at"])
    record = create_viewing_record(
        data=dict(
            house_id=house.pk,
            contact_id=contact.pk,
            source_inquiry_id=None,
            source_inquiry=inquiry,
            assigned_to_id=inquiry.assigned_to_id,
            customer_name=contact.name,
            customer_phone=user.phone,
            scheduled_at=scheduled_at,
            notes=notes,
        ),
        organization=house.building.organization,
    )
    refresh_inquiry_after_viewing(inquiry.pk)
    return record


@transaction.atomic
def cancel_viewing(*, user, viewing_record_id: int):
    from apps.house.models import HouseInquiry

    source = get_object_or_404(viewing_records_for_tenant(user).values("organization_id", "source_inquiry_id"), pk=viewing_record_id)
    Organization.objects.select_for_update().get(pk=source["organization_id"])
    inquiry_id = source["source_inquiry_id"]
    if inquiry_id:
        HouseInquiry.objects.select_for_update().get(pk=inquiry_id)
    record = get_object_or_404(viewing_records_for_tenant(user).select_for_update(of=("self",)), pk=viewing_record_id)
    if record.status != ViewingRecordStatus.SCHEDULED:
        raise ConflictException("只有已预约的带看可以取消。")
    record.status = ViewingRecordStatus.CANCELED
    record.save(update_fields=["status", "updated_at"])
    from apps.house.services.inquiries import refresh_inquiry_after_viewing

    refresh_inquiry_after_viewing(record.source_inquiry_id)
    return record
