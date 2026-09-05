# 房源资产工作区完整闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除房源列表中的“管理结构”Drawer，并让项目、楼栋的创建、完整编辑、删除和待完善治理全部在房源列表内闭环。

**Architecture:** 由房源列表页面统一编排资产范围、工作区动作和 URL；`PropertyAssetNavigator` 负责查找与发起动作，`PropertyAssetWorkspace` 负责对象 Tab、完整表单与删除闭环。复用现有位置选择、媒体上传、标签选择和删除影响确认组件，不修改后端 API，也不删除独立项目/楼栋页面。

**Tech Stack:** React 19、TypeScript、Umi Max、Ant Design 6、TanStack Query、Vitest、Testing Library。

---

> 项目约束要求未获明确指示时不操作 Git，因此本计划省略提交步骤。

### Task 1: 定义房源列表内的资产动作状态

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`
- Test: `frontend_admin/src/pages/rental/houses/PropertyAssetWorkspace.test.tsx`

- [ ] **Step 1: 写失败测试，声明创建项目、创建楼栋和编辑对象都在工作区打开**

在 `PropertyAssetWorkspace.test.tsx` 增加测试用 Harness，传入动作状态并断言出现右侧表单，同时断言页面不出现“完整管理”：

```tsx
expect(screen.queryByRole('button', { name: '完整管理' })).not.toBeInTheDocument();
expect(screen.getByRole('heading', { name: '新建项目' })).toBeVisible();
expect(screen.getByLabelText('项目名称')).toBeVisible();
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run src/pages/rental/houses/PropertyAssetWorkspace.test.tsx
```

Expected: FAIL，原因是工作区尚未接收资产动作，也仍有“完整管理”入口。

- [ ] **Step 3: 在房源列表中建立统一动作类型和 URL 解析**

在 `index.tsx` 定义：

```ts
export type PropertyAssetAction =
  | { type: 'create-estate' }
  | { type: 'create-building'; estateId?: number }
  | { type: 'edit-estate'; estateId: number }
  | { type: 'edit-building'; buildingId: number };
```

使用 `asset_action=create_estate|create_building|edit_estate|edit_building`、`estate_id` 和 `building_id` 表达动作。扩展现有 URL 初始化与 `popstate` 恢复逻辑，保证动作、范围和 `asset_tab` 同步恢复；动作完成或取消时删除 `asset_action`。

- [ ] **Step 4: 运行相关测试**

Run:

```bash
npm exec -- vitest run src/pages/rental/houses/PropertyAssetWorkspace.test.tsx src/pages/rental/houses/houseListLayout.test.ts
```

Expected: 动作状态相关测试进入预期失败点，现有布局测试保持通过。

### Task 2: 将项目与楼栋完整表单接入右侧工作区

**Files:**
- Create: `frontend_admin/src/pages/rental/houses/PropertyAssetForm.tsx`
- Create: `frontend_admin/src/pages/rental/houses/PropertyAssetForm.test.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetWorkspace.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetWorkspace.test.tsx`

- [ ] **Step 1: 写项目完整表单失败测试**

覆盖项目名称、展示名称、物业类型、省市区、地址和位置，提交后调用：

```ts
expect(mockPatchEstate).toHaveBeenCalledWith(
  11,
  expect.objectContaining({
    name: '云栖花园二期',
    address: '科技园路 99 号',
    lat: 22.5,
    lng: 113.9,
  }),
);
```

- [ ] **Step 2: 写楼栋完整表单失败测试**

覆盖所属项目、楼层、地下楼层、建成年份、电梯、地址、位置、图片和标签，提交后调用：

```ts
expect(mockPatchBuilding).toHaveBeenCalledWith(
  21,
  expect.objectContaining({
    estate_id: null,
    floors: 20,
    under_floors: 2,
    year_built: 2024,
    tags: ['近地铁'],
    images: expect.any(Array),
  }),
);
```

- [ ] **Step 3: 写创建与位置继承失败测试**

项目创建断言 `houseApi.createEstate`；项目楼栋创建断言默认 `estate_id`，且未手动定位时使用 `prefillBuildingLocation()` 结果；独立楼栋创建断言 `estate_id: null`。

- [ ] **Step 4: 实现 `PropertyAssetForm`**

组件接口保持单一：

```ts
type PropertyAssetFormProps = {
  action: PropertyAssetAction;
  estate?: EstateOut;
  building?: BuildingOut;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (result: EstateOut | BuildingOut, kind: 'estate' | 'building') => void;
};
```

实现要求：

- 项目与楼栋分别使用独立的表单值类型和提交 payload。
- 使用 `LocationPicker`、`PropertyTagSelect`、`MediaRefsUpload`。
- 使用 `useEnums(['house.estate_property_type'])`、项目列表、标签建议和组织默认位置查询。
- 创建项目楼栋时预选当前项目；修改楼栋所属项目时允许清空。
- 复用 `formLocation()`、`prefillBuildingLocation()` 和 `settingLocation()`。
- 提交成功后调用 `onSaved`，提交失败保留表单和用户输入。
- 表单修改后调用 `onDirtyChange(true)`，取消或成功后恢复为 `false`。

- [ ] **Step 5: 将表单接入 `PropertyAssetWorkspace`**

- 创建动作时，右侧标题显示“新建项目”“新建楼栋”或“新建独立楼栋”。
- 编辑动作或资料 Tab 的“编辑资料”统一渲染 `PropertyAssetForm`。
- 移除当前简化表单和“完整管理”按钮。
- 编辑或创建期间禁用其他 Tab，并通过 `onEditingChange` 锁定左侧导航。
- 保留 `beforeunload` 未保存提醒。

- [ ] **Step 6: 运行表单和工作区测试**

Run:

```bash
npm exec -- vitest run src/pages/rental/houses/PropertyAssetForm.test.tsx src/pages/rental/houses/PropertyAssetWorkspace.test.tsx
```

Expected: PASS。

### Task 3: 在资料 Tab 完成删除闭环

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetWorkspace.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetWorkspace.test.tsx`
- Reuse: `frontend_admin/src/pages/rental/estates/ResourceDeleteModal.tsx`

- [ ] **Step 1: 写删除入口和成功状态失败测试**

断言资料查看态存在危险操作区；点击删除后打开 `ResourceDeleteModal`。删除成功回调应调用工作区的删除完成接口：

```ts
expect(onDeleted).toHaveBeenCalledWith({ kind: 'building', id: 21 });
```

- [ ] **Step 2: 实现危险操作区**

在资料 Tab 底部增加语义明确的危险操作区，按钮名称分别为“删除项目”和“删除楼栋”。将当前对象转换为：

```ts
{
  type: selectedKind,
  id: selectedId,
  label: entityName,
}
```

传给现有 `ResourceDeleteModal`。删除成功后使 `house/estates`、`house/buildings`、`house/houses`、`house/asset-navigator` 和 `house/asset-workspace` 查询失效，再通知房源列表清空资产范围。

- [ ] **Step 3: 运行工作区与删除组件测试**

Run:

```bash
npm exec -- vitest run src/pages/rental/houses/PropertyAssetWorkspace.test.tsx src/pages/rental/estates/ResourceDeleteModal.test.tsx
```

Expected: PASS。

### Task 4: 将左侧所有管理动作改为工作区动作，并移除“管理结构”

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.test.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`

- [ ] **Step 1: 改写导航测试**

删除“opens the integrated project and building manager”测试，新增断言：

```ts
expect(screen.queryByRole('button', { name: '管理项目与楼栋' })).not.toBeInTheDocument();
```

并验证：

```ts
expect(onAction).toHaveBeenCalledWith({ type: 'create-estate' });
expect(onAction).toHaveBeenCalledWith({ type: 'create-building', estateId: 1 });
expect(onAction).toHaveBeenCalledWith({ type: 'edit-estate', estateId: 1 });
expect(onAction).toHaveBeenCalledWith({ type: 'edit-building', buildingId: 2 });
```

- [ ] **Step 2: 调整 `PropertyAssetNavigator` 接口**

将 `onOpenManagement` 替换为：

```ts
onAction: (action: PropertyAssetAction) => void;
```

所有项目、楼栋的新建和编辑按钮只发出工作区动作。移除 `SettingOutlined`、底部“管理结构”按钮及相关样式；地图查看和房态同步保持不变。

- [ ] **Step 3: 在房源列表页面接线并删除 Drawer**

从 `index.tsx` 移除：

- `Drawer` 引入。
- `EstatesPage` 引入。
- `structureOpen` 状态。
- `syncPropertyStructureIntent()`、`handleOpenStructure()`、`handleCloseStructure()`。
- 页面末尾的“管理项目与楼栋”Drawer。

将导航动作更新到统一 `assetAction` 状态，传入 `PropertyAssetWorkspace`。保存后按返回对象设置 `estateId` 或 `buildingId`、清理动作并打开资料 Tab；删除后清空范围并回到房源 Tab。

- [ ] **Step 4: 运行导航和工作区测试**

Run:

```bash
npm exec -- vitest run src/pages/rental/houses/PropertyAssetNavigator.test.tsx src/pages/rental/houses/PropertyAssetWorkspace.test.tsx
```

Expected: PASS，且源码中不再存在“管理项目与楼栋”Drawer。

### Task 5: 将待完善治理迁移到资产导航

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.test.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`

- [ ] **Step 1: 写四类治理筛选失败测试**

构造缺地址、缺位置和无楼栋数据，验证选择筛选后仅展示匹配对象，并验证对象操作发出正确动作：

```ts
expect(screen.getByRole('button', { name: '补项目地址' })).toBeVisible();
expect(screen.getByRole('button', { name: '补楼栋位置' })).toBeVisible();
expect(screen.getByRole('button', { name: '补首栋楼' })).toBeVisible();
```

- [ ] **Step 2: 实现治理筛选**

增加：

```ts
export type PropertyAssetIssueFilter =
  | 'estate_address'
  | 'building_address'
  | 'building_location'
  | 'no_building';
```

在导航头部搜索框下提供紧凑的“待完善”选择器。筛选时请求足够覆盖当前组织资产的数据，并复用原 `EstatesPage` 的匹配语义：

- `estate_address`: `!estate.address`
- `building_address`: `!building.address`
- `building_location`: `building.lat == null || building.lng == null`
- `no_building`: 项目没有楼栋

筛选结果使用已有项目、楼栋节点样式；无结果时提供“清除筛选”。点击补充操作直接进入对应资料编辑或创建楼栋动作。

- [ ] **Step 3: 将治理筛选同步到 URL**

使用独立参数 `asset_issue`，避免覆盖房源高级筛选的 `inspection_reason`、`status` 和 `keyword`。刷新与 `popstate` 恢复筛选；清除筛选时删除参数。

- [ ] **Step 4: 运行导航测试**

Run:

```bash
npm exec -- vitest run src/pages/rental/houses/PropertyAssetNavigator.test.tsx
```

Expected: PASS。

### Task 6: 完整验证与视觉验收

**Files:**
- Modify: `.codex/audits/property-asset-workspace/design-qa.md`
- Create screenshots only under: `.codex/audits/property-asset-workspace/`

- [ ] **Step 1: 运行相关测试**

Run:

```bash
cd frontend_admin
nvm use 22
npm exec -- vitest run \
  src/pages/rental/houses/PropertyAssetForm.test.tsx \
  src/pages/rental/houses/PropertyAssetWorkspace.test.tsx \
  src/pages/rental/houses/PropertyAssetNavigator.test.tsx \
  src/pages/rental/houses/houseListLayout.test.ts \
  src/pages/rental/estates/ResourceDeleteModal.test.tsx
```

Expected: PASS。

- [ ] **Step 2: 运行类型和组件规范检查**

Run:

```bash
npm run tsc
npm exec -- antd lint ./src/pages/rental/houses
npm exec -- biome check \
  src/pages/rental/houses/PropertyAssetForm.tsx \
  src/pages/rental/houses/PropertyAssetForm.test.tsx \
  src/pages/rental/houses/PropertyAssetWorkspace.tsx \
  src/pages/rental/houses/PropertyAssetWorkspace.test.tsx \
  src/pages/rental/houses/PropertyAssetNavigator.tsx \
  src/pages/rental/houses/PropertyAssetNavigator.test.tsx \
  src/pages/rental/houses/index.tsx
```

Expected: 全部通过。

- [ ] **Step 3: 浏览器验收**

验证以下状态：

- 页面不再出现“管理结构”“完整管理”或管理 Drawer。
- 新建项目、项目楼栋、独立楼栋均在右侧完成。
- 项目和楼栋完整资料可保存，取消后上下文正确。
- 删除影响确认可打开，验收时不执行真实删除。
- 四类待完善筛选可定位并修复对象。
- URL 刷新、前进和后退恢复正确。
- 编辑期间左侧导航和其他 Tab 锁定。
- 控制台无新增 warning 或 error。

- [ ] **Step 4: 更新验收记录**

在 `.codex/audits/property-asset-workspace/design-qa.md` 追加完整闭环状态、截图路径、视口、交互检查、控制台结果和最终结论。
