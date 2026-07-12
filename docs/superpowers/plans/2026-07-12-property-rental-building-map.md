# 房源地图业务化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理端“房源租赁”中重新启用以楼栋为聚合单位的房源地图，支持楼栋汇总、房源浏览、地图选点和业务详情跳转。

**Architecture:** 后端在 `apps.house` 提供按组织隔离的楼栋地图标点、未定位统计和楼栋地图详情接口；地图详情复用一个确定性的房号自然排序服务。前端将原通用模拟地图迁移到 `property-rental/map`，使用高德 JSAPI 展示真实楼栋、抽屉详情与 URL 状态；`LocationPicker` 使用同一 JSAPI 提供浏览器定位、地址搜索和人工选点，确认后仅回填楼栋表单的既有经纬度字段。

**Tech Stack:** Django 5、django-ninja、Django ORM、pytest、React 19、Umi Max、Ant Design 6、TanStack Query、Vitest、`@amap/amap-jsapi-loader`。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `apps/house/services.py` | 楼栋房源自然排序和地图查询共用的纯业务函数。 |
| `apps/house/schemas.py` | 地图标点、楼栋详情、房源摘要和未定位统计的 API Schema。 |
| `apps/house/api.py` | 组织隔离的地图列表、统计和详情端点。 |
| `tests/house/test_api.py` | 地图端点、汇总、边界过滤、跨组织和房号排序回归测试。 |
| `frontend_admin/src/services/manual/house.ts` | 对生成 OpenAPI 函数的房产业务适配。 |
| `frontend_admin/src/services/manual/amap.ts` | 高德 JSAPI 及地图插件的统一加载。 |
| `frontend_admin/src/pages/property-rental/components/LocationPicker.tsx` | 地址搜索、浏览器定位、拖动/点击选点和确认回传。 |
| `frontend_admin/src/pages/property-rental/components/LocationPicker.test.tsx` | 选点组件的交互测试。 |
| `frontend_admin/src/pages/property-rental/map/index.tsx` | 楼栋地图、筛选、地图视口、标点聚合和详情抽屉。 |
| `frontend_admin/src/pages/property-rental/map/index.test.tsx` | 房源地图查询、抽屉、跳转与 URL 状态测试。 |
| `frontend_admin/src/pages/property-rental/buildings/detail.tsx` | 楼栋详情与按自然顺序的房源列表。 |
| `frontend_admin/src/pages/property-rental/buildings/detail.test.tsx` | 楼栋详情跳转和房源展示测试。 |
| `frontend_admin/src/pages/property-rental/estates/index.tsx` | 楼栋新建/编辑抽屉接入地图选点。 |
| `frontend_admin/config/routes.ts` | 房源地图和楼栋详情路由；移除通用地理菜单入口。 |
| `frontend_admin/src/locales/zh-CN/menu.ts`、`frontend_admin/src/locales/en-US/menu.ts` | 房源地图、楼栋详情菜单翻译。 |

## Task 1: 锁定楼栋房源的自然排序规则

**Files:**

- Modify: `apps/house/services.py`
- Modify: `tests/house/test_models.py`

- [ ] **Step 1: 写出失败的自然排序测试**

  在 `tests/house/test_models.py` 的房源领域测试中加入：

  ```python
  from apps.house.services import sort_houses_for_building

  def test_sort_houses_for_building_orders_floor_then_natural_room_number(self):
      building = self.make_building()
      houses = [
          self.make_house(building=building, room_number="A10", floor=2),
          self.make_house(building=building, room_number="A2", floor=2),
          self.make_house(building=building, room_number="10", floor=1),
          self.make_house(building=building, room_number="2", floor=1),
          self.make_house(building=building, room_number="102", floor=None),
          self.make_house(building=building, room_number="101", floor=None),
      ]

      self.assertEqual(
          [house.room_number for house in sort_houses_for_building(houses)],
          ["2", "10", "A2", "A10", "101", "102"],
      )
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `docker compose exec web pytest tests/house/test_models.py::HouseDomainTestCase -q`

  Expected: FAIL，提示 `sort_houses_for_building` 尚不存在。

- [ ] **Step 3: 实现可复用的排序键**

  在 `apps/house/services.py` 添加以下函数；不要改变现有列表 API 的数据库排序：

  ```python
  import re

  _NATURAL_ROOM_PARTS = re.compile(r"(\d+)")

  def natural_room_sort_key(room_number: str) -> tuple[tuple[int, int | str], ...]:
      return tuple(
          (0, int(part)) if part.isdigit() else (1, part.casefold())
          for part in _NATURAL_ROOM_PARTS.split(room_number.strip())
          if part
      )

  def sort_houses_for_building(houses):
      return sorted(
          houses,
          key=lambda house: (
              house.floor is None,
              house.floor if house.floor is not None else 0,
              natural_room_sort_key(house.room_number),
              house.pk,
          ),
      )
  ```

- [ ] **Step 4: 运行测试并确认通过**

  Run: `docker compose exec web pytest tests/house/test_models.py -q`

  Expected: PASS。

- [ ] **Step 5: 提交排序服务**

  ```bash
  git add apps/house/services.py tests/house/test_models.py
  git commit -m "feat: 支持楼栋房源自然排序"
  ```

## Task 2: 定义楼栋地图 API 输出

**Files:**

- Modify: `apps/house/schemas.py`
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: 写出地图端点契约测试**

  在 `HouseApiTestCase` 中加入测试，先固定标点所需字段和未定位统计：

  ```python
  def test_building_map_returns_organization_scoped_markers_and_unlocated_count(self):
      self.building.lat = Decimal("22.533100")
      self.building.lng = Decimal("113.930400")
      self.building.save()
      Building.objects.create(organization=self.org, estate=self.estate, name="未定位楼", floors=8)
      _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()
      other_house.building.lat = Decimal("22.540000")
      other_house.building.lng = Decimal("113.940000")
      other_house.building.save()

      response = self.client.get("/api/house/building-map/?page=1&page_size=50")
      count_response = self.client.get("/api/house/building-map-unlocated-count/")

      self.assertEqual(response.status_code, 200)
      self.assertEqual([item["id"] for item in api_data(response)["items"]], [self.building.pk])
      self.assertEqual(api_data(response)["items"][0]["is_located"], True)
      self.assertEqual(api_data(count_response), {"count": 1})
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `docker compose exec web pytest tests/house/test_api.py::HouseApiTestCase::test_building_map_returns_organization_scoped_markers_and_unlocated_count -q`

  Expected: FAIL，端点返回 404。

- [ ] **Step 3: 添加精确 Schema**

  在 `apps/house/schemas.py` 添加：

  ```python
  class BuildingMapCountsOut(Schema):
      total: int
      vacant: int
      rented: int
      renovating: int
      locked: int
      published: int

  class BuildingMapMarkerOut(Schema):
      id: int
      estate: EstateSummaryOut | None
      name: str
      address: str
      lat: Decimal
      lng: Decimal
      is_active: bool
      is_located: bool = True
      counts: BuildingMapCountsOut

      @staticmethod
      def resolve_counts(obj):
          return {
              "total": obj.total,
              "vacant": obj.vacant,
              "rented": obj.rented,
              "renovating": obj.renovating,
              "locked": obj.locked,
              "published": obj.published,
          }

  class BuildingMapHouseOut(Schema):
      id: int
      room_number: str
      floor: int | None
      area: Decimal | None
      asking_rent: Decimal | None
      status: str
      status__mapping: str
      publish_status: str
      publish_status__mapping: str

      @staticmethod
      def resolve_status__mapping(obj):
          return HouseStatus.get_choice_label(obj.status)

      @staticmethod
      def resolve_publish_status__mapping(obj):
          return HousePublishStatus.get_choice_label(obj.publish_status)

  class BuildingMapDetailOut(BuildingOut):
      counts: BuildingMapCountsOut
      houses: list[BuildingMapHouseOut]

  class CountOut(Schema):
      count: int
  ```

- [ ] **Step 4: 确认 Schema 单元测试通过**

  Run: `docker compose exec web pytest tests/house/test_api.py::HouseApiTestCase::test_building_map_returns_organization_scoped_markers_and_unlocated_count -q`

  Expected: 仍 FAIL，原因仅为端点尚未实现。

- [ ] **Step 5: 提交 API Schema**

  ```bash
  git add apps/house/schemas.py tests/house/test_api.py
  git commit -m "feat: 定义楼栋地图接口模型"
  ```

## Task 3: 实现楼栋地图列表、统计和详情 API

**Files:**

- Modify: `apps/house/api.py`
- Modify: `apps/house/services.py`
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: 补齐失败用例**

  在 `tests/house/test_api.py` 增加下列断言：

  ```python
  def test_building_map_filters_bounds_keyword_status_and_inactive(self):
      self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
      self.building.save()
      matching = House.objects.create(building=self.building, room_number="101", status=HouseStatus.VACANT)
      inactive = Building.objects.create(organization=self.org, estate=self.estate, name="停用楼", floors=8, lat=Decimal("22.534000"), lng=Decimal("113.931000"), is_active=False)
      House.objects.create(building=inactive, room_number="201", status=HouseStatus.VACANT)

      response = self.client.get("/api/house/building-map/?west=113.92&south=22.52&east=113.94&north=22.54&keyword=1栋&house_status=vacant&page=1&page_size=20")
      self.assertEqual([item["id"] for item in api_data(response)["items"]], [self.building.pk])
      self.assertEqual(api_data(response)["items"][0]["counts"]["vacant"], 1)
      self.assertNotEqual(matching.pk, 0)
      self.assertNotIn(inactive.pk, [item["id"] for item in api_data(response)["items"]])

  def test_building_map_detail_sorts_houses_and_rejects_other_organization(self):
      House.objects.create(building=self.building, room_number="10", floor=1)
      House.objects.create(building=self.building, room_number="2", floor=1)
      House.objects.create(building=self.building, room_number="A10", floor=2)
      House.objects.create(building=self.building, room_number="A2", floor=2)
      response = self.client.get(f"/api/house/building-map/{self.building.pk}/")
      self.assertEqual([item["room_number"] for item in api_data(response)["houses"]], ["2", "10", "A2", "A10"])
      _other_org, other_house, _other_landlord, _other_tenant = self.make_other_org_house()
      self.assertEqual(self.client.get(f"/api/house/building-map/{other_house.building_id}/").status_code, 404)
  ```

- [ ] **Step 2: 运行新增测试并确认失败**

  Run: `docker compose exec web pytest tests/house/test_api.py -k "building_map" -q`

  Expected: FAIL，未注册的地图端点返回 404。

- [ ] **Step 3: 在 API 中实现严格过滤和聚合**

  在 `apps/house/api.py` 导入 `Count`、`HttpError` 和 `HouseStatus`、`HousePublishStatus`，并在 `apps/house/services.py` 添加 `_building_map_counts`。`@paginate(LegacyPagination)` 保持全部分页端点的项目约定；`page_size` 最大值由 `LegacyPagination` 的现有规则控制。

  ```python
  def _building_map_queryset(org, *, keyword=None, estate_id=None, house_status=None, include_inactive=False, west=None, south=None, east=None, north=None):
      qs = Building.objects.filter(organization=org, lat__isnull=False, lng__isnull=False).select_related("estate")
      if not include_inactive:
          qs = qs.filter(is_active=True)
      if estate_id is not None:
          qs = qs.filter(estate_id=estate_id)
      if keyword:
          qs = qs.filter(Q(name__icontains=keyword) | Q(address__icontains=keyword) | Q(estate__name__icontains=keyword) | Q(estate__display_name__icontains=keyword))
      if house_status:
          qs = qs.filter(houses__status=house_status)
      if None not in {west, south, east, north}:
          qs = qs.filter(lng__gte=west, lng__lte=east, lat__gte=south, lat__lte=north)
      return qs.annotate(
          total=Count("houses", distinct=True),
          vacant=Count("houses", filter=Q(houses__status=HouseStatus.VACANT), distinct=True),
          rented=Count("houses", filter=Q(houses__status=HouseStatus.RENTED), distinct=True),
          renovating=Count("houses", filter=Q(houses__status=HouseStatus.RENOVATING), distinct=True),
          locked=Count("houses", filter=Q(houses__status=HouseStatus.LOCKED), distinct=True),
          published=Count("houses", filter=Q(houses__publish_status=HousePublishStatus.PUBLISHED), distinct=True),
      ).order_by("estate__name", "name", "id")
  ```

  在 `apps/house/services.py` 添加详情共用的汇总函数：

  ```python
  def building_map_counts(houses):
      return {
          "total": len(houses),
          "vacant": sum(house.status == HouseStatus.VACANT for house in houses),
          "rented": sum(house.status == HouseStatus.RENTED for house in houses),
          "renovating": sum(house.status == HouseStatus.RENOVATING for house in houses),
          "locked": sum(house.status == HouseStatus.LOCKED for house in houses),
          "published": sum(house.publish_status == HousePublishStatus.PUBLISHED for house in houses),
      }
  ```

  使用该查询集实现：

  ```python
  @router.get("/building-map/", response=list[BuildingMapMarkerOut], summary="获取楼栋地图标点")
  @paginate(LegacyPagination)
  def list_building_map(request, keyword: str | None = Query(None), estate_id: int | None = Query(None), house_status: str | None = Query(None), include_inactive: bool = Query(False), west: Decimal | None = Query(None), south: Decimal | None = Query(None), east: Decimal | None = Query(None), north: Decimal | None = Query(None)):
      if None not in {west, south, east, north} and (west >= east or south >= north):
          raise HttpError(422, "地图范围无效")
      return _building_map_queryset(require_org_selected(request), keyword=keyword, estate_id=estate_id, house_status=house_status, include_inactive=include_inactive, west=west, south=south, east=east, north=north)

  @router.get("/building-map-unlocated-count/", response=CountOut, summary="获取待定位楼栋数量")
  def get_building_map_unlocated_count(request):
      org = require_org_selected(request)
      return {"count": Building.objects.filter(organization=org).filter(Q(lat__isnull=True) | Q(lng__isnull=True)).count()}

  @router.get("/building-map/{building_id}/", response=BuildingMapDetailOut, summary="获取楼栋地图详情")
  def get_building_map_detail(request, building_id: int):
      building = get_object_or_404(Building.objects.select_related("estate"), pk=building_id, organization=require_org_selected(request))
      houses = sort_houses_for_building(list(building.houses.select_related("building__estate").all()))
      return {
          "id": building.id,
          "estate_id": building.estate_id,
          "estate": building.estate,
          "name": building.name,
          "floors": building.floors,
          "under_floors": building.under_floors,
          "year_built": building.year_built,
          "elevator": building.elevator,
          "lat": building.lat,
          "lng": building.lng,
          "address": building.address,
          "is_active": building.is_active,
          "counts": building_map_counts(houses),
          "houses": houses,
      }
  ```

- [ ] **Step 4: 运行地图 API 测试**

  Run: `docker compose exec web pytest tests/house/test_api.py -k "building_map" -q`

  Expected: PASS。

- [ ] **Step 5: 运行房源 API 回归测试**

  Run: `docker compose exec web pytest tests/house/test_api.py tests/house/test_models.py -q`

  Expected: PASS。

- [ ] **Step 6: 提交后端地图 API**

  ```bash
  git add apps/house/api.py apps/house/services.py tests/house/test_api.py
  git commit -m "feat: 提供楼栋房源地图接口"
  ```

## Task 4: 生成并适配管理端 API 客户端

**Files:**

- Modify: `frontend_admin/src/services/openapi/`
- Modify: `frontend_admin/src/services/manual/house.ts`

- [ ] **Step 1: 启动包含新 Schema 的本地 API 并生成客户端**

  Run:

  ```bash
  docker compose exec web python manage.py migrate
  cd frontend_admin && nvm use 22 && npm run openapi
  ```

  Expected: `src/services/openapi/propertyRentalManagement.ts` 中出现 `appsHouseApiListBuildingMap`、`appsHouseApiGetBuildingMapDetail` 和 `appsHouseApiGetBuildingMapUnlocatedCount`。

- [ ] **Step 2: 先添加适配层类型和失败类型检查用法**

  在 `frontend_admin/src/services/manual/house.ts` 定义：

  ```typescript
  export type BuildingMapMarkerOut = API.BuildingMapMarkerOut;
  export type BuildingMapDetailOut = API.BuildingMapDetailOut;
  export type BuildingMapHouseOut = API.BuildingMapHouseOut;
  export type CountOut = API.CountOut;
  ```

  并在 `houseApi` 中增加：

  ```typescript
  listBuildingMap: (params?: QueryParams) =>
    appsHouseApiListBuildingMap((params ?? {}) as API.appsHouseApiListBuildingMapParams) as Promise<PageResult<BuildingMapMarkerOut>>,
  getBuildingMapDetail: (buildingId: number) =>
    appsHouseApiGetBuildingMapDetail({ building_id: buildingId }) as Promise<BuildingMapDetailOut>,
  getBuildingMapUnlocatedCount: () =>
    appsHouseApiGetBuildingMapUnlocatedCount() as Promise<CountOut>,
  ```

- [ ] **Step 3: 运行 TypeScript 检查并修正生成函数的实际名称**

  Run: `cd frontend_admin && nvm use 22 && npm run tsc`

  Expected: PASS；若生成器将函数名缩写为不同名称，以 `propertyRentalManagement.ts` 的导出为准同步修改三个 import 和调用名，不手改生成文件。

- [ ] **Step 4: 提交生成客户端与适配层**

  ```bash
  git add frontend_admin/src/services/openapi frontend_admin/src/services/manual/house.ts
  git commit -m "feat: 接入楼栋地图接口客户端"
  ```

## Task 5: 扩展高德加载器并创建地图选点组件

**Files:**

- Modify: `frontend_admin/src/services/manual/amap.ts`
- Create: `frontend_admin/src/pages/property-rental/components/LocationPicker.tsx`
- Create: `frontend_admin/src/pages/property-rental/components/LocationPicker.test.tsx`

- [ ] **Step 1: 编写选点组件失败测试**

  在 `LocationPicker.test.tsx` mock `useAmap`，并覆盖确认、取消与定位回退：

  ```tsx
  it('returns the clicked point only after confirmation', async () => {
    const onConfirm = vi.fn();
    render(<LocationPicker open initialSearch="深圳市南山区科技园" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '选择模拟地图坐标' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确定位置' }));
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) }));
  });

  it('falls back when browser geolocation rejects', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_ok: never, fail: PositionErrorCallback) => fail({ code: 1 } as GeolocationPositionError) } });
    render(<LocationPicker open initialPoint={{ lat: 22.5331, lng: 113.9304 }} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(await screen.findByText('已使用已有坐标作为初始位置')).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/components/LocationPicker.test.tsx`

  Expected: FAIL，模块尚不存在。

- [ ] **Step 3: 为 `useAmap` 增加插件参数**

  将 `useAmap()` 改为 `useAmap(plugins: string[] = [])`；调用 `AMapLoader.load` 时合并并去重：

  ```typescript
  const DEFAULT_PLUGINS = ['AMap.Scale', 'AMap.ToolBar'];
  const requestedPlugins = [...new Set([...DEFAULT_PLUGINS, ...plugins])];
  // AMapLoader.load({ key, version: '2.0', plugins: requestedPlugins })
  ```

  使用 `useMemo` 由调用方传入稳定数组，或在 hook 内只以 `plugins.join('|')` 作为 effect 依赖，避免每次渲染重复加载 SDK。

- [ ] **Step 4: 实现 `LocationPicker` 的明确接口**

  创建组件并使用 Ant Design `Modal`：

  ```tsx
  export type PickedLocation = {
    lat: number;
    lng: number;
    formattedAddress?: string;
    name?: string;
    province?: string;
    city?: string;
    district?: string;
  };

  type LocationPickerProps = {
    open: boolean;
    initialSearch?: string;
    initialPoint?: PickedLocation;
    onConfirm: (location: PickedLocation) => void;
    onCancel: () => void;
  };
  ```

  具体行为：

  1. 使用 `useAmap(['AMap.PlaceSearch', 'AMap.Geolocation', 'AMap.Geocoder'])`。
  2. `open` 变为 `true` 时调用 `navigator.geolocation.getCurrentPosition`，参数使用 `{ enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }`；成功时中心点为当前位置。
  3. 失败时按 `initialPoint`、`initialSearch` 的 `AMap.PlaceSearch` 首个候选、默认 `[116.397428, 39.90923]` 回退，并以 `Alert` 显示原因。
  4. 搜索框用 `Input.Search` 调用 `PlaceSearch.search`；结果用 `List` 渲染，点击候选更新地图中心和待确认坐标。
  5. `map.on('click')` 将 `event.lnglat.getLng()` 和 `event.lnglat.getLat()` 写入 `draftLocation`；`map.on('moveend')` 只更新视觉中心，不能覆盖用户已点击的草稿点。
  6. 每次草稿点改变，用 `AMap.Geocoder.getAddress` 更新格式化地址和行政区字段；逆地理失败时保留坐标并显示“未获取到标准地址”。
  7. Modal 的“确定位置”仅在 `draftLocation` 有合法经纬度时可用，点击后调用 `onConfirm(draftLocation)`；取消或关闭只调用 `onCancel`。

- [ ] **Step 5: 运行选点测试和类型检查**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/components/LocationPicker.test.tsx
  cd frontend_admin && nvm use 22 && npm run tsc
  ```

  Expected: 两项均 PASS。

- [ ] **Step 6: 提交选点基础组件**

  ```bash
  git add frontend_admin/src/services/manual/amap.ts frontend_admin/src/pages/property-rental/components/LocationPicker.tsx frontend_admin/src/pages/property-rental/components/LocationPicker.test.tsx
  git commit -m "feat: 新增楼栋地图选点组件"
  ```

## Task 6: 将地图选点接入楼栋新建和编辑抽屉

**Files:**

- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 写出表单回填失败测试**

  在 `domain-list-pages.test.tsx` 中 mock `LocationPicker` 为触发 `onConfirm` 的按钮，新增测试：

  ```tsx
  it('writes a confirmed map point into the building create payload', async () => {
    render(<EstatesPage />);
    await userEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    await userEvent.click(screen.getByRole('button', { name: '地图选点' }));
    await userEvent.click(screen.getByRole('button', { name: '确认模拟位置' }));
    await userEvent.type(screen.getByLabelText('楼栋名'), '3 栋');
    await userEvent.clear(screen.getByLabelText('楼层'));
    await userEvent.type(screen.getByLabelText('楼层'), '18');
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(mockCreateBuilding).toHaveBeenCalledWith(expect.objectContaining({ lat: 22.5331, lng: 113.9304 }));
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

  Expected: FAIL，尚无“地图选点”按钮和表单值。

- [ ] **Step 3: 接入 Form 隐藏坐标和选点按钮**

  在 `BuildingFormValues` 中加入 `lat?: number` 和 `lng?: number`，在楼栋 `Drawer` 的 `Form` 中加入：

  ```tsx
  <Form.Item name="lat" hidden><Input /></Form.Item>
  <Form.Item name="lng" hidden><Input /></Form.Item>
  <Form.Item label="地图位置" extra="搜索地址、拖动地图或点击地图后确认；未确认不会保存坐标。">
    <Space>
      <Button onClick={() => setLocationPickerOpen(true)}>地图选点</Button>
      {pickedPoint ? <Typography.Text type="secondary">{pickedPoint.lat.toFixed(6)}, {pickedPoint.lng.toFixed(6)}</Typography.Text> : <Typography.Text type="secondary">尚未选点</Typography.Text>}
    </Space>
  </Form.Item>
  ```

  使用 `const [buildingForm] = Form.useForm<BuildingFormValues>()` 管理表单。打开编辑抽屉时以 `form.setFieldsValue(editingBuilding)` 回填；`LocationPicker.onConfirm` 调用：

  ```tsx
  buildingForm.setFieldsValue({ lat: location.lat, lng: location.lng });
  setPickedPoint(location);
  setLocationPickerOpen(false);
  ```

  `initialSearch` 必须按 `[selectedEstate?.province, selectedEstate?.city, selectedEstate?.district, selectedEstate?.address, form.getFieldValue('address'), form.getFieldValue('name')]` 去空值后用空格连接。现有 `EstateOut` 类型已有区域字段；若当前 `allEstates` 未加载，传入楼栋地址与楼栋名。

- [ ] **Step 4: 运行前端回归测试**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

  Expected: PASS。

- [ ] **Step 5: 提交楼栋表单选点接入**

  ```bash
  git add frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
  git commit -m "feat: 楼栋表单接入地图选点"
  ```

## Task 7: 建立房源地图路由、页面状态和地图查询

**Files:**

- Create: `frontend_admin/src/pages/property-rental/map/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/map/index.test.tsx`
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Modify: `frontend_admin/src/locales/en-US/menu.ts`
- Modify: `frontend_admin/src/pages/geo/map/index.tsx`

- [ ] **Step 1: 写出路由和查询参数失败测试**

  在 `map/index.test.tsx` mock `houseApi.listBuildingMap` 与 `useAmap`，新增：

  ```tsx
  it('reads URL filters and queries the visible map bounds', async () => {
    window.history.replaceState({}, '', '/dashboard/property-rental/map?keyword=云岸&estate_id=1&status=vacant&lng=113.93&lat=22.53&zoom=14');
    render(<PropertyRentalMapPage />);
    await waitFor(() => expect(mockListBuildingMap).toHaveBeenCalledWith(expect.objectContaining({
      keyword: '云岸', estate_id: 1, house_status: 'vacant', west: expect.any(Number), south: expect.any(Number), east: expect.any(Number), north: expect.any(Number), page: 1, page_size: 200,
    })));
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: FAIL，页面模块尚不存在。

- [ ] **Step 3: 添加菜单和隐藏旧入口**

  在 `frontend_admin/config/routes.ts` 的 `/property-rental` 子路由中，紧随 `/property-rental/houses` 添加：

  ```typescript
  {
    name: 'map',
    icon: 'environment',
    path: '/property-rental/map',
    component: './property-rental/map',
  },
  ```

  新增隐藏详情路由：

  ```typescript
  {
    name: 'building-detail',
    path: '/property-rental/buildings/:id',
    component: './property-rental/buildings/detail',
    hideInMenu: true,
  },
  ```

  删除或以 `hideInMenu: true` 标记 `/geo` 路由分组，确保其不在导航出现且 `/geo/map` 不再承载业务。两个语言文件增加：

  ```typescript
  'menu.property-rental.map': '房源地图',
  'menu.property-rental.building-detail': '楼栋详情',
  ```

  英文分别为 `Property Map` 和 `Building Detail`。

- [ ] **Step 4: 实现 URL 状态与数据查询**

  在 `map/index.tsx` 定义并实现以下纯函数，导出给测试：

  ```tsx
  export type MapSearchState = { keyword?: string; estateId?: number; status?: string; includeInactive: boolean; lng?: number; lat?: number; zoom?: number; selectedBuildingId?: number };

  export function readMapSearchState(search: string): MapSearchState { /* 使用 URLSearchParams、正数 ID 和有限经纬度验证 */ }
  export function writeMapSearchState(state: MapSearchState): void { /* replaceState，删除空值 */ }
  ```

  页面必须：

  1. 以 `TenantSelectionGuard` 包裹，并以 `workspace.selectedOrgSlug` 作为 query key 的一部分。
  2. 用 `useAmap(['AMap.MarkerClusterer'])` 创建地图；初始中心来自 URL，缺失时在首批标点 `setFitView` 后再写入 URL。
  3. 在 `moveend` 后 300ms 防抖读取 `map.getBounds()`，调用 `houseApi.listBuildingMap({ keyword, estate_id, house_status, include_inactive, west, south, east, north, page: 1, page_size: 200 })`。
  4. 使用 `useQuery` 请求 `houseApi.listEstates({ page: 1, page_size: 100 })`、`houseApi.getBuildingMapUnlocatedCount()` 与地图标点。
  5. 左上 `Card` 使用 `Input.Search`、`Select`、`Switch` 和状态 `Select`；修改筛选后重置页码并写 URL。
  6. 标点的 HTML 内容包含楼栋名和 `counts.total`；`counts.total === 0` 使用灰色；通过 `new AMap.MarkerClusterer(map, markers)` 聚合。
  7. 清理 effect 时调用 `clusterer?.setMap(null)`、移除标点和 `map.destroy()`；不要保留全局地图实例。

- [ ] **Step 5: 验证地图查询测试通过**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: PASS。

- [ ] **Step 6: 提交地图页面骨架**

  ```bash
  git add frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/locales/en-US/menu.ts frontend_admin/src/pages/property-rental/map frontend_admin/src/pages/geo/map/index.tsx
  git commit -m "feat: 重新启用房源楼栋地图"
  ```

## Task 8: 实现地图楼栋详情抽屉与业务跳转

**Files:**

- Modify: `frontend_admin/src/pages/property-rental/map/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/map/index.test.tsx`

- [ ] **Step 1: 增加抽屉失败测试**

  ```tsx
  it('opens a building drawer and links to house list and house detail', async () => {
    mockGetBuildingMapDetail.mockResolvedValue({ id: 8, name: '1 栋', counts: { total: 2, vacant: 1, rented: 1, renovating: 0, locked: 0, published: 1 }, houses: [
      { id: 20, room_number: '101', floor: 1, status: 'vacant', status__mapping: '空置', publish_status: 'published', publish_status__mapping: '已发布' },
    ] });
    render(<PropertyRentalMapPage />);
    await userEvent.click(await screen.findByRole('button', { name: '查看 1 栋' }));
    expect(await screen.findByText('房源汇总')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '101' })).toHaveAttribute('href', '/dashboard/property-rental/houses/20');
    expect(screen.getByRole('link', { name: '查看楼栋全部房源' })).toHaveAttribute('href', '/dashboard/property-rental/houses?building_id=8');
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: FAIL，抽屉尚未渲染。

- [ ] **Step 3: 添加按需详情查询和抽屉**

  选择标点时执行 `setSelectedBuildingId(marker.id)`，同步 `selected_building_id` 到 URL；用：

  ```tsx
  const buildingDetail = useQuery({
    queryKey: ['house', 'building-map-detail', workspace.selectedOrgSlug, selectedBuildingId],
    queryFn: () => houseApi.getBuildingMapDetail(selectedBuildingId!),
    enabled: Boolean(selectedBuildingId && workspace.selectedOrgSlug),
  });
  ```

  使用 `Drawer` 展示 `Descriptions`、四个 `Statistic` 和 `Table<BuildingMapHouseOut>`。表格列为房号、楼层、房态、面积、挂牌租金、发布状态；房号列链接至 `/dashboard/property-rental/houses/${record.id}?return_to=${encodeURIComponent(currentMapPath)}`。抽屉 footer 包含：

  ```tsx
  <Link to={`/dashboard/property-rental/houses?building_id=${detail.id}`}>查看楼栋全部房源</Link>
  <Link to={`/dashboard/property-rental/buildings/${detail.id}?return_to=${encodeURIComponent(currentMapPath)}`}>查看楼栋详情</Link>
  ```

  抽屉关闭仅清除 `selectedBuildingId`，不得重置地图筛选或视口。

- [ ] **Step 4: 运行抽屉交互测试**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: PASS。

- [ ] **Step 5: 提交地图详情抽屉**

  ```bash
  git add frontend_admin/src/pages/property-rental/map/index.tsx frontend_admin/src/pages/property-rental/map/index.test.tsx
  git commit -m "feat: 展示楼栋地图房源汇总"
  ```

## Task 9: 新增楼栋详情页并复用地图详情数据

**Files:**

- Create: `frontend_admin/src/pages/property-rental/buildings/detail.tsx`
- Create: `frontend_admin/src/pages/property-rental/buildings/detail.test.tsx`

- [ ] **Step 1: 写出详情页失败测试**

  ```tsx
  it('shows naturally ordered houses and returns to the encoded map URL', async () => {
    mockGetBuildingMapDetail.mockResolvedValue({ id: 8, name: '1 栋', counts: { total: 2, vacant: 1, rented: 1, renovating: 0, locked: 0, published: 1 }, houses: [
      { id: 2, room_number: '2', floor: 1, status: 'vacant', status__mapping: '空置', publish_status: 'draft', publish_status__mapping: '草稿' },
      { id: 1, room_number: '10', floor: 1, status: 'rented', status__mapping: '已租', publish_status: 'published', publish_status__mapping: '已发布' },
    ] });
    window.history.replaceState({}, '', '/dashboard/property-rental/buildings/8?return_to=%2Fdashboard%2Fproperty-rental%2Fmap%3Fkeyword%3D%E4%BA%91%E5%B2%B8');
    render(<BuildingDetailPage />);
    expect((await screen.findAllByRole('row')).map((row) => row.textContent).join('')).toContain('210');
    expect(screen.getByRole('link', { name: '返回房源地图' })).toHaveAttribute('href', '/dashboard/property-rental/map?keyword=云岸');
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/buildings/detail.test.tsx`

  Expected: FAIL，详情页模块尚不存在。

- [ ] **Step 3: 实现楼栋详情页**

  使用 `useParams()` 获取 `id`，`useQuery` 调用 `houseApi.getBuildingMapDetail(Number(id))`，并以 `TenantSelectionGuard` 包裹。页面用 `Card`、`Descriptions`、`Statistic` 和 `Table` 展示 API 已排序的 `houses`；不要在前端再次排序。解析 `return_to` 时只接受以 `/dashboard/property-rental/map` 开头的相对路径：

  ```tsx
  function safeMapReturnTo(value: string | null) {
    return value?.startsWith('/dashboard/property-rental/map') ? value : '/dashboard/property-rental/map';
  }
  ```

  房号链接保持 `return_to`，房源详情返回后可回到该楼栋详情或地图；页面顶部提供“返回房源地图”和“查看全部房源”链接。

- [ ] **Step 4: 运行详情页测试**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/buildings/detail.test.tsx`

  Expected: PASS。

- [ ] **Step 5: 提交楼栋详情页**

  ```bash
  git add frontend_admin/src/pages/property-rental/buildings/detail.tsx frontend_admin/src/pages/property-rental/buildings/detail.test.tsx
  git commit -m "feat: 新增楼栋房源详情页"
  ```

## Task 10: 全量验证、接口生成检查与人工地图验收

**Files:**

- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: 运行后端完整房产业务测试与迁移检查**

  Run:

  ```bash
  docker compose exec web pytest tests/house/test_api.py tests/house/test_models.py -q
  docker compose exec web python manage.py makemigrations --check --dry-run
  ```

  Expected: 两项均 PASS；第二项显示 `No changes detected`，因为本计划只复用既有坐标字段。

- [ ] **Step 2: 运行前端聚焦测试、类型和 Ant Design 检查**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/components/LocationPicker.test.tsx src/pages/property-rental/map/index.test.tsx src/pages/property-rental/buildings/detail.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx
  cd frontend_admin && nvm use 22 && npm run tsc
  cd frontend_admin && nvm use 22 && npm exec -- antd lint ./src/pages/property-rental ./src/services/manual/amap.ts
  ```

  Expected: 全部 PASS。

- [ ] **Step 3: 构建管理端**

  Run: `cd frontend_admin && nvm use 22 && npm run build`

  Expected: 构建退出码为 0。

- [ ] **Step 4: 手工验收高德地图关键路径**

  在已配置 `AMAP_JSAPI_KEY` 和 `AMAP_SECURITY_JS_CODE` 的环境中检查：

  1. 从“房源租赁 → 房源地图”进入，确认旧“地理”菜单不显示。
  2. 搜索项目/楼栋/地址、切换项目和房态，确认标点和计数变化。
  3. 拖动/缩放地图，确认请求范围更新且标点聚合正确。
  4. 点击标点，确认抽屉汇总、房号顺序、房源/楼栋/列表跳转以及返回地图状态。
  5. 在项目楼栋新建或编辑楼栋，确认浏览器定位允许、拒绝和超时三种分支；再检查搜索、拖动、点击、确定和取消。
  6. 对未定位楼栋选点并保存，刷新地图确认新标点出现；取消选点后确认楼栋坐标未变化。

- [ ] **Step 5: 提交仅包含修复的验证改动（如有）**

  ```bash
  git status --short
  git add apps/house/api.py apps/house/services.py apps/house/schemas.py tests/house/test_api.py tests/house/test_models.py frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/locales/en-US/menu.ts frontend_admin/src/services/manual/amap.ts frontend_admin/src/services/manual/house.ts frontend_admin/src/pages/property-rental
  git commit -m "fix: 修正房源地图验收问题"
  ```

  若无验证修复，不创建空提交。

## 计划自检

- 设计中要求的菜单入口、楼栋聚合、范围筛选、状态筛选、点聚合、抽屉、楼栋详情、房源跳转、返回状态、待定位统计、浏览器定位、地址搜索、拖动/点击选点与确认保存，分别覆盖于 Task 3、5、6、7、8、9、10。
- 本计划不新增服务端地理编码 Key、后台任务、模型字段或迁移；这与已确认的“用户确认选点后才保存”一致。
- 所有 API 类型名、手写适配层名称、查询参数和 URL 参数在后续任务中保持一致：`building-map`、`building-map-unlocated-count`、`selected_building_id`、`return_to`。
- 实施时每个后端和前端功能都先运行对应失败测试，再最小实现、回归并提交。
