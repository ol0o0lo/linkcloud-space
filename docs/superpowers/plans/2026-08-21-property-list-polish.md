# 房源列表细节精修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变房源列表接口与核心操作的前提下，增加当前范围、结果数、筛选反馈、编辑提示、状态图标和可操作空状态，并精修导航与表格视觉层级。

> **最新反馈覆盖：** 独立的房源列表上下文摘要已取消。最终实现不在右侧表格上方重复展示范围、结果数、筛选标签或编辑提示；范围信息保留在左侧导航，并为“房源范围”标题增加轻量房屋图标装饰。“选择项目或楼栋，右侧列表会同步筛选”说明文案也不再展示。后续执行本计划时，以该反馈和对应设计文档为准。

**Architecture:** 新增一个房源列表私有的展示组件承载上下文摘要，页面继续负责查询与筛选状态；空状态和房态展示仍由列表页根据现有数据生成。左侧资产导航只增加说明和选中态样式，不改变其查询与交互模型。

**Tech Stack:** React 19、TypeScript、Ant Design 6、ProComponents 3、antd-style、React Query、Vitest、Testing Library。

---

## 文件结构

- Create: `frontend_admin/src/pages/rental/houses/HouseListContextBar.tsx`：渲染当前范围、结果数、筛选标签、清除筛选和编辑中提示。
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`：提供范围元数据、空状态、状态图标、操作提示与表格视觉样式。
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.tsx`：增加范围用途说明并强化选中、悬浮和底部快捷区层次。
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`：覆盖上下文摘要、筛选清除、编辑提示和两类空状态。

仓库规则要求未明确授权时不操作 Git，因此本计划不包含 worktree 或 commit 步骤。

### Task 1: 为用户可见反馈补充失败测试

**Files:**
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 增加默认范围与结果数测试**

在房源列表测试区增加：

```tsx
it('shows the current house scope and result count', async () => {
  renderPage(<HousesPage />);

  expect(await screen.findByText('全部房源')).toBeInTheDocument();
  expect(screen.getByText('共 1 套')).toBeInTheDocument();
  expect(screen.getByText('选择项目或楼栋，右侧列表会同步筛选')).toBeInTheDocument();
});
```

- [ ] **Step 2: 增加筛选摘要与清除测试**

```tsx
it('summarizes and clears active house filters', async () => {
  window.history.pushState(
    {},
    '',
    '/rental/properties/list?keyword=A-101&status=vacant',
  );

  renderPage(<HousesPage />);

  expect(await screen.findByText('关键词：A-101')).toBeInTheDocument();
  expect(screen.getByText('房态：空置')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '清除筛选' }));

  await waitFor(() => expect(window.location.search).toBe(''));
  expect(mockListHouses).toHaveBeenLastCalledWith(
    expect.objectContaining({ keyword: undefined, status: undefined, page: 1 }),
  );
});
```

- [ ] **Step 3: 增加编辑中提示测试**

```tsx
it('explains why scope and filters are locked while editing', async () => {
  renderPage(<HousesPage />);

  fireEvent.click(await screen.findByRole('button', { name: '编辑房源 A-101' }));

  expect(
    screen.getByText('正在编辑 1 套房源，保存或取消后可切换范围与筛选'),
  ).toBeInTheDocument();
});
```

- [ ] **Step 4: 更新筛选无结果测试并增加范围空数据测试**

筛选无结果断言改为：

```tsx
expect(await screen.findByText('未找到符合条件的房源')).toBeInTheDocument();
expect(screen.getByText('可以清除关键词或房态筛选后重试')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '清除筛选' })).toBeInTheDocument();
```

再增加：

```tsx
it('offers house creation when the current scope is empty', async () => {
  mockListHouses.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
  });

  renderPage(<HousesPage />);

  expect(await screen.findByText('当前范围暂无房源')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '新建房源' }));
  expect(mockHistoryPush).toHaveBeenCalledWith('/rental/properties/new');
});
```

- [ ] **Step 5: 运行测试并确认新断言失败**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx
```

Expected: 新增用例因上下文摘要、编辑提示和新空状态尚未实现而失败；既有用例保持可运行。

### Task 2: 实现列表上下文摘要

**Files:**
- Create: `frontend_admin/src/pages/rental/houses/HouseListContextBar.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`

- [ ] **Step 1: 创建纯展示组件**

组件公开以下接口：

```tsx
type HouseListContextBarProps = {
  editingCount: number;
  keyword?: string;
  scopeLabel: string;
  statusLabel?: string;
  total: number;
  onClearFilters: () => void;
};
```

组件使用 `HomeOutlined`、`EditOutlined`、`Button`、`Tag`、`Typography` 和 `createStyles`，显示：

```tsx
<div className={styles.root} aria-label="房源列表上下文">
  <div className={styles.scopeSummary}>
    <span className={styles.scopeIcon}><HomeOutlined /></span>
    <div>
      <Typography.Text type="secondary" className={styles.eyebrow}>当前范围</Typography.Text>
      <div className={styles.scopeLine}>
        <Typography.Text strong>{scopeLabel}</Typography.Text>
        <Typography.Text type="secondary">共 {total} 套</Typography.Text>
      </div>
    </div>
  </div>
  <div className={styles.feedback}>
    {keyword ? <Tag>关键词：{keyword}</Tag> : null}
    {statusLabel ? <Tag>房态：{statusLabel}</Tag> : null}
    {keyword || statusLabel ? (
      <Button type="link" size="small" onClick={onClearFilters}>清除筛选</Button>
    ) : null}
    {editingCount ? (
      <Tag icon={<EditOutlined />} color="processing">
        正在编辑 {editingCount} 套房源，保存或取消后可切换范围与筛选
      </Tag>
    ) : null}
  </div>
</div>
```

样式全部使用主题 token，并允许反馈区在中等宽度换行。

- [ ] **Step 2: 在列表页查询范围名称并生成标签**

在 `HousesPage` 中增加两个按需查询：

```tsx
const selectedEstate = useQuery({
  queryKey: ['house', 'houses', 'selected-estate', workspace.selectedOrgSlug, estateId],
  queryFn: () => houseApi.getEstate(estateId as number),
  enabled: enabled && Boolean(estateId) && !buildingId,
});
const selectedBuilding = useQuery({
  queryKey: ['house', 'asset-navigator', 'selected-building', workspace.selectedOrgSlug, buildingId],
  queryFn: () => houseApi.getBuilding(buildingId as number),
  enabled: enabled && Boolean(buildingId),
});
```

按“楼栋 → 项目 → 全部房源”优先级生成 `scopeLabel`，楼栋标签使用“项目名 / 楼栋名”，请求未返回时分别回退为 `楼栋 #ID` 和 `项目 #ID`。

- [ ] **Step 3: 接入摘要与统一清除逻辑**

在 `Card` 内、`EditableProTable` 前渲染 `HouseListContextBar`：

```tsx
<HouseListContextBar
  editingCount={editableKeys.length}
  keyword={q}
  scopeLabel={scopeLabel}
  statusLabel={houseStatusOptions.find((option) => option.value === status)?.label}
  total={houses.data?.total || 0}
  onClearFilters={() => {
    setPage(1);
    setSearchDraft('');
    setQ(undefined);
    setStatus(undefined);
  }}
/>
```

范围条件不属于“清除筛选”，因此清除时保留 `estateId`、`buildingId` 与排序。

- [ ] **Step 4: 更新测试 mock**

在 hoisted mocks 和 `houseApi` mock 中加入 `mockGetEstate`，并在 `beforeEach` 中：

```tsx
mockGetEstate.mockResolvedValue(defaultEstate);
```

- [ ] **Step 5: 运行上下文相关测试**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx -t "house scope|house filters|while editing"
```

Expected: 3 个上下文用例通过。

### Task 3: 实现空状态、状态提示和操作提示

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 实现两类空状态**

根据 `Boolean(q || status)` 构造 `locale.emptyText`：

```tsx
const emptyState = q || status ? (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <Space direction="vertical" size={2}>
        <Typography.Text strong>未找到符合条件的房源</Typography.Text>
        <Typography.Text type="secondary">可以清除关键词或房态筛选后重试</Typography.Text>
      </Space>
    }
  >
    <Button onClick={clearHouseFilters}>清除筛选</Button>
  </Empty>
) : (
  <Empty
    image={Empty.PRESENTED_IMAGE_SIMPLE}
    description={
      <Space direction="vertical" size={2}>
        <Typography.Text strong>当前范围暂无房源</Typography.Text>
        <Typography.Text type="secondary">新建房源后可在这里维护房态与出租资料</Typography.Text>
      </Space>
    }
  >
    <Button type="primary" icon={<PlusOutlined />} onClick={() => history.push('/rental/properties/new')}>
      新建房源
    </Button>
  </Empty>
);
```

将清除逻辑提取为 `clearHouseFilters`，供上下文条和空状态复用。

- [ ] **Step 2: 给房态增加形状线索**

增加 `houseStatusIcon(status)`，按现有状态返回：

```tsx
switch (status) {
  case HOUSE_STATUS.LISTED:
    return <ClockCircleOutlined />;
  case HOUSE_STATUS.RENTED:
    return <CheckCircleOutlined />;
  case HOUSE_STATUS.RENOVATING:
    return <ToolOutlined />;
  case HOUSE_STATUS.INACTIVE:
    return <StopOutlined />;
  default:
    return <HomeOutlined />;
}
```

房态列继续使用现有颜色映射，同时传入 `Tag` 的 `icon`。

- [ ] **Step 3: 明确行内图标操作**

编辑按钮改为：

```tsx
<Tooltip title="行内编辑">
  <Button
    type="link"
    size="small"
    aria-label={`编辑房源 ${record.room_number}`}
    icon={<EditOutlined />}
    onClick={() => action?.startEditable?.(record.id)}
  />
</Tooltip>
```

更多按钮增加 `Tooltip title="更多操作"` 和 `aria-label="更多操作"`，并将测试中依赖英文 `more` 的断言更新为中文可访问名称。

- [ ] **Step 4: 运行房态、操作与空状态测试**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx -t "house|房源"
```

Expected: 房源列表相关用例全部通过。

### Task 4: 精修导航和表格视觉层级

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/PropertyAssetNavigator.tsx`
- Modify: `frontend_admin/src/pages/rental/houses/index.tsx`

- [ ] **Step 1: 查询实际使用的 Ant Design 组件 API**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- antd info Empty
nvm use 22 && npm --prefix frontend_admin exec -- antd info Tag
nvm use 22 && npm --prefix frontend_admin exec -- antd info Tooltip
```

Expected: 命令成功输出 Ant Design 6 的组件属性，确认 `Empty` children、`Tag` icon 与 `Tooltip` 用法。

- [ ] **Step 2: 精修左侧导航**

在导航标题下增加：

```tsx
<Typography.Text type="secondary" className={styles.description}>
  选择项目或楼栋，右侧列表会同步筛选
</Typography.Text>
```

选中行使用透明默认边框占位，并在激活时切换为 `token.colorPrimaryBg` 背景、`token.colorPrimaryBorder` 边框、主色文字和中等字重；移除左侧竖线。选中项数量使用 `token.colorBgContainer` 胶囊承载并保持主色文字，“全部房源”、项目、楼栋、最近使用和搜索结果统一通过 `aria-current` 暴露当前范围。悬浮态、底部快捷区和搜索区继续只使用 token，并保留 `prefers-reduced-motion` 处理。

- [ ] **Step 3: 精修表格与房源识别列**

在 `stableEditableTable` 中增加 token 化的表头背景、行悬浮过渡和固定列一致背景；为房源识别列增加局部类名，使缩略图具备细边框和占位背景，房号使用强调字重。不要改变行高、列宽、排序、固定列或编辑行为。

- [ ] **Step 4: 优化工具栏换行**

让上下文条和 ProTable 工具栏在 `screenLG` 以下自然换行；新建房源仍是唯一主按钮，搜索和房态筛选保持现有宽度语义，在窄屏不溢出卡片。

- [ ] **Step 5: 运行定向测试**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx
```

Expected: 文件内全部用例通过。

### Task 5: 完整验证与视觉检查

**Files:**
- Verify only

- [ ] **Step 1: 运行 TypeScript 检查**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin run tsc
```

Expected: 退出码 0，无 TypeScript 错误。

- [ ] **Step 2: 运行 Ant Design 用法检查**

Run:

```bash
nvm use 22 && npm --prefix frontend_admin exec -- antd lint ./src/pages/rental/houses
```

Expected: 退出码 0，或仅报告与本次改动无关的既有问题并记录。

- [ ] **Step 3: 在本地页面检查桌面状态**

打开 `http://localhost:8080/dashboard/rental/properties/list`，检查：

- 默认全部房源、项目范围和楼栋范围的标签与数量；
- 关键词/房态筛选摘要及清除动作；
- 行内编辑提示和禁用控件原因；
- 房态图标、无图占位、行悬浮及更多操作提示；
- 无筛选空数据和筛选无结果两种状态。

- [ ] **Step 4: 检查窄屏与暗色主题**

将视口缩窄到 `≤768px` 并切换暗色主题，确认上下文条、筛选工具栏和主按钮可用，新增表面、边框、文字与选中态可读。

- [ ] **Step 5: 检查改动范围**

Run:

```bash
git diff -- frontend_admin/src/pages/rental/houses frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx docs/superpowers
```

Expected: 仅包含已批准的房源列表精修、测试和设计/计划文档，无生成服务、多语言、依赖或无关重构。
