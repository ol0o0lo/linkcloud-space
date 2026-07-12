# 管理端实体悬停预览设计

## 背景与目标

`frontend_admin` 的表格、详情抽屉和关联实体文字目前由各页面独立实现。房源、项目、楼栋、联系人、合同、用户等实体在不同表格里重复出现，但没有统一的悬停概览和跳转入口。

本设计新增一套前端实体预览能力：业务页面以语义组件包裹实体文字；鼠标悬停时显示实体专属 Popover 概览，点击后进入完整详情。公共层统一交互和路由选择，实体层独立处理详情请求与卡片设计。

目标：

- 表格及其他业务页面只声明实体 ID 和显示文字，不承载预览请求、缓存、字段拼装或 Popover 逻辑。
- 所有已具备可复用详情接口的核心业务实体均可接入，并能按同一方式扩展。
- 各实体可独立决定概览卡片的字段、样式和加载状态，不受通用字段模型限制。
- 不新增“统一实体概览”后端接口；概览复用现有实体详情接口。
- 首期不要求同时建设所有独立详情页；尚无独立详情页的实体可跳转到对应列表并自动打开现有详情 Drawer。

非目标：

- 不把静态枚举、纯展示统计、模板示例表格或无详情概念的操作行纳入实体预览。
- 不从列表行数据构造预览内容，也不向列表组件传入 `initialData`、请求函数或缓存键。
- 不将所有实体卡片强制为相同字段或布局。

## 总体架构

采用“一个通用内核 + 多个实体入口组件 + 多个实体面板”的结构。

```text
业务列表
└── HousePreview / BuildingPreview / UserPreview
    └── EntityPreview（通用内核）
        ├── 读取实体注册表
        ├── 处理 Popover、悬停延迟、键盘交互与跳转
        └── 延迟挂载对应 XxxPreviewPanel
            └── 各自调用详情接口、管理查询状态并渲染独立卡片
```

公共内核不包含任何业务详情接口。每个 `XxxPreviewPanel` 自己拥有请求函数、查询键的数据部分、状态渲染和布局；因此新增或调整一个实体不会修改其他实体的预览。

建议目录：

```text
frontend_admin/src/components/EntityPreview/
├── EntityPreview.tsx
├── EntityPreviewBoundary.tsx
├── EntityPreviewSkeleton.tsx
├── EntityPreviewError.tsx
├── registry.ts
├── types.ts
├── index.ts
└── entities/
    ├── house/
    │   ├── HousePreview.tsx
    │   ├── HousePreviewPanel.tsx
    │   └── HousePreviewPanel.test.tsx
    ├── building/
    │   ├── BuildingPreview.tsx
    │   ├── BuildingPreviewPanel.tsx
    │   └── BuildingPreviewPanel.test.tsx
    └── user/
        ├── UserPreview.tsx
        ├── UserPreviewPanel.tsx
        └── UserPreviewPanel.test.tsx
```

`HousePreview` 等组件是业务页面唯一需要直接使用的公开入口。`HousePreviewPanel` 等组件仅用于 Popover 内容，避免“入口触发器”和“预览卡片”同名而产生职责混淆。

## 组件契约

业务页面使用语义组件，而不是直接传入字符串类型：

```tsx
<HousePreview id={record.id}>{houseLabel(record)}</HousePreview>

<BuildingPreview id={record.building_id}>
  {record.building_name}
</BuildingPreview>

<UserPreview id={record.user_id}>{record.username}</UserPreview>
```

实体入口组件只固定实体类型并委托通用内核：

```tsx
export function HousePreview({ id, children, href }: EntityPreviewEntryProps<number>) {
  return (
    <EntityPreview type="house" id={id} href={href}>
      {children}
    </EntityPreview>
  );
}
```

`EntityPreview` 的职责限定为：

- 根据 `type` 从注册表选择面板和默认目标地址；
- 控制 Popover 的可见性、悬停延迟和焦点交互；
- 在 Popover 实际打开后才挂载预览面板；
- 将 `id` 传递给面板；
- 处理未注册实体和渲染异常；
- 将点击交给默认或调用方覆盖的 `href`。

`EntityPreview` 不得导入 `houseApi`、用户接口或任何实体详情类型。

注册表集中管理“可预览实体”的能力，不管理请求：

```tsx
export const entityPreviewRegistry = {
  house: {
    Panel: HousePreviewPanel,
    getHref: (id: number) => `/property-rental/houses/${id}`,
  },
  building: {
    Panel: BuildingPreviewPanel,
    getHref: (id: number) => `/property-rental/estates?building=${id}`,
  },
  user: {
    Panel: UserPreviewPanel,
    getHref: (id: number) => `/platform-management/users?detail=${id}`,
  },
} satisfies EntityPreviewRegistry;
```

调用方只在确有上下文需求时覆盖 `href`，例如打开房源详情中的指定标签。常规列表不得重复拼装默认路由。

## 数据加载与缓存

列表行数据通常不完整，因此预览面板只接收 `id`，不接收也不依赖列表快照。以房源为例：

```tsx
function HousePreviewPanel({ id }: EntityPreviewPanelProps<number>) {
  const workspace = useTenantWorkspace();
  const house = useQuery({
    queryKey: ['entity-preview', workspace.selectedOrgSlug, 'house', id],
    queryFn: () => houseApi.getHouse(id),
    enabled: Boolean(workspace.selectedOrgSlug),
    staleTime: 60_000,
    gcTime: 600_000,
  });

  // 在此组件内处理加载、错误和房源专属 UI。
}
```

统一规则：

- 查询键固定为 `['entity-preview', selectedOrgSlug, entityType, id]`，同一组织内的同一实体跨页面共享缓存且请求去重，并防止切换组织后复用旧组织的预览数据。
- `staleTime` 默认一分钟，`gcTime` 默认十分钟；个别高频变化实体可在自己的面板中缩短失效时间。
- Popover 使用约 200ms 悬停延迟，并仅在打开后挂载面板，避免鼠标快速扫过表格时批量请求。
- 面板关闭后可卸载，React Query 缓存保留；再次悬停优先显示缓存数据并按失效策略刷新。
- 预览请求的失败不会回写列表状态，也不会影响表格加载、分页、筛选或操作。

## 交互、状态与可访问性

- 悬停实体文字显示 Popover；点击实体文字导航至完整详情。
- 键盘聚焦同样可打开预览，`Esc` 或失焦关闭。
- 鼠标从触发文字移动到 Popover 内容时保持打开，方便阅读。
- ID 为空或无效时退化为普通文本，不创建链接或触发请求。
- 默认文本外观与表格正文保持一致，仅在悬停或键盘焦点时体现可点击状态，避免整表过度强调。

公共层提供统一的基础状态组件：

- `EntityPreviewSkeleton`：固定合理宽高，防止 Popover 布局跳动。
- `EntityPreviewError`：网络错误说明和重新加载操作。
- `EntityPreviewNotFound`：接口返回 404 时显示“该记录已不存在”。
- `EntityPreviewForbidden`：接口返回 403 时显示“暂无权限查看详情”。
- `EntityPreviewBoundary`：隔离某个业务面板的渲染异常，不能导致整个表格失败。

面板可以组合基础状态组件，但业务成功态的字段、图片、标签和排版全部保持独立：房源可展示封面、租金、房态和项目楼栋；用户可展示头像、联系方式、角色和状态；合同可展示租期、租金和状态。

## 详情跳转与分期

现有前端只有房源已具备独立详情路由。多数其他核心实体已经有可复用详情接口，但目前仍在列表 Drawer 中查看，或尚无独立详情页面。

首期采用兼容跳转：

- 有独立详情页的实体（当前为房源）直接进入详情路由。
- 有详情接口但尚无独立详情页的实体，跳转到其所属列表并带实体 ID 查询参数，页面据此自动打开现有 Drawer。
- 缺少可复用详情接口的实体不注册预览，先补齐实体详情接口和详情承载页。

当某个实体补齐独立详情页后，只修改注册表中的 `getHref`；业务列表和预览面板无需修改。

推荐接入顺序：

1. 房源、楼栋、项目、联系人、合同、带看；
2. 用户、组织成员、组织、团队、邀请；
3. 通知、通知派发、钱包账户、提现；
4. 其余具备详情接口和详情承载页的核心实体。

每个实体在接入前均需确认详情接口、权限边界、现有 Drawer 查询参数和目标路由；不以列表接口替代详情接口。

## 测试与验收

公共内核测试覆盖：

- 悬停延迟前不挂载面板、不产生详情请求；
- 打开后挂载注册的正确面板，并保留可点击的详情地址；
- ID 缺失时不渲染可预览链接；
- 未注册类型和面板渲染异常均只影响当前单元格；
- 自定义 `href` 覆盖默认跳转地址；
- 键盘打开、关闭与焦点行为可用。

每个实体面板测试覆盖：

- 请求正确的详情接口并使用统一查询键格式；
- 加载、成功、403、404、网络错误和重试状态；
- 渲染实体定义的关键业务信息；
- 详情跳转符合当前阶段：独立页面或列表 Drawer；
- 同一 ID 重复打开时复用 React Query 缓存。

验收标准是：任意接入表格只增加一个 `XxxPreview` 包裹组件；其中不出现详情接口调用、查询键、预览字段转换或 Popover 状态。预览请求、内容排版和错误处理全部封装在实体预览模块内。
