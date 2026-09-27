"""公开房源列表与通勤候选共用的筛选条件。"""

import hashlib
import json
from decimal import Decimal
from typing import Literal

from django.db.models import Prefetch

from ninja import Schema
from ninja.errors import HttpError

from apps.base.maps.coordinates import make_wgs84_point
from apps.house.geo.queries import NamedGeoOrigin
from apps.house.services import apply_public_house_filters, get_public_houses_queryset
from apps.metro.models import MetroLineStation, MetroStation

ALLOWED_PUBLIC_HOUSE_RADIUS_M = {500, 1000, 1500, 2000}
PUBLIC_HOUSE_METRO_STATION_LIMIT = 5


class PublicHouseSearchFilters(Schema):
    keyword: str | None = None
    province: str | None = None
    city: str | None = None
    district: str | None = None
    subdistrict: str | None = None
    estate_id: int | None = None
    building_id: int | None = None
    min_rent: Decimal | None = None
    max_rent: Decimal | None = None
    min_area: Decimal | None = None
    max_area: Decimal | None = None
    bedrooms: int | None = None
    living_rooms: int | None = None
    decoration: str | None = None
    has_elevator_access: bool | None = None
    tags: list[str] | None = None
    publisher_slug: str | None = None
    metro_stations: list[str] | None = None
    longitude: Decimal | None = None
    latitude: Decimal | None = None
    radius_m: int = 1000
    coordinate_system: Literal["gcj02"] | None = None


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
        raise HttpError(422, "选择地铁站时必须提供完整城市名称")
    if len(names) > PUBLIC_HOUSE_METRO_STATION_LIMIT:
        raise HttpError(422, "最多选择 5 个地铁站")

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
        raise HttpError(422, f"地铁站不存在或已停用：{'、'.join(unknown)}")

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
            raise HttpError(422, "按距离排序时必须提供当前位置")
        return None
    if longitude is None or latitude is None:
        raise HttpError(422, "经度和纬度必须同时提供")
    if coordinate_system != "gcj02":
        raise HttpError(422, "提供当前位置时必须指定 coordinate_system=gcj02")
    if not 100 <= radius_m <= 50000:
        raise HttpError(422, "附近范围必须在 100 到 50000 米之间")
    try:
        return make_wgs84_point(float(longitude), float(latitude), coordinate_system)
    except ValueError as exc:
        raise HttpError(422, str(exc)) from exc


def public_houses_for_filters(filters: PublicHouseSearchFilters, *, sort: str = "latest"):
    if filters.radius_m not in ALLOWED_PUBLIC_HOUSE_RADIUS_M:
        raise HttpError(422, "范围只支持 500、1000、1500、2000 米")
    metro_origins = resolve_metro_origins(city=filters.city, metro_stations=filters.metro_stations)
    if metro_origins and (filters.longitude is not None or filters.latitude is not None):
        raise HttpError(422, "当前位置与地铁站不能同时作为搜索中心")
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
