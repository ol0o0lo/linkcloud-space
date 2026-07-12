# 房源空间定位与楼栋地图实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立租户默认定位、小区与楼栋独立定位、楼栋聚合房源地图和楼栋详情闭环，同时保持房源位置继承楼栋、楼栋可选绑定小区的既有规则。

**Architecture:** `property_rental.default_location` 是组织 JSON 设置，只提供前端初始地图中心。`Estate`、`Building` 复用已有的地址和坐标列；后端补充校验，前端通过同一个高德选点组件写入表单。地图 API 只聚合有坐标的楼栋及有效房源，管理端以地图、抽屉和楼栋详情页消费这些 API。

**Tech Stack:** Django 5、django-ninja、Django ORM、pytest、React 19、Umi Max、Ant Design 6、TanStack Query、Vitest、`@amap/amap-jsapi-loader`。

---

## 文件边界

| 文件 | 责任 |
| --- | --- |
| `apps/house/models.py` | 小区、楼栋的位置校验；不新增房源坐标。 |
| `apps/house/schemas.py` | 楼栋摘要坐标、地图标点、地图详情和汇总响应。 |
| `apps/house/services.py` | 房号自然排序及楼栋详情汇总。 |
| `apps/house/api.py` | 组织隔离的楼栋地图列表、待定位计数和详情接口。 |
| `apps/settings/constants.py`、`apps/settings/service.py` | 默认定位控件类型与设置值校验。 |
| `apps/settings/migrations/0006_property_rental_default_location.py` | 注册默认定位设置项。 |
| `frontend_admin/src/components/LocationPicker/index.tsx` | 可复用的地址搜索、当前定位、拖动/点击选点弹窗。 |
| `frontend_admin/src/pages/settings-management/organization/index.tsx` | 默认定位设置控件。 |
| `frontend_admin/src/pages/property-rental/estates/index.tsx` | 小区、楼栋表单的位置预填、编辑和保存。 |
| `frontend_admin/src/pages/property-rental/map/index.tsx` | 楼栋地图、筛选、标点、抽屉和 URL 状态。 |
| `frontend_admin/src/pages/property-rental/buildings/detail.tsx` | 楼栋摘要和已排序房源详情。 |

## Task 1: 锁定实体坐标与默认定位的后端契约

**Files:**

- Modify: `apps/house/models.py`
- Modify: `apps/house/schemas.py`
- Modify: `apps/settings/constants.py`
- Modify: `apps/settings/service.py`
- Create: `apps/settings/migrations/0006_property_rental_default_location.py`
- Modify: `tests/house/test_models.py`
- Modify: `tests/house/test_api.py`
- Modify: `tests/settings/test_service.py`

- [ ] **Step 1: 写出失败的坐标与设置测试**

  在 `tests/house/test_models.py` 添加小区/楼栋坐标成对、范围与地址规则测试：

  ```python
  def test_estate_allows_empty_location_but_rejects_coordinates_without_address(self):
      estate = self.make_estate(address="")
      estate.full_clean()
      estate.lat = Decimal("22.533100")
      estate.lng = Decimal("113.930400")
      with self.assertRaises(ValidationError) as context:
          estate.full_clean()
      self.assertIn("address", context.exception.message_dict)

  def test_building_requires_address_and_complete_valid_coordinate_pair(self):
      building = Building(organization=self.org, estate=self.make_estate(), name="1 栋", address="", floors=18)
      with self.assertRaises(ValidationError) as context:
          building.full_clean()
      self.assertIn("address", context.exception.message_dict)
      building.address = "科技路 1 号"
      building.lat = Decimal("22.533100")
      with self.assertRaises(ValidationError) as context:
          building.full_clean()
      self.assertIn("lng", context.exception.message_dict)
  ```

  在 `tests/settings/test_service.py` 添加：

  ```python
  def test_org_default_location_accepts_only_complete_location_value(org):
      set_org_setting(org, "property_rental.default_location", {"address": "科技园路 1 号", "lat": 22.540123, "lng": 113.934567})
      assert get_org_setting(org, "property_rental.default_location")["value"]["lat"] == 22.540123
      with pytest.raises(ValidationError):
          set_org_setting(org, "property_rental.default_location", {"address": "科技园路 1 号", "lat": 22.540123})
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_models.py tests/settings/test_service.py -k "location" -q`

  Expected: FAIL，位置校验、设置键和验证器尚不存在。

- [ ] **Step 3: 实现位置与设置值校验**

  在 `apps/house/models.py` 增加并在 `Estate.clean()`、`Building.clean()` 调用：

  ```python
  def validate_coordinates(*, address: str, lat: Decimal | None, lng: Decimal | None, address_required: bool) -> None:
      if address_required and not address:
          raise ValidationError({"address": "楼栋地址不能为空。"})
      if (lat is None) != (lng is None):
          raise ValidationError({"lng" if lat is not None else "lat": "纬度和经度必须同时填写。"})
      if lat is not None and not Decimal("-90") <= lat <= Decimal("90"):
          raise ValidationError({"lat": "纬度必须在 -90 到 90 之间。"})
      if lng is not None and not Decimal("-180") <= lng <= Decimal("180"):
          raise ValidationError({"lng": "经度必须在 -180 到 180 之间。"})
      if lat is not None and not address:
          raise ValidationError({"address": "保存坐标时必须填写地址。"})
  ```

  `Estate.clean()` 传入 `address_required=False`，`Building.clean()` 传入 `address_required=True`，并保留既有小区组织一致性与独立楼栋唯一性校验。

  在 `apps/settings/constants.py` 增加：

  ```python
  LOCATION_PICKER = "location_picker", "地址选择器"
  ```

  在 `apps/settings/service.py` 添加 `validate_location_setting_value`，仅在 key 为 `property_rental.default_location` 时要求值为 `None` 或包含非空 `address`、有限数值 `lat`、`lng` 的字典；在 `set_org_setting` 写入前调用它。错误使用 Django `ValidationError`，不接受额外字段以外的替代结构。

  创建迁移，使用 `RunPython` 注册：

  ```python
  {
      "key": "property_rental.default_location",
      "value": None,
      "value_type": "json",
      "widget": "location_picker",
      "label": "默认定位",
      "description": "新建项目、楼栋和地图的初始位置。",
      "category": "property_rental",
      "ui": {"provider": "amap"},
  }
  ```

  反向迁移使用 `RunPython.noop`，不得删除已有组织覆盖值。

- [ ] **Step 4: 扩展楼栋摘要 Schema**

  在 `BuildingSummaryOut` 增加：

  ```python
  lat: Decimal | None
  lng: Decimal | None
  ```

  让房源详情的 `building` 摘要可以明确表达“楼栋待定位”，但不为 `House` 增加字段或迁移。

- [ ] **Step 5: 运行后端验证**

  Run:

  ```bash
  DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_models.py tests/house/test_api.py tests/settings/test_service.py -k "location or building" -q
  DATABASE_URL=sqlite:///:memory: uv run python manage.py makemigrations --check --dry-run
  ```

  Expected: 测试 PASS；迁移检查显示 `No changes detected`，设置项迁移是显式数据迁移而不是模型迁移。

- [ ] **Step 6: 提交后端定位契约**

  ```bash
  git add apps/house/models.py apps/house/schemas.py apps/settings/constants.py apps/settings/service.py apps/settings/migrations/0006_property_rental_default_location.py tests/house/test_models.py tests/house/test_api.py tests/settings/test_service.py
  git commit -m "feat: 增加房源空间定位设置"
  ```

## Task 2: 增加楼栋地图 API 与自然排序

**Files:**

- Modify: `apps/house/services.py`
- Modify: `apps/house/schemas.py`
- Modify: `apps/house/api.py`
- Modify: `tests/house/test_api.py`
- Modify: `tests/house/test_models.py`

- [ ] **Step 1: 写出失败的排序、聚合和隔离测试**

  ```python
  def test_building_map_detail_orders_active_houses_by_floor_and_room_number(self):
      House.objects.create(building=self.building, room_number="10", floor=1)
      House.objects.create(building=self.building, room_number="2", floor=1)
      House.objects.create(building=self.building, room_number="A10", floor=2)
      House.objects.create(building=self.building, room_number="A2", floor=2)
      inactive = House.objects.create(building=self.building, room_number="999", floor=9, is_active=False)
      response = self.client.get(f"/api/house/building-map/{self.building.pk}/")
      self.assertEqual([item["room_number"] for item in api_data(response)["houses"]], ["2", "10", "A2", "A10"])
      self.assertNotIn(inactive.pk, [item["id"] for item in api_data(response)["houses"]])

  def test_building_map_filters_markers_but_keeps_full_active_counts(self):
      self.building.lat, self.building.lng = Decimal("22.533100"), Decimal("113.930400")
      self.building.save()
      House.objects.create(building=self.building, room_number="101", status=HouseStatus.VACANT)
      House.objects.create(building=self.building, room_number="102", status=HouseStatus.RENTED)
      response = self.client.get("/api/house/building-map/?house_status=vacant&page=1&page_size=50")
      item = api_data(response)["items"][0]
      self.assertEqual(item["counts"], {"total": 2, "vacant": 1, "rented": 1, "renovating": 0, "locked": 0, "published": 0})
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -k "building_map" -q`

  Expected: FAIL，地图路由和排序服务不存在。

- [ ] **Step 3: 实现排序服务与 API Schema**

  在 `apps/house/services.py` 定义 `natural_room_sort_key` 和 `sort_houses_for_building`：按 `floor is None`、`floor`、分割数字后的房号键、`pk` 排序。定义 `building_map_counts(houses)`，只统计传入有效房源的 `total`、四种 `HouseStatus` 与 `HousePublishStatus.PUBLISHED`。

  在 `apps/house/schemas.py` 新增：

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
      counts: BuildingMapCountsOut

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

  class BuildingMapDetailOut(BuildingOut):
      counts: BuildingMapCountsOut
      houses: list[BuildingMapHouseOut]
  ```

- [ ] **Step 4: 实现三个组织隔离接口**

  在 `apps/house/api.py` 使用 `Building.objects.filter(organization=org, lat__isnull=False, lng__isnull=False)` 构建标点查询。

  - `GET /building-map/` 使用 `@paginate(LegacyPagination)`；支持 `keyword`、`estate_id`、`house_status`、`include_inactive`、`west`、`south`、`east`、`north`。
  - `house_status` 只通过 `houses__status` 过滤楼栋是否出现；聚合 `Count` 不带该过滤，并总是加入 `houses__is_active=True`。
  - `include_inactive=False` 时过滤 `Building.is_active=True`；传 `true` 才包含停用楼栋。
  - 边界四项必须同时给出；`west >= east` 或 `south >= north` 时抛 `HttpError(422, "地图范围无效")`。
  - `GET /building-map-unlocated-count/` 统计当前组织中 `lat` 或 `lng` 为空的楼栋。
  - `GET /building-map/{building_id}/` 使用 `Building.organization` 获取对象，只读取 `houses.filter(is_active=True)`，用 Task 2 排序和汇总函数组装响应。

- [ ] **Step 5: 运行地图 API 回归**

  Run:

  ```bash
  DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py tests/house/test_models.py -k "building_map or natural_room" -q
  DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py tests/house/test_models.py -q
  ```

  Expected: 两项均 PASS。

- [ ] **Step 6: 提交地图后端**

  ```bash
  git add apps/house/api.py apps/house/schemas.py apps/house/services.py tests/house/test_api.py tests/house/test_models.py
  git commit -m "feat: 提供楼栋房源地图接口"
  ```

## Task 3: 重新生成两端客户端并增加房产业务适配

**Files:**

- Modify: `frontend_admin/src/services/openapi/`
- Modify: `frontend_admin/src/services/manual/house.ts`
- Modify: `frontend_miniprogram/src/services/openapi/`

- [ ] **Step 1: 生成管理端客户端**

  Run:

  ```bash
  docker compose exec web python manage.py migrate
  cd frontend_admin && nvm use 22 && npm run openapi
  ```

  Expected: 生成 `BuildingMapMarkerOut`、`BuildingMapDetailOut`、`BuildingMapHouseOut` 及三个地图 API 函数；不手改生成目录。

- [ ] **Step 2: 补充手写房产适配层**

  在 `frontend_admin/src/services/manual/house.ts` 导入生成函数并添加：

  ```ts
  export type BuildingMapMarkerOut = API.BuildingMapMarkerOut;
  export type BuildingMapDetailOut = API.BuildingMapDetailOut;

  listBuildingMap: (params?: QueryParams) => appsHouseApiListBuildingMap((params ?? {}) as API.appsHouseApiListBuildingMapParams) as Promise<PageResult<BuildingMapMarkerOut>>,
  getBuildingMapDetail: (buildingId: number) => appsHouseApiGetBuildingMapDetail({ building_id: buildingId }) as Promise<BuildingMapDetailOut>,
  getBuildingMapUnlocatedCount: () => appsHouseApiGetBuildingMapUnlocatedCount() as Promise<API.CountOut>,
  ```

- [ ] **Step 3: 生成小程序客户端**

  Run: `cd frontend_miniprogram && nvm use 22 && pnpm run openapi`

  生成后确认 `BuildingSummaryOut` 的 `lat`、`lng` 与管理端生成类型一致。

- [ ] **Step 4: 验证生成结果**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm run tsc
  cd frontend_miniprogram && nvm use 22 && pnpm run type-check
  ```

  Expected: 两端类型检查 PASS。

- [ ] **Step 5: 提交客户端更新**

  ```bash
  git add frontend_admin/src/services/openapi frontend_admin/src/services/manual/house.ts frontend_miniprogram/src/services/openapi
  git commit -m "feat: 生成房源地图客户端"
  ```

## Task 4: 实现可复用的高德选点组件

**Files:**

- Modify: `frontend_admin/src/services/manual/amap.ts`
- Create: `frontend_admin/src/components/LocationPicker/index.tsx`
- Create: `frontend_admin/src/components/LocationPicker/index.test.tsx`

- [ ] **Step 1: 写出选点组件失败测试**

  ```tsx
  it('changes form value only after the user confirms a selected point', async () => {
    const onChange = vi.fn();
    render(<LocationPicker ariaLabel="楼栋位置" value={null} fallbackLocation={{ address: '科技园路 1 号', lat: 22.54, lng: 113.93 }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    await userEvent.click(screen.getByRole('button', { name: '选择模拟坐标' }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '确定位置' }));
    expect(onChange).toHaveBeenCalledWith({ address: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) });
  });

  it('uses browser geolocation only when no value or fallback is available', async () => {
    render(<LocationPicker ariaLabel="默认定位" value={null} fallbackLocation={null} onChange={vi.fn()} />);
    expect(mockGetCurrentPosition).toHaveBeenCalledOnce();
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/components/LocationPicker/index.test.tsx`

  Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现明确的受控接口**

  在组件中导出：

  ```tsx
  export type LocationValue = { address: string; lat: number; lng: number };
  export function LocationPicker({ ariaLabel, value, fallbackLocation, onChange, disabled = false }: {
    ariaLabel: string;
    value: LocationValue | null;
    fallbackLocation: LocationValue | null;
    onChange: (value: LocationValue | null) => void;
    disabled?: boolean;
  }) { /* Button + Modal */ }
  ```

  `useAmap` 需加载 `AMap.PlaceSearch`、`AMap.Geocoder` 和 `AMap.Geolocation`。组件规则：

  1. `value` 存在时直接作为中心，不申请浏览器权限。
  2. `value` 为空且 `fallbackLocation` 存在时直接使用 fallback，不申请浏览器权限。
  3. 两者为空时调用 `navigator.geolocation.getCurrentPosition`，使用 `enableHighAccuracy: true`、`timeout: 8000`、`maximumAge: 60000`。
  4. 定位失败时显示提示并以中国范围中心 `[104.1954, 35.8617]` 和缩放级别 `4` 显示。
  5. 地址搜索使用 `AMap.PlaceSearch.search`；地图点击、固定中心拖动后通过 `AMap.Geocoder.getAddress` 更新草稿地址。逆地理失败时保留草稿经纬度并显示“未获取标准地址”。
  6. “确定位置”把草稿 `{ address, lat, lng }` 传给 `onChange`；“取消”不调用 `onChange`；“清除定位”只在允许清除的设置场景传 `null`。
  7. SDK 失败显示 `Alert` 和重试按钮，不创建地图实例。

- [ ] **Step 4: 运行组件测试与类型检查**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm exec -- vitest run src/components/LocationPicker/index.test.tsx
  cd frontend_admin && nvm use 22 && npm run tsc
  ```

  Expected: PASS。

- [ ] **Step 5: 提交选点组件**

  ```bash
  git add frontend_admin/src/services/manual/amap.ts frontend_admin/src/components/LocationPicker/index.tsx frontend_admin/src/components/LocationPicker/index.test.tsx
  git commit -m "feat: 增加高德地图选点组件"
  ```

## Task 5: 接入组织默认定位、小区和楼栋表单

**Files:**

- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 编写失败的设置和表单测试**

  ```tsx
  it('saves a selected default location through the organization setting API', async () => {
    render(<OrganizationSettingsPage />);
    await userEvent.click(await screen.findByRole('button', { name: '默认定位' }));
    await userEvent.click(screen.getByRole('button', { name: '确定位置' }));
    expect(mockPutOrgSetting).toHaveBeenCalledWith(
      { key: 'property_rental.default_location' },
      { value: { address: expect.any(String), lat: expect.any(Number), lng: expect.any(Number) } },
    );
  });

  it('prefills a new building from its selected estate but preserves a user-picked location', async () => {
    render(<EstatesPage />);
    await userEvent.click(screen.getByRole('button', { name: '新建楼栋' }));
    await userEvent.selectOptions(screen.getByLabelText('所属项目'), '1');
    expect(screen.getByDisplayValue('科技园路 1 号')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '楼栋位置' }));
    await userEvent.click(screen.getByRole('button', { name: '确定位置' }));
    await userEvent.selectOptions(screen.getByLabelText('所属项目'), '2');
    expect(screen.getByDisplayValue('用户确认的地址')).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

  Expected: FAIL，页面未识别 `location_picker`，表单未维护坐标草稿。

- [ ] **Step 3: 接入默认定位设置**

  在 `OrganizationSettingsPage.renderControl` 中优先匹配 `property_rental.default_location` 或 `setting.widget === 'location_picker'`，将合法 JSON 值转换为 `LocationValue | null` 后渲染 `LocationPicker`。选点确认调用既有 `appsSettingsApiPutOrgSetting`；清除调用 `appsSettingsApiDeleteOrgSettingView` 以恢复 `DefaultSetting.value=None`。非法历史 JSON 显示为空值且不传入地图。

- [ ] **Step 4: 接入小区与楼栋表单**

  在 `EstateFormValues` 和 `BuildingFormValues` 增加 `lat?: number | null`、`lng?: number | null`。使用受控 `Form.useForm` 和 `LocationPicker`：

  - 小区：`value` 为当前表单地址/坐标完整值，`fallbackLocation` 为组织默认定位；选点确认写入 `address`、`lat`、`lng`。
  - 楼栋：地址 `Form.Item` 始终 `required`；`value` 为当前楼栋地址/坐标完整值；`fallbackLocation` 为所选小区完整位置，否则组织默认定位。
  - 新建楼栋选中有位置的小区时，若 `locationTouched` 为 `false`，写入小区地址与坐标；用户输入地址或确认选点后置 `locationTouched=true`，之后切换小区只显示提示，不改表单。
  - 编辑小区或楼栋时从实体值初始化，不从小区或设置覆盖。
  - 地址被手动修改后保留已有坐标并显示“地址已修改，请核对定位”；提交仍由 Task 1 服务器校验兜底。

- [ ] **Step 5: 运行前端表单回归**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx
  cd frontend_admin && nvm use 22 && npm run tsc
  ```

  Expected: PASS。

- [ ] **Step 6: 提交定位表单接入**

  ```bash
  git add frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
  git commit -m "feat: 支持维护小区楼栋定位"
  ```

## Task 6: 实现房源地图路由、筛选与楼栋抽屉

**Files:**

- Create: `frontend_admin/src/pages/property-rental/map/index.tsx`
- Create: `frontend_admin/src/pages/property-rental/map/index.test.tsx`
- Modify: `frontend_admin/config/routes.ts`
- Modify: `frontend_admin/src/locales/zh-CN/menu.ts`
- Modify: `frontend_admin/src/locales/en-US/menu.ts`
- Modify: `frontend_admin/src/pages/geo/map/index.tsx`

- [ ] **Step 1: 编写地图页面失败测试**

  ```tsx
  it('queries map markers from URL filters and opens the building summary drawer', async () => {
    window.history.replaceState({}, '', '/dashboard/property-rental/map?keyword=云岸&estate_id=1&house_status=vacant&selected_building_id=8');
    render(<PropertyRentalMapPage />);
    await waitFor(() => expect(mockListBuildingMap).toHaveBeenCalledWith(expect.objectContaining({ keyword: '云岸', estate_id: 1, house_status: 'vacant', page: 1, page_size: 200 })));
    expect(await screen.findByText('房源汇总')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看楼栋全部房源' })).toHaveAttribute('href', '/dashboard/property-rental/houses?building_id=8');
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: FAIL，页面模块不存在。

- [ ] **Step 3: 注册路由并兼容旧入口**

  在 `/property-rental` 路由中增加 `/property-rental/map` 与隐藏的 `/property-rental/buildings/:id`。添加 `menu.property-rental.map`、`menu.property-rental.building-detail` 的中英文文案。将 `/geo/map` 的路由改为 `redirect: '/property-rental/map'` 并隐藏 `/geo` 菜单组；保留旧 URL 的可达性。

- [ ] **Step 4: 实现地图与 URL 状态**

  页面以 `TenantSelectionGuard` 包裹，并定义 `readMapSearchState`、`writeMapSearchState`：只接受有限经纬度、正整数 ID、合法缩放级别和相对 `return_to`。使用 `useAmap(['AMap.MarkerClusterer'])`，在 `moveend` 后 300ms 防抖从 `map.getBounds()` 请求：

  ```ts
  houseApi.listBuildingMap({ keyword, estate_id, house_status, include_inactive, west, south, east, north, page: 1, page_size: 200 })
  ```

  初始中心依次使用 URL、第一批标点 `setFitView`、组织默认定位和中国范围视图。左上 `Card` 提供关键词、小区、房态和“包含停用楼栋”；待定位数量链接至 `/dashboard/property-rental/estates?task=building_location`。

- [ ] **Step 5: 实现标点、聚合和抽屉**

  用标点 HTML 展示楼栋名与 `counts.total`；零房源使用灰色；创建 `AMap.MarkerClusterer`。点击标点设置 `selected_building_id`，按需调用 `houseApi.getBuildingMapDetail`。抽屉展示小区（非空时）、楼栋资料、六项汇总和 API 已排序的房源表；房号链接房源详情，footer 链接房源列表和楼栋详情。关闭抽屉只移除 `selected_building_id`，不重置地图状态。

- [ ] **Step 6: 运行地图交互测试**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/map/index.test.tsx`

  Expected: PASS，覆盖筛选、抽屉、跳转、待定位和 URL 恢复。

- [ ] **Step 7: 提交地图页面**

  ```bash
  git add frontend_admin/config/routes.ts frontend_admin/src/locales/zh-CN/menu.ts frontend_admin/src/locales/en-US/menu.ts frontend_admin/src/pages/geo/map/index.tsx frontend_admin/src/pages/property-rental/map
  git commit -m "feat: 重新启用楼栋房源地图"
  ```

## Task 7: 新增楼栋详情页并完成跨页面返回

**Files:**

- Create: `frontend_admin/src/pages/property-rental/buildings/detail.tsx`
- Create: `frontend_admin/src/pages/property-rental/buildings/detail.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`

- [ ] **Step 1: 写出楼栋详情和房源位置提示失败测试**

  ```tsx
  it('shows map API house order and returns to a safe map URL', async () => {
    window.history.replaceState({}, '', '/dashboard/property-rental/buildings/8?return_to=%2Fdashboard%2Fproperty-rental%2Fmap%3Fkeyword%3D%E4%BA%91%E5%B2%B8');
    render(<BuildingDetailPage />);
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '返回房源地图' })).toHaveAttribute('href', '/dashboard/property-rental/map?keyword=云岸');
  });

  it('shows building pending-location text instead of a fabricated house location', async () => {
    mockGetHouse.mockResolvedValue(houseItem({ building: { ...buildingItem(), lat: null, lng: null } }));
    render(<HouseDetailPage />);
    expect(await screen.findByText('楼栋待定位')).toBeInTheDocument();
  });
  ```

- [ ] **Step 2: 运行测试并确认失败**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/buildings/detail.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx`

  Expected: FAIL，楼栋详情页和位置提示不存在。

- [ ] **Step 3: 实现详情与安全返回**

  楼栋详情调用 `houseApi.getBuildingMapDetail`，展示 API 返回的自然排序房源，不在前端排序。实现：

  ```ts
  function safeMapReturnTo(value: string | null) {
    return value?.startsWith('/dashboard/property-rental/map') ? value : '/dashboard/property-rental/map';
  }
  ```

  房源详情使用 `building.lat/lng` 显示“楼栋位置已维护”或“楼栋待定位”；不出现 House 坐标输入、字段或假地图点。

- [ ] **Step 4: 运行详情测试**

  Run: `cd frontend_admin && nvm use 22 && npm exec -- vitest run src/pages/property-rental/buildings/detail.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx`

  Expected: PASS。

- [ ] **Step 5: 提交详情页**

  ```bash
  git add frontend_admin/src/pages/property-rental/buildings/detail.tsx frontend_admin/src/pages/property-rental/buildings/detail.test.tsx frontend_admin/src/pages/property-rental/houses/detail.tsx frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx
  git commit -m "feat: 展示楼栋位置与地图详情"
  ```

## Task 8: 完整验证与人工验收

**Files:**

- Modify: 仅限验证发现的本功能缺陷文件。

- [ ] **Step 1: 运行后端回归和迁移检查**

  Run:

  ```bash
  DATABASE_URL=sqlite:///:memory: uv run pytest tests/house tests/settings -q
  DATABASE_URL=sqlite:///:memory: uv run python manage.py check
  DATABASE_URL=sqlite:///:memory: uv run python manage.py makemigrations --check --dry-run
  ```

  Expected: 全部 PASS；无模型迁移遗漏。

- [ ] **Step 2: 运行前端聚焦验证**

  Run:

  ```bash
  cd frontend_admin && nvm use 22 && npm exec -- vitest run src/components/LocationPicker/index.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/map/index.test.tsx src/pages/property-rental/buildings/detail.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx
  cd frontend_admin && nvm use 22 && npm run tsc
  cd frontend_admin && nvm use 22 && npm exec -- antd lint ./src/pages/property-rental ./src/components/LocationPicker ./src/services/manual/amap.ts
  cd frontend_admin && nvm use 22 && npm run build
  ```

  Expected: 全部 PASS。

- [ ] **Step 3: 人工验收**

  在配置 `AMAP_JSAPI_KEY` 和 `AMAP_SECURITY_JS_CODE` 的环境中逐项确认：

  1. 空间设置保存和清除默认定位，不改变既有小区/楼栋位置。
  2. 小区可不定位；保存小区坐标时必须有地址。
  3. 楼栋地址必填；选择已定位小区后预填地址/坐标；用户确认位置后切换小区不被覆盖。
  4. 浏览器定位授权、拒绝与超时均有正确回退；搜索、拖动、点击、确认和取消符合预期。
  5. 楼栋地图能搜索、筛选、聚合、查看抽屉、进入楼栋/房源详情、返回原视口。
  6. 待定位楼栋不显示错误标点，保存坐标后刷新地图出现标点。
  7. 旧 `/dashboard/geo/map` 自动跳至新地图。

- [ ] **Step 4: 提交验证修复（仅在存在修复时）**

  若前述命令发现本功能缺陷，先为该缺陷增加回归测试，再提交明确文件列表和中文提交信息；若没有修复，不创建空提交。

## 计划自检

- 已合并的“楼栋可选小区、删除检查、组织隔离”被视为现有能力，计划不重复实现。
- 小区位置非必填、楼栋地址必填、房源继承楼栋位置、坐标优先级、选点确认、有效房源统计、旧入口重定向和两端 OpenAPI 生成均有对应任务。
- 所有新接口、组件、类型和 URL 参数均在前序任务中定义后再被后续任务引用。
