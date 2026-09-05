from __future__ import annotations

from datetime import datetime

from django.db import IntegrityError, transaction
from django.http import Http404
from django.utils import timezone

from apps.allocation.constants import AllocationItemEffect, AllocationRequestStatus
from apps.allocation.exceptions import AllocationAlreadyExistsException, AllocationExpiredException, AllocationInvalidException, AllocationNotPendingException
from apps.allocation.services import (
    AllocationItemInput,
    AllocationShareInput,
    approve_allocation_request_locked,
    create_allocation_request,
    expire_allocation_request_locked,
    lock_allocation_request,
    reject_allocation_request_locked,
    void_allocation_request_locked,
)
from apps.allocation.tasks import enqueue_allocation_notification
from apps.house.allocation_rules import resolve_lease_allocation_rule
from apps.house.constants import LeaseStatus
from apps.house.models import Lease, LeaseAllocation
from apps.house.services import create_deal_signing
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
            lease = create_deal_signing(
                organization=organization,
                house_id=house.pk,
                tenant=tenant,
                source_viewing_record=source_viewing_record,
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


def _lock_lease_allocation(lease_id: int, organization):
    try:
        lease = Lease.objects.select_for_update().get(pk=lease_id, organization=organization)
    except Lease.DoesNotExist:
        raise Http404 from None
    try:
        link = LeaseAllocation.objects.get(lease=lease)
    except LeaseAllocation.DoesNotExist:
        raise AllocationInvalidException("该租约尚未提交分配申请。") from None
    allocation_request = lock_allocation_request(link.allocation_request_id)
    if allocation_request.organization_id != organization.pk:
        raise AllocationInvalidException("租约与分配申请不属于同一组织。")
    return lease, link, allocation_request


def _terminate_lease_locked(lease: Lease) -> None:
    if lease.status in {LeaseStatus.PENDING, LeaseStatus.ACTIVE}:
        lease.status = LeaseStatus.TERMINATED
        lease.save(update_fields=("status", "updated_at"))


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
):
    expired = False
    with transaction.atomic():
        lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization)
        effective_reviewed_at = reviewed_at or timezone.now()
        if allocation_request.status == AllocationRequestStatus.APPROVED and approved:
            return allocation_request
        if allocation_request.status != AllocationRequestStatus.PENDING:
            raise AllocationNotPendingException()
        if effective_reviewed_at >= allocation_request.expires_at:
            expire_allocation_request_locked(allocation_request)
            _terminate_lease_locked(lease)
            _schedule_notification(
                lease=lease,
                allocation_request=allocation_request,
                title="分配申请已过期",
                body="分配申请超过 7 天未审核，已自动过期；如需再次申请，请创建新的租约。",
                actor=None,
                include_submitter=True,
            )
            expired = True
        elif approved:
            if lease.status != LeaseStatus.ACTIVE:
                raise AllocationInvalidException("只有生效中的租约可以审核通过分配申请。")
            approve_allocation_request_locked(allocation_request, reviewer=reviewer, reviewed_at=effective_reviewed_at)
        else:
            reject_allocation_request_locked(allocation_request, reviewer=reviewer, reason=reason, reviewed_at=effective_reviewed_at)
            _terminate_lease_locked(lease)
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


def expire_lease_allocation(*, organization, lease_id: int, expired_at: datetime | None = None):
    expired_at = expired_at or timezone.now()
    with transaction.atomic():
        lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization)
        if allocation_request.status != AllocationRequestStatus.PENDING or expired_at < allocation_request.expires_at:
            return allocation_request
        expire_allocation_request_locked(allocation_request)
        _terminate_lease_locked(lease)
        _schedule_notification(
            lease=lease,
            allocation_request=allocation_request,
            title="分配申请已过期",
            body="分配申请超过 7 天未审核，已自动过期；如需再次申请，请创建新的租约。",
            actor=None,
            include_submitter=True,
        )
        return allocation_request


@transaction.atomic
def void_lease_allocation(*, organization, lease_id: int, actor, reason: str, voided_at: datetime | None = None):
    lease, _link, allocation_request = _lock_lease_allocation(lease_id, organization)
    was_voided = allocation_request.status == AllocationRequestStatus.VOIDED
    allocation_request = void_allocation_request_locked(allocation_request, actor=actor, reason=reason, voided_at=voided_at)
    if not was_voided:
        _terminate_lease_locked(lease)
        _schedule_notification(
            lease=lease,
            allocation_request=allocation_request,
            title="已生效分配被作废",
            body=f"作废原因：{allocation_request.void_reason}",
            actor=actor,
            include_submitter=False,
        )
    return allocation_request


def get_lease_allocation(*, organization, lease_id: int) -> LeaseAllocation:
    try:
        return (
            LeaseAllocation.objects.select_related(
                "lease",
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
