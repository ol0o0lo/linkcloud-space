from __future__ import annotations

import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction

import requests

from apps.house.constants import EstatePropertyType, HouseDecoration, HouseOrientation, HouseStatus
from apps.house.geo.coordinates import make_wgs84_point
from apps.house.models import Building, Estate, House
from apps.metro.importer import import_metro_city
from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from apps.organizations.models import Organization

AMAP_GUANGZHOU_METRO_URL = "https://map.amap.com/service/subway?srhdata=4401_drw_guangzhou.json"
DEMO_ORGANIZATION_SLUG = "housing-ui-demo"


class GuangzhouReferenceDataError(RuntimeError):
    pass


@dataclass(frozen=True)
class DistrictSeed:
    name: str
    adcode: str
    longitude: float
    latitude: float
    subdistricts: tuple[str, ...]


@dataclass(frozen=True)
class GuangzhouUiSeedResult:
    organization_slug: str
    data_version: str
    metro_lines: int
    metro_stations: int
    metro_links: int
    districts: int
    estates: int
    buildings: int
    houses: int


# 广州市现行 11 个市辖区；名称、行政区划代码和中心点来自高德行政区域接口（2026-09 快照）。
GUANGZHOU_DISTRICTS = (
    DistrictSeed("荔湾区", "440103", 113.218998, 23.107123, ("陈家祠", "芳村")),
    DistrictSeed("越秀区", "440104", 113.267065, 23.128673, ("北京路", "淘金")),
    DistrictSeed("海珠区", "440105", 113.317412, 23.084003, ("客村", "江南西")),
    DistrictSeed("天河区", "440106", 113.361597, 23.124817, ("珠江新城", "天河北", "车陂")),
    DistrictSeed("白云区", "440111", 113.273200, 23.157159, ("白云新城", "嘉禾望岗")),
    DistrictSeed("黄埔区", "440112", 113.480613, 23.181355, ("科学城", "知识城")),
    DistrictSeed("番禺区", "440113", 113.383917, 22.937560, ("万博", "市桥")),
    DistrictSeed("花都区", "440114", 113.220125, 23.404326, ("花都新区", "狮岭")),
    DistrictSeed("南沙区", "440115", 113.525178, 22.801435, ("金洲", "蕉门")),
    DistrictSeed("从化区", "440117", 113.586329, 23.549150, ("街口", "温泉")),
    DistrictSeed("增城区", "440118", 113.810734, 23.261452, ("新塘", "荔城")),
)


def fetch_amap_guangzhou_metro_payload() -> dict:
    try:
        response = requests.get(AMAP_GUANGZHOU_METRO_URL, timeout=20)
        response.raise_for_status()
        payload = response.json()
    except (requests.RequestException, ValueError) as exc:
        raise GuangzhouReferenceDataError("广州地铁数据获取失败") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("l"), list) or not payload["l"]:
        raise GuangzhouReferenceDataError("广州地铁数据格式无效")
    return payload


def _normalized_line_name(raw_name: str, station_names: list[str], duplicate_counts: Counter) -> str:
    if duplicate_counts[raw_name] == 1:
        return raw_name
    if raw_name == "3号线":
        return "3号线北延段" if "机场北(T2)" in station_names else "3号线"
    if raw_name == "12号线":
        return "12号线西段" if "广州体育馆" in station_names else "12号线东段"
    return f"{raw_name}（{station_names[0]}—{station_names[-1]}）"


def build_metro_import_payload(source: dict) -> dict:
    source_lines = source.get("l")
    if not isinstance(source_lines, list) or not source_lines:
        raise GuangzhouReferenceDataError("广州地铁线路为空")

    raw_names = [str(line.get("ln") or "").strip() for line in source_lines]
    if any(not name for name in raw_names):
        raise GuangzhouReferenceDataError("广州地铁存在无名称线路")
    duplicate_counts = Counter(raw_names)
    canonical_stations: dict[str, tuple[float, float]] = {}
    for source_line in source_lines:
        for source_station in source_line.get("st") or []:
            name = str(source_station.get("n") or "").strip()
            coordinate = str(source_station.get("sl") or "").strip()
            if not name or "," not in coordinate:
                raise GuangzhouReferenceDataError("广州地铁存在无名称或无坐标站点")
            try:
                longitude, latitude = (float(value) for value in coordinate.split(",", maxsplit=1))
            except ValueError as exc:
                raise GuangzhouReferenceDataError(f"广州地铁站点坐标无效：{name}") from exc
            canonical_stations.setdefault(name, (longitude, latitude))

    lines = []
    for line_order, source_line in enumerate(source_lines, start=1):
        source_stations = source_line.get("st") or []
        station_names = [str(item.get("n") or "").strip() for item in source_stations]
        if not station_names:
            raise GuangzhouReferenceDataError(f"广州地铁线路无站点：{raw_names[line_order - 1]}")
        lines.append(
            {
                "name": _normalized_line_name(raw_names[line_order - 1], station_names, duplicate_counts),
                "color": f"#{str(source_line.get('cl') or '').strip().lstrip('#')}",
                "sort_order": line_order,
                "is_loop": False,
                "stations": [
                    {
                        "name": station_name,
                        "aliases": [],
                        "district": "",
                        "address": "",
                        "longitude": canonical_stations[station_name][0],
                        "latitude": canonical_stations[station_name][1],
                        "sort_order": station_order,
                    }
                    for station_order, station_name in enumerate(station_names, start=1)
                ],
            }
        )

    snapshot = json.dumps(source, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return {
        "schema_version": 1,
        "data_version": f"amap-{hashlib.sha256(snapshot).hexdigest()[:12]}",
        "coordinate_system": "gcj02",
        "city": {"name": "广州市", "province": "广东省"},
        "lines": lines,
    }


def _resolve_demo_organization() -> Organization:
    organization = Organization.objects.filter(slug=DEMO_ORGANIZATION_SLUG).first()
    if organization is not None:
        return organization
    organization = Organization.objects.filter(slug="demo-space", is_active=True).first() or Organization.objects.filter(is_active=True).order_by("pk").first()
    if organization is not None:
        return organization
    return Organization.objects.create(
        slug=DEMO_ORGANIZATION_SLUG,
        name="找房 UI 验收数据",
        description="用于检查公开找房区域、地铁和筛选组件完整性的开发演示数据。",
        is_active=True,
    )


def _seed_district_houses() -> tuple[str, int, int, int, int]:
    organization = _resolve_demo_organization()
    estate_ids: set[int] = set()
    building_ids: set[int] = set()
    house_ids: set[int] = set()
    layouts = ((1, 0), (1, 1), (2, 1), (3, 2))
    orientations = (HouseOrientation.SOUTH, HouseOrientation.EAST, HouseOrientation.SOUTH_NORTH, HouseOrientation.WEST)
    decorations = (HouseDecoration.SIMPLE, HouseDecoration.FINE, HouseDecoration.LUXURY)

    for district_index, seed in enumerate(GUANGZHOU_DISTRICTS):
        for subdistrict_index, subdistrict in enumerate(seed.subdistricts):
            location = make_wgs84_point(seed.longitude + subdistrict_index * 0.003, seed.latitude + subdistrict_index * 0.002, "gcj02")
            estate, _ = Estate.objects.update_or_create(
                organization=organization,
                name=f"UI验收·{seed.name}·{subdistrict}",
                defaults={
                    "display_name": f"{subdistrict} UI 验收小区",
                    "property_type": EstatePropertyType.RESIDENTIAL,
                    "province": "广东省",
                    "city": "广州市",
                    "district": seed.name,
                    "subdistrict": subdistrict,
                    "address": f"{subdistrict}示范路",
                    "location": location,
                    "description": f"用于展示广州市{seed.name}{subdistrict}板块筛选项的 UI 验收记录。",
                },
            )
            estate_ids.add(estate.pk)
            building, _ = Building.objects.update_or_create(
                estate=estate,
                name="验收 1 栋",
                defaults={
                    "organization": organization,
                    "floors": 28,
                    "under_floors": 2,
                    "year_built": 2020 + district_index % 5,
                    "elevator": (district_index + subdistrict_index) % 2 == 0,
                    "location": location,
                    "address": f"{subdistrict}示范路 1 号",
                    "tags": ["近地铁", "拎包入住"] if district_index % 2 == 0 else ["采光好", "配套成熟"],
                },
            )
            building_ids.add(building.pk)

            for room_index in range(2):
                layout_index = (district_index + subdistrict_index + room_index) % len(layouts)
                bedrooms, living_rooms = layouts[layout_index]
                room_number = f"UI-{seed.adcode}-{subdistrict_index + 1:02d}-{room_index + 1:02d}"
                asking_rent = Decimal(2200 + district_index * 320 + subdistrict_index * 260 + room_index * 950)
                area = Decimal(28 + district_index * 3 + subdistrict_index * 2 + room_index * 24)
                house, _ = House.objects.update_or_create(
                    building=building,
                    room_number=room_number,
                    defaults={
                        "floor": 6 + district_index + room_index * 8,
                        "area": area,
                        "interior_area": area - Decimal("4.50"),
                        "asking_rent": asking_rent,
                        "deposit_amount": asking_rent,
                        "bedrooms": bedrooms,
                        "living_rooms": living_rooms,
                        "bathrooms": 1 if bedrooms < 3 else 2,
                        "kitchens": 1,
                        "balconies": room_index,
                        "orientation": orientations[layout_index],
                        "decoration": decorations[(district_index + subdistrict_index + room_index) % len(decorations)],
                        "has_elevator_access": building.elevator,
                        "status": HouseStatus.LISTED,
                        "tags": [seed.name.removesuffix("区"), subdistrict, "UI验收", "近地铁"],
                        "public_description": f"广州市{seed.name}{subdistrict}筛选 UI 验收房源。",
                        "internal_notes": "开发环境 UI 验收数据，可重复执行命令更新。",
                        "extra": {"source": "housing-ui-demo", "district_adcode": seed.adcode, "subdistrict": subdistrict},
                    },
                )
                house_ids.add(house.pk)

    return organization.slug, len(GUANGZHOU_DISTRICTS), len(estate_ids), len(building_ids), len(house_ids)


def seed_guangzhou_ui_data(source: dict | None = None) -> GuangzhouUiSeedResult:
    import_payload = build_metro_import_payload(source or fetch_amap_guangzhou_metro_payload())
    with transaction.atomic():
        import_metro_city(import_payload)
        organization_slug, districts, estates, buildings, houses = _seed_district_houses()
        city = MetroCity.objects.get(name="广州市")
        result = GuangzhouUiSeedResult(
            organization_slug=organization_slug,
            data_version=city.data_version,
            metro_lines=MetroLine.objects.filter(city=city, is_active=True).count(),
            metro_stations=MetroStation.objects.filter(city=city, is_active=True).count(),
            metro_links=MetroLineStation.objects.filter(line__city=city, is_active=True, station__is_active=True).count(),
            districts=districts,
            estates=estates,
            buildings=buildings,
            houses=houses,
        )
        transaction.on_commit(lambda: cache.delete_many([f"public-metro-city:v1:{city.name}", "public-house-regions:v1", "public-house-regions:v2"]))
        return result
