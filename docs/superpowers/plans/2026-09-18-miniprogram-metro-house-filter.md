# 小程序地铁找房筛选 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为公开房源增加可按城市导入的地铁主数据、多站点半径查询，以及从房源列表顶部筛选栏向下展开的区域 / 地铁三级筛选 UI。

**Architecture:** 新增独立 `apps.metro` 维护城市、线路、站点和线路站点关系，使用城市整包事务导入并提供只读公开目录。公开房源沿用楼栋 PostGIS 坐标，按当前位置或最多 5 个地铁站实时计算最短距离；小程序扩展现有地区 Store，将区域、地铁、附近三种状态统一转换为互斥的请求参数。区域 / 地铁采用锚定顶部筛选栏的下拉覆盖层，不使用底部抽屉，三级列宽为 `1:3:6`。

**Tech Stack:** Django 5、django-ninja、PostgreSQL/PostGIS、pytest、uni-app、Vue 3、Pinia、Wot UI v2、Node test runner、TypeScript。

---

## 文件结构

### 后端新增

- `apps/metro/__init__.py`：地铁应用包。
- `apps/metro/apps.py`：Django 应用配置。
- `apps/metro/models.py`：城市、线路、站点、线路站点关联模型。
- `apps/metro/schemas.py`：导入契约与公开 API 响应结构。
- `apps/metro/importer.py`：城市整包校验、原子写入、停用旧数据和缓存失效。
- `apps/metro/api.py`：公开城市目录与城市线路站点详情。
- `apps/metro/management/commands/import_metro_city.py`：JSON 文件导入命令。
- `apps/metro/migrations/0001_initial.py`：模型初始迁移。
- `tests/metro/test_models.py`：模型约束测试。
- `tests/metro/test_importer.py`：换乘站、坐标冲突、回滚和停用测试。
- `tests/metro/test_public_api.py`：公开目录响应与缓存测试。

### 后端修改

- `config/settings/_base.py`：注册 `apps.metro`。
- `config/api.py`：挂载 `/api/public/metro/`。
- `apps/house/geo/coordinates.py`：允许导入边界接收 `wgs84`，保留现有 `gcj02` 行为。
- `apps/house/geo/queries.py`：增加多空间中心 OR 筛选、最短距离和最近站点标注。
- `apps/house/services.py`：公开房源筛选接受地铁站空间中心。
- `apps/house/api.py`：增加 `metro_stations` 参数及三种空间模式校验。
- `apps/house/schemas.py`：返回 `nearest_metro_station`。
- `tests/house/test_public_api.py`：覆盖多站点、去重、最近站点和参数冲突。

### 小程序新增

- `frontend_miniprogram/src/domain/public-house-metro.ts`：地铁选择、半径档位、去重和请求参数纯函数。
- `frontend_miniprogram/src/services/manual/metro.ts`：公开地铁目录请求适配器。
- `frontend_miniprogram/src/features/houses/components/PublicHouseLocationDropdown.vue`：从顶部筛选栏向下展开的 `1:3:6` 区域 / 地铁筛选层。
- `frontend_miniprogram/tests/public-house-metro.test.ts`：选择上限、跨线路去重、城市联动和请求参数测试。
- `frontend_miniprogram/tests/public-house-location-dropdown.test.ts`：顶部下拉结构的静态约束测试。

### 小程序修改

- `frontend_miniprogram/src/store/public-house-region.ts`：持久化地铁选择与统一半径，生成互斥空间请求参数。
- `frontend_miniprogram/src/services/manual/houses.ts`：补充地铁请求参数和最近站点响应类型。
- `frontend_miniprogram/src/features/houses/service.ts`：导出地铁相关类型和请求方法。
- `frontend_miniprogram/src/domain/house-card.ts`：生成“距某站”文案。
- `frontend_miniprogram/src/pages/houses/index.vue`：接入顶部下拉层、独立附近条件和距离排序。
- `frontend_miniprogram/src/pages/index/index.vue`：附近默认半径统一为 1000 米。
- `frontend_miniprogram/src/pages-housing/map/index.vue`：附近半径档位统一为 500/1000/1500/2000 米。
- `frontend_miniprogram/tests/house.test.ts`：房源卡地铁距离文案测试。
- `frontend_miniprogram/src/services/openapi/*`：通过生成命令更新，不手工编辑。

> 项目约束要求未获明确授权时不执行 Git 操作，因此下列任务以测试通过作为完成边界；如用户另行要求提交，再按任务边界分别提交。

### Task 1: 建立地铁领域模型与应用注册

**Files:**
- Create: `apps/metro/__init__.py`
- Create: `apps/metro/apps.py`
- Create: `apps/metro/models.py`
- Create: `apps/metro/migrations/0001_initial.py`
- Modify: `config/settings/_base.py`
- Test: `tests/metro/test_models.py`

- [ ] **Step 1: 写模型约束失败测试**

```python
from django.contrib.gis.geos import Point
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation


class MetroModelTestCase(TestCase):
    def test_city_line_and_station_names_are_unique_inside_city(self):
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
        MetroLine.objects.create(city=city, name="1号线", sort_order=1)
        MetroStation.objects.create(city=city, name="世界之窗", location=Point(113.97, 22.53, srid=4326))

        with self.assertRaises(ValidationError):
            MetroLine(city=city, name="1号线", sort_order=2).full_clean()
        with self.assertRaises(ValidationError):
            MetroStation(city=city, name="世界之窗", location=Point(113.98, 22.54, srid=4326)).full_clean()

    def test_line_station_requires_same_city(self):
        shenzhen = MetroCity.objects.create(name="深圳市", province="广东省", data_version="1")
        guangzhou = MetroCity.objects.create(name="广州市", province="广东省", data_version="1")
        line = MetroLine.objects.create(city=shenzhen, name="1号线", sort_order=1)
        station = MetroStation.objects.create(city=guangzhou, name="公园前", location=Point(113.26, 23.13, srid=4326))

        with self.assertRaises(ValidationError):
            MetroLineStation(line=line, station=station, sort_order=1).full_clean()
```

- [ ] **Step 2: 运行测试确认应用尚不存在**

Run: `docker compose exec web pytest tests/metro/test_models.py -q`

Expected: FAIL，提示 `No module named 'apps.metro'`。

- [ ] **Step 3: 创建应用和模型**

`apps/metro/apps.py`：

```python
from django.apps import AppConfig


class MetroConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.metro"
    verbose_name = "地铁数据"
```

`apps/metro/models.py`：

```python
from django.contrib.gis.db import models
from django.core.exceptions import ValidationError

from apps.base.mixins import CreateUpdateTimeModelMixin


class MetroCity(CreateUpdateTimeModelMixin):
    name = models.CharField(max_length=64, unique=True, verbose_name="城市名称")
    province = models.CharField(max_length=64, verbose_name="省份")
    data_version = models.CharField(max_length=64, verbose_name="数据版本")
    imported_at = models.DateTimeField(null=True, blank=True, verbose_name="最近导入时间")

    class Meta:
        ordering = ["province", "name"]
        verbose_name = "地铁城市"
        verbose_name_plural = "地铁城市"

    def __str__(self):
        return self.name


class MetroLine(CreateUpdateTimeModelMixin):
    city = models.ForeignKey(MetroCity, on_delete=models.PROTECT, related_name="lines", verbose_name="城市")
    name = models.CharField(max_length=64, verbose_name="线路名称")
    color = models.CharField(max_length=16, blank=True, default="", verbose_name="线路颜色")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="排序")
    is_loop = models.BooleanField(default=False, verbose_name="是否环线")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")
    stations = models.ManyToManyField("MetroStation", through="MetroLineStation", related_name="lines")

    class Meta:
        ordering = ["sort_order", "name", "pk"]
        constraints = [models.UniqueConstraint(fields=["city", "name"], name="metro_line_city_name_unique")]

    def __str__(self):
        return f"{self.city.name} {self.name}"


class MetroStation(CreateUpdateTimeModelMixin):
    city = models.ForeignKey(MetroCity, on_delete=models.PROTECT, related_name="stations", verbose_name="城市")
    name = models.CharField(max_length=64, verbose_name="站点名称")
    aliases = models.JSONField(default=list, blank=True, verbose_name="别名")
    district = models.CharField(max_length=64, blank=True, default="", verbose_name="行政区")
    address = models.CharField(max_length=255, blank=True, default="", verbose_name="地址")
    location = models.PointField(srid=4326, geography=True, spatial_index=True, verbose_name="站点位置")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        ordering = ["name", "pk"]
        constraints = [models.UniqueConstraint(fields=["city", "name"], name="metro_station_city_name_unique")]

    def clean(self):
        super().clean()
        if not isinstance(self.aliases, list) or any(not isinstance(item, str) for item in self.aliases):
            raise ValidationError({"aliases": "站点别名必须是字符串列表。"})
        if self.location.srid != 4326:
            raise ValidationError({"location": "站点坐标必须使用 WGS84（SRID 4326）。"})

    def __str__(self):
        return f"{self.city.name} {self.name}"


class MetroLineStation(CreateUpdateTimeModelMixin):
    line = models.ForeignKey(MetroLine, on_delete=models.PROTECT, related_name="station_links", verbose_name="线路")
    station = models.ForeignKey(MetroStation, on_delete=models.PROTECT, related_name="line_links", verbose_name="站点")
    sort_order = models.PositiveIntegerField(default=0, verbose_name="线路内排序")
    is_active = models.BooleanField(default=True, verbose_name="是否启用")

    class Meta:
        ordering = ["sort_order", "pk"]
        constraints = [models.UniqueConstraint(fields=["line", "station"], name="metro_line_station_unique")]

    def clean(self):
        super().clean()
        if self.line_id and self.station_id and self.line.city_id != self.station.city_id:
            raise ValidationError("线路与站点必须属于同一城市。")
```

在 `config/settings/_base.py` 的业务应用列表中将 `"apps.metro"` 放在 `"apps.house"` 前面。

- [ ] **Step 4: 生成并检查迁移**

Run: `docker compose exec web python manage.py makemigrations metro`

Expected: 创建 `apps/metro/migrations/0001_initial.py`，包含 4 个模型、2 个城市内名称唯一约束、1 个线路站点唯一约束和站点空间索引。

- [ ] **Step 5: 运行模型测试与迁移检查**

Run: `docker compose exec web pytest tests/metro/test_models.py -q`

Expected: PASS。

Run: `docker compose exec web python manage.py makemigrations --check`

Expected: `No changes detected`。

### Task 2: 实现城市整包校验与原子导入

**Files:**
- Create: `apps/metro/schemas.py`
- Create: `apps/metro/importer.py`
- Create: `apps/metro/management/__init__.py`
- Create: `apps/metro/management/commands/__init__.py`
- Create: `apps/metro/management/commands/import_metro_city.py`
- Modify: `apps/house/geo/coordinates.py`
- Test: `tests/metro/test_importer.py`
- Test: `tests/house/test_geo.py`

- [ ] **Step 1: 写换乘合并、冲突回滚和旧数据停用测试**

```python
from copy import deepcopy
from unittest.mock import patch

from django.test import TestCase

from apps.metro.importer import MetroImportError, import_metro_city
from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation


def city_payload():
    return {
        "schema_version": 1,
        "data_version": "2026-09",
        "coordinate_system": "gcj02",
        "city": {"name": "深圳市", "province": "广东省"},
        "lines": [
            {
                "name": "1号线", "color": "#00A651", "sort_order": 1, "is_loop": False,
                "stations": [
                    {"name": "世界之窗", "aliases": [], "district": "南山区", "address": "", "longitude": 113.974, "latitude": 22.536, "sort_order": 1},
                ],
            },
            {
                "name": "2号线", "color": "#F58220", "sort_order": 2, "is_loop": False,
                "stations": [
                    {"name": "世界之窗", "aliases": [], "district": "南山区", "address": "", "longitude": 113.974, "latitude": 22.536, "sort_order": 8},
                ],
            },
        ],
    }


class MetroImporterTestCase(TestCase):
    def test_transfer_station_is_merged_and_linked_to_each_line(self):
        result = import_metro_city(city_payload())
        self.assertEqual(result.station_created, 1)
        self.assertEqual(MetroStation.objects.count(), 1)
        self.assertEqual(MetroLineStation.objects.count(), 2)

    def test_conflicting_transfer_station_coordinates_reject_whole_package(self):
        payload = city_payload()
        payload["lines"][1]["stations"][0]["longitude"] = 114.0
        with self.assertRaisesMessage(MetroImportError, "世界之窗"):
            import_metro_city(payload)
        self.assertFalse(MetroCity.objects.exists())

    def test_database_failure_rolls_back_previous_version(self):
        import_metro_city(city_payload())
        payload = deepcopy(city_payload())
        payload["data_version"] = "2026-10"
        payload["lines"].append({"name": "3号线", "color": "", "sort_order": 3, "is_loop": False, "stations": []})
        with patch("apps.metro.importer.MetroLine.objects.update_or_create", side_effect=RuntimeError("write failed")):
            with self.assertRaises(RuntimeError):
                import_metro_city(payload)
        self.assertEqual(MetroCity.objects.get().data_version, "2026-09")

    def test_missing_records_are_marked_inactive_without_deletion(self):
        import_metro_city(city_payload())
        payload = city_payload()
        payload["data_version"] = "2026-10"
        payload["lines"] = payload["lines"][:1]
        import_metro_city(payload)
        self.assertFalse(MetroLine.objects.get(name="2号线").is_active)
```

在 `tests/house/test_geo.py` 增加：

```python
def test_wgs84_input_is_kept_without_gcj02_offset(self):
    point = make_wgs84_point(113.974, 22.536, "wgs84")

    self.assertEqual(point.srid, 4326)
    self.assertAlmostEqual(point.x, 113.974, places=7)
    self.assertAlmostEqual(point.y, 22.536, places=7)
```

- [ ] **Step 2: 运行测试确认导入器尚不存在**

Run: `docker compose exec web pytest tests/metro/test_importer.py -q`

Expected: FAIL，提示无法导入 `apps.metro.importer`。

- [ ] **Step 3: 扩展坐标工具并定义导入 Schema**

将 `apps/house/geo/coordinates.py` 的坐标类型和入口改为：

```python
CoordinateSystem = Literal["gcj02", "wgs84"]
COORDINATE_SYSTEM_GCJ02: CoordinateSystem = "gcj02"
COORDINATE_SYSTEM_WGS84: CoordinateSystem = "wgs84"


def make_wgs84_point(longitude: float, latitude: float, coordinate_system: CoordinateSystem) -> Point:
    longitude, latitude = validate_longitude_latitude(longitude, latitude)
    if coordinate_system == COORDINATE_SYSTEM_GCJ02:
        longitude, latitude = gcj02_to_wgs84(longitude, latitude)
    elif coordinate_system != COORDINATE_SYSTEM_WGS84:
        raise ValueError("当前仅支持 gcj02 或 wgs84 坐标系")
    return Point(longitude, latitude, srid=4326)
```

`apps/metro/schemas.py` 中定义导入结构：

```python
from typing import Literal

from ninja import Schema
from pydantic import Field


class MetroImportStationIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    aliases: list[str] = []
    district: str = ""
    address: str = ""
    longitude: float
    latitude: float
    sort_order: int = Field(ge=0)


class MetroImportLineIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    color: str = ""
    sort_order: int = Field(ge=0)
    is_loop: bool = False
    stations: list[MetroImportStationIn]


class MetroImportCityIdentityIn(Schema):
    name: str = Field(min_length=1, max_length=64)
    province: str = Field(min_length=1, max_length=64)


class MetroCityImportIn(Schema):
    schema_version: Literal[1]
    data_version: str = Field(min_length=1, max_length=64)
    coordinate_system: Literal["gcj02", "wgs84"]
    city: MetroImportCityIdentityIn
    lines: list[MetroImportLineIn]
```

- [ ] **Step 4: 实现预校验和事务写入**

`apps/metro/importer.py` 应包含以下稳定入口和行为：

```python
from dataclasses import dataclass

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from pydantic import ValidationError as PydanticValidationError

from apps.house.geo.coordinates import make_wgs84_point
from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from apps.metro.schemas import MetroCityImportIn


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


def _station_identity(station) -> tuple:
    return (
        tuple(station.aliases), station.district.strip(), station.address.strip(),
        float(station.longitude), float(station.latitude),
    )


def _validate_package(payload: MetroCityImportIn) -> None:
    line_names: set[str] = set()
    stations: dict[str, tuple] = {}
    for line in payload.lines:
        line_name = line.name.strip()
        if line_name in line_names:
            raise MetroImportError(f"城市内线路名称重复：{line_name}")
        line_names.add(line_name)
        line_station_names: set[str] = set()
        for station in line.stations:
            station_name = station.name.strip()
            if station_name in line_station_names:
                raise MetroImportError(f"线路 {line_name} 内站点重复：{station_name}")
            line_station_names.add(station_name)
            identity = _station_identity(station)
            if station_name in stations and stations[station_name] != identity:
                raise MetroImportError(f"换乘站数据不一致：{station_name}")
            stations[station_name] = identity
            make_wgs84_point(station.longitude, station.latitude, payload.coordinate_system)


@transaction.atomic
def import_metro_city(raw_payload: dict) -> MetroImportResult:
    try:
        payload = MetroCityImportIn.model_validate(raw_payload)
    except PydanticValidationError as exc:
        raise MetroImportError(str(exc)) from exc
    _validate_package(payload)

    city, _ = MetroCity.objects.update_or_create(
        name=payload.city.name.strip(),
        defaults={"province": payload.city.province.strip(), "data_version": payload.data_version},
    )
    active_line_ids: set[int] = set()
    active_station_ids: set[int] = set()
    active_link_ids: set[int] = set()
    counters = {name: 0 for name in MetroImportResult.__dataclass_fields__ if name != "city"}
    station_cache: dict[str, MetroStation] = {}

    for line_input in payload.lines:
        line, created = MetroLine.objects.update_or_create(
            city=city,
            name=line_input.name.strip(),
            defaults={"color": line_input.color, "sort_order": line_input.sort_order, "is_loop": line_input.is_loop, "is_active": True},
        )
        counters["line_created" if created else "line_updated"] += 1
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
                counters["station_created" if station_created else "station_updated"] += 1
                station_cache[station_name] = station
            active_station_ids.add(station.pk)
            link, link_created = MetroLineStation.objects.update_or_create(
                line=line,
                station=station,
                defaults={"sort_order": station_input.sort_order, "is_active": True},
            )
            counters["link_created" if link_created else "link_updated"] += 1
            active_link_ids.add(link.pk)

    counters["link_deactivated"] = MetroLineStation.objects.filter(line__city=city, is_active=True).exclude(pk__in=active_link_ids).update(is_active=False)
    counters["line_deactivated"] = MetroLine.objects.filter(city=city, is_active=True).exclude(pk__in=active_line_ids).update(is_active=False)
    counters["station_deactivated"] = MetroStation.objects.filter(city=city, is_active=True).exclude(pk__in=active_station_ids).update(is_active=False)
    city.data_version = payload.data_version
    city.imported_at = timezone.now()
    city.save(update_fields=["data_version", "imported_at", "updated_at"])
    transaction.on_commit(lambda: cache.delete(f"public-metro-city:v1:{city.name}"))
    return MetroImportResult(city=city.name, **counters)
```

- [ ] **Step 5: 增加管理命令**

`apps/metro/management/commands/import_metro_city.py`：

```python
import json
from pathlib import Path

from django.core.management import BaseCommand, CommandError

from apps.metro.importer import MetroImportError, import_metro_city


class Command(BaseCommand):
    help = "按城市整包导入地铁线路、站点和坐标"

    def add_arguments(self, parser):
        parser.add_argument("json_file", type=Path)

    def handle(self, *args, **options):
        path: Path = options["json_file"]
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            result = import_metro_city(payload)
        except (OSError, json.JSONDecodeError, MetroImportError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(
            f"{result.city} 导入完成：线路新增 {result.line_created}、站点新增 {result.station_created}、关联新增 {result.link_created}"
        ))
```

- [ ] **Step 6: 运行导入器和坐标回归测试**

Run: `docker compose exec web pytest tests/metro/test_importer.py tests/house/test_geo.py -q`

Expected: PASS，GCJ-02 现有行为不变，WGS84 输入直接以 SRID 4326 保存。

### Task 3: 提供公开地铁目录 API

**Files:**
- Modify: `apps/metro/schemas.py`
- Create: `apps/metro/api.py`
- Modify: `config/api.py`
- Test: `tests/metro/test_public_api.py`

- [ ] **Step 1: 写无内部 ID 的嵌套响应测试**

```python
from django.contrib.gis.geos import Point
from django.test import TestCase
from django.utils import timezone

from apps.metro.models import MetroCity, MetroLine, MetroLineStation, MetroStation
from tests.api_helpers import api_data


class PublicMetroApiTestCase(TestCase):
    def setUp(self):
        city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
        line = MetroLine.objects.create(city=city, name="1号线", color="#00A651", sort_order=1)
        station = MetroStation.objects.create(city=city, name="世界之窗", location=Point(113.97, 22.53, srid=4326))
        MetroLineStation.objects.create(line=line, station=station, sort_order=1)

    def test_city_detail_returns_lines_with_embedded_stations(self):
        response = self.client.get("/api/public/metro/cities/深圳市/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(api_data(response), {
            "name": "深圳市",
            "province": "广东省",
            "data_version": "2026-09",
            "lines": [{"name": "1号线", "color": "#00A651", "stations": [{"name": "世界之窗"}]}],
        })
        self.assertNotIn("id", response.json())
```

- [ ] **Step 2: 运行测试确认路由不存在**

Run: `docker compose exec web pytest tests/metro/test_public_api.py -q`

Expected: FAIL，接口返回 404。

- [ ] **Step 3: 增加输出 Schema 和公开路由**

在 `apps/metro/schemas.py` 追加：

```python
class PublicMetroStationOut(Schema):
    name: str


class PublicMetroLineOut(Schema):
    name: str
    color: str
    stations: list[PublicMetroStationOut]


class PublicMetroCitySummaryOut(Schema):
    name: str
    province: str


class PublicMetroCityDetailOut(PublicMetroCitySummaryOut):
    data_version: str
    lines: list[PublicMetroLineOut]
```

`apps/metro/api.py`：

```python
from django.core.cache import cache
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from ninja import Router

from apps.metro.models import MetroCity, MetroLine, MetroLineStation
from apps.metro.schemas import PublicMetroCityDetailOut, PublicMetroCitySummaryOut

public_router = Router(tags=["地铁/公开"])


def _active_cities():
    return MetroCity.objects.filter(
        imported_at__isnull=False,
        lines__is_active=True,
        lines__station_links__is_active=True,
        lines__station_links__station__is_active=True,
    ).distinct()


@public_router.get("/cities/", response=list[PublicMetroCitySummaryOut], auth=None)
def list_public_metro_cities(request):
    return _active_cities().order_by("province", "name")


@public_router.get("/cities/{city_name}/", response=PublicMetroCityDetailOut, auth=None)
def get_public_metro_city(request, city_name: str):
    cache_key = f"public-metro-city:v1:{city_name}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    links = MetroLineStation.objects.filter(is_active=True, station__is_active=True).select_related("station").order_by("sort_order", "station__name")
    city = get_object_or_404(
        _active_cities().prefetch_related(
            Prefetch("lines", queryset=MetroLine.objects.filter(is_active=True).order_by("sort_order", "name").prefetch_related(Prefetch("station_links", queryset=links)))
        ),
        name=city_name,
    )
    result = {
        "name": city.name,
        "province": city.province,
        "data_version": city.data_version,
        "lines": [
            {"name": line.name, "color": line.color, "stations": [{"name": link.station.name} for link in line.station_links.all()]}
            for line in city.lines.all()
        ],
    }
    cache.set(cache_key, result, timeout=24 * 60 * 60)
    return result
```

在 `config/api.py` 导入 `apps.metro.api.public_router` 并添加：

```python
api.add_router("/public/metro/", metro_public_router)
```

- [ ] **Step 4: 运行公开地铁 API 测试**

Run: `docker compose exec web pytest tests/metro/test_public_api.py -q`

Expected: PASS；停用线路、站点或关联不会出现在响应中。

### Task 4: 扩展公开房源多站点空间查询

**Files:**
- Modify: `apps/house/geo/queries.py`
- Modify: `apps/house/services.py`
- Modify: `apps/house/api.py`
- Modify: `apps/house/schemas.py`
- Test: `tests/house/test_public_api.py`

- [ ] **Step 1: 写多站点 OR、最近站点、去重和校验测试**

在 `tests/house/test_public_api.py` 导入 `django.utils.timezone` 和 `MetroCity/MetroLine/MetroStation/MetroLineStation`，并增加：

```python
def test_public_house_list_filters_multiple_metro_stations_and_returns_nearest_station(self):
    city = MetroCity.objects.create(name="深圳市", province="广东省", data_version="2026-09", imported_at=timezone.now())
    line = MetroLine.objects.create(city=city, name="1号线", sort_order=1)
    luohu = MetroStation.objects.create(city=city, name="罗湖", location=make_wgs84_point(114.117, 22.531, "gcj02"))
    guomao = MetroStation.objects.create(city=city, name="国贸", location=make_wgs84_point(114.1188, 22.538, "gcj02"))
    MetroLineStation.objects.create(line=line, station=luohu, sort_order=1)
    MetroLineStation.objects.create(line=line, station=guomao, sort_order=2)

    nearest = self.make_house(org_slug="metro-a", org_name="地铁甲", room_number="101", city="深圳市", district="罗湖区")
    farther = self.make_house(org_slug="metro-b", org_name="地铁乙", room_number="202", city="深圳市", district="罗湖区")
    outside = self.make_house(org_slug="metro-c", org_name="地铁丙", room_number="303", city="深圳市", district="罗湖区")
    unlocated = self.make_house(org_slug="metro-d", org_name="地铁丁", room_number="404", city="深圳市", district="罗湖区")
    nearest.building.location = make_wgs84_point(114.117, 22.531, "gcj02")
    farther.building.location = make_wgs84_point(114.123, 22.538, "gcj02")
    outside.building.location = make_wgs84_point(114.20, 22.60, "gcj02")
    nearest.building.save(update_fields=["location", "updated_at"])
    farther.building.save(update_fields=["location", "updated_at"])
    outside.building.save(update_fields=["location", "updated_at"])

    response = self.client.get("/api/public/houses/", {
        "city": "深圳市",
        "metro_stations": ["罗湖", "国贸"],
        "radius_m": 1000,
        "sort": "distance_asc",
        "page": 1,
        "page_size": 20,
    })
    self.assertEqual(response.status_code, 200)
    items = api_data(response)["items"]
    self.assertEqual([item["id"] for item in items], [nearest.pk, farther.pk])
    self.assertEqual(items[0]["nearest_metro_station"], {"name": "罗湖", "line_names": ["1号线"]})
    self.assertEqual(len({item["id"] for item in items}), len(items))
    self.assertNotIn(outside.pk, {item["id"] for item in items})
    self.assertNotIn(unlocated.pk, {item["id"] for item in items})


def test_public_house_list_rejects_conflicting_spatial_centers(self):
    response = self.client.get("/api/public/houses/", {
        "city": "深圳市", "metro_stations": ["罗湖"],
        "longitude": "114.12", "latitude": "22.54", "coordinate_system": "gcj02",
    })
    self.assertEqual(response.status_code, 422)


def test_public_house_list_rejects_unknown_station_invalid_radius_and_over_five_stations(self):
    unknown = self.client.get("/api/public/houses/", {"city": "深圳市", "metro_stations": ["不存在"], "radius_m": 1000})
    radius = self.client.get("/api/public/houses/", {"city": "深圳市", "metro_stations": ["罗湖"], "radius_m": 3000})
    too_many = self.client.get("/api/public/houses/", {"city": "深圳市", "metro_stations": ["站1", "站2", "站3", "站4", "站5", "站6"]})
    self.assertEqual((unknown.status_code, radius.status_code, too_many.status_code), (422, 422, 422))
```

- [ ] **Step 2: 运行新增测试确认当前接口不支持站点参数**

Run: `docker compose exec web pytest tests/house/test_public_api.py -k 'metro or conflicting_spatial or invalid_radius' -q`

Expected: FAIL，`metro_stations` 未参与筛选且响应没有最近站点。

- [ ] **Step 3: 增加多中心查询工具**

在 `apps/house/geo/queries.py` 增加：

```python
from dataclasses import dataclass
from functools import reduce
from operator import or_

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Case, F, JSONField, Q, Value, When
from django.db.models.functions import Least


@dataclass(frozen=True)
class NamedGeoOrigin:
    name: str
    location: object
    line_names: tuple[str, ...]


def apply_named_origins_house_filter(queryset, origins: list[NamedGeoOrigin], radius_m: int):
    radius_filter = reduce(or_, [Q(building__location__distance_lte=(origin.location, D(m=radius_m))) for origin in origins])
    queryset = queryset.filter(building__location__isnull=False).filter(radius_filter)
    if len(origins) == 1:
        origin = origins[0]
        return queryset.annotate(
            distance=Distance("building__location", origin.location, spheroid=True),
            nearest_metro_station_name=Value(origin.name),
            nearest_metro_line_names=Value(list(origin.line_names), output_field=JSONField()),
        )
    distance_aliases = {f"_metro_distance_{index}": Distance("building__location", origin.location, spheroid=True) for index, origin in enumerate(origins)}
    queryset = queryset.alias(**distance_aliases)
    alias_names = list(distance_aliases)
    nearest_cases = []
    line_cases = []
    for index, origin in enumerate(origins):
        alias = alias_names[index]
        condition = Q()
        for other_alias in alias_names:
            if other_alias != alias:
                condition &= Q(**{f"{alias}__lte": F(other_alias)})
        nearest_cases.append(When(condition, then=Value(origin.name)))
        line_cases.append(When(condition, then=Value(list(origin.line_names), output_field=JSONField())))
    return queryset.annotate(
        distance=Least(*[F(alias) for alias in alias_names]),
        nearest_metro_station_name=Case(*nearest_cases, default=Value("")),
        nearest_metro_line_names=Case(*line_cases, default=Value([], output_field=JSONField()), output_field=JSONField()),
    )
```

单站点分支直接使用 `Distance`，多站点分支才使用 `Least`，避免数据库收到单参数 `LEAST` 或空条件 `CASE`。

- [ ] **Step 4: 解析并校验站点空间中心**

在 `apps/house/api.py` 增加：

```python
ALLOWED_PUBLIC_HOUSE_RADIUS_M = {500, 1000, 1500, 2000}
PUBLIC_HOUSE_METRO_STATION_LIMIT = 5


def _unique_names(values: list[str] | None) -> list[str]:
    return list(dict.fromkeys(value.strip() for value in values or [] if value.strip()))


def _resolve_metro_origins(*, city: str | None, metro_stations: list[str] | None):
    names = _unique_names(metro_stations)
    if not names:
        return []
    if not city:
        raise HttpError(422, "选择地铁站时必须提供完整城市名称")
    if len(names) > PUBLIC_HOUSE_METRO_STATION_LIMIT:
        raise HttpError(422, "最多选择 5 个地铁站")
    stations = list(
        MetroStation.objects.filter(
            city__name=city,
            city__imported_at__isnull=False,
            name__in=names,
            is_active=True,
            line_links__is_active=True,
            line_links__line__is_active=True,
        )
        .prefetch_related(Prefetch("line_links", queryset=MetroLineStation.objects.filter(is_active=True, line__is_active=True).select_related("line")))
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
```

扩展 `list_public_houses`：

```python
metro_stations: list[str] | None = Query(None),
radius_m: int = Query(1000),
```

并在调用服务前执行：

```python
if radius_m not in ALLOWED_PUBLIC_HOUSE_RADIUS_M:
    raise HttpError(422, "范围只支持 500、1000、1500、2000 米")
metro_origins = _resolve_metro_origins(city=city, metro_stations=metro_stations)
if metro_origins and (longitude is not None or latitude is not None):
    raise HttpError(422, "当前位置与地铁站不能同时作为搜索中心")
origin = _resolve_nearby_origin(
    longitude=longitude,
    latitude=latitude,
    radius_m=radius_m,
    coordinate_system=coordinate_system,
    require_for_distance=sort == "distance_asc" and not metro_origins,
)
if sort == "distance_asc" and origin is None and not metro_origins:
    raise HttpError(422, "按距离排序时必须提供当前位置或地铁站")
```

只对房源列表使用四档半径校验；地图接口现有 `_resolve_nearby_origin` 的通用范围校验保持不变，避免无关回归。

- [ ] **Step 5: 将地铁空间中心接入服务和响应 Schema**

`apply_public_house_filters` 增加 `metro_origins=None` 参数，并在当前位置分支之后处理：

```python
if origin is not None:
    qs = apply_nearby_house_filter(qs, origin, radius_m)
    qs = annotate_house_distance(qs, origin)
elif metro_origins:
    qs = apply_named_origins_house_filter(qs, metro_origins, radius_m)
```

`apps/house/schemas.py` 增加：

```python
class NearestMetroStationOut(Schema):
    name: str
    line_names: list[str]


nearest_metro_station: NearestMetroStationOut | None = None

@staticmethod
def resolve_nearest_metro_station(obj):
    name = getattr(obj, "nearest_metro_station_name", "")
    if not name:
        return None
    return {"name": name, "line_names": getattr(obj, "nearest_metro_line_names", [])}
```

- [ ] **Step 6: 运行房源空间查询回归**

Run: `docker compose exec web pytest tests/house/test_public_api.py -q`

Expected: PASS；当前位置、地铁站和普通条件三种模式均通过，地图接口既有测试不受影响。

### Task 5: 生成 OpenAPI 并建立小程序地铁领域函数

**Files:**
- Create: `frontend_miniprogram/src/domain/public-house-metro.ts`
- Create: `frontend_miniprogram/src/services/manual/metro.ts`
- Modify: `frontend_miniprogram/src/services/manual/houses.ts`
- Modify: `frontend_miniprogram/src/features/houses/service.ts`
- Regenerate: `frontend_miniprogram/src/services/openapi/*`
- Test: `frontend_miniprogram/tests/public-house-metro.test.ts`

- [ ] **Step 1: 写选择和请求参数纯函数测试**

```typescript
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPublicHouseSpatialParams, reconcileMetroSelection, toggleMetroStation } from '../src/domain/public-house-metro.ts'

test('换乘站跨线路勾选只占一个名额', () => {
  assert.deepEqual(toggleMetroStation(['世界之窗'], '世界之窗'), [])
  assert.deepEqual(toggleMetroStation(['罗湖'], '世界之窗'), ['罗湖', '世界之窗'])
})

test('最多允许五个不同站点', () => {
  assert.throws(() => toggleMetroStation(['站1', '站2', '站3', '站4', '站5'], '站6'), /最多选择 5 个站点/)
})

test('附近、地铁和普通地区生成互斥请求参数', () => {
  assert.deepEqual(buildPublicHouseSpatialParams({
    nearbyEnabled: true, nearbyLocation: { longitude: 114, latitude: 22.5 }, radiusM: 1000,
    mode: 'metro', city: '深圳市', metroStationNames: ['罗湖'], province: '广东省', district: '罗湖区',
  }), { longitude: 114, latitude: 22.5, radius_m: 1000, coordinate_system: 'gcj02' })
  assert.deepEqual(buildPublicHouseSpatialParams({
    nearbyEnabled: false, nearbyLocation: null, radiusM: 1500,
    mode: 'metro', city: '深圳市', metroStationNames: ['罗湖', '国贸'], province: '广东省', district: '',
  }), { city: '深圳市', metro_stations: ['罗湖', '国贸'], radius_m: 1500 })
})
```

- [ ] **Step 2: 运行测试确认领域函数尚不存在**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm exec node --experimental-strip-types --test tests/public-house-metro.test.ts`

Expected: FAIL，无法解析 `public-house-metro.ts`。

- [ ] **Step 3: 实现地铁领域类型和互斥参数构建**

`frontend_miniprogram/src/domain/public-house-metro.ts`：

```typescript
export type PublicHouseRadiusM = 500 | 1000 | 1500 | 2000
export type PublicHouseLocationMode = 'region' | 'metro'

export interface PublicMetroStation { name: string }
export interface PublicMetroLine { name: string, color: string, stations: PublicMetroStation[] }
export interface PublicMetroCityDetail { name: string, province: string, data_version: string, lines: PublicMetroLine[] }
export interface PublicHouseMetroSelection { city: string, stationNames: string[] }

export const PUBLIC_HOUSE_RADIUS_OPTIONS: PublicHouseRadiusM[] = [500, 1000, 1500, 2000]

export function isPublicHouseMetroSelection(value: unknown): value is PublicHouseMetroSelection {
  if (!value || typeof value !== 'object')
    return false
  const selection = value as Record<string, unknown>
  return typeof selection.city === 'string'
    && Array.isArray(selection.stationNames)
    && selection.stationNames.length <= 5
    && selection.stationNames.every(name => typeof name === 'string' && Boolean(name.trim()))
}

export function reconcileMetroSelection(selection: PublicHouseMetroSelection, city: string): PublicHouseMetroSelection {
  return selection.city === city
    ? { city, stationNames: [...new Set(selection.stationNames)] }
    : { city, stationNames: [] }
}

export function toggleMetroStation(selected: string[], stationName: string): string[] {
  const names = [...new Set(selected)]
  if (names.includes(stationName))
    return names.filter(name => name !== stationName)
  if (names.length >= 5)
    throw new Error('最多选择 5 个站点')
  return [...names, stationName]
}

export function buildPublicHouseSpatialParams(input: {
  nearbyEnabled: boolean
  nearbyLocation: { longitude: number, latitude: number } | null
  radiusM: PublicHouseRadiusM
  mode: PublicHouseLocationMode
  province: string
  city: string
  district: string
  metroStationNames: string[]
}) {
  if (input.nearbyEnabled && input.nearbyLocation) {
    return { ...input.nearbyLocation, radius_m: input.radiusM, coordinate_system: 'gcj02' as const }
  }
  if (input.mode === 'metro' && input.city && input.metroStationNames.length) {
    return { city: input.city, metro_stations: [...new Set(input.metroStationNames)], radius_m: input.radiusM }
  }
  if (!input.city)
    return {}
  return { province: input.province, city: input.city, district: input.district || undefined }
}
```

- [ ] **Step 4: 生成 OpenAPI 客户端并补充手写适配层**

先确保本地后端在 `http://localhost:18000` 暴露最新 schema，然后运行：

Run: `cd frontend_miniprogram && nvm use 22 && pnpm openapi`

Expected: 生成类型包含 `metro_stations?: string[]` 和 `nearest_metro_station`；不手工修改 `src/services/openapi`。

`frontend_miniprogram/src/services/manual/metro.ts`：

```typescript
import type { PublicMetroCityDetail } from '@/domain/public-house-metro'
import { httpGet } from '@/http/http'

export interface PublicMetroCitySummary { name: string, province: string }

const publicRequestOptions = { requestScope: { kind: 'public' as const } }

export function requestPublicMetroCities() {
  return httpGet<PublicMetroCitySummary[]>('/api/public/metro/cities/', undefined, undefined, publicRequestOptions)
}

export function requestPublicMetroCity(city: string) {
  return httpGet<PublicMetroCityDetail>(`/api/public/metro/cities/${encodeURIComponent(city)}/`, undefined, undefined, publicRequestOptions)
}
```

在 `frontend_miniprogram/src/services/manual/houses.ts` 的参数适配类型中显式补充：

```typescript
metro_stations?: string[]
radius_m?: 500 | 1000 | 1500 | 2000
```

并从 `features/houses/service.ts` 导出 `requestPublicMetroCity` 及相关类型。

- [ ] **Step 5: 运行领域测试和类型检查**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm test && pnpm type-check`

Expected: PASS。

### Task 6: 扩展公开房源范围 Store

**Files:**
- Modify: `frontend_miniprogram/src/store/public-house-region.ts`
- Modify: `frontend_miniprogram/src/domain/public-house-region.ts`
- Test: `frontend_miniprogram/tests/public-house-metro.test.ts`
- Test: `frontend_miniprogram/tests/public-house-region.test.ts`

- [ ] **Step 1: 增加城市切换和半径偏好测试**

在 `public-house-metro.test.ts` 增加：

```typescript
test('城市变化会清空旧城市站点但保留半径偏好', () => {
  assert.deepEqual(reconcileMetroSelection({ city: '深圳市', stationNames: ['罗湖'] }, '广州市'), {
    city: '广州市', stationNames: [],
  })
})
```

- [ ] **Step 2: 在 Store 中增加正式状态和请求参数优先级**

将 Store 的核心状态调整为：

```typescript
const locationMode = ref<PublicHouseLocationMode>('region')
const metroSelection = ref<PublicHouseMetroSelection>({ city: selection.value.city, stationNames: [] })
const radiusM = ref<PublicHouseRadiusM>(1000)
const scopeMode = ref<'region' | 'nearby'>('region')
const nearbyLocation = ref<{ latitude: number, longitude: number } | null>(null)

const requestParams = computed(() => buildPublicHouseSpatialParams({
  nearbyEnabled: scopeMode.value === 'nearby',
  nearbyLocation: nearbyLocation.value,
  radiusM: radiusM.value,
  mode: locationMode.value,
  province: selection.value.province,
  city: selection.value.city,
  district: selection.value.district,
  metroStationNames: metroSelection.value.stationNames,
}))
const hasSpatialCenter = computed(() => (
  scopeMode.value === 'nearby' && nearbyLocation.value !== null
) || (
  scopeMode.value === 'region' && locationMode.value === 'metro' && metroSelection.value.stationNames.length > 0
))
```

Store 必须提供以下显式动作：

```typescript
function applyRegion(selectionValue: PublicHouseRegionSelection) {
  if (!isPublicHouseRegionSelection(selectionValue))
    throw new Error('地区选择无效')
  const cityChanged = selection.value.city !== selectionValue.city
  selection.value = { ...selectionValue }
  locationMode.value = 'region'
  if (cityChanged || !selectionValue.city)
    metroSelection.value = { city: selectionValue.city, stationNames: [] }
  exitNearby()
}
function applyMetro(city: string, stationNames: string[]) {
  const names = [...new Set(stationNames.map(name => name.trim()).filter(Boolean))]
  if (!city)
    throw new Error('地铁筛选必须先选择城市')
  if (city !== selection.value.city)
    throw new Error('地铁城市必须与当前房源城市一致')
  if (names.length > 5)
    throw new Error('最多选择 5 个地铁站')
  metroSelection.value = { city, stationNames: names }
  locationMode.value = names.length ? 'metro' : 'region'
  exitNearby()
}

function clearMetro() {
  metroSelection.value = { city: selection.value.city, stationNames: [] }
  locationMode.value = 'region'
}

function enterNearby(location: { latitude: number, longitude: number }) {
  nearbyLocation.value = { ...location }
  scopeMode.value = 'nearby'
}

function exitNearby() {
  scopeMode.value = 'region'
  nearbyLocation.value = null
}

function setRadiusM(value: PublicHouseRadiusM) {
  if (!PUBLIC_HOUSE_RADIUS_OPTIONS.includes(value))
    throw new Error('附近范围无效')
  radiusM.value = value
}
```

迁移现有 `nearbyRadiusM`：Store 对外可临时保留同名 computed 兼容层，但实际唯一半径来源是 `radiusM`，避免附近与地铁各自保存不同半径。

- [ ] **Step 3: 更新缓存版本与失效策略**

地铁选择单独使用版本化存储：

```typescript
const metroPersistence = createVersionedStorage<PublicHouseMetroSelection>({
  key: 'public-house-metro-filter', version: 1, storage: platformStorage.persistent,
  validate: isPublicHouseMetroSelection, migrations: {},
})
```

当 `selectNationwide()` 或城市发生变化时清空旧站点；地铁目录加载失败时保留同城市已选站点，不静默清空。

- [ ] **Step 4: 运行 Store 相关纯函数测试**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm exec node --experimental-strip-types --test tests/public-house-region.test.ts tests/public-house-metro.test.ts`

Expected: PASS。

### Task 7: 实现顶部向下展开的区域 / 地铁三级筛选层

**Files:**
- Create: `frontend_miniprogram/src/features/houses/components/PublicHouseLocationDropdown.vue`
- Test: `frontend_miniprogram/tests/public-house-location-dropdown.test.ts`

- [ ] **Step 1: 写顶部下拉形态静态测试**

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = readFileSync(new URL('../src/features/houses/components/PublicHouseLocationDropdown.vue', import.meta.url), 'utf8')

test('区域地铁筛选使用顶部覆盖层而不是底部抽屉', () => {
  assert.match(source, /location-dropdown/)
  assert.match(source, /grid-template-columns:\s*1fr 3fr 6fr/)
  assert.match(source, /position:\s*absolute/)
  assert.match(source, /top:\s*100%/)
  assert.doesNotMatch(source, /AppBottomSheet/)
})

test('操作区固定在下拉层底部', () => {
  assert.match(source, /location-dropdown__footer/)
  assert.match(source, /position:\s*sticky/)
  assert.match(source, /查看房源/)
})
```

- [ ] **Step 2: 运行测试确认组件尚不存在**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm exec node --experimental-strip-types --test tests/public-house-location-dropdown.test.ts`

Expected: FAIL，找不到组件文件。

- [ ] **Step 3: 实现草稿式三级选择逻辑**

组件脚本按以下方式维护草稿，只有确认才写入 Store：

```vue
<script setup lang="ts">
import type { PublicHouseLocationMode, PublicMetroCityDetail } from '@/domain/public-house-metro'
import type { PublicHouseRegionSelection } from '@/domain/public-house-region'
import { computed, ref, watch } from 'vue'
import { requestPublicMetroCities, requestPublicMetroCity } from '@/services/manual/metro'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  'apply': []
}>()

const regionStore = usePublicHouseRegionStore()
const draftMode = ref<PublicHouseLocationMode>('region')
const draftRegion = ref<PublicHouseRegionSelection>({ province: '', city: '', district: '' })
const draftStationNames = ref<string[]>([])
const activeLineName = ref('')
const metroCity = ref<PublicMetroCityDetail | null>(null)
const metroLoading = ref(false)
const metroError = ref('')

const activeCity = computed(() => regionStore.regions
  .find(province => province.province === draftRegion.value.province)
  ?.cities.find(city => city.city === draftRegion.value.city) || null)
const activeLine = computed(() => metroCity.value?.lines.find(line => line.name === activeLineName.value) || metroCity.value?.lines[0] || null)

function resetDraftFromStore() {
  draftMode.value = regionStore.locationMode
  draftRegion.value = { ...regionStore.selection }
  draftStationNames.value = [...regionStore.metroSelection.stationNames]
  activeLineName.value = ''
}

async function loadMetroCity() {
  metroCity.value = null
  metroError.value = ''
  if (!draftRegion.value.city)
    return
  metroLoading.value = true
  try {
    const availableCities = await requestPublicMetroCities()
    if (!availableCities.some(item => item.name === draftRegion.value.city)) {
      metroCity.value = { name: draftRegion.value.city, province: draftRegion.value.province, data_version: '', lines: [] }
      return
    }
    metroCity.value = await requestPublicMetroCity(draftRegion.value.city)
    activeLineName.value = metroCity.value.lines[0]?.name || ''
  }
  catch (cause) {
    metroError.value = cause instanceof Error ? cause.message : '地铁数据加载失败'
  }
  finally {
    metroLoading.value = false
  }
}

function selectDraftDistrict(district: string) {
  draftRegion.value = { ...draftRegion.value, district }
}

function resetDraft() {
  if (draftMode.value === 'metro')
    draftStationNames.value = []
  else
    draftRegion.value = { ...draftRegion.value, district: '' }
}

function closeWithoutApply() {
  resetDraftFromStore()
  emit('update:visible', false)
}

function applyDraft() {
  if (draftMode.value === 'metro') {
    if (!draftRegion.value.city) {
      uni.showToast({ title: '请先选择城市', icon: 'none' })
      return
    }
    regionStore.applyMetro(draftRegion.value.city, draftStationNames.value)
  }
  else {
    regionStore.applyRegion(draftRegion.value)
  }
  emit('apply')
  emit('update:visible', false)
}

watch(() => props.visible, (visible) => {
  if (!visible)
    return
  resetDraftFromStore()
  void regionStore.loadRegions()
  void loadMetroCity()
})

watch(draftMode, (mode) => {
  if (mode === 'metro' && !metroCity.value && !metroLoading.value)
    void loadMetroCity()
})
</script>
```

打开时从 Store 克隆 `draftMode`、`draftRegion`、`draftStationNames` 和当前线路；关闭遮罩时丢弃草稿；点击确认时调用 `applyRegion` 或 `applyMetro`。地铁站选择使用 Wot UI v2 的 `wd-checkbox-group`，配置 `v-model="draftStationNames"`、`:max="5"`、`placement="right"`，换乘站依赖站名数组自然去重。

模板主体：

```vue
<template>
  <view v-if="visible" class="location-dropdown-host">
    <view class="location-dropdown__mask" @click="closeWithoutApply" />
    <view class="location-dropdown">
      <view class="location-dropdown__columns">
        <scroll-view class="location-dropdown__column location-dropdown__column--mode" scroll-y>
          <button :class="{ active: draftMode === 'region' }" @click="draftMode = 'region'">区域</button>
          <button :class="{ active: draftMode === 'metro' }" @click="draftMode = 'metro'">地铁</button>
        </scroll-view>

        <scroll-view class="location-dropdown__column location-dropdown__column--secondary" scroll-y>
          <template v-if="draftMode === 'region'">
            <button @click="selectDraftDistrict('')">全城</button>
            <button v-for="item in activeCity?.districts || []" :key="item.district" @click="selectDraftDistrict(item.district)">{{ item.district }}</button>
          </template>
          <template v-else>
            <button v-for="line in metroCity?.lines || []" :key="line.name" @click="activeLineName = line.name">
              <i :style="{ backgroundColor: line.color }" />{{ line.name }}
            </button>
          </template>
        </scroll-view>

        <scroll-view class="location-dropdown__column location-dropdown__column--content" scroll-y>
          <button v-if="draftMode === 'region'" class="active">全区</button>
          <view v-else-if="metroLoading">正在加载地铁数据…</view>
          <button v-else-if="metroError" @click="loadMetroCity">加载失败，点击重试</button>
          <view v-else-if="!metroCity?.lines.length">该城市暂未提供地铁筛选</view>
          <wd-checkbox-group v-else v-model="draftStationNames" :max="5" placement="right">
            <wd-checkbox v-for="station in activeLine?.stations || []" :key="station.name" :name="station.name">
              {{ station.name }}
            </wd-checkbox>
          </wd-checkbox-group>
        </scroll-view>
      </view>

      <view class="location-dropdown__footer">
        <button class="location-dropdown__reset" @click="resetDraft">重置</button>
        <button class="location-dropdown__apply" @click="applyDraft">查看房源</button>
      </view>
    </view>
  </view>
</template>
```

- [ ] **Step 4: 实现顶部锚定、遮罩和滚动约束**

组件样式必须包含：

```scss
.location-dropdown-host { position: absolute; top: 100%; right: 0; left: 0; z-index: 40; }
.location-dropdown__mask { position: fixed; inset: 0; z-index: 1; background: rgb(0 0 0 / 42%); }
.location-dropdown { position: relative; z-index: 2; max-height: min(68vh, 960rpx); overflow: hidden; background: var(--app-bg-card); box-shadow: 0 18rpx 40rpx rgb(15 23 42 / 16%); }
.location-dropdown__columns { display: grid; grid-template-columns: 1fr 3fr 6fr; height: min(58vh, 820rpx); }
.location-dropdown__column { min-width: 0; height: 100%; overflow: hidden; }
.location-dropdown__column--mode { background: var(--app-bg-subtle); }
.location-dropdown__column--secondary { background: var(--app-bg-page); }
.location-dropdown__footer { position: sticky; bottom: 0; display: grid; grid-template-columns: 160rpx 1fr; gap: 20rpx; padding: 20rpx 28rpx calc(20rpx + env(safe-area-inset-bottom)); background: var(--app-bg-card); }
```

房源页的筛选按钮容器使用高于遮罩的层级，确保再次点击当前筛选项可以收起。展开/收起使用短距离 `translateY` 与透明度过渡；必须尊重 `prefers-reduced-motion`，不能让房源列表参与布局位移。

- [ ] **Step 5: 运行组件结构测试、lint 和类型检查**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm exec node --experimental-strip-types --test tests/public-house-location-dropdown.test.ts && pnpm lint && pnpm type-check`

Expected: PASS。

### Task 8: 接入房源列表、附近半径和房源卡片

**Files:**
- Modify: `frontend_miniprogram/src/pages/houses/index.vue`
- Modify: `frontend_miniprogram/src/pages/index/index.vue`
- Modify: `frontend_miniprogram/src/pages-housing/map/index.vue`
- Modify: `frontend_miniprogram/src/domain/house-card.ts`
- Modify: `frontend_miniprogram/tests/house.test.ts`

- [ ] **Step 1: 写最近地铁站卡片文案测试**

在 `frontend_miniprogram/tests/house.test.ts` 增加：

```typescript
test('地铁筛选房源优先显示最近站点距离', () => {
  const model = buildHouseCardModel({
    id: 1, room_number: '1202', bedrooms: 1, living_rooms: 0, has_elevator_access: true,
    distance_m: 680,
    nearest_metro_station: { name: '世界之窗', line_names: ['1号线', '2号线'] },
    building: { name: '1栋', estate: { display_name: '世界花园', district: '南山区' } },
  })
  assert.equal(model.distanceText, '距世界之窗站 680m')
})
```

- [ ] **Step 2: 扩展卡片输入和距离格式化**

`HouseCardSource` 增加：

```typescript
nearest_metro_station?: { name: string, line_names: string[] } | null
```

将距离文案函数调整为：

```typescript
export function formatHouseDistance(value?: number | null, stationName?: string): string {
  if (value == null || !Number.isFinite(value) || value < 0)
    return ''
  const distance = value < 1000 ? `${Math.round(value)}m` : `${(value / 1000).toFixed(1)}km`
  return stationName ? `距${stationName}站 ${distance}` : `距你 ${distance}`
}
```

- [ ] **Step 3: 在房源页建立唯一顶部筛选展开状态**

`frontend_miniprogram/src/pages/houses/index.vue` 增加：

```typescript
const activeTopFilter = ref<'location' | null>(null)

function toggleLocationDropdown() {
  activeTopFilter.value = activeTopFilter.value === 'location' ? null : 'location'
}

function handleLocationApplied() {
  activeTopFilter.value = null
  if (regionStore.locationMode === 'metro' || regionStore.scopeMode === 'nearby')
    query.sort = 'distance_asc'
  void loadHouses(true)
}
```

将“区域”快速筛选点击行为从 `navigateTo(APP_ROUTES.publicHouseCity)` 改为 `toggleLocationDropdown()`；城市选择页面继续保留给首页和需要切换城市的入口使用。筛选栏外层设置 `position: relative`，把 `PublicHouseLocationDropdown` 放在横向快速筛选 `scroll-view` 之后，从筛选栏下沿展开。

- [ ] **Step 4: 让附近条件独立使用统一四档半径**

把房源页附近选项改为：

```typescript
const nearbyRadiusOptions = [500, 1000, 1500, 2000] as const
```

选择范围时只更新 `regionStore.radiusM`；首次开启附近才调用 `uni.getLocation`，关闭附近后保留半径偏好和地铁/区域草稿。将 `pages/index/index.vue` 的附近默认值从 5000 改为 1000；将 `pages-housing/map/index.vue` 的选择项和默认值同步为四档，防止共享 Store 中残留 3000/5000 米导致房源列表 422。

- [ ] **Step 5: 更新列表请求、摘要、空状态和排序**

请求继续使用：

```typescript
return {
  keyword: query.keyword,
  min_rent: query.minRent,
  max_rent: query.maxRent,
  min_area: query.minArea,
  max_area: query.maxArea,
  bedrooms: query.bedrooms === '' ? undefined : Number(query.bedrooms),
  has_elevator_access: query.elevatorOnly ? true : undefined,
  ...regionStore.requestParams,
  sort: regionStore.hasSpatialCenter && query.sort === 'latest' ? 'distance_asc' : query.sort,
  page,
  page_size: targetPageSize,
}
```

区域 / 地铁摘要规则：区域模式显示当前地区，地铁模式显示 `地铁 · N站`。附近开启时“附近”按钮显示当前半径，但区域 / 地铁草稿不被清空。无结果说明增加“可尝试扩大范围、调整站点或放宽其他条件”。

- [ ] **Step 6: 运行小程序回归验证**

Run: `cd frontend_miniprogram && nvm use 22 && pnpm test && pnpm lint && pnpm type-check`

Expected: PASS。

Run: `cd frontend_miniprogram && nvm use 22 && pnpm build:mp:prod`

Expected: 微信小程序生产构建成功。

### Task 9: 全链路验证与视觉验收

**Files:**
- Verify: `docs/superpowers/specs/2026-09-18-miniprogram-metro-house-filter-design.md`
- Verify: all files listed above
- Artifact only: `.codex/audits/miniprogram-metro-filter/`

- [ ] **Step 1: 运行后端定向测试**

Run: `docker compose exec web pytest tests/metro tests/house/test_public_api.py -q`

Expected: PASS。

- [ ] **Step 2: 运行后端迁移和 lint 检查**

Run: `docker compose exec web python manage.py makemigrations --check`

Expected: `No changes detected`。

Run: `docker compose exec web ruff check apps/metro apps/house tests/metro tests/house/test_public_api.py`

Expected: PASS。

- [ ] **Step 3: 使用一份可信城市 JSON 做命令级冒烟验证**

Run: `docker compose exec web python manage.py import_metro_city /workspace/data/metro/shenzhen.json`

Expected: 输出城市名称及线路、站点、关联的新增/更新/停用数量；若文件校验失败，数据库版本和旧数据保持不变。执行前由用户提供实际文件路径，不在代码中附带虚构生产数据。

- [ ] **Step 4: 验证公开接口契约**

Run: `curl -s 'http://localhost:18000/api/public/metro/cities/%E6%B7%B1%E5%9C%B3%E5%B8%82/'`

Expected: 返回城市、版本、线路和内嵌站点，不含数据库 ID、站点编码和坐标。

Run: `curl -sG 'http://localhost:18000/api/public/houses/' --data-urlencode 'city=深圳市' --data-urlencode 'metro_stations=罗湖' --data-urlencode 'metro_stations=国贸' --data-urlencode 'radius_m=1000' --data-urlencode 'sort=distance_asc' --data-urlencode 'page=1' --data-urlencode 'page_size=12'`

Expected: 房源去重，`distance_m` 为最近站点距离，`nearest_metro_station` 仅在地铁模式有值。

- [ ] **Step 5: 在微信开发者工具做交互验收**

逐项确认：

1. 点击区域 / 地铁筛选后，面板从顶部筛选栏下方向下展开，不从屏幕底部弹出。
2. 搜索栏和筛选栏保持可见，房源列表在遮罩后保持原位置。
3. 三列宽度接近 `1:3:6`，每列可独立滚动，底部“重置 / 查看房源”始终可见。
4. 点击遮罩或再次点击筛选按钮向上收起并放弃未确认草稿。
5. 跨线路选择保留，换乘站只计一次，第 6 个不同站点被阻止。
6. 地区模式第三级只显示“全区”。
7. 附近开启时请求只含经纬度；关闭后恢复已确认地铁条件。
8. 500m、1km、1.5km、2km 四档均可查询，首次空间筛选默认距离排序。
9. 房源卡显示“距某站”，普通附近模式显示“距你”。

如需保存临时验收截图，只能写入 `.codex/audits/miniprogram-metro-filter/`，不得写入项目根目录，也不纳入提交。

- [ ] **Step 6: 扫描实现与方案一致性**

Run: `rg -n "spatial_mode|line_stations|radius_m[^\n]*(3000|5000|10000)|nearbyRadiusOptions[^\n]*(3000|5000|10000)" apps/metro apps/house frontend_miniprogram/src frontend_miniprogram/tests`

Expected: 不存在未处理占位符；不引入 `spatial_mode` 或对外 `line_stations`；公开房源附近范围不再使用 3000/5000/10000 米。
