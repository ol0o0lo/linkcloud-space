from __future__ import annotations

from decimal import Decimal
from typing import Literal

from django.contrib.gis.db.models import GeometryField
from django.contrib.gis.db.models.aggregates import Collect
from django.contrib.gis.db.models.functions import Centroid
from django.db.models import Case, CharField, Count, Exists, Min, OuterRef, Q, Subquery, Value, When
from django.db.models.functions import Cast
from django.shortcuts import get_object_or_404

from apps.geography.coordinates import convert_viewport_to_wgs84, serialize_point
from apps.house.constants import HouseStatus
from apps.house.exceptions import HouseInvalidException
from apps.house.geo.queries import apply_nearby_house_filter, filter_by_viewport
from apps.house.models import Building, Estate, House
from apps.house.queries.properties import building_map_counts, sort_houses_for_building
from apps.house.queries.public import apply_public_house_filters, get_public_houses_queryset
from apps.house.queries.public import resolve_nearby_origin as _resolve_nearby_origin


def _public_house_map_level(zoom: int) -> Literal["city", "district", "estate", "building"]:
    if zoom <= 7:
        return "city"
    if zoom <= 10:
        return "district"
    if zoom <= 14:
        return "estate"
    return "building"


def _public_house_map_coordinates(qs, level: Literal["city", "district", "estate", "building"]):
    geometry_field = GeometryField(srid=4326)
    building_geometry = Cast("building__location", output_field=geometry_field)
    if level != "estate":
        return qs.annotate(map_geometry=building_geometry)
    return qs.annotate(
        map_geometry=Case(
            When(building__estate__location__isnull=False, then=Cast("building__estate__location", output_field=geometry_field)),
            default=building_geometry,
            output_field=geometry_field,
        )
    )


def _public_house_map_rows(qs, level: Literal["city", "district", "estate", "building"]):
    common_annotations = {
        "map_location": Centroid(Collect("map_geometry")),
        "house_count": Count("id", distinct=True),
        "min_rent": Min("asking_rent"),
    }
    if level == "city":
        return (
            qs.exclude(region_city="")
            .values("region_province", "region_city")
            .annotate(child_count=Count("region_district", distinct=True), **common_annotations)
            .order_by("-house_count", "region_city")
        )
    if level == "district":
        return (
            qs.exclude(region_district="")
            .values("region_province", "region_city", "region_district")
            .annotate(
                child_count=Count("building__estate_id", distinct=True) + Count("building_id", filter=Q(building__estate_id__isnull=True), distinct=True),
                **common_annotations,
            )
            .order_by("-house_count", "region_district")
        )
    if level == "estate":
        return (
            qs.filter(building__estate_id__isnull=False)
            .values(
                "building__estate_id",
                "building__estate__display_name",
                "building__estate__name",
                "building__estate__address",
                "region_city",
                "region_district",
            )
            .annotate(child_count=Count("building_id", distinct=True), **common_annotations)
            .order_by("-house_count", "building__estate__display_name", "building__estate__name")
        )
    return (
        qs.filter(building__location__isnull=False)
        .values(
            "building_id",
            "building__estate_id",
            "building__name",
            "building__address",
            "region_city",
            "region_district",
        )
        .annotate(child_count=Count("id", distinct=True), **common_annotations)
        .order_by("-house_count", "building__name")
    )


def _serialize_public_house_map_marker(row, level: Literal["city", "district", "estate", "building"]):
    city = row.get("region_city") or ""
    district = row.get("region_district") or ""
    if level == "city":
        name = city
        address = row.get("region_province") or ""
        key = f"city:{address}:{city}"
        target_zoom = 9
    elif level == "district":
        name = district
        address = " · ".join(part for part in (city, district) if part)
        key = f"district:{city}:{district}"
        target_zoom = 12
    elif level == "estate":
        name = row.get("building__estate__display_name") or row.get("building__estate__name") or "未命名小区"
        address = row.get("building__estate__address") or ""
        key = f"estate:{row['building__estate_id']}"
        target_zoom = 15
    else:
        name = row.get("building__name") or "未命名楼栋"
        address = row.get("building__address") or ""
        key = f"building:{row['building_id']}"
        target_zoom = 17
    return {
        "key": key,
        "level": level,
        "name": name,
        "address": address,
        "location": serialize_point(row["map_location"]),
        "house_count": row["house_count"],
        "child_count": row["child_count"],
        "min_rent": row["min_rent"],
        "target_zoom": target_zoom,
        "city": city,
        "district": district,
        "estate_id": row.get("building__estate_id"),
        "building_id": row.get("building_id"),
    }


def _building_map_queryset(org, *, house_status: str | None, located: bool = True):
    qs = Building.objects.filter(organization=org).select_related("estate")
    qs = qs.filter(location__isnull=False) if located else qs.filter(location__isnull=True)
    if house_status:
        qs = qs.filter(Exists(House.objects.filter(building_id=OuterRef("pk"), status=house_status, is_active=True)))
    return qs.annotate(
        **_map_count_annotations("houses", Q(houses__is_active=True)),
    )


def _filter_building_map_queryset(qs, *, keyword: str | None, estate_id: int | None):
    if estate_id is not None:
        qs = qs.filter(estate_id=estate_id)
    if keyword:
        qs = qs.filter(
            Q(name__icontains=keyword)
            | Q(address__icontains=keyword)
            | Q(estate__name__icontains=keyword)
            | Q(estate__display_name__icontains=keyword)
            | Q(estate__address__icontains=keyword)
        )
    return qs


def _map_count_annotations(house_lookup: str, active_houses: Q):
    return {
        "total": Count(house_lookup, filter=active_houses, distinct=True),
        "paused": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.PAUSED}), distinct=True),
        "listed": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.LISTED}), distinct=True),
        "rented": Count(house_lookup, filter=active_houses & Q(**{f"{house_lookup}__status": HouseStatus.RENTED}), distinct=True),
    }


def _validate_map_bounds(*, west: Decimal | None, south: Decimal | None, east: Decimal | None, north: Decimal | None) -> None:
    bounds = (west, south, east, north)
    if not any(value is not None for value in bounds):
        return
    if west is None or south is None or east is None or north is None or west >= east or south >= north:
        raise HouseInvalidException("地图范围无效")


def _estate_map_queryset(org, *, keyword: str | None, estate_id: int | None, house_status: str | None):
    eligible_buildings = Building.objects.filter(organization=org, estate_id=OuterRef("pk"))

    geometry_field = GeometryField(srid=4326)
    located_buildings = eligible_buildings.filter(location__isnull=False)
    building_centroid = located_buildings.order_by().values("estate_id").annotate(point=Centroid(Collect(Cast("location", output_field=geometry_field)))).values("point")

    qs = Estate.objects.filter(organization=org).filter(Exists(eligible_buildings))
    if estate_id is not None:
        qs = qs.filter(pk=estate_id)
    if keyword:
        keyword_buildings = eligible_buildings.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword))
        qs = qs.filter(Q(name__icontains=keyword) | Q(display_name__icontains=keyword) | Q(address__icontains=keyword) | Exists(keyword_buildings))
    if house_status:
        matching_houses = House.objects.filter(
            building__organization=org,
            building__estate_id=OuterRef("pk"),
            status=house_status,
            is_active=True,
        )
        qs = qs.filter(Exists(matching_houses))

    eligible_building_filter = Q(buildings__pk__isnull=False)
    active_houses = eligible_building_filter & Q(buildings__houses__is_active=True)
    qs = qs.annotate(
        map_location=Case(
            When(location__isnull=False, then=Cast("location", output_field=geometry_field)),
            default=Subquery(building_centroid[:1], output_field=geometry_field),
            output_field=geometry_field,
        ),
        location_source=Case(
            When(location__isnull=False, then=Value("estate")),
            default=Value("building_centroid"),
            output_field=CharField(),
        ),
        building_count=Count("buildings", filter=eligible_building_filter, distinct=True),
        located_building_count=Count(
            "buildings",
            filter=eligible_building_filter & Q(buildings__location__isnull=False),
            distinct=True,
        ),
        unlocated_building_count=Count(
            "buildings",
            filter=eligible_building_filter & Q(buildings__location__isnull=True),
            distinct=True,
        ),
        **_map_count_annotations("buildings__houses", active_houses),
    ).filter(map_location__isnull=False)
    return qs


def list_estate_map(*, org, keyword, estate_id, house_status, west, south, east, north, coordinate_system):
    _validate_map_bounds(west=west, south=south, east=east, north=north)
    qs = _estate_map_queryset(org, keyword=keyword, estate_id=estate_id, house_status=house_status)
    if west is not None:
        viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        qs = filter_by_viewport(qs, "map_location", viewport)
    return qs.order_by("display_name", "id")


def list_building_map(*, org, keyword, estate_id, house_status, standalone_only, west, south, east, north, coordinate_system):
    _validate_map_bounds(west=west, south=south, east=east, north=north)

    qs = _building_map_queryset(org, house_status=house_status)
    qs = _filter_building_map_queryset(qs, keyword=keyword, estate_id=estate_id)
    if standalone_only:
        qs = qs.filter(estate__isnull=True)
    if west is not None:
        viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        qs = filter_by_viewport(qs, "location", viewport)
    return qs.order_by("name", "id")


def list_building_map_unlocated(*, org, keyword, estate_id, house_status):
    qs = _building_map_queryset(org, house_status=house_status, located=False)
    return _filter_building_map_queryset(qs, keyword=keyword, estate_id=estate_id).order_by("name", "id")


def get_building_map_unlocated_count(*, org):
    return {"count": Building.objects.filter(organization=org, location__isnull=True).count()}


def get_building_map_detail(*, org, building_id):
    building = get_object_or_404(Building.objects.select_related("estate"), pk=building_id, organization=org)
    houses = sort_houses_for_building(building.houses.filter(is_active=True))
    return {
        "id": building.pk,
        "estate_id": building.estate_id,
        "estate": building.estate,
        "name": building.name,
        **{field: getattr(building, field) for field in ("province", "city", "district", "subdistrict")},
        "floors": building.floors,
        "under_floors": building.under_floors,
        "year_built": building.year_built,
        "elevator": building.elevator,
        "location": serialize_point(building.location),
        "address": building.address,
        "images": building.images_resolved,
        "tags": building.tags,
        "counts": building_map_counts(houses),
        "houses": [
            {
                "id": house.pk,
                "room_number": house.room_number,
                "floor": house.floor,
                "area": house.area,
                "asking_rent": house.asking_rent,
                "status": house.status,
                "status__mapping": HouseStatus.get_choice_label(house.status),
                "is_active": house.is_active,
            }
            for house in houses
        ],
    }


def list_public_house_map(
    *, zoom, west, south, east, north, keyword, listing_type, bedrooms, bedrooms_min, province, city, district, subdistrict, longitude, latitude, radius_m, coordinate_system
):
    if zoom < 3 or zoom > 20:
        raise HouseInvalidException("地图缩放级别无效")
    _validate_map_bounds(west=west, south=south, east=east, north=north)

    origin = _resolve_nearby_origin(
        longitude=longitude,
        latitude=latitude,
        radius_m=radius_m,
        coordinate_system=coordinate_system,
    )
    filtered = apply_public_house_filters(
        get_public_houses_queryset(),
        keyword=keyword,
        listing_type=listing_type,
        bedrooms=bedrooms,
        bedrooms_min=bedrooms_min,
        province=province,
        city=city,
        district=district,
        subdistrict=subdistrict,
        sort="rent_asc",
    ).order_by()
    level = _public_house_map_level(zoom)
    unlocated_house_count = filtered.filter(building__location__isnull=True).count()
    located = filtered.filter(building__location__isnull=False)
    if origin is not None:
        located = apply_nearby_house_filter(located, origin, radius_m)
    if west is not None:
        try:
            viewport = convert_viewport_to_wgs84(float(west), float(south), float(east), float(north), coordinate_system)
        except ValueError as exc:
            raise HouseInvalidException(str(exc)) from exc
        located = filter_by_viewport(located, "building__location", viewport)

    visible_house_count = located.count()
    coordinates = _public_house_map_coordinates(located, level)
    rows = list(_public_house_map_rows(coordinates, level)[: PUBLIC_HOUSE_MAP_MAX_MARKERS + 1])
    items = [_serialize_public_house_map_marker(row, level) for row in rows]
    if level == "estate":
        standalone_rows = _public_house_map_rows(coordinates.filter(building__estate_id__isnull=True), "building")[: PUBLIC_HOUSE_MAP_MAX_MARKERS + 1]
        items.extend(_serialize_public_house_map_marker(row, "building") for row in standalone_rows)
        items.sort(key=lambda item: (-item["house_count"], item["key"]))
    truncated = len(items) > PUBLIC_HOUSE_MAP_MAX_MARKERS
    items = items[:PUBLIC_HOUSE_MAP_MAX_MARKERS]
    return {
        "level": level,
        "zoom": zoom,
        "visible_house_count": visible_house_count,
        "marker_count": len(items),
        "unlocated_house_count": unlocated_house_count,
        "truncated": truncated,
        "items": items,
    }


PUBLIC_HOUSE_MAP_MAX_MARKERS = 200
