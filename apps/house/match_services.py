from __future__ import annotations

import secrets

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Case, F, IntegerField, When
from django.http import Http404
from django.utils import timezone

from pydantic import ValidationError as PydanticValidationError

from apps.house.constants import HouseMatchMode, HouseStatus
from apps.house.match_schemas import HouseMatchCriteriaIn
from apps.house.models import House, HouseMatchShare
from apps.house.services import apply_public_house_filters, get_public_houses_queryset
from apps.organizations.models import OrganizationMember

HOUSE_MATCH_CRITERIA_VERSION = 1
HOUSE_MATCH_SHARE_KEY_BYTES = 24
HOUSE_MATCH_SHARE_KEY_RETRIES = 5


class UnsupportedHouseMatchCriteria(Exception):
    pass


def build_house_match_share_url(share_key: str) -> str:
    return f"{settings.SITE_URL.rstrip('/')}/h5/#/pages/house-match/index?key={share_key}"


def _normalize_house_ids(values: list[int]) -> list[int]:
    normalized: list[int] = []
    seen: set[int] = set()
    for value in values:
        if isinstance(value, bool):
            raise ValidationError({"house_ids": "房源 ID 必须是正整数。"})
        try:
            house_id = int(value)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"house_ids": "房源 ID 必须是正整数。"}) from exc
        if house_id <= 0:
            raise ValidationError({"house_ids": "房源 ID 必须是正整数。"})
        if house_id not in seen:
            seen.add(house_id)
            normalized.append(house_id)
    if not 1 <= len(normalized) <= 100:
        raise ValidationError({"house_ids": "手工配房必须选择 1 至 100 套房源。"})
    return normalized


def _create_share_with_unique_key(**values) -> HouseMatchShare:
    for _attempt in range(HOUSE_MATCH_SHARE_KEY_RETRIES):
        try:
            with transaction.atomic():
                return HouseMatchShare.objects.create(share_key=secrets.token_urlsafe(HOUSE_MATCH_SHARE_KEY_BYTES), **values)
        except IntegrityError:
            continue
    raise RuntimeError("生成配房链接失败，请重试。")


def create_house_match_share(*, organization, consultant, payload) -> HouseMatchShare:
    if not OrganizationMember.objects.filter(organization=organization, user=consultant).exists():
        raise ValidationError("当前用户已不属于所选组织。")

    house_ids: list[int] = []
    criteria: dict = {}
    if payload.mode == HouseMatchMode.MANUAL:
        house_ids = _normalize_house_ids(payload.house_ids)
        valid_count = House.objects.filter(
            pk__in=house_ids,
            building__organization=organization,
            status=HouseStatus.LISTED,
        ).count()
        if valid_count != len(house_ids):
            raise ValidationError({"house_ids": "所选房源必须全部属于当前组织且处于招租状态。"})
    else:
        criteria = payload.criteria.to_storage()

    return _create_share_with_unique_key(
        organization=organization,
        consultant=consultant,
        title=payload.title,
        remark=payload.remark,
        mode=payload.mode,
        house_ids=house_ids,
        criteria=criteria,
        criteria_version=HOUSE_MATCH_CRITERIA_VERSION,
        expires_at=payload.expires_at,
        created_by=consultant.username,
    )


def get_owned_house_match_share(*, organization, consultant, share_id: int, for_update: bool = False) -> HouseMatchShare:
    queryset = HouseMatchShare.objects.filter(organization=organization, consultant=consultant)
    if for_update:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=share_id)
    except HouseMatchShare.DoesNotExist as exc:
        raise Http404 from exc


@transaction.atomic
def extend_house_match_share(*, organization, consultant, share_id: int, expires_at) -> HouseMatchShare:
    share = get_owned_house_match_share(organization=organization, consultant=consultant, share_id=share_id, for_update=True)
    if share.revoked_at is not None:
        raise ValidationError("已失效的配房链接不能延期。")
    if share.expires_at is None:
        raise ValidationError("永不过期的配房链接无需延期。")
    if expires_at <= share.expires_at:
        raise ValidationError("新的到期时间必须晚于原到期时间。")
    share.expires_at = expires_at
    share.updated_by = consultant.username
    share.save(update_fields=["expires_at", "updated_by", "updated_at"])
    return share


@transaction.atomic
def revoke_house_match_share(*, organization, consultant, share_id: int) -> HouseMatchShare:
    share = get_owned_house_match_share(organization=organization, consultant=consultant, share_id=share_id, for_update=True)
    if share.revoked_at is None:
        share.revoked_at = timezone.now()
        share.updated_by = consultant.username
        share.save(update_fields=["revoked_at", "updated_by", "updated_at"])
    return share


def get_public_house_match_share(share_key: str) -> HouseMatchShare:
    try:
        share = HouseMatchShare.objects.select_related("organization", "consultant").get(share_key=share_key)
    except HouseMatchShare.DoesNotExist as exc:
        raise Http404 from exc
    if not share.organization.is_active:
        raise Http404
    if share.revoked_at is not None:
        raise HouseMatchShareExpired
    if share.expires_at is not None and share.expires_at <= timezone.now():
        raise HouseMatchShareExpired
    if share.mode == HouseMatchMode.DYNAMIC:
        _parse_share_criteria(share)
    return share


class HouseMatchShareExpired(Exception):
    pass


def record_house_match_share_access(share: HouseMatchShare) -> None:
    accessed_at = timezone.now()
    HouseMatchShare.objects.filter(pk=share.pk).update(view_count=F("view_count") + 1, last_accessed_at=accessed_at)
    share.view_count += 1
    share.last_accessed_at = accessed_at


def get_public_consultant(share: HouseMatchShare) -> dict | None:
    consultant = share.consultant
    if consultant is None or not consultant.is_active:
        return None
    if not OrganizationMember.objects.filter(organization=share.organization, user=consultant).exists():
        return None
    return {
        "id": consultant.pk,
        "name": consultant.get_full_name().strip() or consultant.username,
        "avatar_url": consultant.avatar_url,
        "phone": consultant.phone if consultant.phone_verified else None,
    }


def _parse_share_criteria(share: HouseMatchShare) -> HouseMatchCriteriaIn:
    if share.criteria_version != HOUSE_MATCH_CRITERIA_VERSION:
        raise UnsupportedHouseMatchCriteria
    try:
        criteria = HouseMatchCriteriaIn.model_validate(share.criteria)
    except PydanticValidationError as exc:
        raise UnsupportedHouseMatchCriteria from exc
    if not criteria.has_filter():
        raise UnsupportedHouseMatchCriteria
    return criteria


def get_public_house_match_queryset(share: HouseMatchShare):
    qs = get_public_houses_queryset().filter(building__organization=share.organization)
    if share.mode == HouseMatchMode.MANUAL:
        house_ids: list[int] = []
        for value in share.house_ids if isinstance(share.house_ids, list) else []:
            if isinstance(value, bool):
                continue
            try:
                house_id = int(value)
            except (TypeError, ValueError):
                continue
            if house_id > 0 and house_id not in house_ids:
                house_ids.append(house_id)
        ordering = Case(
            *(When(pk=house_id, then=position) for position, house_id in enumerate(house_ids)),
            default=len(house_ids),
            output_field=IntegerField(),
        )
        return qs.filter(pk__in=house_ids).order_by(ordering)
    criteria = _parse_share_criteria(share)
    return apply_public_house_filters(qs, **criteria.model_dump(exclude_none=True))


def get_public_house_match_house(share: HouseMatchShare, house_id: int) -> House:
    try:
        return get_public_house_match_queryset(share).get(pk=house_id)
    except House.DoesNotExist as exc:
        raise Http404 from exc
