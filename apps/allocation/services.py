from dataclasses import dataclass
from datetime import date, datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from apps.allocation.constants import (
    ALLOCATION_CURRENCY,
    ALLOCATION_REVIEW_VALIDITY_HOURS,
    ALLOCATION_TIMEZONE,
    AccrualEntryType,
    AllocationDistributionMethod,
    AllocationItemEffect,
    AllocationRequestStatus,
    AllocationRuleSource,
)
from apps.allocation.exceptions import AllocationExpiredException, AllocationInvalidException, AllocationNotPendingException
from apps.allocation.models import AccrualEntry, AllocationItem, AllocationRequest, AllocationShare
from apps.organizations.models import OrganizationMember

MONEY_QUANT = Decimal("0.01")


def _require_organization_member(organization, user, role_label: str) -> None:
    if not OrganizationMember.objects.filter(organization=organization, user=user, user__is_active=True).exists():
        raise AllocationInvalidException(f"{role_label}不是当前组织成员。")


@dataclass(frozen=True)
class AllocationItemInput:
    name: str
    effect: str
    amount: Decimal
    sort_order: int = 0
    remark: str = ""


@dataclass(frozen=True)
class AllocationShareInput:
    beneficiary_user_id: int
    weight_bp: int
    allocated_amount: Decimal | None = None
    sort_order: int = 0
    remark: str = ""


def quantize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)


def user_name_snapshot(user) -> str:
    return (user.get_full_name() or getattr(user, "real_name_masked", "") or user.username or f"用户{user.pk}").strip()


def effective_month_for(value: datetime) -> date:
    local_value = value.astimezone(ZoneInfo(ALLOCATION_TIMEZONE))
    return date(local_value.year, local_value.month, 1)


def calculate_basis_amount(items: list[AllocationItemInput]) -> Decimal:
    if not items:
        raise AllocationInvalidException("至少需要一条计算依据明细。")
    total = Decimal("0")
    for item in items:
        amount = quantize_money(item.amount)
        if amount <= 0:
            raise AllocationInvalidException("计算依据明细金额必须大于零。")
        if item.effect == AllocationItemEffect.INCREASE:
            total += amount
        elif item.effect == AllocationItemEffect.DECREASE:
            total -= amount
        else:
            raise AllocationInvalidException("未知的计算依据影响方向。")
    total = quantize_money(total)
    if total < 0:
        raise AllocationInvalidException("计算依据金额不能为负数。")
    return total


def calculate_distributable_amount(
    *,
    basis_amount: Decimal,
    distribution_method: str,
    distribution_rate_bp: int | None,
    distributable_amount: Decimal | None,
) -> Decimal:
    if distribution_method == AllocationDistributionMethod.PERCENTAGE:
        if distribution_rate_bp is None or not 0 <= distribution_rate_bp <= 10000:
            raise AllocationInvalidException("比例分配必须提供 0 至 10000 的万分比。")
        if distributable_amount is not None:
            raise AllocationInvalidException("比例分配不能同时提供固定可分配金额。")
        return quantize_money(basis_amount * Decimal(distribution_rate_bp) / Decimal(10000))
    if distribution_method == AllocationDistributionMethod.FIXED:
        if distribution_rate_bp is not None:
            raise AllocationInvalidException("固定分配不能同时提供比例。")
        if distributable_amount is None or distributable_amount < 0:
            raise AllocationInvalidException("固定分配必须提供非负固定金额。")
        return quantize_money(distributable_amount)
    raise AllocationInvalidException("未知的分配方式。")


def distribute_by_weight(total: Decimal, shares: list[AllocationShareInput]) -> list[Decimal]:
    if not shares:
        raise AllocationInvalidException("至少需要一名受益人。")
    if sum(share.weight_bp for share in shares) != 10000:
        raise AllocationInvalidException("全部受益人权重合计必须等于 10000。")
    total_cents = int(quantize_money(total) * 100)
    floors: list[int] = []
    remainders: list[int] = []
    for share in shares:
        if not 1 <= share.weight_bp <= 10000:
            raise AllocationInvalidException("受益人权重必须在 1 至 10000 之间。")
        numerator = total_cents * share.weight_bp
        floors.append(numerator // 10000)
        remainders.append(numerator % 10000)
    leftover = total_cents - sum(floors)
    order = sorted(range(len(shares)), key=lambda index: (-remainders[index], shares[index].sort_order, shares[index].beneficiary_user_id))
    for index in order[:leftover]:
        floors[index] += 1
    return [Decimal(cents) / Decimal(100) for cents in floors]


def _validate_share_inputs(shares: list[AllocationShareInput]) -> None:
    if not shares:
        raise AllocationInvalidException("至少需要一名受益人。")
    user_ids = [share.beneficiary_user_id for share in shares]
    if len(user_ids) != len(set(user_ids)):
        raise AllocationInvalidException("同一受益人不能在一份申请中重复出现。")
    if sum(share.weight_bp for share in shares) != 10000:
        raise AllocationInvalidException("全部受益人权重合计必须等于 10000。")
    provided = [share.allocated_amount is not None for share in shares]
    if any(provided) and not all(provided):
        raise AllocationInvalidException("分配金额必须全部填写或全部由系统按权重计算。")


@transaction.atomic
def create_allocation_request(
    *,
    organization,
    submitted_by,
    team=None,
    rule_source: str = AllocationRuleSource.DEFAULT,
    items: list[AllocationItemInput],
    shares: list[AllocationShareInput],
    distribution_method: str,
    distribution_rate_bp: int | None = None,
    distributable_amount: Decimal | None = None,
    source_snapshot: dict | None = None,
    submitted_at: datetime | None = None,
) -> AllocationRequest:
    _validate_share_inputs(shares)
    submitted_at = submitted_at or timezone.now()
    _require_organization_member(organization, submitted_by, "申请人")
    if team is not None and team.organization_id != organization.pk:
        raise AllocationInvalidException("归属团队不属于当前组织。")
    basis_amount = calculate_basis_amount(items)
    calculated_distributable_amount = calculate_distributable_amount(
        basis_amount=basis_amount,
        distribution_method=distribution_method,
        distribution_rate_bp=distribution_rate_bp,
        distributable_amount=distributable_amount,
    )
    users_by_id = {
        member.user_id: member.user
        for member in OrganizationMember.objects.select_related("user").filter(
            organization=organization,
            user_id__in=[share.beneficiary_user_id for share in shares],
            user__is_active=True,
        )
    }
    missing_ids = sorted({share.beneficiary_user_id for share in shares} - users_by_id.keys())
    if missing_ids:
        raise AllocationInvalidException(f"受益人不是当前组织成员：{', '.join(str(value) for value in missing_ids)}。")

    attributed_amounts = distribute_by_weight(basis_amount, shares)
    if all(share.allocated_amount is None for share in shares):
        allocated_amounts = distribute_by_weight(calculated_distributable_amount, shares)
    else:
        allocated_amounts = [quantize_money(share.allocated_amount or Decimal("0")) for share in shares]
        if any(amount < 0 for amount in allocated_amounts):
            raise AllocationInvalidException("分配金额不能为负数。")
        if sum(allocated_amounts, Decimal("0")) > calculated_distributable_amount:
            raise AllocationInvalidException("员工分配金额合计不能超过可分配金额。")

    allocation_request = AllocationRequest(
        organization=organization,
        team=team,
        team_name_snapshot=team.name if team else "",
        rule_source=rule_source,
        status=AllocationRequestStatus.PENDING,
        basis_amount=basis_amount,
        distribution_method=distribution_method,
        distribution_rate_bp=distribution_rate_bp,
        distributable_amount=calculated_distributable_amount,
        currency=ALLOCATION_CURRENCY,
        source_snapshot=source_snapshot or {},
        submitted_by=submitted_by,
        submitted_by_name_snapshot=user_name_snapshot(submitted_by),
        submitted_at=submitted_at,
        expires_at=submitted_at + timedelta(hours=ALLOCATION_REVIEW_VALIDITY_HOURS),
    )
    allocation_request.save()
    basis_rows = [
        AllocationItem(
            allocation_request=allocation_request,
            name=item.name.strip(),
            effect=item.effect,
            amount=quantize_money(item.amount),
            sort_order=item.sort_order,
            remark=item.remark.strip(),
        )
        for item in items
    ]
    for row in basis_rows:
        row.full_clean()
    AllocationItem.objects.bulk_create(basis_rows)
    share_rows = [
        AllocationShare(
            allocation_request=allocation_request,
            beneficiary_user=users_by_id[share.beneficiary_user_id],
            beneficiary_name_snapshot=user_name_snapshot(users_by_id[share.beneficiary_user_id]),
            weight_bp=share.weight_bp,
            attributed_basis_amount=attributed_amounts[index],
            allocated_amount=allocated_amounts[index],
            sort_order=share.sort_order,
            remark=share.remark.strip(),
        )
        for index, share in enumerate(shares)
    ]
    for row in share_rows:
        row.full_clean()
    AllocationShare.objects.bulk_create(share_rows)
    return allocation_request


def validate_allocation_request_totals(allocation_request: AllocationRequest) -> None:
    basis_total = Decimal("0")
    for item in allocation_request.items.all():
        basis_total += item.amount if item.effect == AllocationItemEffect.INCREASE else -item.amount
    if quantize_money(basis_total) != allocation_request.basis_amount:
        raise ValidationError({"basis_amount": "计算依据明细合计与申请金额不一致。"})
    share_totals = allocation_request.shares.aggregate(weight=Sum("weight_bp"), amount=Sum("allocated_amount"))
    if share_totals["weight"] != 10000:
        raise ValidationError({"shares": "全部受益人权重合计必须等于 10000。"})
    if (share_totals["amount"] or Decimal("0")) > allocation_request.distributable_amount:
        raise ValidationError({"shares": "分配金额合计不能超过可分配金额。"})
    beneficiary_ids = set(allocation_request.shares.values_list("beneficiary_user_id", flat=True))
    current_member_ids = set(
        OrganizationMember.objects.filter(
            organization=allocation_request.organization,
            user_id__in=beneficiary_ids,
            user__is_active=True,
        ).values_list("user_id", flat=True)
    )
    if current_member_ids != beneficiary_ids:
        raise ValidationError({"shares": "受益人必须仍是当前组织成员。"})


def lock_allocation_request(allocation_request_id: int) -> AllocationRequest:
    return AllocationRequest.objects.select_for_update().select_related("organization", "submitted_by").get(pk=allocation_request_id)


def approve_allocation_request_locked(allocation_request: AllocationRequest, *, reviewer, reviewed_at: datetime | None = None) -> AllocationRequest:
    reviewed_at = reviewed_at or timezone.now()
    _require_organization_member(allocation_request.organization, reviewer, "审核人")
    if allocation_request.status == AllocationRequestStatus.APPROVED:
        return allocation_request
    if allocation_request.status != AllocationRequestStatus.PENDING:
        raise AllocationNotPendingException()
    if reviewed_at >= allocation_request.expires_at:
        raise AllocationExpiredException()
    validate_allocation_request_totals(allocation_request)
    shares = list(allocation_request.shares.select_related("beneficiary_user").order_by("sort_order", "pk"))
    entries = [
        AccrualEntry(
            organization=allocation_request.organization,
            beneficiary_user=share.beneficiary_user,
            beneficiary_name_snapshot=share.beneficiary_name_snapshot,
            entry_type=AccrualEntryType.ALLOCATION,
            amount=share.allocated_amount,
            currency=ALLOCATION_CURRENCY,
            effective_at=allocation_request.submitted_at,
            effective_month=effective_month_for(allocation_request.submitted_at),
            allocation_share=share,
            reason="",
            created_by=reviewer,
        )
        for share in shares
        if share.allocated_amount != 0
    ]
    for entry in entries:
        entry.full_clean()
    AccrualEntry.objects.bulk_create(entries)
    allocation_request.status = AllocationRequestStatus.APPROVED
    allocation_request.reviewed_by = reviewer
    allocation_request.reviewed_by_name_snapshot = user_name_snapshot(reviewer)
    allocation_request.reviewed_at = reviewed_at
    allocation_request.rejection_reason = ""
    allocation_request.save(update_fields=("status", "reviewed_by", "reviewed_by_name_snapshot", "reviewed_at", "rejection_reason", "updated_at"))
    return allocation_request


def reject_allocation_request_locked(allocation_request: AllocationRequest, *, reviewer, reason: str, reviewed_at: datetime | None = None) -> AllocationRequest:
    reason = reason.strip()
    if not reason:
        raise AllocationInvalidException("审核不通过时必须填写原因。")
    reviewed_at = reviewed_at or timezone.now()
    _require_organization_member(allocation_request.organization, reviewer, "审核人")
    if allocation_request.status != AllocationRequestStatus.PENDING:
        raise AllocationNotPendingException()
    if reviewed_at >= allocation_request.expires_at:
        raise AllocationExpiredException()
    allocation_request.status = AllocationRequestStatus.REJECTED
    allocation_request.reviewed_by = reviewer
    allocation_request.reviewed_by_name_snapshot = user_name_snapshot(reviewer)
    allocation_request.reviewed_at = reviewed_at
    allocation_request.rejection_reason = reason
    allocation_request.save(update_fields=("status", "reviewed_by", "reviewed_by_name_snapshot", "reviewed_at", "rejection_reason", "updated_at"))
    return allocation_request


def expire_allocation_request_locked(allocation_request: AllocationRequest) -> AllocationRequest:
    if allocation_request.status != AllocationRequestStatus.PENDING:
        return allocation_request
    allocation_request.status = AllocationRequestStatus.EXPIRED
    allocation_request.save(update_fields=("status", "updated_at"))
    return allocation_request


def void_allocation_request_locked(allocation_request: AllocationRequest, *, actor, reason: str, voided_at: datetime | None = None) -> AllocationRequest:
    reason = reason.strip()
    if not reason:
        raise AllocationInvalidException("作废时必须填写原因。")
    if allocation_request.status == AllocationRequestStatus.VOIDED:
        return allocation_request
    if allocation_request.status != AllocationRequestStatus.APPROVED:
        raise AllocationInvalidException("只有已经通过的分配申请可以作废。")
    _require_organization_member(allocation_request.organization, actor, "作废操作人")
    voided_at = voided_at or timezone.now()
    originals = list(
        AccrualEntry.objects.select_for_update()
        .filter(allocation_share__allocation_request=allocation_request, entry_type=AccrualEntryType.ALLOCATION)
        .select_related("beneficiary_user")
        .order_by("pk")
    )
    reversals = []
    for original in originals:
        if hasattr(original, "reversal"):
            continue
        reversals.append(
            AccrualEntry(
                organization=allocation_request.organization,
                beneficiary_user=original.beneficiary_user,
                beneficiary_name_snapshot=original.beneficiary_name_snapshot,
                entry_type=AccrualEntryType.REVERSAL,
                amount=-original.amount,
                currency=original.currency,
                effective_at=voided_at,
                effective_month=effective_month_for(voided_at),
                reversal_of=original,
                reason=reason,
                created_by=actor,
            )
        )
    for reversal in reversals:
        reversal.full_clean()
    AccrualEntry.objects.bulk_create(reversals)
    allocation_request.status = AllocationRequestStatus.VOIDED
    allocation_request.voided_by = actor
    allocation_request.voided_by_name_snapshot = user_name_snapshot(actor)
    allocation_request.voided_at = voided_at
    allocation_request.void_reason = reason
    allocation_request.save(update_fields=("status", "voided_by", "voided_by_name_snapshot", "voided_at", "void_reason", "updated_at"))
    return allocation_request


@transaction.atomic
def create_manual_entry(
    *,
    organization,
    beneficiary_user,
    entry_type: str,
    amount: Decimal,
    reason: str,
    actor,
    effective_at: datetime | None = None,
    effective_month: date | None = None,
) -> AccrualEntry:
    if entry_type not in {AccrualEntryType.MANUAL_INCREASE, AccrualEntryType.MANUAL_DECREASE}:
        raise AllocationInvalidException("人工调整类型必须是人工增加或人工扣减。")
    if not OrganizationMember.objects.filter(organization=organization, user=beneficiary_user).exists():
        raise AllocationInvalidException("受益人不是当前组织成员。")
    _require_organization_member(organization, actor, "操作人")
    reason = reason.strip()
    if not reason:
        raise AllocationInvalidException("人工调整必须填写原因。")
    amount = quantize_money(abs(amount))
    if amount == 0:
        raise AllocationInvalidException("人工调整金额必须大于零。")
    signed_amount = amount if entry_type == AccrualEntryType.MANUAL_INCREASE else -amount
    effective_at = effective_at or timezone.now()
    current_month = effective_month_for(effective_at)
    effective_month = (effective_month or current_month).replace(day=1)
    if effective_month > current_month:
        raise AllocationInvalidException("人工调整不能归属未来月份。")
    entry = AccrualEntry(
        organization=organization,
        beneficiary_user=beneficiary_user,
        beneficiary_name_snapshot=user_name_snapshot(beneficiary_user),
        entry_type=entry_type,
        amount=signed_amount,
        currency=ALLOCATION_CURRENCY,
        effective_at=effective_at,
        effective_month=effective_month,
        reason=reason,
        created_by=actor,
    )
    entry.save()
    return entry
