from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from decimal import Decimal

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.access.constants import AllocationPermission
from apps.access.services import has_permission
from apps.allocation.constants import AllocationItemEffect, AllocationRequestStatus
from apps.allocation.exceptions import AllocationAlreadyExistsException, AllocationExpiredException, AllocationInvalidException, AllocationNotPendingException
from apps.allocation.models import AllocationItem, AllocationRequest, AllocationShare
from apps.allocation.services import (
    AllocationItemInput,
    AllocationShareInput,
    approve_allocation_request_locked,
    create_allocation_request,
    effective_month_for,
    expire_allocation_request_locked,
    lock_allocation_request,
    reject_allocation_request_locked,
    user_name_snapshot,
    void_allocation_request_locked,
)
from apps.allocation.tasks import enqueue_allocation_notification
from apps.base.exceptions import ConflictException
from apps.house.constants import ContactRole, LeaseStatus
from apps.house.models import Lease, LeaseAllocation
from apps.house.queries.properties import get_house_in_org
from apps.house.queries.viewings import get_viewing_record_in_org
from apps.house.services.allocation_rules import resolve_lease_allocation_rule
from apps.house.services.contacts import get_contact_for_new_business, resolve_deal_signing_tenant
from apps.house.services.customers import assert_customer_contact_access
from apps.house.services.leases import create_deal_signing
from apps.organizations.models import Organization
from apps.teams.models import Team


def build_lease_source_snapshot(lease: Lease) -> dict:
    estate = lease.house.building.estate
    return {
        "lease_id": lease.pk,
        "house": {
            "id": lease.house_id,
            "room_number": lease.house.room_number,
            "building_id": lease.house.building_id,
            "building_name": lease.house.building.name,
            "estate_id": estate.pk if estate else None,
            "estate_name": (estate.display_name or estate.name) if estate else None,
        },
        "tenant": {"id": lease.tenant_id, "name": lease.tenant.name},
        "sign_at": lease.sign_at.isoformat() if lease.sign_at else None,
        "start_date": lease.start_date.isoformat(),
        "end_date": lease.end_date.isoformat(),
        "monthly_rent": str(lease.monthly_rent),
        "deposit": str(lease.deposit) if lease.deposit is not None else None,
        "team_id": lease.deal_team_id,
        "performance_month": lease.performance_month.isoformat() if lease.performance_month else None,
        "status": lease.status,
    }


def create_lease_with_allocation(
    *,
    organization,
    submitted_by,
    lease_data: dict,
    beneficiary_user_ids: list[int],
    team_id: int | None = None,
    submitted_at: datetime | None = None,
) -> LeaseAllocation:
    try:
        with transaction.atomic():
            team = resolve_signing_team(organization=organization, submitted_by=submitted_by, team_id=team_id)
            beneficiary_user_ids = sorted(set(beneficiary_user_ids))
            shares = build_equal_share_inputs(beneficiary_user_ids)
            house = lease_data.pop("house")
            tenant = lease_data.pop("tenant")
            source_viewing_record = lease_data.pop("source_viewing_record", None)
            source_inquiry = lease_data.pop("source_inquiry", None)
            lease_data.update(registered_by=submitted_by, deal_team=team, deal_team_name_snapshot=team.name if team else "")
            signing_at = lease_data.get("sign_at") or submitted_at or timezone.now()
            lease_data["performance_month"] = effective_month_for(signing_at)
            lease = create_deal_signing(
                organization=organization,
                house_id=house.pk,
                tenant=tenant,
                source_viewing_record=source_viewing_record,
                source_inquiry=source_inquiry,
                lease_data=lease_data,
            )
            rule = resolve_lease_allocation_rule(organization, team=team)
            allocation_request = create_allocation_request(
                organization=organization,
                submitted_by=submitted_by,
                team=team,
                rule_source=rule.source,
                items=[
                    AllocationItemInput(
                        name="成交房源月租",
                        effect=AllocationItemEffect.INCREASE,
                        amount=lease.monthly_rent,
                    )
                ],
                shares=shares,
                distribution_method=rule.method,
                distribution_rate_bp=rule.rate_bp,
                distributable_amount=rule.fixed_amount,
                source_snapshot=build_lease_source_snapshot(lease),
                submitted_at=submitted_at,
                performance_month=lease.performance_month,
            )
            link = LeaseAllocation(lease=lease, allocation_request=allocation_request)
            link.save()
            return link
    except IntegrityError as error:
        raise AllocationAlreadyExistsException("该房源已有生效租约或该租约已经提交过分配申请。") from error


def resolve_signing_team(*, organization, submitted_by, team_id: int | None):
    teams = Team.objects.filter(organization=organization, members=submitted_by).order_by("pk")
    if team_id is not None:
        try:
            return teams.get(pk=team_id)
        except Team.DoesNotExist:
            raise AllocationInvalidException("归属团队必须是当前操作人所在的团队。") from None
    team_count = teams.count()
    if team_count == 0:
        return None
    if team_count == 1:
        return teams.first()
    raise AllocationInvalidException("当前操作人属于多个团队，请选择本次签约的归属团队。")


def build_equal_share_inputs(beneficiary_user_ids: list[int]) -> list[AllocationShareInput]:
    if not beneficiary_user_ids:
        raise AllocationInvalidException("至少需要一名受益人。")
    if len(beneficiary_user_ids) > 10000:
        raise AllocationInvalidException("受益人数不能超过 10000 人。")
    base_weight, remainder = divmod(10000, len(beneficiary_user_ids))
    return [
        AllocationShareInput(
            beneficiary_user_id=user_id,
            weight_bp=base_weight + (1 if index < remainder else 0),
            sort_order=index,
        )
        for index, user_id in enumerate(beneficiary_user_ids)
    ]


def _lock_lease_allocation(lease_id: int, organization, request_id=None):
    Organization.objects.select_for_update().get(pk=organization.pk)
    try:
        lease = Lease.objects.select_for_update().get(pk=lease_id, organization=organization)
    except Lease.DoesNotExist:
        raise Http404 from None
    try:
        links = LeaseAllocation.objects.filter(lease=lease)
        link = links.get(allocation_request_id=request_id) if request_id is not None else links.latest("pk")
    except LeaseAllocation.DoesNotExist:
        raise AllocationInvalidException("该租约尚未提交分配申请。") from None
    allocation_request = lock_allocation_request(link.allocation_request_id)
    if allocation_request.organization_id != organization.pk:
        raise AllocationInvalidException("租约与分配申请不属于同一组织。")
    return lease, link, allocation_request


def _recipient_ids(allocation_request, *, include_submitter: bool) -> list[int]:
    values = set(allocation_request.shares.values_list("beneficiary_user_id", flat=True))
    if include_submitter:
        values.add(allocation_request.submitted_by_id)
    return sorted(values)


def _schedule_notification(*, lease: Lease, allocation_request, title: str, body: str, actor, include_submitter: bool) -> None:
    kwargs = {
        "allocation_request_id": allocation_request.pk,
        "recipient_user_ids": _recipient_ids(allocation_request, include_submitter=include_submitter),
        "title": title,
        "body": body,
        "url": f"/dashboard/rental/earnings?tab=reviews&request={allocation_request.pk}",
        "actor_id": actor.pk if actor else None,
    }
    transaction.on_commit(lambda: enqueue_allocation_notification(**kwargs))


def review_lease_allocation(
    *,
    organization,
    lease_id: int,
    reviewer,
    approved: bool,
    reason: str = "",
    reviewed_at: datetime | None = None,
    request_id: int | None = None,
):
    expired = False
    with transaction.atomic():
        lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization, request_id)
        effective_reviewed_at = reviewed_at or timezone.now()
        if allocation_request.status == AllocationRequestStatus.APPROVED and approved:
            return allocation_request
        if allocation_request.status != AllocationRequestStatus.PENDING:
            raise AllocationNotPendingException()
        if effective_reviewed_at >= allocation_request.expires_at:
            expire_allocation_request_locked(allocation_request)
            _schedule_notification(
                lease=lease,
                allocation_request=allocation_request,
                title="分配申请已过期",
                body="分配申请超过 7 天未审核，已自动过期。关联租约保持有效，请联系审核人员处理收益申请。",
                actor=None,
                include_submitter=True,
            )
            expired = True
        elif approved:
            if lease.status not in (LeaseStatus.ACTIVE, LeaseStatus.EXPIRED):
                raise AllocationInvalidException("该租约不能审核通过分配申请。")
            approve_allocation_request_locked(allocation_request, reviewer=reviewer, reviewed_at=effective_reviewed_at)
        else:
            reject_allocation_request_locked(allocation_request, reviewer=reviewer, reason=reason, reviewed_at=effective_reviewed_at)
            _schedule_notification(
                lease=lease,
                allocation_request=allocation_request,
                title="分配申请审核不通过",
                body=f"审核不通过原因：{allocation_request.rejection_reason}",
                actor=reviewer,
                include_submitter=True,
            )
    if expired:
        raise AllocationExpiredException()
    return allocation_request


def expire_lease_allocation(*, organization, lease_id: int, expired_at: datetime | None = None, request_id=None):
    expired_at = expired_at or timezone.now()
    with transaction.atomic():
        lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization, request_id)
        if allocation_request.status != AllocationRequestStatus.PENDING or expired_at < allocation_request.expires_at:
            return allocation_request
        expire_allocation_request_locked(allocation_request)
        _schedule_notification(
            lease=lease,
            allocation_request=allocation_request,
            title="分配申请已过期",
            body="分配申请超过 7 天未审核，已自动过期。关联租约保持有效，请联系审核人员处理收益申请。",
            actor=None,
            include_submitter=True,
        )
        return allocation_request


@transaction.atomic
def void_lease_allocation(*, organization, lease_id: int, actor, reason: str, voided_at: datetime | None = None, request_id=None):
    lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization, request_id)
    was_voided = allocation_request.status == AllocationRequestStatus.VOIDED
    allocation_request = void_allocation_request_locked(allocation_request, actor=actor, reason=reason, voided_at=voided_at)
    if not was_voided:
        _schedule_notification(
            lease=lease,
            allocation_request=allocation_request,
            title="已生效分配被作废",
            body=f"作废原因：{allocation_request.void_reason}",
            actor=actor,
            include_submitter=False,
        )
    return allocation_request


def _withdraw_allocation_locked(allocation_request, *, actor, reason):
    if allocation_request.status == AllocationRequestStatus.WITHDRAWN:
        return allocation_request
    if allocation_request.status != AllocationRequestStatus.PENDING:
        raise AllocationNotPendingException()
    if not reason.strip():
        raise AllocationInvalidException("撤回时必须填写原因。")
    allocation_request.status = AllocationRequestStatus.WITHDRAWN
    allocation_request.withdrawn_by = actor
    allocation_request.withdrawn_at = timezone.now()
    allocation_request.withdraw_reason = reason.strip()
    allocation_request.save(update_fields=["status", "withdrawn_by", "withdrawn_at", "withdraw_reason", "updated_at"])
    return allocation_request


@transaction.atomic
def withdraw_lease_allocation(*, organization, lease_id, request_id, actor, reason="申请人撤回后修改成交信息。"):
    from apps.house.queries.customers import require_customer_member

    require_customer_member(organization=organization, actor=actor)
    _lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization, request_id)
    if allocation_request.submitted_by_id != actor.pk:
        raise PermissionDenied("仅申请人本人可以撤回；审核人员请使用退回操作。")
    return _withdraw_allocation_locked(allocation_request, actor=actor, reason=reason)


@transaction.atomic
def cancel_terminated_lease_allocations(*, organization, lease_id, actor):
    from apps.house.services.leases import assert_lease_maintenance

    Organization.objects.select_for_update().get(pk=organization.pk)
    lease = get_object_or_404(Lease.objects.select_for_update(), pk=lease_id, organization=organization)
    assert_lease_maintenance(lease, actor=actor, organization=organization)
    if lease.status != LeaseStatus.TERMINATED:
        raise AllocationInvalidException("只有已提前终止租约可以自动取消待审核收益申请。")
    for link in lease.allocations.filter(allocation_request__status=AllocationRequestStatus.PENDING):
        allocation_request = lock_allocation_request(link.allocation_request_id)
        _withdraw_allocation_locked(allocation_request, actor=actor, reason="租约提前终止，取消待审核收益申请。")


def _assert_resubmit_snapshot(lease, previous, beneficiary_user_ids):
    snapshot = previous.source_snapshot
    current = build_lease_source_snapshot(lease)
    for key in ("monthly_rent", "deposit", "sign_at", "start_date", "end_date"):
        expected, actual = snapshot.get(key), current[key]
        if key in ("monthly_rent", "deposit"):
            expected = Decimal(expected) if expected is not None else None
            actual = Decimal(actual) if actual is not None else None
        elif key == "sign_at":
            expected = datetime.fromisoformat(expected) if expected else None
            actual = datetime.fromisoformat(actual) if actual else None
        if key in snapshot and expected != actual:
            raise AllocationInvalidException("成交关键字段已变更，请选择纠错重提并填写原因。")
    if (
        snapshot.get("house", {}).get("id", lease.house_id) != lease.house_id
        or snapshot.get("tenant", {}).get("id", lease.tenant_id) != lease.tenant_id
        or previous.team_id != lease.deal_team_id
    ):
        raise AllocationInvalidException("成交房源、客户或团队已变更，请选择纠错重提。")
    if beneficiary_user_ids is not None and sorted(set(beneficiary_user_ids)) != sorted(previous.shares.values_list("beneficiary_user_id", flat=True)):
        raise AllocationInvalidException("普通重提必须保留原受益人快照，请使用纠错重提。")


def _clone_request_snapshot(previous, *, actor):
    now = timezone.now()
    copied_fields = (
        "organization_id",
        "team_id",
        "team_name_snapshot",
        "rule_source",
        "basis_amount",
        "distribution_method",
        "distribution_rate_bp",
        "distributable_amount",
        "currency",
        "source_snapshot",
    )
    allocation_request = AllocationRequest.objects.create(
        **{field: getattr(previous, field) for field in copied_fields},
        performance_month=previous.performance_month or effective_month_for(previous.submitted_at),
        submitted_by=actor,
        submitted_by_name_snapshot=user_name_snapshot(actor),
        submitted_at=now,
        expires_at=now + timedelta(days=7),
    )
    for model, fields in (
        (AllocationItem, ("name", "effect", "amount", "sort_order", "remark")),
        (AllocationShare, ("beneficiary_user_id", "beneficiary_name_snapshot", "weight_bp", "attributed_basis_amount", "allocated_amount", "sort_order", "remark")),
    ):
        source = previous.items.all() if model == AllocationItem else previous.shares.all()
        model.objects.bulk_create([model(allocation_request=allocation_request, **{field: getattr(row, field) for field in fields}) for row in source])
    return allocation_request


@transaction.atomic
def submit_lease_allocation(
    *, organization, actor, lease_id, beneficiary_user_ids=None, client_request_id="", mode="initial", previous_request_id=None, reason="", preview_hash=None
):
    from apps.house.services.leases import assert_lease_maintenance

    if not has_permission(actor, organization, AllocationPermission.SUBMIT):
        raise PermissionDenied("你没有提交收益申请的权限。")
    Organization.objects.select_for_update().get(pk=organization.pk)
    lease = get_object_or_404(
        Lease.objects.select_for_update(of=("self",)).select_related("house__building__estate", "tenant", "deal_team"), pk=lease_id, organization=organization
    )
    assert_lease_maintenance(lease, actor=actor, organization=organization)
    if client_request_id:
        existing = lease.allocations.filter(client_request_id=client_request_id).first()
        if existing:
            return existing
    if lease.status not in (LeaseStatus.ACTIVE, LeaseStatus.EXPIRED):
        raise AllocationInvalidException("只有已登记成交且未提前终止的租约可以申请收益。")
    if lease.allocations.filter(allocation_request__status__in=[AllocationRequestStatus.PENDING, AllocationRequestStatus.APPROVED]).exists():
        raise AllocationAlreadyExistsException("该租约已有待审核或已确认的收益申请。")
    latest = lease.allocations.select_related("allocation_request").order_by("-pk").first()
    previous = latest.allocation_request if latest else None
    if mode == "initial":
        if previous or previous_request_id is not None:
            raise AllocationInvalidException("该租约已有申请历史，请选择重新申请。")
    elif mode in ("resubmit", "correction"):
        if previous is None or previous.pk != previous_request_id:
            raise AllocationInvalidException("请刷新后指定最近一次申请，不能从旧申请重新提交。")
        if mode == "correction":
            if previous.status not in (AllocationRequestStatus.WITHDRAWN, AllocationRequestStatus.VOIDED, AllocationRequestStatus.REJECTED, AllocationRequestStatus.EXPIRED):
                raise AllocationInvalidException("纠错前请先撤回待审核申请或由财务作废已确认申请。")
            if not reason.strip():
                raise AllocationInvalidException("纠错重提必须填写原因。")
        else:
            if previous.status not in (AllocationRequestStatus.REJECTED, AllocationRequestStatus.EXPIRED, AllocationRequestStatus.WITHDRAWN):
                raise AllocationInvalidException("财务已作废申请只能填写原因后纠错重提，不能普通重提。")
            _assert_resubmit_snapshot(lease, previous, beneficiary_user_ids)
    else:
        raise AllocationInvalidException("未知的申请方式。")
    if mode == "resubmit":
        allocation_request = _clone_request_snapshot(previous, actor=actor)
    else:
        if not preview_hash:
            raise AllocationInvalidException("请先预览并确认收益金额，再提交申请。")
        beneficiaries = sorted(
            set(beneficiary_user_ids if beneficiary_user_ids is not None else previous.shares.values_list("beneficiary_user_id", flat=True) if previous else [actor.pk])
        )
        expected = sorted(previous.shares.values_list("beneficiary_user_id", flat=True)) if previous else [actor.pk]
        if not has_permission(actor, organization, AllocationPermission.CHANGE_BENEFICIARIES) and beneficiaries != expected:
            raise PermissionDenied("你没有修改收益受益人的权限。")
        rule = resolve_lease_allocation_rule(organization, team=lease.deal_team)
        if preview_hash != _allocation_preview_values(lease, rule)["preview_hash"]:
            raise ConflictException("收益规则或成交信息已变化，请重新预览确认后提交。")
        month = lease.performance_month or (
            previous.performance_month or effective_month_for(previous.submitted_at) if previous else effective_month_for(lease.sign_at or timezone.now())
        )
        allocation_request = create_allocation_request(
            organization=organization,
            submitted_by=actor,
            team=lease.deal_team,
            rule_source=rule.source,
            items=[AllocationItemInput(name="成交房源月租", effect=AllocationItemEffect.INCREASE, amount=lease.monthly_rent)],
            shares=build_equal_share_inputs(beneficiaries),
            distribution_method=rule.method,
            distribution_rate_bp=rule.rate_bp,
            distributable_amount=rule.fixed_amount,
            source_snapshot=build_lease_source_snapshot(lease),
            performance_month=month,
        )
    return LeaseAllocation.objects.create(
        lease=lease, allocation_request=allocation_request, client_request_id=client_request_id, mode=mode, previous_request=previous, reason=reason.strip()
    )


def _allocation_preview_values(lease, rule):
    from apps.allocation.services import calculate_distributable_amount

    result = {
        "basis_amount": lease.monthly_rent,
        "distributable_amount": calculate_distributable_amount(
            basis_amount=lease.monthly_rent, distribution_method=rule.method, distribution_rate_bp=rule.rate_bp, distributable_amount=rule.fixed_amount
        ),
        "distribution_method": rule.method,
        "distribution_rate_bp": rule.rate_bp,
        "rule_source": rule.source,
        "team_id": lease.deal_team_id,
        "team_name": lease.deal_team_name_snapshot,
        "performance_month": lease.performance_month or effective_month_for(lease.sign_at or timezone.now()),
    }
    result["preview_hash"] = hashlib.sha256(json.dumps({**result, "source_snapshot": build_lease_source_snapshot(lease)}, sort_keys=True, default=str).encode()).hexdigest()
    return result


def preview_lease_allocation(*, organization, actor, lease_id, mode="initial", previous_request_id=None):
    from apps.house.services.leases import assert_lease_maintenance

    lease = get_object_or_404(Lease.objects.select_related("deal_team", "tenant"), organization=organization, pk=lease_id)
    assert_lease_maintenance(lease, actor=actor, organization=organization)
    if lease.status not in (LeaseStatus.ACTIVE, LeaseStatus.EXPIRED):
        raise AllocationInvalidException("该租约不能申请收益。")
    if (
        mode == "correction"
        and not lease.allocations.filter(
            allocation_request_id=previous_request_id,
            allocation_request__status__in=[AllocationRequestStatus.WITHDRAWN, AllocationRequestStatus.VOIDED, AllocationRequestStatus.REJECTED, AllocationRequestStatus.EXPIRED],
        ).exists()
    ):
        raise AllocationInvalidException("纠错预览需指定已结束的收益申请。")
    rule = resolve_lease_allocation_rule(organization, team=lease.deal_team)
    return _allocation_preview_values(lease, rule)


@transaction.atomic
def sign_lease(*, organization, actor, lease_data: dict, beneficiary_user_ids: list[int], team_id: int | None = None):
    org = organization
    if not has_permission(actor, org, AllocationPermission.SUBMIT):
        raise PermissionDenied("你没有提交收益申请的权限。")
    beneficiary_user_ids = sorted(set(beneficiary_user_ids))
    if not has_permission(actor, org, AllocationPermission.CHANGE_BENEFICIARIES) and beneficiary_user_ids != [actor.pk]:
        raise PermissionDenied("你没有修改收益受益人的权限。")

    lease_data = dict(lease_data)
    house_id = lease_data.pop("house_id")
    tenant_id = lease_data.pop("tenant_id")
    tenant_identity = lease_data.pop("tenant_identity")
    source_viewing_record_id = lease_data.pop("source_viewing_record_id", None)
    source_inquiry_id = lease_data.pop("source_inquiry_id", None)
    inquiry = None
    if source_inquiry_id:
        from apps.house.services.inquiries import get_inquiry

        inquiry = get_inquiry(organization=org, actor=actor, inquiry_id=source_inquiry_id, for_update=True)
        lease_data["source_inquiry"] = inquiry
    lease_data["house"] = get_house_in_org(house_id, org)
    if tenant_id is not None:
        lease_data["tenant"] = get_contact_for_new_business(tenant_id, org, ContactRole.TENANT)
    else:
        lease_data["tenant"] = resolve_deal_signing_tenant(organization=org, **tenant_identity)
    assert_customer_contact_access(lease_data["tenant"], actor=actor, organization=org, inquiry=inquiry, house_id=house_id)
    if source_viewing_record_id is not None:
        lease_data["source_viewing_record"] = get_viewing_record_in_org(source_viewing_record_id, org, actor=actor)
    return create_lease_with_allocation(
        organization=org,
        submitted_by=actor,
        lease_data=lease_data,
        beneficiary_user_ids=beneficiary_user_ids,
        team_id=team_id,
    )
