from __future__ import annotations

import hashlib
import json
from decimal import Decimal
from typing import Literal

from django.core.cache import cache
from django.db.models import Count, F, Max, Min, Prefetch, Q

from apps.geography.coordinates import make_wgs84_point
from apps.geography.models import MetroLineStation, MetroStation
from apps.house.constants import HouseStatus
from apps.house.exceptions import HouseInvalidException
from apps.house.geo.queries import NamedGeoOrigin, annotate_house_distance, apply_named_origins_house_filter, apply_nearby_house_filter
from apps.house.geo.regions import annotate_house_regions
from apps.house.schemas.public import (
    PublicHouseSearchFilters,
)

PUBLIC_HOUSE_REGIONS_CACHE_KEY = "public-house-regions:v2"
PUBLIC_HOUSE_REGIONS_CACHE_SECONDS = 5 * 60


def get_public_houses_queryset():
    """返回可被普通用户全局检索的公开房源。"""
    from apps.house.models import House

    return annotate_house_regions(
        House.objects.filter(
            status=HouseStatus.LISTED,
            is_active=True,
            building__organization__is_active=True,
        )
        .select_related("building__estate", "building__organization")
        .order_by("-updated_at", "-pk")
    )


def _normalize_public_house_region_name(value) -> str:
    if not isinstance(value, str):
        return ""
    normalized = value.strip()
    return "" if not normalized or normalized == "默认" else normalized


def build_public_house_regions(qs) -> dict[str, list[dict]]:
    """从公开房源聚合省、市、区、街道/板块目录，并归并历史数据中的首尾空格。"""
    qs = annotate_house_regions(qs)
    provinces: dict[str, dict] = {}
    rows = (
        qs.order_by()
        .values(
            "region_province",
            "region_city",
            "region_district",
            "region_subdistrict",
        )
        .annotate(house_count=Count("id"))
    )
    for row in rows:
        province = _normalize_public_house_region_name(row["region_province"])
        city = _normalize_public_house_region_name(row["region_city"])
        district = _normalize_public_house_region_name(row["region_district"])
        subdistrict = _normalize_public_house_region_name(row["region_subdistrict"])
        if not province or not city:
            continue

        house_count = row["house_count"]
        province_item = provinces.setdefault(province, {"house_count": 0, "cities": {}})
        province_item["house_count"] += house_count
        city_item = province_item["cities"].setdefault(city, {"house_count": 0, "districts": {}})
        city_item["house_count"] += house_count
        if district:
            district_item = city_item["districts"].setdefault(district, {"house_count": 0, "subdistricts": {}})
            district_item["house_count"] += house_count
            if subdistrict:
                district_item["subdistricts"][subdistrict] = district_item["subdistricts"].get(subdistrict, 0) + house_count

    items = []
    for province, province_item in sorted(provinces.items()):
        cities = []
        for city, city_item in sorted(province_item["cities"].items()):
            cities.append(
                {
                    "city": city,
                    "house_count": city_item["house_count"],
                    "districts": [
                        {
                            "district": district,
                            "house_count": district_item["house_count"],
                            "subdistricts": [
                                {"subdistrict": subdistrict, "house_count": house_count} for subdistrict, house_count in sorted(district_item["subdistricts"].items())
                            ],
                        }
                        for district, district_item in sorted(city_item["districts"].items())
                    ],
                }
            )
        items.append({"province": province, "house_count": province_item["house_count"], "cities": cities})
    return {"items": items}


PUBLIC_HOUSE_SORTS = {
    "latest": ("-updated_at", "-pk"),
    "rent_asc": (F("asking_rent").asc(nulls_last=True), "-pk"),
    "rent_desc": (F("asking_rent").desc(nulls_last=True), "-pk"),
    "area_asc": (F("area").asc(nulls_last=True), "-pk"),
    "area_desc": (F("area").desc(nulls_last=True), "-pk"),
    "distance_asc": ("distance", "pk"),
}


def apply_public_house_filters(
    qs,
    *,
    keyword=None,
    listing_type=None,
    province=None,
    city=None,
    district=None,
    subdistrict=None,
    estate_id=None,
    building_id=None,
    min_rent=None,
    max_rent=None,
    min_area=None,
    max_area=None,
    bedrooms=None,
    bedrooms_min=None,
    living_rooms=None,
    decoration=None,
    has_elevator_access=None,
    tags=None,
    publisher_slug=None,
    origin=None,
    radius_m=1000,
    metro_origins=None,
    sort="latest",
):
    """应用公开房源筛选和排序，供全局检索与动态配房共用。"""
    qs = annotate_house_regions(qs)
    if keyword:
        qs = qs.filter(
            Q(room_number__icontains=keyword)
            | Q(public_description__icontains=keyword)
            | Q(building__name__icontains=keyword)
            | Q(building__address__icontains=keyword)
            | Q(building__estate__name__icontains=keyword)
            | Q(building__estate__display_name__icontains=keyword)
            | Q(region_subdistrict__icontains=keyword)
            | Q(region_district__icontains=keyword)
            | Q(building__organization__name__icontains=keyword)
        )
    if listing_type:
        qs = qs.filter(listing_type=listing_type)
    if province:
        qs = qs.filter(region_province__iexact=province)
    if city:
        qs = qs.filter(region_city__iexact=city)
    if district:
        qs = qs.filter(region_district__iexact=district)
    if subdistrict:
        qs = qs.filter(region_subdistrict__iexact=subdistrict)
    if estate_id is not None:
        qs = qs.filter(building__estate_id=estate_id)
    if building_id is not None:
        qs = qs.filter(building_id=building_id)
    if min_rent is not None:
        qs = qs.filter(asking_rent__gte=min_rent)
    if max_rent is not None:
        qs = qs.filter(asking_rent__lte=max_rent)
    if min_area is not None:
        qs = qs.filter(area__gte=min_area)
    if max_area is not None:
        qs = qs.filter(area__lte=max_area)
    if bedrooms is not None:
        qs = qs.filter(bedrooms=bedrooms)
    if bedrooms_min is not None:
        qs = qs.filter(bedrooms__gte=bedrooms_min)
    if living_rooms is not None:
        qs = qs.filter(living_rooms=living_rooms)
    if decoration:
        qs = qs.filter(decoration=decoration)
    if has_elevator_access is not None:
        qs = qs.filter(has_elevator_access=has_elevator_access)
    for tag in tags or []:
        qs = qs.filter(Q(tags__contains=[tag]) | Q(building__tags__contains=[tag]))
    if publisher_slug:
        qs = qs.filter(building__organization__slug=publisher_slug)
    if origin is not None:
        qs = apply_nearby_house_filter(qs, origin, radius_m)
        qs = annotate_house_distance(qs, origin)
    elif metro_origins:
        qs = apply_named_origins_house_filter(qs, metro_origins, radius_m)
    return qs.order_by(*PUBLIC_HOUSE_SORTS[sort])


def get_public_buildings_queryset():
    """返回至少包含一套公开房源的楼栋。"""
    from apps.house.models import Building

    return (
        Building.objects.filter(
            organization__is_active=True,
            houses__status=HouseStatus.LISTED,
            houses__is_active=True,
        )
        .select_related("estate", "organization")
        .distinct()
        .order_by("estate__name", "name", "pk")
    )


def get_public_estates_queryset():
    """返回至少包含一套公开房源的小区。"""
    from apps.house.models import Estate

    return (
        Estate.objects.filter(
            organization__is_active=True,
            buildings__houses__status=HouseStatus.LISTED,
            buildings__houses__is_active=True,
        )
        .select_related("organization")
        .distinct()
        .order_by("name", "pk")
    )


ALLOWED_PUBLIC_HOUSE_RADIUS_M = {500, 1000, 1500, 2000}


PUBLIC_HOUSE_METRO_STATION_LIMIT = 5


def filter_signature(filters: PublicHouseSearchFilters) -> str:
    values = filters.model_dump(mode="json", exclude_none=True, exclude_defaults=True)
    if values.get("tags"):
        values["tags"] = sorted(set(values["tags"]))
    if values.get("metro_stations"):
        values["metro_stations"] = sorted(set(values["metro_stations"]))
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def resolve_metro_origins(*, city: str | None, metro_stations: list[str] | None) -> list[NamedGeoOrigin]:
    names = list(dict.fromkeys(value.strip() for value in metro_stations or [] if value.strip()))
    if not names:
        return []
    if not city:
        raise HouseInvalidException("选择地铁站时必须提供完整城市名称")
    if len(names) > PUBLIC_HOUSE_METRO_STATION_LIMIT:
        raise HouseInvalidException("最多选择 5 个地铁站")

    active_links = MetroLineStation.objects.filter(is_active=True, line__is_active=True).select_related("line")
    stations = list(
        MetroStation.objects.filter(
            city__name=city,
            city__imported_at__isnull=False,
            name__in=names,
            is_active=True,
            line_links__is_active=True,
            line_links__line__is_active=True,
        )
        .prefetch_related(Prefetch("line_links", queryset=active_links))
        .distinct()
    )
    stations_by_name = {station.name: station for station in stations}
    unknown = [name for name in names if name not in stations_by_name]
    if unknown:
        raise HouseInvalidException(f"地铁站不存在或已停用：{'、'.join(unknown)}")

    return [
        NamedGeoOrigin(
            name=name,
            location=stations_by_name[name].location,
            line_names=tuple(sorted({link.line.name for link in stations_by_name[name].line_links.all()})),
        )
        for name in names
    ]


def resolve_nearby_origin(
    *,
    longitude: Decimal | None,
    latitude: Decimal | None,
    radius_m: int,
    coordinate_system: Literal["gcj02"] | None,
    require_for_distance: bool = False,
):
    if longitude is None and latitude is None:
        if require_for_distance:
            raise HouseInvalidException("按距离排序时必须提供当前位置")
        return None
    if longitude is None or latitude is None:
        raise HouseInvalidException("经度和纬度必须同时提供")
    if coordinate_system != "gcj02":
        raise HouseInvalidException("提供当前位置时必须指定 coordinate_system=gcj02")
    if not 100 <= radius_m <= 50000:
        raise HouseInvalidException("附近范围必须在 100 到 50000 米之间")
    try:
        return make_wgs84_point(float(longitude), float(latitude), coordinate_system)
    except ValueError as exc:
        raise HouseInvalidException(str(exc)) from exc


def public_houses_for_filters(filters: PublicHouseSearchFilters, *, sort: str = "latest"):
    if filters.radius_m not in ALLOWED_PUBLIC_HOUSE_RADIUS_M:
        raise HouseInvalidException("范围只支持 500、1000、1500、2000 米")
    metro_origins = resolve_metro_origins(city=filters.city, metro_stations=filters.metro_stations)
    if metro_origins and (filters.longitude is not None or filters.latitude is not None):
        raise HouseInvalidException("当前位置与地铁站不能同时作为搜索中心")
    origin = resolve_nearby_origin(
        longitude=filters.longitude,
        latitude=filters.latitude,
        radius_m=filters.radius_m,
        coordinate_system=filters.coordinate_system,
        require_for_distance=sort == "distance_asc" and not metro_origins,
    )
    return apply_public_house_filters(
        get_public_houses_queryset(),
        **filters.model_dump(exclude={"metro_stations", "longitude", "latitude", "coordinate_system", "radius_m"}),
        origin=origin,
        radius_m=filters.radius_m,
        metro_origins=metro_origins,
        sort=sort,
    )


def get_public_house_regions():
    cached = cache.get(PUBLIC_HOUSE_REGIONS_CACHE_KEY)
    if cached is not None:
        return cached
    result = build_public_house_regions(get_public_houses_queryset())
    cache.set(PUBLIC_HOUSE_REGIONS_CACHE_KEY, result, timeout=PUBLIC_HOUSE_REGIONS_CACHE_SECONDS)
    return result


def get_public_house_filters():
    qs = get_public_houses_queryset()
    amounts = qs.aggregate(
        rent_min=Min("asking_rent"),
        rent_max=Max("asking_rent"),
        area_min=Min("area"),
        area_max=Max("area"),
    )
    tag_values: set[str] = set()
    for house_tags, building_tags in qs.values_list("tags", "building__tags"):
        tag_values.update(tag for tag in [*(building_tags or []), *(house_tags or [])] if isinstance(tag, str) and tag.strip())
    return {
        **amounts,
        "provinces": list(qs.exclude(region_province="").values_list("region_province", flat=True).distinct().order_by("region_province")),
        "cities": list(qs.exclude(region_city="").values_list("region_city", flat=True).distinct().order_by("region_city")),
        "districts": list(qs.exclude(region_district="").values_list("region_district", flat=True).distinct().order_by("region_district")),
        "bedrooms": list(qs.exclude(bedrooms__isnull=True).values_list("bedrooms", flat=True).distinct().order_by("bedrooms")),
        "living_rooms": list(qs.exclude(living_rooms__isnull=True).values_list("living_rooms", flat=True).distinct().order_by("living_rooms")),
        "tags": sorted(tag_values),
    }


def get_public_house_suggestions(*, keyword, city, longitude=None, latitude=None, radius_m=1000, coordinate_system=None, listing_type=None, bedrooms=None, bedrooms_min=None):
    term = keyword.strip()[:40]
    if not term and longitude is None and latitude is None:
        return []
    if (longitude is not None or latitude is not None) and radius_m not in ALLOWED_PUBLIC_HOUSE_RADIUS_M:
        raise HouseInvalidException("范围只支持 500、1000、1500、2000 米")
    origin = resolve_nearby_origin(longitude=longitude, latitude=latitude, radius_m=radius_m, coordinate_system=coordinate_system)
    houses = get_public_houses_queryset().order_by()
    if origin is not None:
        houses = apply_nearby_house_filter(houses, origin, radius_m)
    elif city:
        houses = houses.filter(region_city__iexact=city.strip())
    if listing_type:
        houses = houses.filter(listing_type=listing_type)
    if bedrooms is not None:
        houses = houses.filter(bedrooms=bedrooms)
    if bedrooms_min is not None:
        houses = houses.filter(bedrooms__gte=bedrooms_min)

    groups = [
        ("小区", "building__estate__display_name", Q(building__estate__display_name__icontains=term) | Q(building__estate__name__icontains=term), "building__estate__address"),
        ("商圈", "region_subdistrict", Q(region_subdistrict__icontains=term), None),
        ("区域", "region_district", Q(region_district__icontains=term), None),
    ]
    groups.extend(
        [
            ("楼栋", "building__name", Q(building__name__icontains=term), "building__address"),
            ("房号", "room_number", Q(room_number__icontains=term), "building__address"),
        ]
    )

    suggestions = []
    seen = set()
    for category, field, condition, address_field in groups:
        rows = houses.filter(condition) if term else houses
        rows = (
            rows.exclude(**{f"{field}__isnull": True})
            .exclude(**{field: ""})
            .values(field)
            .annotate(house_count=Count("pk"), **({"address": Min(address_field)} if address_field else {}))
            .order_by("-house_count", field)[:6]
        )
        for row in rows:
            value = row[field].strip()
            if not value or value in seen:
                continue
            suggestions.append({"keyword": value, "category": category, "house_count": row["house_count"], "address": row.get("address") or ""})
            seen.add(value)
            if len(suggestions) == 10:
                return suggestions
    return suggestions
