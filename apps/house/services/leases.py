from __future__ import annotations

from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import Http404
from django.shortcuts import get_object_or_404

from apps.house.constants import ContactRole, HouseStatus, LeaseStatus
from apps.house.models import Lease
from apps.house.queries.properties import get_house_in_org
from apps.house.queries.viewings import get_viewing_record_in_org
from apps.house.services.contacts import get_contact_for_new_business
from apps.organizations.models import Organization


@transaction.atomic
def create_deal_signing(
    *,
    organization: Organization,
    house_id: int,
    tenant,
    source_viewing_record=None,
    lease_data: dict,
):
    """显式完成成交签约，不改变普通租约保存与状态流转语义。"""
    from apps.house.models import House, Lease

    try:
        house = House.objects.select_for_update(of=("self",)).select_related("building").get(pk=house_id, building__organization=organization)
    except House.DoesNotExist:
        raise Http404 from None

    if house.status == HouseStatus.INACTIVE:
        raise ValidationError({"house": "已停用房源不能成交签约。"})

    lease = Lease.objects.create(
        organization=organization,
        house=house,
        tenant=tenant,
        source_viewing_record=source_viewing_record,
        status=LeaseStatus.ACTIVE,
        **lease_data,
    )
    if house.status != HouseStatus.RENTED:
        house.status = HouseStatus.RENTED
        house.save(update_fields=["status", "updated_at"])
    return lease


@transaction.atomic
def create_lease(*, organization, data: dict):
    org = organization
    data = dict(data)
    house_id = data.pop("house_id")
    tenant_id = data.pop("tenant_id")
    source_viewing_record_id = data.pop("source_viewing_record_id", None)
    data["house"] = get_house_in_org(house_id, org)
    data["tenant"] = get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    if source_viewing_record_id is not None:
        data["source_viewing_record"] = get_viewing_record_in_org(source_viewing_record_id, org)
    lease = Lease.objects.create(organization=org, **data)
    return lease


@transaction.atomic
def update_lease(*, organization, lease_id: int, data: dict):
    lease = get_object_or_404(Lease.objects.select_for_update(), pk=lease_id, organization=organization)
    data = dict(data)
    if "house_id" in data:
        lease.house = get_house_in_org(data.pop("house_id"), lease.organization)
    if "tenant_id" in data:
        tenant_id = data.pop("tenant_id")
        if tenant_id != lease.tenant_id:
            lease.tenant = get_contact_for_new_business(tenant_id, lease.organization, ContactRole.TENANT)
    if "source_viewing_record_id" in data:
        source_viewing_record_id = data.pop("source_viewing_record_id")
        lease.source_viewing_record = get_viewing_record_in_org(source_viewing_record_id, lease.organization) if source_viewing_record_id is not None else None
    for field, value in data.items():
        setattr(lease, field, value)
    lease.save()
    return lease
