from __future__ import annotations

from collections import Counter
from dataclasses import dataclass

from django.core.cache import cache
from django.db import transaction
from django.db.models import Prefetch, QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone

from pydantic import ValidationError as PydanticValidationError

from apps.geography.coordinates import make_wgs84_point
from apps.geography.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from apps.geography.schemas import MetroCityImportIn, MetroImportStationIn

METRO_CITY_CACHE_SECONDS = 24 * 60 * 60


class MetroImportError(ValueError):
    pass


@dataclass(frozen=True)
class MetroImportResult:
    city: str
    line_created: int = 0
    line_updated: int = 0
    line_deactivated: int = 0
    station_created: int = 0
    station_updated: int = 0
    station_deactivated: int = 0
    link_created: int = 0
    link_updated: int = 0
    link_deactivated: int = 0


def _city_cache_key(city_name: str) -> str:
    return f"public-metro-city:v1:{city_name}"


def list_metro_cities() -> QuerySet[MetroCity]:
    return (
        MetroCity.objects.filter(
            imported_at__isnull=False,
            lines__is_active=True,
            lines__station_links__is_active=True,
            lines__station_links__station__is_active=True,
        )
        .distinct()
        .order_by("province", "name")
    )


def get_metro_city(city_name: str) -> dict:
    cache_key = _city_cache_key(city_name)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    links = MetroLineStation.objects.filter(is_active=True, station__is_active=True).select_related("station").order_by("sort_order", "station__name")
    lines = MetroLine.objects.filter(is_active=True).order_by("sort_order", "name").prefetch_related(Prefetch("station_links", queryset=links))
    city = get_object_or_404(list_metro_cities().prefetch_related(Prefetch("lines", queryset=lines)), name=city_name)
    result = {
        "name": city.name,
        "province": city.province,
        "data_version": city.data_version,
        "lines": [{"name": line.name, "color": line.color, "stations": [{"name": link.station.name} for link in line.station_links.all()]} for line in city.lines.all()],
    }
    cache.set(cache_key, result, timeout=METRO_CITY_CACHE_SECONDS)
    return result


def _station_identity(station: MetroImportStationIn) -> tuple:
    return (
        tuple(item.strip() for item in station.aliases),
        station.district.strip(),
        station.address.strip(),
        float(station.longitude),
        float(station.latitude),
    )


def _validate_package(payload: MetroCityImportIn) -> None:
    if not payload.data_version.strip():
        raise MetroImportError("数据版本不能为空")
    if not payload.city.name.strip() or not payload.city.province.strip():
        raise MetroImportError("城市名称和省份不能为空")
    if not payload.lines:
        raise MetroImportError("城市地铁数据至少需要一条线路")

    line_names: set[str] = set()
    stations: dict[str, tuple] = {}
    for line in payload.lines:
        line_name = line.name.strip()
        if not line_name:
            raise MetroImportError("线路名称不能为空")
        if line_name in line_names:
            raise MetroImportError(f"城市内线路名称重复：{line_name}")
        if not line.stations:
            raise MetroImportError(f"线路 {line_name} 至少需要一个站点")
        line_names.add(line_name)

        line_station_names: set[str] = set()
        for station in line.stations:
            station_name = station.name.strip()
            if not station_name:
                raise MetroImportError(f"线路 {line_name} 存在空站点名称")
            if station_name in line_station_names:
                raise MetroImportError(f"线路 {line_name} 内站点重复：{station_name}")
            line_station_names.add(station_name)
            identity = _station_identity(station)
            if station_name in stations and stations[station_name] != identity:
                raise MetroImportError(f"换乘站数据不一致：{station_name}")
            stations[station_name] = identity
            try:
                make_wgs84_point(station.longitude, station.latitude, payload.coordinate_system)
            except ValueError as exc:
                raise MetroImportError(f"站点 {station_name} 坐标无效：{exc}") from exc


@transaction.atomic
def import_metro_city(raw_payload: dict) -> MetroImportResult:
    try:
        payload = MetroCityImportIn.model_validate(raw_payload)
    except PydanticValidationError as exc:
        raise MetroImportError(str(exc)) from exc
    _validate_package(payload)

    city, _ = MetroCity.objects.update_or_create(
        name=payload.city.name.strip(),
        defaults={
            "province": payload.city.province.strip(),
            "data_version": payload.data_version.strip(),
        },
    )
    active_line_ids: set[int] = set()
    active_station_ids: set[int] = set()
    active_link_ids: set[int] = set()
    counts: Counter[str] = Counter()
    station_cache: dict[str, MetroStation] = {}

    for line_input in payload.lines:
        line, created = MetroLine.objects.update_or_create(
            city=city,
            name=line_input.name.strip(),
            defaults={
                "color": line_input.color.strip(),
                "sort_order": line_input.sort_order,
                "is_loop": line_input.is_loop,
                "is_active": True,
            },
        )
        counts["line_created" if created else "line_updated"] += 1
        active_line_ids.add(line.pk)

        for station_input in line_input.stations:
            station_name = station_input.name.strip()
            station = station_cache.get(station_name)
            if station is None:
                station, station_created = MetroStation.objects.update_or_create(
                    city=city,
                    name=station_name,
                    defaults={
                        "aliases": station_input.aliases,
                        "district": station_input.district.strip(),
                        "address": station_input.address.strip(),
                        "location": make_wgs84_point(station_input.longitude, station_input.latitude, payload.coordinate_system),
                        "is_active": True,
                    },
                )
                counts["station_created" if station_created else "station_updated"] += 1
                station_cache[station_name] = station
            active_station_ids.add(station.pk)

            link, link_created = MetroLineStation.objects.update_or_create(
                line=line,
                station=station,
                defaults={"sort_order": station_input.sort_order, "is_active": True},
            )
            counts["link_created" if link_created else "link_updated"] += 1
            active_link_ids.add(link.pk)

    counts["link_deactivated"] = MetroLineStation.objects.filter(line__city=city, is_active=True).exclude(pk__in=active_link_ids).update(is_active=False)
    counts["line_deactivated"] = MetroLine.objects.filter(city=city, is_active=True).exclude(pk__in=active_line_ids).update(is_active=False)
    counts["station_deactivated"] = MetroStation.objects.filter(city=city, is_active=True).exclude(pk__in=active_station_ids).update(is_active=False)
    city.imported_at = timezone.now()
    city.save(update_fields=["imported_at", "updated_at"])
    city_name = city.name
    transaction.on_commit(lambda: cache.delete(_city_cache_key(city_name)))
    return MetroImportResult(city=city.name, **counts)
