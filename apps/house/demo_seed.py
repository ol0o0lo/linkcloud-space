from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.contrib.gis.geos import Point
from django.utils import timezone

from apps.house.constants import EstatePropertyType, HouseDecoration, HouseOrientation, HouseStatus
from apps.house.models import Building, Estate, House
from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from apps.organizations.models import Organization

DEMO_ORGANIZATION_SLUG = "housing-ui-demo"
DEMO_METRO_DATA_VERSION = "ui-demo-2026-09"


@dataclass(frozen=True)
class DistrictSeed:
    district: str
    estate_name: str
    address: str
    longitude: float
    latitude: float


@dataclass(frozen=True)
class MetroLineSeed:
    name: str
    color: str
    stations: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class HousingUiDemoResult:
    organization_slug: str
    metro_lines: int
    metro_stations: int
    metro_links: int
    districts: int
    estates: int
    buildings: int
    houses: int


DISTRICT_SEEDS = (
    DistrictSeed("荔湾区", "西关悦府", "中山八路 8 号", 113.2443, 23.1259),
    DistrictSeed("越秀区", "东山雅居", "东华东路 16 号", 113.2807, 23.1246),
    DistrictSeed("海珠区", "滨江映月", "新港中路 18 号", 113.3172, 23.0833),
    DistrictSeed("天河区", "天河云庭", "天河北路 28 号", 113.3612, 23.1247),
    DistrictSeed("白云区", "云山里", "云城西路 36 号", 113.2732, 23.1579),
    DistrictSeed("黄埔区", "科学城花园", "科学大道 46 号", 113.4805, 23.1819),
    DistrictSeed("番禺区", "番禺星汇", "清河东路 56 号", 113.3842, 22.9350),
    DistrictSeed("花都区", "花城芳华", "迎宾大道 66 号", 113.2202, 23.4042),
    DistrictSeed("南沙区", "蕉门水岸", "凤凰大道 76 号", 113.5252, 22.8016),
    DistrictSeed("从化区", "流溪雅苑", "从城大道 86 号", 113.5874, 23.5453),
    DistrictSeed("增城区", "荔城新境", "荔景大道 96 号", 113.8109, 23.2612),
)

DISTRICT_CENTERS = {seed.district: (seed.longitude, seed.latitude) for seed in DISTRICT_SEEDS}

METRO_LINE_SEEDS = (
    MetroLineSeed(
        "1号线",
        "#F3D03E",
        (
            ("西塱", "荔湾区"),
            ("坑口", "荔湾区"),
            ("花地湾", "荔湾区"),
            ("芳村", "荔湾区"),
            ("黄沙", "荔湾区"),
            ("长寿路", "荔湾区"),
            ("陈家祠", "荔湾区"),
            ("西门口", "越秀区"),
            ("公园前", "越秀区"),
            ("农讲所", "越秀区"),
            ("烈士陵园", "越秀区"),
            ("东山口", "越秀区"),
            ("杨箕", "越秀区"),
            ("体育西路", "天河区"),
            ("体育中心", "天河区"),
            ("广州东站", "天河区"),
        ),
    ),
    MetroLineSeed(
        "2号线",
        "#00629B",
        (
            ("嘉禾望岗", "白云区"),
            ("黄边", "白云区"),
            ("江夏", "白云区"),
            ("萧岗", "白云区"),
            ("白云文化广场", "白云区"),
            ("白云公园", "白云区"),
            ("飞翔公园", "白云区"),
            ("三元里", "白云区"),
            ("广州火车站", "越秀区"),
            ("越秀公园", "越秀区"),
            ("纪念堂", "越秀区"),
            ("公园前", "越秀区"),
            ("海珠广场", "越秀区"),
            ("市二宫", "海珠区"),
            ("江南西", "海珠区"),
            ("昌岗", "海珠区"),
            ("江泰路", "海珠区"),
            ("东晓南", "海珠区"),
            ("南洲", "海珠区"),
            ("洛溪", "番禺区"),
            ("南浦", "番禺区"),
            ("会江", "番禺区"),
            ("石壁", "番禺区"),
            ("广州南站", "番禺区"),
        ),
    ),
    MetroLineSeed(
        "3号线",
        "#ECA154",
        (
            ("番禺广场", "番禺区"),
            ("市桥", "番禺区"),
            ("汉溪长隆", "番禺区"),
            ("大石", "番禺区"),
            ("厦滘", "番禺区"),
            ("沥滘", "海珠区"),
            ("大塘", "海珠区"),
            ("客村", "海珠区"),
            ("广州塔", "海珠区"),
            ("珠江新城", "天河区"),
            ("体育西路", "天河区"),
            ("石牌桥", "天河区"),
            ("岗顶", "天河区"),
            ("华师", "天河区"),
            ("五山", "天河区"),
            ("天河客运站", "天河区"),
        ),
    ),
    MetroLineSeed(
        "4号线",
        "#00843D",
        (
            ("黄村", "天河区"),
            ("车陂", "天河区"),
            ("车陂南", "天河区"),
            ("万胜围", "海珠区"),
            ("官洲", "海珠区"),
            ("大学城北", "番禺区"),
            ("大学城南", "番禺区"),
            ("新造", "番禺区"),
            ("石碁", "番禺区"),
            ("海傍", "番禺区"),
            ("低涌", "南沙区"),
            ("东涌", "南沙区"),
            ("黄阁汽车城", "南沙区"),
            ("黄阁", "南沙区"),
            ("蕉门", "南沙区"),
            ("金洲", "南沙区"),
            ("飞沙角", "南沙区"),
            ("广隆", "南沙区"),
            ("大涌", "南沙区"),
            ("塘坑", "南沙区"),
            ("南横", "南沙区"),
            ("南沙客运港", "南沙区"),
        ),
    ),
    MetroLineSeed(
        "5号线",
        "#C5003E",
        (
            ("滘口", "荔湾区"),
            ("坦尾", "荔湾区"),
            ("中山八", "荔湾区"),
            ("西场", "荔湾区"),
            ("西村", "荔湾区"),
            ("广州火车站", "越秀区"),
            ("小北", "越秀区"),
            ("淘金", "越秀区"),
            ("区庄", "越秀区"),
            ("动物园", "越秀区"),
            ("杨箕", "越秀区"),
            ("五羊邨", "越秀区"),
            ("珠江新城", "天河区"),
            ("猎德", "天河区"),
            ("潭村", "天河区"),
            ("员村", "天河区"),
            ("科韵路", "天河区"),
            ("车陂南", "天河区"),
            ("东圃", "天河区"),
            ("三溪", "黄埔区"),
            ("鱼珠", "黄埔区"),
            ("大沙地", "黄埔区"),
            ("大沙东", "黄埔区"),
            ("文冲", "黄埔区"),
        ),
    ),
    MetroLineSeed(
        "6号线",
        "#80225F",
        (
            ("浔峰岗", "白云区"),
            ("横沙", "白云区"),
            ("沙贝", "白云区"),
            ("河沙", "荔湾区"),
            ("坦尾", "荔湾区"),
            ("如意坊", "荔湾区"),
            ("黄沙", "荔湾区"),
            ("文化公园", "荔湾区"),
            ("一德路", "越秀区"),
            ("海珠广场", "越秀区"),
            ("北京路", "越秀区"),
            ("团一大广场", "越秀区"),
            ("东湖", "越秀区"),
            ("东山口", "越秀区"),
            ("区庄", "越秀区"),
            ("黄花岗", "越秀区"),
            ("沙河顶", "天河区"),
            ("天平架", "天河区"),
            ("燕塘", "天河区"),
            ("天河客运站", "天河区"),
            ("长湴", "天河区"),
            ("植物园", "天河区"),
            ("龙洞", "天河区"),
            ("柯木塱", "天河区"),
            ("高塘石", "天河区"),
            ("黄陂", "黄埔区"),
            ("金峰", "黄埔区"),
            ("暹岗", "黄埔区"),
            ("苏元", "黄埔区"),
            ("萝岗", "黄埔区"),
            ("香雪", "黄埔区"),
        ),
    ),
    MetroLineSeed(
        "8号线",
        "#00A6B2",
        (
            ("滘心", "白云区"),
            ("亭岗", "白云区"),
            ("石井", "白云区"),
            ("小坪", "白云区"),
            ("石潭", "白云区"),
            ("聚龙", "白云区"),
            ("上步", "白云区"),
            ("同德", "白云区"),
            ("鹅掌坦", "白云区"),
            ("西村", "荔湾区"),
            ("彩虹桥", "荔湾区"),
            ("陈家祠", "荔湾区"),
            ("华林寺", "荔湾区"),
            ("文化公园", "荔湾区"),
            ("同福西", "海珠区"),
            ("凤凰新村", "海珠区"),
            ("沙园", "海珠区"),
            ("宝岗大道", "海珠区"),
            ("昌岗", "海珠区"),
            ("晓港", "海珠区"),
            ("中大", "海珠区"),
            ("鹭江", "海珠区"),
            ("客村", "海珠区"),
            ("赤岗", "海珠区"),
            ("磨碟沙", "海珠区"),
            ("新港东", "海珠区"),
            ("琶洲", "海珠区"),
            ("万胜围", "海珠区"),
        ),
    ),
    MetroLineSeed(
        "9号线",
        "#71CC98",
        (
            ("飞鹅岭", "花都区"),
            ("花都汽车城", "花都区"),
            ("广州北站", "花都区"),
            ("花城路", "花都区"),
            ("花果山公园", "花都区"),
            ("花都广场", "花都区"),
            ("马鞍山公园", "花都区"),
            ("莲塘", "花都区"),
            ("清㘵", "花都区"),
            ("清塘", "花都区"),
            ("高增", "白云区"),
        ),
    ),
    MetroLineSeed(
        "14号线",
        "#81312F",
        (
            ("嘉禾望岗", "白云区"),
            ("白云东平", "白云区"),
            ("夏良", "白云区"),
            ("太和", "白云区"),
            ("竹料", "白云区"),
            ("钟落潭", "白云区"),
            ("马沥", "白云区"),
            ("新和", "白云区"),
            ("太平", "从化区"),
            ("神岗", "从化区"),
            ("赤草", "从化区"),
            ("从化客运站", "从化区"),
            ("东风", "从化区"),
        ),
    ),
    MetroLineSeed(
        "18号线",
        "#004B87",
        (
            ("冼村", "天河区"),
            ("磨碟沙", "海珠区"),
            ("龙潭", "海珠区"),
            ("沙溪", "番禺区"),
            ("南村万博", "番禺区"),
            ("番禺广场", "番禺区"),
            ("横沥", "南沙区"),
            ("万顷沙", "南沙区"),
        ),
    ),
    MetroLineSeed(
        "21号线",
        "#201747",
        (
            ("员村", "天河区"),
            ("天河公园", "天河区"),
            ("棠东", "天河区"),
            ("黄村", "天河区"),
            ("大观南路", "天河区"),
            ("天河智慧城", "天河区"),
            ("神舟路", "黄埔区"),
            ("科学城", "黄埔区"),
            ("苏元", "黄埔区"),
            ("水西", "黄埔区"),
            ("长平", "黄埔区"),
            ("金坑", "黄埔区"),
            ("镇龙西", "黄埔区"),
            ("镇龙", "黄埔区"),
            ("中新", "增城区"),
            ("坑贝", "增城区"),
            ("凤岗", "增城区"),
            ("朱村", "增城区"),
            ("山田", "增城区"),
            ("钟岗", "增城区"),
            ("增城广场", "增城区"),
        ),
    ),
)


def _station_point(name: str, district: str) -> Point:
    longitude, latitude = DISTRICT_CENTERS[district]
    checksum = sum((index + 1) * ord(character) for index, character in enumerate(name))
    longitude_offset = ((checksum % 9) - 4) * 0.0012
    latitude_offset = (((checksum // 9) % 9) - 4) * 0.0009
    return Point(longitude + longitude_offset, latitude + latitude_offset, srid=4326)


def _seed_metro() -> tuple[MetroCity, int, int, int]:
    city, _ = MetroCity.objects.update_or_create(
        name="广州市",
        defaults={
            "province": "广东省",
            "data_version": DEMO_METRO_DATA_VERSION,
            "imported_at": timezone.now(),
        },
    )
    station_ids: set[int] = set()
    link_ids: set[int] = set()
    line_ids: set[int] = set()

    for line_order, line_seed in enumerate(METRO_LINE_SEEDS, start=1):
        line, _ = MetroLine.objects.update_or_create(
            city=city,
            name=line_seed.name,
            defaults={
                "color": line_seed.color,
                "sort_order": line_order,
                "is_loop": False,
                "is_active": True,
            },
        )
        line_ids.add(line.pk)
        for station_order, (station_name, district) in enumerate(line_seed.stations, start=1):
            station, _ = MetroStation.objects.update_or_create(
                city=city,
                name=station_name,
                defaults={
                    "aliases": [],
                    "district": district,
                    "address": f"{district}{station_name}地铁站（UI 验收数据）",
                    "location": _station_point(station_name, district),
                    "is_active": True,
                },
            )
            station_ids.add(station.pk)
            link, _ = MetroLineStation.objects.update_or_create(
                line=line,
                station=station,
                defaults={"sort_order": station_order, "is_active": True},
            )
            link_ids.add(link.pk)

    city.data_version = DEMO_METRO_DATA_VERSION
    city.imported_at = timezone.now()
    city.save(update_fields=["data_version", "imported_at", "updated_at"])
    return city, len(line_ids), len(station_ids), len(link_ids)


def _seed_houses() -> tuple[str, int, int, int, int]:
    organization = Organization.objects.filter(slug=DEMO_ORGANIZATION_SLUG).first()
    if organization is None:
        organization = Organization.objects.filter(slug="demo-space", is_active=True).first() or Organization.objects.filter(is_active=True).order_by("pk").first()
    if organization is None:
        organization = Organization.objects.create(
            slug=DEMO_ORGANIZATION_SLUG,
            name="找房 UI 验收数据",
            description="用于检查公开找房区域、地铁和筛选组件完整性的开发演示数据。",
            is_active=True,
        )
    estate_ids: set[int] = set()
    building_ids: set[int] = set()
    house_ids: set[int] = set()
    districts: set[str] = set()
    layouts = ((1, 0), (1, 1), (2, 1), (3, 2))
    orientations = (HouseOrientation.SOUTH, HouseOrientation.EAST, HouseOrientation.SOUTH_NORTH, HouseOrientation.WEST)
    decorations = (HouseDecoration.SIMPLE, HouseDecoration.FINE, HouseDecoration.LUXURY)

    for district_index, seed in enumerate(DISTRICT_SEEDS):
        districts.add(seed.district)
        estate, _ = Estate.objects.update_or_create(
            organization=organization,
            name=f"UI验收·{seed.estate_name}",
            defaults={
                "display_name": seed.estate_name,
                "property_type": EstatePropertyType.RESIDENTIAL,
                "province": "广东省",
                "city": "广州市",
                "district": seed.district,
                "address": seed.address,
                "location": Point(seed.longitude, seed.latitude, srid=4326),
                "description": f"{seed.district}公开找房筛选 UI 验收小区。",
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
                "elevator": district_index % 2 == 0,
                "location": Point(seed.longitude + 0.0005, seed.latitude + 0.0004, srid=4326),
                "address": seed.address,
                "tags": ["近地铁", "拎包入住"] if district_index % 2 == 0 else ["采光好", "配套成熟"],
            },
        )
        building_ids.add(building.pk)

        for room_index in range(2):
            layout_index = (district_index + room_index) % len(layouts)
            bedrooms, living_rooms = layouts[layout_index]
            room_number = f"UI-{district_index + 1:02d}-{room_index + 1:02d}"
            asking_rent = Decimal(2200 + district_index * 320 + room_index * 950)
            area = Decimal(28 + district_index * 3 + room_index * 24)
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
                    "decoration": decorations[(district_index + room_index) % len(decorations)],
                    "has_elevator_access": building.elevator,
                    "status": HouseStatus.LISTED,
                    "tags": [seed.district.removesuffix("区"), "UI验收", "近地铁"],
                    "public_description": f"{seed.district}{seed.estate_name}演示房源，用于检查找房筛选与列表展示。",
                    "internal_notes": "开发环境 UI 验收数据，可重复执行命令更新。",
                    "extra": {"source": "housing-ui-demo"},
                },
            )
            house_ids.add(house.pk)

    return organization.slug, len(districts), len(estate_ids), len(building_ids), len(house_ids)


def seed_housing_ui_demo_data() -> HousingUiDemoResult:
    from apps.house.guangzhou_seed import seed_guangzhou_ui_data

    result = seed_guangzhou_ui_data()
    return HousingUiDemoResult(
        organization_slug=result.organization_slug,
        metro_lines=result.metro_lines,
        metro_stations=result.metro_stations,
        metro_links=result.metro_links,
        districts=result.districts,
        estates=result.estates,
        buildings=result.buildings,
        houses=result.houses,
    )
