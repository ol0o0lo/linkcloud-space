from __future__ import annotations

import re
from datetime import timedelta

from django.db.models import BooleanField, Case, Count, DateTimeField, ExpressionWrapper, F, IntegerField, Q, Value, When
from django.shortcuts import get_object_or_404
from django.utils import timezone

from apps.house.constants import HouseStatus
from apps.house.exceptions import HouseInvalidException
from apps.house.geo.regions import annotate_house_regions
from apps.house.models import Building, Estate, House
from apps.house.queries.ordering import apply_house_ordering
from apps.house.queries.responsibilities import filter_responsible_houses
from apps.house.schemas.properties import (
    HouseScope,
)
from apps.house.services.settings import get_org_inspection_max_age_days
from apps.organizations.models import OrganizationMember


def natural_room_sort_key(room_number: str) -> tuple[tuple[int, int | str], ...]:
    """将房号分段，确保 2 排在 10 前、A2 排在 A10 前。"""
    return tuple((0, int(part)) if part.isdigit() else (1, part.casefold()) for part in re.split(r"(\d+)", room_number) if part)


def sort_houses_for_building(houses):
    return sorted(houses, key=lambda house: (house.floor is None, house.floor or 0, natural_room_sort_key(house.room_number), house.pk))


def building_map_counts(houses) -> dict[str, int]:
    """统计已传入的有效房源，地图筛选不应改变该汇总。"""
    houses = [house for house in houses if house.is_active]
    return {
        "total": len(houses),
        "paused": sum(house.status == HouseStatus.PAUSED for house in houses),
        "listed": sum(house.status == HouseStatus.LISTED for house in houses),
        "rented": sum(house.status == HouseStatus.RENTED for house in houses),
    }


def inventory_annotations(house_lookup: str, scope_filter: Q | None = None):
    active_houses = Q(**{f"{house_lookup}__is_active": True})
    if scope_filter is not None:
        active_houses &= scope_filter
    return {
        "inventory_total": Count(house_lookup, filter=active_houses, distinct=True),
        "inventory_paused": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.PAUSED}), distinct=True),
        "inventory_listed": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.LISTED}), distinct=True),
        "inventory_rented": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENTED}), distinct=True),
    }


def houses_in_scope(org, user, scope: HouseScope | None):
    qs = House.objects.filter(building__organization=org)
    if scope == "mine":
        member = get_object_or_404(OrganizationMember, organization=org, user=user)
        qs = filter_responsible_houses(qs, org, member.pk)
    return qs


def get_house_in_org(house_id: int, org):
    return get_object_or_404(House.objects.select_related("building__estate", "landlord"), pk=house_id, building__organization=org)


def annotate_house_inspection_state(qs, org):
    max_age_days = get_org_inspection_max_age_days(org)
    cutoff = timezone.now() - timedelta(days=max_age_days)
    return qs.annotate(
        inspection_due_at=ExpressionWrapper(F("updated_at") + timedelta(days=max_age_days), output_field=DateTimeField()),
        inspection_max_age_days=Value(max_age_days, output_field=IntegerField()),
        inspection_expired=Case(
            When(updated_at__lt=cutoff, then=Value(True)),
            default=Value(False),
            output_field=BooleanField(),
        ),
    )


def list_estates(*, org, user, keyword, scope):
    scoped_houses = houses_in_scope(org, user, scope)
    scope_filter = Q(buildings__houses__in=scoped_houses) if scope == "mine" else None
    qs = (
        Estate.objects.filter(organization=org)
        .annotate(
            building_count=Count("buildings", filter=scope_filter, distinct=True),
            **inventory_annotations("buildings__houses", scope_filter),
        )
        .order_by("name", "id")
    )
    if scope == "mine":
        qs = qs.filter(buildings__houses__in=scoped_houses).distinct()
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(display_name__icontains=keyword))
    return qs


def get_estate(*, org, estate_id):
    return get_object_or_404(
        Estate.objects.filter(pk=estate_id, organization=org).annotate(
            building_count=Count("buildings", distinct=True),
            **inventory_annotations("buildings__houses"),
        ),
    )


def list_buildings(*, org, user, estate_id, keyword, scope):
    scoped_houses = houses_in_scope(org, user, scope)
    scope_filter = Q(houses__in=scoped_houses) if scope == "mine" else None
    qs = Building.objects.filter(organization=org).select_related("estate").annotate(**inventory_annotations("houses", scope_filter)).order_by("estate__name", "name")
    if scope == "mine":
        qs = qs.filter(houses__in=scoped_houses).distinct()
    if estate_id:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword) | Q(estate__name__icontains=keyword) | Q(estate__display_name__icontains=keyword))
    return qs


def get_building(*, org, building_id):
    return get_object_or_404(Building.objects.select_related("estate").annotate(**inventory_annotations("houses")), pk=building_id, organization=org)


def list_houses(
    *,
    org,
    user,
    estate_id,
    building_id,
    responsible_member_id,
    scope,
    inspection_due,
    inspection_reason,
    status,
    keyword,
    ordering,
    min_rent=None,
    max_rent=None,
    bedrooms=None,
    district=None,
    is_active=None,
):
    if scope == "mine" and responsible_member_id is not None:
        raise HouseInvalidException("scope=mine 与 responsible_member_id 不能同时使用")
    qs = House.objects.filter(building__organization=org).select_related("building__estate", "landlord")
    if estate_id:
        qs = qs.filter(building__estate_id=estate_id)
    if building_id:
        qs = qs.filter(building_id=building_id)
    if responsible_member_id is not None:
        member = get_object_or_404(OrganizationMember, pk=responsible_member_id, organization=org)
        qs = filter_responsible_houses(qs, org, member.pk)
    if scope == "mine":
        member = get_object_or_404(OrganizationMember, organization=org, user=user)
        qs = filter_responsible_houses(qs, org, member.pk)
    if inspection_due or inspection_reason:
        qs = annotate_house_inspection_state(qs, org)
    if inspection_due:
        qs = qs.filter(Q(images=[]) | Q(videos=[]) | Q(inspection_expired=True))
    if inspection_reason == "missing_images":
        qs = qs.filter(images=[])
    elif inspection_reason == "missing_videos":
        qs = qs.filter(videos=[])
    elif inspection_reason == "expired":
        qs = qs.filter(inspection_expired=True)
    if status:
        qs = qs.filter(status=status)
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    if min_rent is not None:
        qs = qs.filter(asking_rent__gte=min_rent)
    if max_rent is not None:
        qs = qs.filter(asking_rent__lte=max_rent)
    if bedrooms is not None:
        qs = qs.filter(bedrooms=bedrooms)
    if district:
        qs = annotate_house_regions(qs).filter(region_district__iexact=district)
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(landlord__name__icontains=keyword)
            | Q(landlord__phone__icontains=keyword)
        )
    return apply_house_ordering(qs, ordering)
