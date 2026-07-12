# 房产业务实体悬停预览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在管理端建立统一实体预览内核，并让房源、项目、楼栋、联系人、租约和带看记录通过语义化 `XxxPreview` 组件实现悬停概览与点击详情跳转。

**Architecture:** `EntityPreview` 只负责 Popover、延迟挂载、错误隔离和注册表路由；各 `XxxPreviewPanel` 在内部复用自己的详情接口并独立排版。查询键包含当前组织 slug，业务列表只传实体 ID 和原有显示内容，不传列表快照、请求函数或预览字段。

**Tech Stack:** React 19、TypeScript、Umi Max、Ant Design 6、antd-style、TanStack React Query、Vitest、Testing Library、Django 5、django-ninja、pytest。

---

## 范围与文件结构

本计划是总设计的第一个可独立交付子项目，只覆盖公共内核和房产业务实体。用户/组织/团队、通知以及钱包实体分别编写后续计划，复用本计划产出的公共内核。

新增公共文件：

- `frontend_admin/src/components/EntityPreview/types.ts`：公共 props、实体类型和注册表类型。
- `frontend_admin/src/components/EntityPreview/EntityPreview.tsx`：Popover、链接、延迟挂载、Suspense 和异常边界。
- `frontend_admin/src/components/EntityPreview/EntityPreviewBoundary.tsx`：隔离面板渲染异常。
- `frontend_admin/src/components/EntityPreview/EntityPreviewState.tsx`：Skeleton、403、404、网络错误和重试状态。
- `frontend_admin/src/components/EntityPreview/registry.ts`：实体面板懒加载与默认跳转地址。
- `frontend_admin/src/components/EntityPreview/index.ts`：只导出业务入口组件。
- `frontend_admin/src/components/EntityPreview/__tests__/EntityPreview.test.tsx`：公共交互测试。
- `frontend_admin/src/components/EntityPreview/__tests__/renderPreview.tsx`：面板测试 QueryClient 工具。

每个房产实体目录包含入口和面板：

```text
frontend_admin/src/components/EntityPreview/entities/
├── house/HousePreview.tsx
├── house/HousePreviewPanel.tsx
├── house/HousePreviewPanel.test.tsx
├── estate/EstatePreview.tsx
├── estate/EstatePreviewPanel.tsx
├── estate/EstatePreviewPanel.test.tsx
├── building/BuildingPreview.tsx
├── building/BuildingPreviewPanel.tsx
├── building/BuildingPreviewPanel.test.tsx
├── contact/ContactPreview.tsx
├── contact/ContactPreviewPanel.tsx
├── contact/ContactPreviewPanel.test.tsx
├── lease/LeasePreview.tsx
├── lease/LeasePreviewPanel.tsx
├── lease/LeasePreviewPanel.test.tsx
├── viewing/ViewingPreview.tsx
├── viewing/ViewingPreviewPanel.tsx
└── viewing/ViewingPreviewPanel.test.tsx
```

项目、楼栋、联系人、租约和带看面板测试按实体目录放置；不要把所有面板测试堆进页面测试文件。

### Task 1: 为带看记录补齐详情接口

**Files:**
- Modify: `tests/house/test_api.py`
- Modify: `apps/house/api.py`
- Regenerate: `frontend_admin/src/services/openapi/propertyRentalManagement.ts`
- Regenerate: `frontend_admin/src/services/openapi/typings.d.ts`
- Modify: `frontend_admin/src/services/manual/house.ts`

- [ ] **Step 1: 写带看详情接口的失败测试**

在 `HouseApiTestCase` 增加当前组织可读、其他组织不可读的测试：

```python
def test_get_viewing_record_returns_org_scoped_detail(self):
    tenant = Contact.objects.create(
        organization=self.org,
        name="预览租客",
        phone="13900139009",
        roles=[ContactRole.TENANT],
    )
    house = House.objects.create(building=self.building, room_number="1901")
    viewing = ViewingRecord.objects.create(
        organization=self.org,
        house=house,
        contact=tenant,
        customer_name="预览客户",
        customer_phone="13900139009",
        scheduled_at=timezone.now(),
    )
    other_org, other_house, _landlord, other_tenant = self.make_other_org_house()
    other_viewing = ViewingRecord.objects.create(
        organization=other_org,
        house=other_house,
        contact=other_tenant,
        customer_name="其他组织客户",
        customer_phone="13900139999",
        scheduled_at=timezone.now(),
    )

    response = self.client.get(f"/api/house/viewing-records/{viewing.pk}/")
    forbidden_response = self.client.get(
        f"/api/house/viewing-records/{other_viewing.pk}/"
    )

    self.assertEqual(response.status_code, 200)
    payload = api_data(response)
    self.assertEqual(payload["id"], viewing.pk)
    self.assertEqual(payload["house"]["id"], house.pk)
    self.assertEqual(payload["contact"]["id"], tenant.pk)
    self.assertEqual(forbidden_response.status_code, 404)
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py::HouseApiTestCase::test_get_viewing_record_returns_org_scoped_detail -q`

Expected: FAIL，详情 URL 返回 405 或 404。

- [ ] **Step 3: 抽取组织内带看查询并新增 GET 路由**

在 `apps/house/api.py` 复用列表和详情需要的关联查询：

```python
def _viewing_records_qs(org):
    signed_lease_qs = Lease.objects.filter(
        source_viewing_record_id=OuterRef("pk")
    ).order_by("id")
    return (
        ViewingRecord.objects.filter(organization=org)
        .select_related("house__building__estate", "contact", "assigned_to")
        .annotate(signed_lease_id=Subquery(signed_lease_qs.values("id")[:1]))
    )


@router.get(
    "/viewing-records/{record_id}/",
    response=ViewingRecordOut,
    summary="获取带看记录详情",
)
def get_viewing_record(request, record_id: int):
    org = require_org_selected(request)
    return get_object_or_404(_viewing_records_qs(org), pk=record_id)
```

同时将 `list_viewing_records()` 中原有查询构造替换为：

```python
qs = _viewing_records_qs(org).order_by("-scheduled_at", "-id")
```

- [ ] **Step 4: 运行后端聚焦测试**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py::HouseApiTestCase::test_get_viewing_record_returns_org_scoped_detail tests/house/test_api.py::HouseApiTestCase::test_admin_list_responses_include_display_labels -q`

Expected: `2 passed`。

- [ ] **Step 5: 重新生成 OpenAPI 客户端并补手写适配器**

确保本地后端在 `http://localhost:18000/api/openapi.json` 可访问，然后执行：

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run openapi'`

在 `frontend_admin/src/services/manual/house.ts` 导入生成函数并增加：

```ts
getViewingRecord: (recordId: number) =>
  appsHouseApiGetViewingRecord({ record_id: recordId }) as Promise<ViewingRecordOut>,
```

- [ ] **Step 6: 提交带看详情接口**

```bash
git add apps/house/api.py tests/house/test_api.py frontend_admin/src/services/openapi frontend_admin/src/services/manual/house.ts
git commit -m "feat: 补充带看详情接口"
```

### Task 2: 实现实体预览公共内核

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/types.ts`
- Create: `frontend_admin/src/components/EntityPreview/EntityPreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/EntityPreviewBoundary.tsx`
- Create: `frontend_admin/src/components/EntityPreview/EntityPreviewState.tsx`
- Create: `frontend_admin/src/components/EntityPreview/registry.ts`
- Create: `frontend_admin/src/components/EntityPreview/__tests__/EntityPreview.test.tsx`

- [ ] **Step 1: 写公共内核失败测试**

测试使用 `vi.mock('../registry')` 注册一个测试面板，覆盖：无 ID 退化为文字、悬停前不挂载、200ms 后挂载、点击地址、Escape 关闭、面板异常被隔离。

核心断言：

```tsx
expect(screen.getByText('测试房源').closest('a')).toHaveAttribute(
  'href',
  '/property-rental/houses/7',
);
expect(screen.queryByText('测试面板 7')).not.toBeInTheDocument();

fireEvent.mouseEnter(screen.getByText('测试房源'));
act(() => vi.advanceTimersByTime(199));
expect(screen.queryByText('测试面板 7')).not.toBeInTheDocument();

act(() => vi.advanceTimersByTime(1));
expect(await screen.findByText('测试面板 7')).toBeInTheDocument();
```

- [ ] **Step 2: 运行公共测试并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/__tests__/EntityPreview.test.tsx'`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 定义公共类型和空注册表**

`types.ts` 使用明确的房产实体联合类型：

```ts
import type React from 'react';

export type EntityPreviewType =
  | 'house'
  | 'estate'
  | 'building'
  | 'contact'
  | 'lease'
  | 'viewing';

export type EntityPreviewId = number;

export type EntityPreviewPanelProps = {
  id: EntityPreviewId;
};

export type EntityPreviewEntryProps<TId extends EntityPreviewId = number> = {
  id?: TId | null;
  children: React.ReactNode;
  href?: string;
};

export type EntityPreviewProps = EntityPreviewEntryProps & {
  type: EntityPreviewType;
};

export type EntityPreviewDefinition = {
  Panel: React.LazyExoticComponent<React.ComponentType<EntityPreviewPanelProps>>;
  getHref: (id: EntityPreviewId) => string;
};

export type EntityPreviewRegistry = Partial<
  Record<EntityPreviewType, EntityPreviewDefinition>
>;
```

`registry.ts` 初始导出空注册表，后续实体任务逐项登记：

```ts
import type { EntityPreviewRegistry } from './types';

export const entityPreviewRegistry: EntityPreviewRegistry = {};
```

- [ ] **Step 4: 实现状态组件和异常边界**

`EntityPreviewState.tsx` 提供固定宽度状态：

```tsx
type PreviewError = {
  response?: { status?: number };
  status?: number;
  info?: { code?: number };
};

function getHttpStatus(error: unknown) {
  const candidate = error as PreviewError | undefined;
  return candidate?.response?.status ?? candidate?.status ?? candidate?.info?.code;
}

export function EntityPreviewSkeleton() {
  return <Skeleton active avatar paragraph={{ rows: 3 }} style={{ width: 320 }} />;
}

export function EntityPreviewError({ error, onRetry }: Props) {
  const status = getHttpStatus(error);
  if (status === 403) return <Alert type="warning" title="暂无权限查看详情" />;
  if (status === 404) return <Alert type="info" title="该记录已不存在" />;
  return (
    <Result
      status="error"
      title="详情加载失败"
      extra={<Button onClick={onRetry}>重新加载</Button>}
    />
  );
}
```

`EntityPreviewBoundary.tsx` 使用 class error boundary，并通过 `key={`${type}:${id}`}` 在切换实体时重建：

```tsx
type BoundaryState = { failed: boolean };

export class EntityPreviewBoundary extends React.Component<
  React.PropsWithChildren,
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <Alert type="error" title="预览暂不可用" />;
    }
    return this.props.children;
  }
}
```

- [ ] **Step 5: 实现 `EntityPreview`**

关键实现必须保持业务无关：

```tsx
export function EntityPreview({ type, id, children, href }: EntityPreviewProps) {
  const [open, setOpen] = useState(false);
  const definition = entityPreviewRegistry[type];

  if (!id || !definition) return <>{children}</>;

  const Panel = definition.Panel;
  const target = href || definition.getHref(id);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      mouseEnterDelay={0.2}
      destroyOnHidden
      trigger={['hover', 'focus']}
      content={
        open ? (
          <EntityPreviewBoundary key={`${type}:${id}`}>
            <Suspense fallback={<EntityPreviewSkeleton />}>
              <Panel id={id} />
            </Suspense>
          </EntityPreviewBoundary>
        ) : null
      }
    >
      <Link
        to={target}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        {children}
      </Link>
    </Popover>
  );
}
```

用 `antd-style/createStyles` 将链接默认颜色设为 `token.colorText`，hover/focus 时变为 `token.colorLink`，不要在列表里新增样式。

- [ ] **Step 6: 运行公共测试和类型检查**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/__tests__/EntityPreview.test.tsx && npm --prefix frontend_admin run tsc'`

Expected: 公共测试 PASS，TypeScript 无错误。

- [ ] **Step 7: 提交公共内核**

```bash
git add frontend_admin/src/components/EntityPreview
git commit -m "feat: 新增实体预览公共内核"
```

### Task 3: 实现房源预览作为首个完整切片

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/__tests__/renderPreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/house/HousePreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/house/HousePreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/house/HousePreviewPanel.test.tsx`
- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Create: `frontend_admin/src/components/EntityPreview/index.ts`

- [ ] **Step 1: 建立面板测试渲染工具并写房源失败测试**

测试 QueryClient 必须关闭 retry，避免错误态用例变慢：

```tsx
export function renderPreview(node: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>,
    ),
  };
}
```

房源面板测试 mock `houseApi.getHouse` 和 `useTenantWorkspace`，断言调用 `getHouse(9)`、查询键包含 `org`、显示封面、`星河湾 / 1 栋 / A-101`、租金、面积、房态和房东；另测 404 与重试。

- [ ] **Step 2: 运行房源测试并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/house/HousePreviewPanel.test.tsx'`

Expected: FAIL，房源面板不存在。

- [ ] **Step 3: 实现房源入口和面板**

入口只固定实体类型：

```tsx
export function HousePreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="house" {...props} />;
}
```

面板内部请求详情：

```tsx
const query = useQuery({
  queryKey: ['entity-preview', workspace.selectedOrgSlug, 'house', id],
  queryFn: () => houseApi.getHouse(id),
  enabled: Boolean(workspace.selectedOrgSlug),
  staleTime: 60_000,
  gcTime: 600_000,
});
```

成功态使用约 340px 宽的 `Space`、40–56px 封面、`Typography`、`Tag` 和紧凑 `Descriptions`，展示房源标签、租金、面积/户型、房态/发布状态、所属楼栋和房东。加载与错误分别委托公共状态组件。

- [ ] **Step 4: 注册房源并导出入口**

```ts
house: {
  Panel: lazy(() =>
    import('./entities/house/HousePreviewPanel').then((module) => ({
      default: module.HousePreviewPanel,
    })),
  ),
  getHref: (id) => `/property-rental/houses/${id}`,
},
```

`index.ts` 只导出 `HousePreview`，不要导出 `HousePreviewPanel`。

- [ ] **Step 5: 运行房源与公共测试**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/__tests__/EntityPreview.test.tsx src/components/EntityPreview/entities/house/HousePreviewPanel.test.tsx'`

Expected: 全部 PASS。

- [ ] **Step 6: 提交房源预览**

```bash
git add frontend_admin/src/components/EntityPreview
git commit -m "feat: 新增房源悬停预览"
```

### Task 4: 实现项目和楼栋预览

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/entities/estate/EstatePreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/estate/EstatePreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/estate/EstatePreviewPanel.test.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/building/BuildingPreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/building/BuildingPreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/building/BuildingPreviewPanel.test.tsx`
- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Modify: `frontend_admin/src/components/EntityPreview/index.ts`

- [ ] **Step 1: 写两个面板的失败测试**

项目断言 `getEstate(id)`、封面、名称、物业类型、城市/区、地址和启停状态；楼栋断言 `getBuilding(id)`、所属项目、楼层/地下层、建成年份、电梯、地址和启停状态。两个查询键都包含 `selectedOrgSlug`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/estate src/components/EntityPreview/entities/building'`

Expected: FAIL，入口和面板不存在。

- [ ] **Step 3: 实现入口、查询和独立布局**

入口分别固定 `estate`、`building`。面板复用 `houseApi.getEstate`、`houseApi.getBuilding`，使用与房源相同的缓存时间，但保持各自字段布局；不得提取通用业务字段渲染器。

- [ ] **Step 4: 注册默认跳转**

```ts
estate: {
  Panel: lazy(() =>
    import('./entities/estate/EstatePreviewPanel').then((module) => ({
      default: module.EstatePreviewPanel,
    })),
  ),
  getHref: (id) => `/property-rental/estates?estate_edit=${id}`,
},
building: {
  Panel: lazy(() =>
    import('./entities/building/BuildingPreviewPanel').then((module) => ({
      default: module.BuildingPreviewPanel,
    })),
  ),
  getHref: (id) =>
    `/property-rental/estates?view=buildings&building_edit=${id}`,
},
```

- [ ] **Step 5: 运行测试并提交**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/estate src/components/EntityPreview/entities/building'`

```bash
git add frontend_admin/src/components/EntityPreview
git commit -m "feat: 新增项目楼栋悬停预览"
```

### Task 5: 实现联系人预览和 URL Drawer 入口

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/entities/contact/ContactPreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/contact/ContactPreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/contact/ContactPreviewPanel.test.tsx`
- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Modify: `frontend_admin/src/components/EntityPreview/index.ts`
- Modify: `frontend_admin/src/pages/property-rental/contacts/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 写联系人面板和 URL Drawer 失败测试**

面板断言 `getContact(id)`、姓名/手机号、角色、邮箱、备注和状态。页面测试先写：访问 `/property-rental/contacts?edit=3` 后调用 `getContact(3)` 并打开编辑 Drawer；关闭后清除 `edit` 参数；点击列表编辑按钮写入 `?edit=3`。

- [ ] **Step 2: 运行聚焦测试并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/contact/ContactPreviewPanel.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx'`

Expected: 联系人面板不存在，URL 不能自动打开 Drawer。

- [ ] **Step 3: 实现联系人入口、面板与注册项**

注册跳转使用：

```ts
getHref: (id) => `/property-rental/contacts?edit=${id}`
```

面板查询 `houseApi.getContact(id)`，角色显示优先使用 `roles__mapping`。

- [ ] **Step 4: 给联系人页面增加 URL 驱动的编辑状态**

将列表状态扩展为：

```ts
type ContactDrawerState = { editContactId?: number };

function getContactDrawerStateFromSearch(search: string): ContactDrawerState {
  const params = new URLSearchParams(search);
  return { editContactId: Number(params.get('edit')) || undefined };
}
```

增加 `getContact(editContactId)` 查询；URL 指定的记录不在当前页时也能打开 Drawer。`openEdit()` 写入参数，关闭 Drawer 清除参数，`syncContactListSearch()` 必须从现有 `window.location.search` 开始更新，不能擦掉 `edit`。

- [ ] **Step 5: 运行联系人测试并提交**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/contact/ContactPreviewPanel.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx'`

```bash
git add frontend_admin/src/components/EntityPreview frontend_admin/src/pages/property-rental/contacts/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 新增联系人悬停预览"
```

### Task 6: 实现租约预览

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/entities/lease/LeasePreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/lease/LeasePreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/lease/LeasePreviewPanel.test.tsx`
- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Modify: `frontend_admin/src/components/EntityPreview/index.ts`

- [ ] **Step 1: 写租约面板失败测试**

mock `houseApi.getLease`，断言房源、租客、起止日期、月租、押金、付款日、合同份数和状态；404 使用公共不存在状态。

- [ ] **Step 2: 运行并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/lease/LeasePreviewPanel.test.tsx'`

Expected: FAIL，租约面板不存在。

- [ ] **Step 3: 实现并注册租约预览**

面板调用 `houseApi.getLease(id)`，复用 `houseLabel`、`contactLabel`、`moneyText`；默认跳转：

```ts
getHref: (id) => `/property-rental/leases?edit=${id}`
```

- [ ] **Step 4: 运行测试并提交**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/lease/LeasePreviewPanel.test.tsx'`

```bash
git add frontend_admin/src/components/EntityPreview
git commit -m "feat: 新增租约悬停预览"
```

### Task 7: 实现带看预览

**Files:**
- Create: `frontend_admin/src/components/EntityPreview/entities/viewing/ViewingPreview.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/viewing/ViewingPreviewPanel.tsx`
- Create: `frontend_admin/src/components/EntityPreview/entities/viewing/ViewingPreviewPanel.test.tsx`
- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Modify: `frontend_admin/src/components/EntityPreview/index.ts`

- [ ] **Step 1: 写带看面板失败测试**

mock Task 1 新增的 `houseApi.getViewingRecord`，断言客户、联系电话、房源、绑定联系人、预约时间、实际带看时间、状态和备注。

- [ ] **Step 2: 运行并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/viewing/ViewingPreviewPanel.test.tsx'`

Expected: FAIL，带看面板不存在。

- [ ] **Step 3: 实现并注册带看预览**

面板调用 `houseApi.getViewingRecord(id)`，默认跳转：

```ts
getHref: (id) => `/property-rental/viewings?edit=${id}`
```

- [ ] **Step 4: 运行测试并提交**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview/entities/viewing/ViewingPreviewPanel.test.tsx'`

```bash
git add frontend_admin/src/components/EntityPreview
git commit -m "feat: 新增带看悬停预览"
```

### Task 8: 将房产业务表格接入语义预览组件

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/houses/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/contacts/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/viewings/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/leases/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/workbench.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/workbench.test.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`

- [ ] **Step 1: 先为页面测试 mock 语义组件并写失败断言**

页面测试不重复测试 Popover，只把入口渲染成带实体标记的链接：

```tsx
vi.mock('@/components/EntityPreview', () => ({
  HousePreview: ({ id, children }: any) => <a data-preview="house" data-id={id}>{children}</a>,
  EstatePreview: ({ id, children }: any) => <a data-preview="estate" data-id={id}>{children}</a>,
  BuildingPreview: ({ id, children }: any) => <a data-preview="building" data-id={id}>{children}</a>,
  ContactPreview: ({ id, children }: any) => <a data-preview="contact" data-id={id}>{children}</a>,
  LeasePreview: ({ id, children }: any) => <a data-preview="lease" data-id={id}>{children}</a>,
  ViewingPreview: ({ id, children }: any) => <a data-preview="viewing" data-id={id}>{children}</a>,
}));
```

断言每个主列表的主体文字被正确实体组件包裹，并覆盖房源表房东、楼栋表所属项目、房源详情里的租客/租约/带看关联。

- [ ] **Step 2: 运行三个页面测试文件并确认失败**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/workbench.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx'`

Expected: 新增实体标记断言 FAIL。

- [ ] **Step 3: 接入列表主体列**

接入规则：

```tsx
<HousePreview id={record.id}>{houseLabel(record)}</HousePreview>
<ContactPreview id={record.landlord_id}>{contactLabel(record)}</ContactPreview>
<EstatePreview id={record.id}>{record.display_name || record.name}</EstatePreview>
<BuildingPreview id={record.id}>{record.name}</BuildingPreview>
<ContactPreview id={record.id}>{businessInfo.primary}</ContactPreview>
<ViewingPreview id={record.id}>{businessInfo.primary}</ViewingPreview>
<LeasePreview id={record.id}>{businessInfo.primary}</LeasePreview>
```

只包裹原有主要文字，不改变列宽、筛选、分页、操作按钮和原有二级信息。

- [ ] **Step 4: 接入关联实体位置**

在工作台和房源详情表格中使用已有嵌套 ID：房源使用 `house.id`，租客使用 `tenant_id`，租约使用 `lease.id`，带看使用 `viewing.id`。ID 为空时仍可直接渲染入口组件，由公共内核退化为普通文字。

- [ ] **Step 5: 运行页面回归测试**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx src/pages/property-rental/workbench.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx'`

Expected: 全部 PASS，原页面行为断言保持通过。

- [ ] **Step 6: 提交页面接入**

```bash
git add frontend_admin/src/pages/property-rental
git commit -m "feat: 接入房产业务实体预览"
```

### Task 9: 完整验证与文档一致性检查

**Files:**
- Verify: `docs/superpowers/specs/2026-07-11-frontend-admin-entity-preview-design.md`
- Verify: `frontend_admin/src/components/EntityPreview/**`
- Verify: `frontend_admin/src/pages/property-rental/**`

- [ ] **Step 1: 运行后端房产业务测试**

Run: `DATABASE_URL=sqlite:///:memory: uv run pytest tests/house/test_api.py -q`

Expected: 全部 PASS。

- [ ] **Step 2: 运行实体预览测试**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/components/EntityPreview'`

Expected: 全部 PASS。

- [ ] **Step 3: 运行房产页面测试**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental'`

Expected: 全部 PASS。

- [ ] **Step 4: 运行前端静态检查**

Run: `/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run lint && npm --prefix frontend_admin exec -- antd lint ./src/components/EntityPreview ./src/pages/property-rental'`

Expected: Biome、TypeScript 与 Ant Design 用法检查均通过。

- [ ] **Step 5: 检查列表页面没有预览数据逻辑**

Run: `rg -n "entity-preview|PreviewPanel|getHouse\(|getEstate\(|getBuilding\(|getContact\(|getLease\(|getViewingRecord\(" frontend_admin/src/pages/property-rental`

Expected: 页面可出现 `XxxPreview` 入口和自身原有详情逻辑，但不出现 `PreviewPanel`，也不为悬停预览新增查询键或请求。

- [ ] **Step 6: 检查工作区并提交必要的最终修正**

Run: `git diff --check && git status --short`

如静态检查产生格式修正，只暂存本计划涉及文件：

```bash
git add apps/house/api.py tests/house/test_api.py frontend_admin/src/components/EntityPreview frontend_admin/src/pages/property-rental frontend_admin/src/services/manual/house.ts frontend_admin/src/services/openapi
git commit -m "fix: 完善房产业务实体预览"
```

不要暂存或修改用户当前已有的 `frontend_admin/public/logo.*`、`frontend_admin/src/app.tsx` 和 `frontend_admin/src/pages/user/login/index.tsx` 改动。
