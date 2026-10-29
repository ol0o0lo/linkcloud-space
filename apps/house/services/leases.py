from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.house.constants import ContactRole, HouseStatus, LeaseStatus
from apps.house.models import House, Lease
from apps.house.queries.viewings import get_viewing_record_in_org
from apps.house.services.contacts import get_contact_for_new_business
from apps.house.services.customers import assert_customer_contact_access
from apps.organizations.models import Organization


def normalize_signing_datetime(value: datetime | None) -> datetime | None:
    return timezone.make_aware(value, ZoneInfo("Asia/Shanghai")) if value is not None and timezone.is_naive(value) else value


def _get_active_house_for_lease(*, organization, house_id):
    house = get_object_or_404(House.objects.select_for_update(of=("self",)).select_related("building"), pk=house_id, building__organization=organization)
    if not house.is_active:
        raise ValidationError({"house": "已停用房源不能成交签约。"})
    return house


@transaction.atomic
def create_deal_signing(
    *,
    organization: Organization,
    house_id: int,
    tenant,
    source_viewing_record=None,
    lease_data: dict,
    source_inquiry=None,
):
    """显式完成成交签约，不改变普通租约保存与状态流转语义。"""
    Organization.objects.select_for_update().get(pk=organization.pk)
    house = _get_active_house_for_lease(organization=organization, house_id=house_id)

    lease = Lease.objects.create(
        organization=organization,
        house=house,
        tenant=tenant,
        source_viewing_record=source_viewing_record,
        source_inquiry=source_inquiry,
        status=LeaseStatus.ACTIVE,
        **lease_data,
    )
    if house.status != HouseStatus.RENTED:
        house.status = HouseStatus.RENTED
        house.save(update_fields=["status", "updated_at"])
    if source_inquiry is not None:
        from apps.house.constants import HouseInquiryStatus, ViewingRecordStatus

        source_inquiry.status = HouseInquiryStatus.SIGNED
        source_inquiry.save(update_fields=["status", "updated_at"])
        source_inquiry.viewings.filter(status=ViewingRecordStatus.SCHEDULED).exclude(pk=source_viewing_record.pk if source_viewing_record else None).update(
            status=ViewingRecordStatus.CANCELED
        )
    return lease


def can_maintain_lease(lease, *, actor, organization):
    from apps.house.queries.customers import can_manage_customers

    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    if can_manage_customers(organization=organization, actor=actor):
        return True
    if lease.registered_by_id is not None:
        return lease.registered_by_id == actor.pk
    profile = getattr(lease.tenant, "customer_profile", None)
    return profile is not None and profile.assigned_to_id == actor.pk


def assert_lease_maintenance(lease, *, actor, organization):
    from apps.house.queries.customers import require_customer_member

    require_customer_member(organization=organization, actor=actor)
    if can_maintain_lease(lease, actor=actor, organization=organization):
        return
    if lease.registered_by_id is not None:
        raise PermissionDenied("仅成交登记人或组织管理员可维护该租约。")
    if not getattr(lease.tenant, "customer_profile", None):
        raise PermissionDenied("历史租约请先由组织管理员补齐客户归属。")
    raise PermissionDenied("你没有维护该租约的权限。")


@transaction.atomic
def register_signing(*, organization, actor, lease_data, team_id=None, client_request_id=""):
    from apps.allocation.services import effective_month_for
    from apps.house.queries.customers import require_customer_member
    from apps.house.services.allocations import resolve_signing_team
    from apps.house.services.contacts import resolve_deal_signing_tenant
    from apps.house.services.inquiries import get_inquiry

    require_customer_member(organization=organization, actor=actor)
    Organization.objects.select_for_update().get(pk=organization.pk)
    if client_request_id:
        existing = Lease.objects.filter(organization=organization, client_request_id=client_request_id).first()
        if existing:
            assert_lease_maintenance(existing, actor=actor, organization=organization)
            return existing
    data = dict(lease_data)
    house_id = data.pop("house_id")
    inquiry_id = data.pop("source_inquiry_id", None)
    source_viewing_id = data.pop("source_viewing_record_id", None)
    tenant_id = data.pop("tenant_id", None)
    identity = data.pop("tenant_identity", None)
    source_viewing = get_viewing_record_in_org(source_viewing_id, organization, actor=actor) if source_viewing_id else None
    if source_viewing is not None and source_viewing.source_inquiry_id is None:
        source_viewing = get_viewing_record_in_org(source_viewing_id, organization, actor=actor, for_update=True)
    if source_viewing and source_viewing.source_inquiry_id:
        if inquiry_id and inquiry_id != source_viewing.source_inquiry_id:
            raise ValidationError({"source_inquiry": "来源带看与咨询不匹配。"})
        inquiry_id = source_viewing.source_inquiry_id
    inquiry = get_inquiry(organization=organization, actor=actor, inquiry_id=inquiry_id, for_update=True) if inquiry_id else None
    tenant = get_contact_for_new_business(tenant_id, organization, ContactRole.TENANT) if tenant_id else resolve_deal_signing_tenant(organization=organization, **identity)
    assert_customer_contact_access(tenant, actor=actor, organization=organization, inquiry=inquiry, viewing=source_viewing, house_id=house_id)
    if source_viewing:
        from apps.house.constants import ViewingRecordStatus

        if source_viewing.house_id != house_id or source_viewing.contact_id not in (None, tenant.pk):
            raise ValidationError({"source_viewing_record": "来源带看与当前房源、客户不匹配。"})
        source_viewing.status = ViewingRecordStatus.CONVERTED
        source_viewing.save(update_fields=["status", "updated_at"])
    team = resolve_signing_team(organization=organization, submitted_by=actor, team_id=team_id)
    data["sign_at"] = normalize_signing_datetime(data.get("sign_at") or timezone.now())
    data.update(
        registered_by=actor,
        deal_team=team,
        deal_team_name_snapshot=team.name if team else "",
        performance_month=effective_month_for(data["sign_at"]),
        client_request_id=client_request_id,
    )
    return create_deal_signing(organization=organization, house_id=house_id, tenant=tenant, source_viewing_record=source_viewing, source_inquiry=inquiry, lease_data=data)


@transaction.atomic
def create_lease(*, organization, data: dict, actor=None):
    org = organization
    Organization.objects.select_for_update().get(pk=org.pk)
    data = dict(data)
    house_id = data.pop("house_id")
    tenant_id = data.pop("tenant_id")
    source_viewing_record_id = data.pop("source_viewing_record_id", None)
    source_inquiry_id = data.pop("source_inquiry_id", None)
    inquiry = None
    if source_inquiry_id:
        from apps.house.services.inquiries import get_inquiry

        inquiry = get_inquiry(organization=org, actor=actor, inquiry_id=source_inquiry_id, for_update=True)
        data["source_inquiry"] = inquiry
    data["house"] = _get_active_house_for_lease(organization=org, house_id=house_id)
    data["tenant"] = get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    if actor is not None:
        assert_customer_contact_access(data["tenant"], actor=actor, organization=org, inquiry=inquiry, house_id=house_id)
    if source_viewing_record_id is not None:
        data["source_viewing_record"] = get_viewing_record_in_org(source_viewing_record_id, org, actor=actor)
    lease = Lease.objects.create(organization=org, **data)
    return lease


@transaction.atomic
def update_lease(*, organization, lease_id: int, data: dict, actor=None):
    from apps.house.queries.leases import visible_leases

    Organization.objects.select_for_update().get(pk=organization.pk)
    lease = get_object_or_404(visible_leases(Lease.objects.select_for_update(of=("self",)), org=organization, actor=actor), pk=lease_id, organization=organization)
    if actor is not None:
        assert_lease_maintenance(lease, actor=actor, organization=organization)
    data = dict(data)
    if "sign_at" in data:
        data["sign_at"] = normalize_signing_datetime(data["sign_at"])
    from apps.allocation.constants import AllocationRequestStatus

    if "source_inquiry_id" in data and data["source_inquiry_id"] != lease.source_inquiry_id:
        raise ValidationError({"source_inquiry": "登记成交后不能更换来源咨询。"})

    key_fields = {"house_id", "tenant_id", "monthly_rent", "deposit", "sign_at", "deal_team_id", "start_date", "end_date", "source_inquiry_id", "source_viewing_record_id"}
    changed = {field for field in key_fields & data.keys() if getattr(lease, field) != data[field]}
    if actor is not None and changed & {"sign_at", "deal_team_id"}:
        from apps.house.queries.customers import can_manage_customers

        if not can_manage_customers(organization=organization, actor=actor):
            raise PermissionDenied("仅组织管理员可调整已登记的签约日期和成交团队。")
    if changed and lease.allocations.filter(allocation_request__status__in=[AllocationRequestStatus.PENDING, AllocationRequestStatus.APPROVED]).exists():
        raise ValidationError({"allocation": "已有有效收益申请，请先撤回待审核申请或由财务作废已确认申请，再修改成交信息。"})
    if "deal_team_id" in data:
        from apps.teams.models import Team

        team_id = data.pop("deal_team_id")
        team = get_object_or_404(Team, pk=team_id, organization=organization) if team_id is not None else None
        lease.deal_team = team
        lease.deal_team_name_snapshot = team.name if team else ""
    target_house_id = data.pop("house_id", lease.house_id)
    activating = data.get("status") == LeaseStatus.ACTIVE and lease.status != LeaseStatus.ACTIVE
    if target_house_id != lease.house_id or activating:
        lease.house = _get_active_house_for_lease(organization=lease.organization, house_id=target_house_id)
    if "tenant_id" in data:
        tenant_id = data.pop("tenant_id")
        if tenant_id != lease.tenant_id:
            lease.tenant = get_contact_for_new_business(tenant_id, lease.organization, ContactRole.TENANT)
            if actor is not None:
                assert_customer_contact_access(lease.tenant, actor=actor, organization=organization)
    if "source_viewing_record_id" in data:
        source_viewing_record_id = data.pop("source_viewing_record_id")
        lease.source_viewing_record = get_viewing_record_in_org(source_viewing_record_id, lease.organization, actor=actor) if source_viewing_record_id is not None else None
    for field, value in data.items():
        setattr(lease, field, value)
    lease.save()
    if lease.status == LeaseStatus.TERMINATED:
        from apps.house.services.allocations import cancel_terminated_lease_allocations

        cancel_terminated_lease_allocations(organization=organization, lease_id=lease.pk, actor=actor)
    if "sign_at" in changed and lease.sign_at:
        from apps.allocation.services import effective_month_for

        lease.performance_month = effective_month_for(lease.sign_at)
        lease.save(update_fields=["performance_month", "updated_at"])
    return lease
