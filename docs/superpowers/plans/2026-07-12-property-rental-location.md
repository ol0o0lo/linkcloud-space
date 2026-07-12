# Property Rental Location Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让租户维护一个高德地图默认定位，并在新建小区和独立楼栋时自动带入可选择的地址与经纬度。

**Architecture:** 后端将默认定位注册为现有 `DefaultSetting` / `OrganizationSetting` 的 JSON 设置项，并在模型层校验地址坐标的一致性。管理端新增受控的 `LocationPicker`，通过现有 JS API loader 搜索 POI、地图选点并输出位置对象；设置页与项目楼栋页均复用它。

**Tech Stack:** Django 5、django-ninja、pytest、React 19、Ant Design 6、TanStack Query、Vitest、@amap/amap-jsapi-loader。

---

## 文件结构

- 修改 `apps/house/models.py`：为 `Estate` 与 `Building` 增加位置成对与经纬度范围校验。
- 修改 `apps/house/services.py`：注册并读取 `property_rental.default_location` 设置。
- 修改 `apps/settings/constants.py`：声明 `location_picker` 设置控件。
- 新建 `apps/settings/migrations/0006_property_rental_default_location.py`：创建默认定位的默认设置记录。
- 修改 `tests/house/test_api.py`、新建或修改 `tests/settings/test_service.py`：覆盖 API、模型与设置回退行为。
- 修改 `frontend_admin/src/services/manual/amap.ts`：加载 `AMap.PlaceSearch` 与 `AMap.Geocoder` 插件。
- 新建 `frontend_admin/src/components/LocationPicker/index.tsx`：封装地址搜索、地图点击和清除。
- 新建 `frontend_admin/src/components/LocationPicker/index.test.tsx`：验证控件可见行为与 SDK 故障提示。
- 修改 `frontend_admin/src/pages/settings-management/organization/index.tsx` 及测试：渲染并保存默认定位。
- 修改 `frontend_admin/src/pages/property-rental/estates/index.tsx` 及域页面测试：在抽屉中预填及保存位置，关联小区楼栋只读继承。

### Task 1: 后端位置约束

**Files:**
- Modify: `apps/house/models.py`
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: 写出坐标成对与范围验证的失败测试**

在 `HouseApiTestCase` 中加入下面的 API 测试，断言返回 422 且字段错误存在；同时覆盖小区和独立楼栋的正常完整坐标保存：

```python
def test_estate_location_requires_coordinate_pair_and_accepts_valid_coordinates(self):
    incomplete = self.client.post(
        "/api/house/estates/",
        data=json.dumps({
            "name": "坐标不完整小区", "display_name": "坐标不完整小区",
            "property_type": "residential", "province": "广东", "city": "深圳", "district": "南山",
            "address": "科技园路 1 号", "lat": "22.540123",
        }),
        content_type="application/json",
    )
    self.assertEqual(incomplete.status_code, 422)
    self.assertIn("lng", api_error(incomplete)["data"]["fields"])

    created = self.client.post(
        "/api/house/estates/",
        data=json.dumps({
            "name": "坐标完整小区", "display_name": "坐标完整小区",
            "property_type": "residential", "province": "广东", "city": "深圳", "district": "南山",
            "address": "科技园路 1 号", "lat": "22.540123", "lng": "113.934567",
        }),
        content_type="application/json",
    )
    self.assertEqual(created.status_code, 201)
    self.assertEqual(api_data(created)["lat"], "22.540123")
    self.assertEqual(api_data(created)["lng"], "113.934567")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -k location -v`

Expected: FAIL，因为模型现在允许只保存一个坐标。

- [ ] **Step 3: 在模型层实现最小校验**

抽取私有函数，在两个模型的 `clean()` 中调用；使用 `ValidationError` 的字段映射，使 Ninja 返回字段错误：

```python
def validate_location_pair(*, address: str, lat: Decimal | None, lng: Decimal | None) -> None:
    if (lat is None) != (lng is None):
        raise ValidationError({"lng" if lat is not None else "lat": "纬度和经度必须同时填写。"})
    if lat is not None and not Decimal("-90") <= lat <= Decimal("90"):
        raise ValidationError({"lat": "纬度必须在 -90 到 90 之间。"})
    if lng is not None and not Decimal("-180") <= lng <= Decimal("180"):
        raise ValidationError({"lng": "经度必须在 -180 到 180 之间。"})
```

调用时保留既有 `address` 允许为空的兼容性；不为历史空地址或空坐标做迁移。

- [ ] **Step 4: 运行测试确认通过**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -k location -v`

Expected: PASS。

- [ ] **Step 5: 提交后端位置校验**

```bash
git add apps/house/models.py tests/house/test_api.py
git commit -m "feat: 校验房源位置坐标"
```

### Task 2: 注册并读取租户默认定位

**Files:**
- Modify: `apps/house/services.py`
- Modify: `apps/settings/constants.py`
- Create: `apps/settings/migrations/0006_property_rental_default_location.py`
- Modify: `tests/house/test_api.py`

- [ ] **Step 1: 写出默认设置注册与租户覆盖的失败测试**

```python
def test_default_location_setting_is_visible_and_org_override_is_used(self):
    default_location = {"address": "科技园路 1 号", "lat": 22.540123, "lng": 113.934567}
    setting = ensure_default_location_setting()
    self.assertEqual(setting.key, "property_rental.default_location")
    self.assertEqual(setting.value, None)

    set_org_setting(self.org, setting.key, default_location)
    self.assertEqual(get_org_default_location(self.org), default_location)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -k default_location -v`

Expected: FAIL，导入的设置注册/读取函数不存在。

- [ ] **Step 3: 实现设置 metadata、迁移与值归一化**

在 `apps/house/services.py` 添加：

```python
DEFAULT_LOCATION_SETTING_KEY = "property_rental.default_location"

def ensure_default_location_setting():
    metadata = {
        "description": "新建项目和独立楼栋时预填的地址与地图定位。",
        "label": "默认定位",
        "widget": "location_picker",
        "ui": {"provider": "amap"},
        "category": "property_rental",
    }
    return DefaultSetting.objects.update_or_create(
        key=DEFAULT_LOCATION_SETTING_KEY,
        defaults={"value": None, "value_type": ValueType.JSON, **metadata},
    )[0]

def get_org_default_location(organization):
    setting = ensure_default_location_setting()
    value = OrganizationSetting.objects.filter(organization=organization, setting=setting).values_list("value", flat=True).first()
    return value if isinstance(value, dict) else None
```

让 `SettingWidget` 增加 `LOCATION_PICKER = "location_picker", "地址选择器"`。迁移用 `RunPython` 的 `update_or_create` 写入 key、`null` value、JSON value type、metadata；反向迁移为 `RunPython.noop`，不删除用户已保存的覆盖值。

- [ ] **Step 4: 运行测试确认通过并检查迁移**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -k default_location -v && DATABASE_URL=sqlite:///:memory: uv run python manage.py makemigrations --check --dry-run`

Expected: PASS，且迁移检查输出 `No changes detected`。

- [ ] **Step 5: 提交默认定位设置**

```bash
git add apps/house/services.py apps/settings/constants.py apps/settings/migrations/0006_property_rental_default_location.py tests/house/test_api.py
git commit -m "feat: 增加租户默认定位设置"
```

### Task 3: 实现可复用高德地址选择器

**Files:**
- Modify: `frontend_admin/src/services/manual/amap.ts`
- Create: `frontend_admin/src/components/LocationPicker/index.tsx`
- Create: `frontend_admin/src/components/LocationPicker/index.test.tsx`

- [ ] **Step 1: 写组件失败测试**

模拟 `useAmap` 返回包含 `Map`、`Marker`、`PlaceSearch` 的 AMap，并测试公开接口：

```tsx
it('选择地点时回传完整地址和坐标，清除时回传 null', async () => {
  const onChange = vi.fn();
  render(<LocationPicker value={null} onChange={onChange} ariaLabel="默认定位" />);
  fireEvent.change(screen.getByRole('textbox', { name: '默认定位' }), { target: { value: '科技园' } });
  fireEvent.click(await screen.findByRole('option', { name: '科技园路 1 号' }));
  expect(onChange).toHaveBeenLastCalledWith({ address: '科技园路 1 号', lat: 22.540123, lng: 113.934567 });
  fireEvent.click(screen.getByRole('button', { name: '清除定位' }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});
```

- [ ] **Step 2: 运行失败测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/LocationPicker/index.test.tsx`

Expected: FAIL，因为 `LocationPicker` 尚未存在。

- [ ] **Step 3: 实现受控组件与 loader 插件**

在 loader 的 `plugins` 中加入 `AMap.PlaceSearch` 和 `AMap.Geocoder`。组件导出以下明确类型和属性：

```tsx
export type LocationValue = { address: string; lat: number; lng: number };
export function LocationPicker({ value, onChange, ariaLabel, disabled = false }: {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  ariaLabel: string;
  disabled?: boolean;
}) { /* 搜索、地图、Marker 与清除 */ }
```

使用 `AMap.PlaceSearch.search(keyword, callback)` 生成选择列表；选择 POI 时读取 `poi.location.getLat()`、`getLng()` 并用 `poi.address + poi.name` 作为地址。地图点击时使用 `AMap.Geocoder.getAddress` 获得格式化地址；地址解析失败时显示 `message.error` 且保留旧值。地图与 marker 生命周期分别存于 ref，并在 effect cleanup 中调用 `map.destroy()`。SDK 加载中显示 `Spin`，失败显示 `Alert`，且禁用搜索与选址。

- [ ] **Step 4: 运行组件测试与类型检查**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/LocationPicker/index.test.tsx && npm --prefix frontend_admin run tsc`

Expected: PASS。

- [ ] **Step 5: 提交地址选择组件**

```bash
git add frontend_admin/src/services/manual/amap.ts frontend_admin/src/components/LocationPicker/index.tsx frontend_admin/src/components/LocationPicker/index.test.tsx
git commit -m "feat: 增加高德地址选择组件"
```

### Task 4: 在租户设置中维护默认定位

**Files:**
- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`

- [ ] **Step 1: 写设置页失败测试**

在 fixture 添加 `property_rental.default_location`（`value: null`、`value_type: 'json'`、`widget: 'location_picker'`）；mock `LocationPicker` 为触发 `onChange` 的按钮，测试选择后调用现有组织设置 API：

```tsx
fireEvent.click(await screen.findByRole('button', { name: '选择测试定位' }));
await waitFor(() => expect(mockPutSetting).toHaveBeenCalledWith(
  { key: 'property_rental.default_location' },
  { value: { address: '科技园路 1 号', lat: 22.540123, lng: 113.934567 } },
));
```

- [ ] **Step 2: 运行失败测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/organization/index.test.tsx`

Expected: FAIL，设置页未识别 `location_picker`。

- [ ] **Step 3: 接入专用控件**

定义 `defaultLocationSettingKey`，在 `renderControl` 中优先匹配此 key 或 `setting.widget === 'location_picker'`，渲染：

```tsx
<LocationPicker
  ariaLabel={setting.label || '默认定位'}
  value={isLocationValue(value) ? value : null}
  onChange={(nextValue) => onCommit(nextValue)}
/>
```

`isLocationValue` 只接受含非空 `address` 和有限数值 `lat`/`lng` 的对象；非法历史 JSON 显示为空，不将它传给地图。删除原先“空间设置”中仅为默认楼栋创建楼栋的弹窗不属于本任务，保持原有功能不变。

- [ ] **Step 4: 运行测试确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/organization/index.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交设置页面改动**

```bash
git add frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx
git commit -m "feat: 支持维护默认定位"
```

### Task 5: 将默认定位接入小区和楼栋抽屉

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 写页面失败测试**

mock `appsSettingsApiGetOrgSettingView` 返回默认位置，并 mock `LocationPicker`。分别验证：

```tsx
expect(locationPickerProps.value).toEqual({ address: '科技园路 1 号', lat: 22.540123, lng: 113.934567 });
expect(screen.getByText('楼栋位置继承所属小区')).toBeInTheDocument();
```

再触发保存，断言 `houseApi.createEstate` 与 `houseApi.createBuilding` 收到 `address`、`lat`、`lng`；给楼栋选择 `estate_id` 后，断言不再显示可编辑地址选择器。

- [ ] **Step 2: 运行失败测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

Expected: FAIL，抽屉尚未请求默认定位或渲染地址选择器。

- [ ] **Step 3: 添加默认定位查询、表单类型和选址字段**

通过 `appsSettingsApiGetOrgSettingView({ key: 'property_rental.default_location' })` 在有选中租户时查询；只在“新建”且资源自身没有值时将合法默认值放进 `estateInitialValues` / `buildingInitialValues`。扩展两个表单类型：

```ts
type LocationFields = { address?: string; lat?: number; lng?: number };
type EstateFormValues = /* 既有字段 */ & LocationFields;
type BuildingFormValues = /* 既有字段 */ & LocationFields;
```

用 `Form.Item noStyle shouldUpdate` 监听 `estate_id`：无小区时渲染 `LocationPicker`，并在 `onChange` 中调用 `form.setFieldsValue(nextValue ?? { address: '', lat: null, lng: null })`；有小区时清除独立 `address`、`lat`、`lng`，显示只读卡片“楼栋位置继承所属小区”。小区抽屉始终渲染选址组件。提交时传递三个字段，不再渲染手工地址 `Input`。

- [ ] **Step 4: 运行页面测试与静态检查**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx && npm --prefix frontend_admin run lint`

Expected: PASS。

- [ ] **Step 5: 提交表单接入**

```bash
git add frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 新建项目楼栋预填默认定位"
```

### Task 6: 全量回归与交付检查

**Files:**
- Modify: 按前述任务产生的文件（仅在测试失败时进行最小修正）

- [ ] **Step 1: 运行后端相关回归**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py tests/settings -v`

Expected: PASS。

- [ ] **Step 2: 运行前端相关回归与构建**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/LocationPicker/index.test.tsx src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx && npm --prefix frontend_admin run build`

Expected: PASS，构建成功。

- [ ] **Step 3: 检查差异与迁移**

Run: `git diff --check && DATABASE_URL=sqlite:///:memory: uv run python manage.py makemigrations --check --dry-run && git status --short`

Expected: 无空白错误、无遗漏 migration；仅出现本功能的预期改动。

- [ ] **Step 4: 提交最终验证修正（如有）**

```bash
git add apps/house/models.py apps/house/services.py apps/settings/constants.py apps/settings/migrations/0006_property_rental_default_location.py tests/house/test_api.py frontend_admin/src/services/manual/amap.ts frontend_admin/src/components/LocationPicker/index.tsx frontend_admin/src/components/LocationPicker/index.test.tsx frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "test: 验证房源定位流程"
```

## 自查

- 设计中的租户级默认设置、选址组件、创建预填、关联小区继承、错误处理与测试均有对应任务。
- 所有值使用同一 `{ address, lat, lng }` 结构；模型、设置和前端组件的字段名称一致。
- 未使用“稍后实现”等占位语；唯一条件提交步骤明确限定为测试产生的最小修正。
