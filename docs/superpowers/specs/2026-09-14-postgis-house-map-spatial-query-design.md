# PostGIS 地图找房与空间查询改造设计

**日期：** 2026-09-14  
**状态：** 设计已确认，待实施计划  
**适用范围：** Django 房源领域、管理端房源地图、uni-app 微信小程序与 H5 地图找房

## 1. 背景

项目当前运行 PostgreSQL 17，但数据库镜像是普通 `postgres:17`，Django 使用 `django.db.backends.postgresql`，数据库没有安装 PostGIS 扩展。`Estate` 与 `Building` 分别使用 `DecimalField` 保存 `lat`、`lng`，地图视野查询通过经纬度区间比较完成。

公开地图找房已经具备城市、区域、小区、楼栋四级聚合，微信小程序与 H5 均会在地图停止拖动或缩放后按当前视野请求后端。组织地图也有小区与楼栋视野查询。现有方案可以支撑较小数据量，但不能可靠提供空间索引、附近半径查询、距离排序和未来的多边形空间关系。

项目尚未上线，无需维持旧数据库字段、旧坐标查询实现或旧前端数据结构，因此本次采用干净的原生 PostGIS 模型，不设计长期双写和兼容层。

本设计取代以下文档中关于 `lat/lng` 数据库存储与普通范围查询的决策；其中已经确认的地址业务规则、选点交互和地图页面布局仍然有效：

- `docs/superpowers/specs/2026-07-12-property-rental-location-design.md`
- `docs/superpowers/specs/2026-07-12-property-rental-spatial-location-design.md`

## 2. 目标

- 将自建 PostgreSQL 17 切换到同主版本的 PostGIS 镜像。
- 使用 PostGIS `PointField` 作为小区和楼栋唯一的数据库坐标来源。
- 数据库统一存储 WGS84，经 API 边界与微信、高德使用的 GCJ-02 双向转换。
- 所有地图视野查询使用 GiST 空间索引，不再使用独立经纬度字段比较。
- 保留城市、区域、小区、楼栋四级聚合及当前全屏地图交互。
- 支持“附近 X 公里”筛选和按距离升序排列房源。
- 同时改造公开地图、组织楼栋地图和组织小区地图，避免项目内并存两套空间实现。
- 为未来商圈和行政区多边形查询保留扩展能力，但本次不实现多边形业务。
- 形成可验证、可备份恢复、可观察性能的部署流程。

## 3. 非目标

- 不实现路线规划、驾车距离或预计到达时间；本次距离均为空间直线距离。
- 不接入服务端地理编码、逆地理编码或地址纠错任务。
- 不保存单套 `House` 的独立坐标；房源继续继承所属楼栋位置。
- 不实现商圈、行政区边界或地铁线路的 `PolygonField` / `MultiPolygonField`。
- 不引入 Redis 地图缓存、地图瓦片服务、预聚合表或独立搜索引擎。
- 不长期保留旧 `lat/lng` 字段，不提供新旧坐标查询的运行时切换开关。
- 不修改地图供应商；H5 继续使用高德，微信小程序继续使用原生地图组件。

## 4. 已确认决策

### 4.1 数据库与部署

- 生产数据库为自建 Docker PostgreSQL。
- PostgreSQL 主版本保持 17，PostGIS 版本保持 3.6。
- AMD64 生产环境使用体积更小的 `postgis/postgis:17-3.6-alpine`。
- ARM64 本地开发通过 `compose.override.yml` 使用 `config/docker/Dockerfile.db` 构建原生镜像，不依赖架构模拟。
- 现有 PostgreSQL volume 继续使用，不通过删除或重建数据库完成迁移。
- 使用 Django migration 创建 PostGIS 扩展和迁移字段。
- 正式执行前必须生成可恢复的数据库备份。

### 4.2 坐标标准

- PostGIS 内部坐标统一为 WGS84，SRID 固定为 4326。
- 微信与高德输入输出坐标统一为 GCJ-02。
- 实体位置对象必须显式携带 `coordinate_system`；地图视野与附近查询也必须传该参数。本次只接受 `gcj02`，避免后端根据数值猜测坐标系。
- 坐标转换只发生在统一的领域服务中，页面、Schema 和模型不自行实现转换公式。
- `Point.x` 固定表示经度，`Point.y` 固定表示纬度。

### 4.3 兼容与范围

- 项目未上线，最终数据库模型不保留 `lat/lng`。
- 内部 API 可以同步调整为结构化位置字段，前端与 OpenAPI 客户端一起更新。
- 本次实现附近半径查询和距离排序；多边形筛选只保留扩展边界。

## 5. 总体架构

```text
微信地图 / 高德地图
        │ GCJ-02 坐标、视野边界、当前位置
        ▼
前端平台地图适配层
        │
        ▼
Django Ninja API
        │ 参数与业务约束校验
        ▼
apps.house.geo
├── coordinates.py：GCJ-02 ⇄ WGS84、Point 构造和序列化
└── queries.py：视野、聚合、附近和距离查询
        │ WGS84 / SRID 4326
        ▼
PostGIS PointField + GiST
        │
        ├── 当前视野空间过滤
        ├── 城市/区域/小区/楼栋聚合
        ├── 附近半径过滤
        └── 距离计算与排序
```

职责边界：

- 模型只保存规范化 WGS84 `Point`，不关心地图供应商。
- 坐标模块只负责坐标语义、范围验证和转换，不查询房源。
- 查询模块只接受 WGS84 `Point` 或空间范围，不解析 HTTP 参数。
- API 层只负责认证、参数校验、调用查询服务和响应组装。
- 前端地图组件只负责地图实例、视野事件和标记渲染。
- 前端页面负责筛选状态、请求竞态、选择状态和房源卡展示。

## 6. Docker 与 Django GIS 基础设施

### 6.1 数据库镜像

`compose.yml` 面向 AMD64 生产部署，数据库服务使用：

```yaml
db:
  image: postgis/postgis:17-3.6-alpine
```

本地开发自动加载 `compose.override.yml`，将数据库服务覆盖为 `linkcloud-space:postgres-postgis`，并通过 `config/docker/Dockerfile.db` 基于多架构的 `postgres:17` 构建，从 PGDG 仓库安装 `postgresql-17-postgis-3` 和对应 scripts 包。

生产部署必须只加载 `compose.yml`，不要加载本地覆盖文件。两套镜像均保持现有端口、环境变量、volume 和 `pg_isready` 健康检查；切换前后 PostgreSQL 主版本均为 17，不触发跨主版本数据目录升级。

### 6.2 Web 镜像

`config/docker/Dockerfile.web` 的 Python 基础阶段安装：

```text
binutils
gdal-bin
libgdal-dev
libgeos-dev
libproj-dev
```

数据库容器提供 PostGIS 服务端扩展；Web 和 Worker 镜像提供 GeoDjango 运行时依赖。Web、Worker 必须复用同一个包含 GIS 系统库的 Python 镜像，避免 Celery 导入模型时失败。

### 6.3 Django 设置

`config/settings/_base.py` 增加 `django.contrib.gis`，数据库 backend 固定为：

```python
django.contrib.gis.db.backends.postgis
```

现有 `DATABASE_URL`、SSL 和连接参数继续由 epicenv 管理。数据库配置生成完成后显式覆盖 `DATABASES["default"]["ENGINE"]`，避免 URL 解析器回退到普通 PostgreSQL backend。

### 6.4 扩展创建

使用独立 Django migration 执行：

```python
CreateExtension("postgis")
```

迁移用户必须具有创建扩展权限。自建 Docker 默认数据库所有者满足该条件；部署验收仍需读取 `pg_extension` 确认 `postgis` 已安装。

## 7. 领域数据模型

### 7.1 小区与楼栋

`Estate` 与 `Building` 使用相同字段：

```python
location = PointField(
    srid=4326,
    geography=True,
    spatial_index=True,
    null=True,
    blank=True,
    verbose_name="地理位置",
)
```

最终删除两个模型的 `lat`、`lng` 字段。

语义规则：

- 小区位置表示项目整体展示点，可以为空。
- 楼栋位置表示精确导航和房源距离计算点，可以为空。
- 房源不新增位置字段，统一使用 `house.building.location`。
- 小区位置不会自动覆盖已保存的楼栋位置。
- 新建楼栋时可以使用所属小区位置作为表单初始值；保存后成为独立楼栋位置。
- 无位置对象不进入地图空间结果，并通过待定位计数或列表单独呈现。

### 7.2 索引

`PointField(spatial_index=True)` 创建 GiST 空间索引。普通业务字段继续使用 B-tree 索引：

- `House.status` 复用现有索引。
- `Building.estate_id`、`Building.organization_id` 复用外键索引。
- `Estate.organization_id` 复用外键索引。
- 城市、区域搜索若执行计划证明需要，再通过同一实现变更增加组合 B-tree 索引；本次不预先添加没有执行计划证据的索引。

### 7.3 数据校验

模型与 API 共同保证：

- 经度范围 `[-180, 180]`。
- 纬度范围 `[-90, 90]`。
- 位置输入必须同时包含经度和纬度。
- 小区保存位置时地址不能为空。
- 楼栋地址继续必填，无论位置是否为空。
- `Point` 必须为 SRID 4326。
- 无穷值、NaN 和非数值输入返回字段级 422。

## 8. API 坐标契约

### 8.1 结构化位置

实体写入使用：

```json
{
  "location": {
    "longitude": 113.934567,
    "latitude": 22.540123,
    "coordinate_system": "gcj02"
  }
}
```

实体读取返回同样结构，输出坐标系固定为 `gcj02`。数据库中的 WGS84 不直接暴露给微信、高德页面。

PATCH 语义：

- 未提供 `location`：保持位置不变。
- `location: null`：清除位置。
- 提供完整对象：替换位置。
- 只提供经度或纬度：返回 422。

使用 Pydantic `model_fields_set` 区分“未提供”和“明确清空”，不再通过两个可空字段推断操作意图。

### 8.2 地图标记响应

地图标记使用统一嵌套字段：

```json
{
  "key": "building:42",
  "level": "building",
  "name": "1 栋",
  "location": {
    "longitude": 113.934567,
    "latitude": 22.540123,
    "coordinate_system": "gcj02"
  },
  "house_count": 8,
  "child_count": 8,
  "min_rent": "3200.00",
  "target_zoom": 17
}
```

公开地图、组织小区地图和组织楼栋地图统一使用 `location`，不并存 `lat/lng` 与 `latitude/longitude` 三套命名。

## 9. 坐标转换设计

新增：

```text
apps/house/geo/__init__.py
apps/house/geo/coordinates.py
apps/house/geo/queries.py
```

`coordinates.py` 提供：

```python
is_outside_china(longitude, latitude)
wgs84_to_gcj02(longitude, latitude)
gcj02_to_wgs84(longitude, latitude)
make_wgs84_point(longitude, latitude, coordinate_system)
serialize_point(point, coordinate_system="gcj02")
convert_viewport_to_wgs84(west, south, east, north, coordinate_system)
```

转换规则：

- 中国境内使用确定性 GCJ-02 转换公式。
- GCJ-02 转 WGS84 使用迭代逆变换，最多 10 次，目标误差不高于 `1e-7` 度。
- 中国境外坐标保持不变。
- 视野范围转换四个角点，再以转换结果的最小、最大经纬度构造 WGS84 包围盒。
- 所有对外返回值按 6 位小数序列化，数据库点保留双精度。
- 转换模块不调用第三方网络服务，也不依赖高德服务端配额。

本项目不将 GCJ-02 数据伪装为 EPSG:4326。只有转换后的 WGS84 才能构造 SRID 4326 `Point`，从而保证 PostGIS 距离单位和空间关系语义正确。

## 10. 公开地图视野接口

继续使用：

```http
GET /api/public/houses/map/
```

请求参数：

```text
zoom: 3..20
west: GCJ-02 经度
south: GCJ-02 纬度
east: GCJ-02 经度
north: GCJ-02 纬度
keyword: 可选
district: 可选
coordinate_system: 必填，当前仅支持 gcj02
```

四个边界参数必须同时提供或同时省略，且满足 `west < east`、`south < north`。当前产品范围不处理跨国际日期变更线视野。

### 10.1 聚合层级

| Zoom | 返回层级 | 点击目标 Zoom |
|---:|---|---:|
| 3–7 | 城市 | 9 |
| 8–10 | 区域 | 12 |
| 11–14 | 小区 | 15 |
| 15–20 | 楼栋 | 17 |

### 10.2 空间过滤

视野参数经坐标转换后构造 SRID 4326 Polygon，查询使用空间关系：

```python
building__location__intersects=viewport
```

使用 `intersects` 包含正好落在视野边界上的点。楼栋层级严格使用楼栋位置；城市、区域和小区聚合也以可定位楼栋为主要空间过滤对象。

### 10.3 聚合位置

- 楼栋标记直接使用 `Building.location`。
- 小区优先使用 `Estate.location`；小区未定位时使用当前匹配且已定位楼栋的空间中心点。
- 城市和区域使用当前匹配楼栋位置集合的空间中心点。
- 空间中心通过 `ST_Centroid(ST_Collect(location::geometry))` 计算。
- 中心点仅用于标记展示，不参与房源距离排序。

### 10.4 数量与截断

单次最多返回 200 个标记，但数量字段不得受标记截断影响：

```json
{
  "level": "estate",
  "zoom": 12,
  "visible_house_count": 328,
  "marker_count": 42,
  "unlocated_house_count": 3,
  "truncated": false,
  "items": []
}
```

- `visible_house_count`：整个当前视野内符合筛选条件的公开房源数。
- `marker_count`：实际返回的标记数量。
- `unlocated_house_count`：符合非空间筛选但所属楼栋未定位的房源数，因此不属于某个可见视野。
- `truncated`：聚合组超过 200 个时为 true。
- `items`：按房源数降序、稳定业务键升序返回前 200 个标记。

前端在 `truncated=true` 时提示用户继续放大地图，不尝试下载全部数据后在客户端聚合。

## 11. 附近房源与距离排序

扩展现有公开房源列表：

```http
GET /api/public/houses/
```

新增参数：

```text
longitude: 可选，GCJ-02
latitude: 可选，GCJ-02
radius_m: 可选，默认 3000
sort: 增加 distance_asc
coordinate_system: 提供经纬度时必填，当前仅支持 gcj02
```

约束：

- 经度和纬度必须同时提供。
- 提供经纬度时必须同时提供 `coordinate_system=gcj02`。
- `radius_m` 仅在提供位置时有效。
- `radius_m` 最小 100，最大 50000。
- `sort=distance_asc` 必须提供位置。
- 附近查询只返回楼栋已定位的房源。
- 其他关键词、区域、租金、面积、户型、装修、标签和发布方筛选继续组合生效。

查询语义：

```python
origin = Point(wgs84_longitude, wgs84_latitude, srid=4326)

queryset.filter(
    building__location__distance_lte=(origin, D(m=radius_m)),
).annotate(
    distance=Distance("building__location", origin),
).order_by("distance", "id")
```

响应中的每套房源增加可空字段：

```json
{
  "distance_m": 1280
}
```

- 传入定位点时返回整数米。
- 普通列表未传定位点时返回 `null`。
- 距离相同以房源 ID 保证稳定分页。
- 分页继续使用 `{ items, total, page, page_size }`。

前端展示规则：

- 小于 1000 米：`距你 680m`。
- 大于等于 1000 米：保留一位小数，例如 `距你 1.3km`。
- 没有距离不展示占位文案。

## 12. 组织地图接口

以下接口全部改用 PostGIS：

- `GET /api/house/estate-map/`
- `GET /api/house/building-map/`
- `GET /api/house/building-map-unlocated/`
- `GET /api/house/building-map-unlocated-count/`
- `GET /api/house/building-map/{building_id}/`

规则：

- 继续使用当前组织隔离和权限认证。
- 视野边界仍由前端以 GCJ-02 发送，后端转换后执行空间查询。
- 待定位条件统一为 `location IS NULL`。
- 小区位置缺失时继续以已定位楼栋中心点作为地图展示点。
- 楼栋详情输出结构化 `location`。
- 房源状态、小区、关键词和独立楼栋筛选逻辑保持不变。
- 分页接口遵守项目统一的 `page`、`page_size` 和 `{ items, total, page, page_size }` 响应结构。

管理端和小程序组织地图必须通过重新生成的 OpenAPI 客户端消费新位置结构，不手工修改生成文件。

## 13. 查询模块设计

`apps/house/geo/queries.py` 对外提供明确入口：

```python
get_public_map_markers(filters, viewport, zoom, limit=200)
apply_nearby_house_filter(queryset, origin, radius_m)
apply_house_distance_ordering(queryset, origin)
get_organization_estate_markers(organization, filters, viewport)
get_organization_building_markers(organization, filters, viewport)
```

实现原则：

- 空间查询先缩小楼栋范围，再关联房源聚合。
- 对公开房源只统计 `HouseStatus.LISTED`。
- 组织地图继续沿用现有有效房源状态口径。
- 不在 API 函数中拼接 GIS 表达式。
- 不把 QuerySet、模型实例或 WGS84 原始点直接暴露给前端。
- 每个聚合查询必须有独立的 SQL 数量口径测试。
- 不为了复用而构造一个接收大量布尔参数的通用地图函数；公开地图和组织地图共享底层空间表达式，但保留各自业务入口。

## 14. 前端设计

### 14.1 共享领域能力

在 `frontend_miniprogram/src/features/houses/` 中集中维护：

- 地图视野请求参数。
- 地图层级与目标缩放。
- 附近半径状态。
- 距离格式化。
- 地图请求竞态控制。

平台地图组件只负责：

- H5 高德地图创建与销毁。
- 微信原生地图视野读取。
- `moveend` / `zoomend` / `regionchange` 事件。
- 标记渲染、点击和地图空白点击。

### 14.2 地图视野请求

- 地图停止移动或缩放后等待 320ms 请求。
- 新请求开始时保留旧标记并显示轻量“更新中”。
- 只应用最后一次请求结果；旧响应不得覆盖新视野。
- 请求失败保留旧标记并显示非阻塞提示。
- 初次加载失败才展示整页错误和重试。
- `truncated=true` 时显示“房源较多，请继续放大”。

### 14.3 四级下钻

- 城市标记点击后居中并缩放至 9。
- 区域标记点击后居中并缩放至 12。
- 小区标记点击后居中并缩放至 15。
- 楼栋标记点击后读取该楼栋房源并展示底部房源卡。
- 地图空白点击清除选中房源卡。
- 放大、缩小、当前位置、恢复全览继续作为悬浮操作。

### 14.4 附近筛选

地图和公开房源列表增加：

- “附近”入口。
- 1km、3km、5km、10km 四档半径。
- “距离优先”排序。
- 房源卡距离文案。
- 地图半径圆形覆盖物。

用户开启附近筛选时：

1. 请求定位权限。
2. 获取 GCJ-02 当前坐标。
3. 使用选择的半径请求公开房源。
4. 地图居中到当前位置并展示范围圆。
5. 定位失败时保留普通找房结果，小程序提供“去设置”，H5 提示检查浏览器权限。

附近筛选不会自动持续追踪用户位置；用户点击当前位置或重新进入附近模式时才刷新位置，避免无必要的连续定位和隐私提示。

## 15. 数据迁移

虽然项目未上线，迁移仍拆分为可检查步骤，不修改已应用的历史 migration。

### 15.1 迁移顺序

1. 创建 PostGIS 扩展。
2. 为 `Estate`、`Building` 增加 nullable `location`。
3. 将现有成对 `lat/lng` 视为 GCJ-02，转换为 WGS84 Point 后写入 `location`。
4. 通过独立 `RunPython` 操作校验回填数量、SRID 和坐标范围；任何异常都必须让 migration 失败。
5. 删除旧 `lat`、`lng` 字段。

上述 migration 在同一版本中交付，并在部署前对数据库备份的恢复副本完整演练。生产启动时现有 `migrate --noinput` 会按顺序执行全部操作；运行时业务代码不经历双写阶段。

### 15.2 回填要求

- 转换算法冻结在数据 migration 中，不导入未来可能变化的业务模块。
- 完整成对坐标必须全部回填成功。
- 两个字段均为空时保持 `location=NULL`。
- 只有一个坐标存在时 migration 明确失败，不静默丢弃。
- 坐标越界时 migration 明确失败并输出模型与主键。

### 15.3 回填验收

校验操作必须在移除旧字段前满足：

```text
有效 Estate lat/lng 数量 = Estate location 数量
有效 Building lat/lng 数量 = Building location 数量
单边缺失坐标数量 = 0
location SRID 异常数量 = 0
转换后坐标越界数量 = 0
```

最终 schema 只有 `location`，业务代码不保留旧字段读取分支。

## 16. 错误处理

| 场景 | 处理 |
|---|---|
| PostGIS 扩展无法创建 | migration 失败，应用不启动，保留原数据库数据 |
| Web 镜像缺少 GIS 库 | 构建或 Django system check 失败，不进入部署 |
| 坐标越界或不完整 | API 返回字段级 422 |
| 地图边界不完整或逆序 | API 返回 422“地图范围无效” |
| 半径超出 100–50000 米 | API 返回字段级 422 |
| 距离排序缺少定位点 | API 返回字段级 422 |
| 无定位房源 | 不进入空间结果，计入待定位数量 |
| 地图请求失败 | 前端保留旧标记并允许重试 |
| 用户拒绝定位 | 普通找房保持可用，提供权限引导 |
| 坐标转换异常 | 请求失败并记录结构化错误，不写入未经转换的坐标 |

日志不得记录用户持续位置轨迹。地图请求可记录缩放等级、耗时、结果数量和截断状态，但默认不记录完整精确坐标。

## 17. 测试设计

### 17.1 坐标单元测试

- 深圳、广州等已知点的 WGS84 → GCJ-02 结果。
- GCJ-02 → WGS84 → GCJ-02 往返误差不高于 `1e-7` 度。
- 中国境外坐标保持不变。
- 经度写入 `Point.x`，纬度写入 `Point.y`。
- 四角视野转换后生成有效 Polygon。
- NaN、无穷值、越界和不完整位置被拒绝。

### 17.2 模型与 CRUD 测试

- 小区和楼栋创建、更新、清空位置。
- PATCH 未提供位置时保持原值。
- 数据库存储 WGS84，API 输出 GCJ-02。
- 楼栋地址必填和小区有位置时地址必填规则。
- 房源始终继承楼栋位置。

### 17.3 空间接口测试

- 视野内、视野外和正好落在边界上的楼栋。
- 城市、区域、小区、楼栋四级聚合。
- 小区自身无位置时使用楼栋中心点。
- 公开状态、组织隔离和筛选条件。
- 200 标记截断不影响 `visible_house_count`。
- 待定位统计口径。
- 1km、3km、5km、10km 半径边界。
- 距离升序与相同距离下稳定 ID 排序。
- 距离和普通分页结构符合项目约定。

### 17.4 前端测试

- H5 `zoomend`、`moveend` 与小程序 `regionchange` 触发视野请求。
- 连续视野变化只采用最后响应。
- 四级标记点击下钻。
- 楼栋房源卡加载和错误状态。
- 附近半径切换和距离格式化。
- 定位拒绝后的 H5 与小程序处理。
- 最终微信 `app.json` 包含位置权限。
- 生产微信 WXSS 不包含不兼容选择器。

### 17.5 数据库集成测试

- migration 可在空库完整执行。
- migration 可在包含现有坐标数据的 PostgreSQL 17 volume 上执行。
- `pg_extension` 包含 `postgis`。
- `pg_indexes` 包含 Estate、Building 位置 GiST 索引。
- `EXPLAIN ANALYZE` 的有限视野和附近查询使用空间索引。

## 18. 性能与可观察性

### 18.1 基准数据

建立不进入生产数据的性能 fixture：

- 2 万栋楼。
- 5 千个小区。
- 10 万套公开房源。
- 坐标覆盖多个城市和高密度城区。

### 18.2 性能目标

| 场景 | 数据规模 | 数据库 P95 目标 |
|---|---:|---:|
| 楼栋视野查询 | 2 万楼栋 | < 150ms |
| 城区聚合 | 10 万房源 | < 300ms |
| 附近 3km | 2 万楼栋 | < 150ms |
| 距离分页 | 10 万房源 | < 250ms |

### 18.3 观测指标

地图接口记录：

- 接口总耗时。
- 数据库查询耗时。
- zoom 和聚合层级。
- 返回标记数。
- 是否截断。
- 可见房源数量。
- 是否为附近查询。

不记录用户精确经纬度。慢查询通过 PostgreSQL 日志或应用 tracing 定位，不能仅依靠前端感知判断索引是否生效。

## 19. 部署与回滚

### 19.1 部署顺序

1. 使用现有备份方式导出数据库并验证备份文件可读取。
2. 将备份恢复到隔离的演练数据库，完整执行 PostGIS 镜像切换和全部 migration。
3. 在演练数据库校验位置数量、SRID、空间索引、接口测试和 `EXPLAIN ANALYZE`。
4. 构建包含 GeoDjango 系统库的 Web/Worker 镜像。
5. 预先生成管理端和小程序 OpenAPI 客户端并完成三个前端生产构建。
6. 停止业务写入后再次生成最终数据库备份。
7. AMD64 生产环境启动 `postgis/postgis:17-3.6-alpine` 数据库容器，复用现有 volume；ARM64 开发环境继续使用本地覆盖的原生镜像。
8. 确认 PostgreSQL 主版本、数据库连接和原有表正常。
9. 启动新 Web 镜像，由现有启动命令执行全部 migration。
10. 校验 PostGIS 扩展、位置数量、SRID 和空间索引。
11. 运行房源地图与附近查询后端冒烟测试。
12. 在管理端、H5 和微信开发者工具执行地图交互验收。

### 19.2 回滚

- migration 在删除旧字段前失败：修复原因后继续迁移，或回退应用并恢复部署前备份；不得跳过校验操作强制继续。
- migration 已全部完成：由于最终设计不保留兼容字段，回滚应用与数据必须一起恢复到部署前备份。
- PostGIS 镜像与普通 PostgreSQL 镜像使用同一主版本，但回滚时仍以经过验证的数据库备份为准，不依赖直接切回镜像碰运气。
- 不通过降低 PostgreSQL 主版本或直接替换数据目录回滚。
- 不在故障现场删除 volume、数据库或 migration 文件。

## 20. 安全与隐私

- 小程序继续在最终 `app.json` 声明 `scope.userLocation`、`getLocation` 和 `chooseLocation`。
- 定位只在用户触发“当前位置”或“附近”时请求，不在应用启动时自动获取。
- 附近查询不建立用户位置历史表。
- 应用日志、错误上报和分析事件不记录完整精确坐标。
- 对外地图接口只返回公开房源关联的展示坐标，不返回未公开房源位置。
- 组织地图继续经过登录认证、组织选择和组织数据隔离。

## 21. 文件影响范围

### 21.1 后端与基础设施

- `compose.yml`
- `config/docker/Dockerfile.web`
- `config/settings/_base.py`
- `apps/house/models.py`
- `apps/house/schemas.py`
- `apps/house/api.py`
- `apps/house/services.py`
- `apps/house/geo/__init__.py`
- `apps/house/geo/coordinates.py`
- `apps/house/geo/queries.py`
- `apps/house/migrations/`
- `tests/house/`

### 21.2 管理端

- `frontend_admin/src/pages/rental/map/`
- `frontend_admin/src/services/openapi/`
- 小区和楼栋位置表单相关组件
- 对应 Vitest / Testing Library 测试

### 21.3 小程序与 H5

- `frontend_miniprogram/src/pages-housing/map/index.vue`
- `frontend_miniprogram/src/components/house/HouseH5Map.vue`
- `frontend_miniprogram/src/features/houses/service.ts`
- `frontend_miniprogram/src/services/manual/houses.ts`
- `frontend_miniprogram/src/services/openapi/`
- 房源列表、筛选和房源卡共享组件
- 地图、距离和构建权限测试

自动生成的 OpenAPI 文件只能通过项目生成命令更新，不手工编辑。

## 22. 验收标准

- 数据库镜像为固定版本 PostGIS，`pg_extension` 存在 `postgis`。
- Django Web 与 Worker 均能加载 GeoDjango 模型。
- Estate、Building 最终只保存 WGS84 `location`，不存在业务使用中的 `lat/lng`。
- 数据库存储 WGS84，H5 与微信地图收到 GCJ-02。
- 管理端、H5、小程序的选点、展示和导航位置一致。
- 公开地图按当前视野返回四级聚合结果。
- 组织小区和楼栋地图使用 PostGIS 视野过滤。
- 附近 1km、3km、5km、10km 查询结果正确。
- 距离排序稳定，房源卡距离显示正确。
- 200 标记截断不会错误减少可见房源总数。
- 待定位对象不会产生伪造标记。
- 空间查询通过执行计划确认使用 GiST 索引。
- 后端测试、前端测试、类型检查、Lint 和三个前端生产构建全部通过。
- 微信生产构建最终 `app.json` 包含定位权限，地图 WXSS 可被微信开发者工具编译。

## 23. 延后扩展

当产品需要商圈或行政区筛选时，可以新增独立区域模型：

```text
GeoArea
├── type：business_district / administrative_district / custom
├── name
├── boundary：MultiPolygonField(SRID 4326)
└── organization：可空，区分公共区域与组织区域
```

房源通过楼栋位置与 `boundary__covers=building.location` 判断归属。该扩展复用本设计的 WGS84、GiST、坐标转换和查询服务，无需再次迁移小区、楼栋坐标模型。
