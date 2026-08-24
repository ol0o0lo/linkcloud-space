# 可自定义工作台实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重新设计“我的工作台”和“空间工作台”，并实现个人级组件显隐、三档宽度、桌面拖拽排序、移动端单列以及独立持久化。

**Architecture:** 使用 `dnd-kit` 只改变组件偏好数组顺序，CSS Grid 根据 `width: 1 | 2 | 3` 自动排版。组件注册表声明默认值与 `allowedWidths`，个人设置 Hook 负责读取、规范化、本地草稿和保存；两个工作台通过各自的数据 Provider 复用现有查询，避免组件拆分后重复请求。

**Tech Stack:** React 19、Umi Max 4、Ant Design 6、antd-style 4、TanStack React Query 5、dnd-kit、Vitest、Testing Library、TypeScript 6。

**Repository constraints:** 所有 Node 命令在 `frontend_admin/` 工作目录中先执行 `nvm use 22`；使用 npm；不手改生成的 OpenAPI 文件；不执行 git 操作；不物理删除遗留文件。

---

## 文件结构

### 新增文件

```text
frontend_admin/src/pages/team-operations/workbench/
├── components/
│   ├── SortableWorkbenchWidget.tsx
│   ├── WorkbenchCustomizeDrawer.tsx
│   ├── WorkbenchEditToolbar.tsx
│   ├── WorkbenchLayout.test.tsx
│   ├── WorkbenchLayout.tsx
│   └── WorkbenchWidgetFrame.tsx
├── data/
│   ├── MineWorkbenchData.tsx
│   └── SpaceWorkbenchData.tsx
├── hooks/
│   ├── useUnsavedWorkbenchGuard.ts
│   ├── useWorkbenchLayoutPreference.test.tsx
│   └── useWorkbenchLayoutPreference.ts
├── layout/
│   ├── layout.test.ts
│   ├── model.ts
│   ├── normalize.ts
│   └── reorder.ts
├── widgets/
│   ├── mine/
│   │   ├── AnnouncementSummaryWidget.tsx
│   │   ├── MineQuickActionsWidget.tsx
│   │   ├── PriorityTasksWidget.tsx
│   │   ├── TaskProgressWidget.tsx
│   │   └── TaskSummaryWidget.tsx
│   └── space/
│       ├── OperatingOverviewWidget.tsx
│       ├── PublishWorkspaceWidget.tsx
│       ├── SpaceQuickActionsWidget.tsx
│       ├── SpaceRisksWidget.tsx
│       ├── WorkflowWidget.tsx
│       ├── model.test.ts
│       └── model.ts
├── MineWorkbenchContent.tsx
├── MineWorkbenchContent.test.tsx
├── SpaceWorkbenchContent.tsx
├── index.page.test.tsx
└── registry.tsx

frontend_admin/src/utils/
├── userSettings.test.ts
└── userSettings.ts
```

### 修改文件

```text
frontend_admin/package.json
frontend_admin/package-lock.json
frontend_admin/src/pages/team-operations/workbench/index.tsx
frontend_admin/src/pages/team-operations/workbench/index.test.ts
frontend_admin/src/pages/team-operations/workbench/styles.ts
frontend_admin/src/pages/rental/workbench.tsx
frontend_admin/src/pages/rental/workbench.test.tsx
frontend_admin/src/pages/personal-business/overview/index.tsx
frontend_admin/src/pages/personal-business/overview/index.test.tsx
```

`frontend_admin/src/pages/rental/workbench.styles.ts` 暂时保留，不执行物理删除；完成迁移后应确保新代码不再依赖其中的遗留布局样式。

---

### Task 1：声明拖拽直接依赖并验证基线

**Files:**

- Modify: `frontend_admin/package.json`
- Modify: `frontend_admin/package-lock.json`

- [ ] **Step 1：切换 Node 22 并运行工作台现有测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/index.test.ts src/pages/team-operations/workbench/priorityTimeline.test.ts src/pages/rental/workbench.test.tsx
```

Expected: 当前测试全部通过，作为重构基线。

- [ ] **Step 2：将 dnd-kit 声明为直接依赖**

Run:

```bash
nvm use 22 && npm install @dnd-kit/core@^6.3.1 @dnd-kit/sortable@^10.0.0 @dnd-kit/utilities@^3.2.2
```

Expected: `frontend_admin/package.json` 的 `dependencies` 出现三个包，`package-lock.json` 同步更新，不依赖 ProComponents 的传递依赖。

- [ ] **Step 3：确认依赖树可解析**

Run:

```bash
nvm use 22 && npm ls @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: 三个包均从管理端根依赖解析，命令退出码为 0。

---

### Task 2：实现布局偏好模型、规范化与排序纯函数

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/layout/model.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/layout/normalize.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/layout/reorder.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/layout/layout.test.ts`

- [ ] **Step 1：编写布局模型与规范化失败测试**

在 `layout/layout.test.ts` 写入覆盖以下行为的测试：未知 ID 被过滤、重复 ID 只保留一次、非法宽度回退、缺失组件按注册表顺序追加、隐藏组件重新显示时移动到末尾、排序只改变数组顺序。

```ts
import { describe, expect, it } from 'vitest';
import type { WorkbenchWidgetDefinition } from './model';
import {
  defaultWorkbenchLayout,
  normalizeWorkbenchLayout,
  setWidgetVisibility,
  updateWidgetWidth,
} from './normalize';
import { reorderWorkbenchWidgets } from './reorder';

const definitions: WorkbenchWidgetDefinition[] = [
  {
    id: 'summary',
    title: '概览',
    defaultWidth: 3,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'tasks',
    title: '任务',
    defaultWidth: 2,
    allowedWidths: [2, 3],
    defaultVisible: true,
  },
  {
    id: 'quick',
    title: '快捷入口',
    defaultWidth: 1,
    allowedWidths: [1, 2],
    defaultVisible: true,
  },
];

describe('workbench layout model', () => {
  it('builds defaults from definitions', () => {
    expect(defaultWorkbenchLayout(definitions)).toEqual([
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
  });

  it('sanitizes saved values and appends new widgets', () => {
    expect(
      normalizeWorkbenchLayout(
        [
          { id: 'tasks', width: 1, visible: true },
          { id: 'unknown', width: 1, visible: true },
          { id: 'tasks', width: 3, visible: false },
        ],
        definitions,
      ),
    ).toEqual([
      { id: 'tasks', width: 2, visible: true },
      { id: 'summary', width: 3, visible: true },
      { id: 'quick', width: 1, visible: true },
    ]);
  });

  it('moves a restored widget to the visible tail', () => {
    const hidden = [
      { id: 'summary', width: 3 as const, visible: false },
      { id: 'tasks', width: 2 as const, visible: true },
      { id: 'quick', width: 1 as const, visible: true },
    ];
    expect(setWidgetVisibility(hidden, 'summary', true)).toEqual([
      { id: 'tasks', width: 2, visible: true },
      { id: 'quick', width: 1, visible: true },
      { id: 'summary', width: 3, visible: true },
    ]);
  });

  it('rejects widths not supported by the widget', () => {
    expect(
      updateWidgetWidth(defaultWorkbenchLayout(definitions), 'quick', 3, definitions),
    ).toEqual(defaultWorkbenchLayout(definitions));
  });

  it('reorders by widget id', () => {
    expect(
      reorderWorkbenchWidgets(defaultWorkbenchLayout(definitions), 'quick', 'summary'),
    ).toEqual([
      { id: 'quick', width: 1, visible: true },
      { id: 'summary', width: 3, visible: true },
      { id: 'tasks', width: 2, visible: true },
    ]);
  });
});
```

- [ ] **Step 2：运行测试确认失败**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/layout/layout.test.ts
```

Expected: FAIL，提示布局模块不存在。

- [ ] **Step 3：实现类型定义**

在 `layout/model.ts` 写入：

```ts
export type WorkbenchWidgetWidth = 1 | 2 | 3;

export type WorkbenchWidgetPreference = {
  id: string;
  width: WorkbenchWidgetWidth;
  visible: boolean;
};

export type WorkbenchLayoutPreference = WorkbenchWidgetPreference[];

export const WORKBENCH_WIDTH_LABELS = {
  1: '窄',
  2: '中',
  3: '宽',
} as const;

export type WorkbenchWidgetDefinition = {
  id: string;
  title: string;
  defaultWidth: WorkbenchWidgetWidth;
  allowedWidths: readonly WorkbenchWidgetWidth[];
  defaultVisible: boolean;
};

export const WORKBENCH_LAYOUT_KEYS = {
  mine: 'internal.workbench.mine.layout.v1',
  space: 'internal.workbench.space.layout.v1',
} as const;
```

- [ ] **Step 4：实现规范化和编辑纯函数**

在 `layout/normalize.ts` 实现：

```ts
import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetDefinition,
  WorkbenchWidgetPreference,
  WorkbenchWidgetWidth,
} from './model';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const defaultWorkbenchLayout = (
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference =>
  definitions.map((item) => ({
    id: item.id,
    width: item.defaultWidth,
    visible: item.defaultVisible,
  }));

export function normalizeWorkbenchLayout(
  value: unknown,
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference {
  if (!Array.isArray(value)) return defaultWorkbenchLayout(definitions);

  const byId = new Map(definitions.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const normalized: WorkbenchWidgetPreference[] = [];

  value.forEach((raw) => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || seen.has(raw.id)) return;
    const definition = byId.get(raw.id);
    if (!definition) return;
    seen.add(raw.id);
    const width = definition.allowedWidths.includes(raw.width as WorkbenchWidgetWidth)
      ? (raw.width as WorkbenchWidgetWidth)
      : definition.defaultWidth;
    normalized.push({
      id: definition.id,
      width,
      visible:
        typeof raw.visible === 'boolean'
          ? raw.visible
          : definition.defaultVisible,
    });
  });

  definitions.forEach((definition) => {
    if (!seen.has(definition.id)) {
      normalized.push({
        id: definition.id,
        width: definition.defaultWidth,
        visible: definition.defaultVisible,
      });
    }
  });
  return normalized;
}

export function setWidgetVisibility(
  current: WorkbenchLayoutPreference,
  widgetId: string,
  visible: boolean,
): WorkbenchLayoutPreference {
  const target = current.find((item) => item.id === widgetId);
  if (!target || target.visible === visible) return current;
  if (!visible) {
    return current.map((item) =>
      item.id === widgetId ? { ...item, visible: false } : item,
    );
  }
  return [
    ...current.filter((item) => item.id !== widgetId),
    { ...target, visible: true },
  ];
}

export function updateWidgetWidth(
  current: WorkbenchLayoutPreference,
  widgetId: string,
  width: WorkbenchWidgetWidth,
  definitions: readonly WorkbenchWidgetDefinition[],
): WorkbenchLayoutPreference {
  const definition = definitions.find((item) => item.id === widgetId);
  if (!definition?.allowedWidths.includes(width)) return current;
  return current.map((item) =>
    item.id === widgetId ? { ...item, width } : item,
  );
}

export const hasVisibleWorkbenchWidget = (
  value: WorkbenchLayoutPreference,
) => value.some((item) => item.visible);

export function isSameWorkbenchLayout(
  left: WorkbenchLayoutPreference,
  right: WorkbenchLayoutPreference,
) {
  return (
    left.length === right.length &&
    left.every((item, index) => {
      const other = right[index];
      return (
        other?.id === item.id &&
        other.width === item.width &&
        other.visible === item.visible
      );
    })
  );
}
```

- [ ] **Step 5：实现排序函数**

在 `layout/reorder.ts` 写入：

```ts
import type { WorkbenchLayoutPreference } from './model';

export function reorderWorkbenchWidgets(
  current: WorkbenchLayoutPreference,
  activeId: string,
  overId: string,
): WorkbenchLayoutPreference {
  const from = current.findIndex((item) => item.id === activeId);
  const to = current.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return current;
  const next = [...current];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
```

- [ ] **Step 6：运行布局纯函数测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/layout/layout.test.ts
```

Expected: PASS。

---

### Task 3：实现个人布局设置 Hook 和未保存导航保护

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference.test.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/hooks/useUnsavedWorkbenchGuard.ts`

- [ ] **Step 1：编写 Hook 失败测试**

测试需要 mock 生成的个人设置 API，并使用 `QueryClientProvider` 包裹 `renderHook`。覆盖 404 默认布局、网络错误禁止保存、保存成功更新提交态、保存失败保留草稿。

核心测试结构：

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appsSettingsApiGetUserSettingView,
  appsSettingsApiPutUserSetting,
} from '@/services/openapi/userSettings';
import { useWorkbenchLayoutPreference } from './useWorkbenchLayoutPreference';

vi.mock('@/services/openapi/userSettings', () => ({
  appsSettingsApiGetUserSettingView: vi.fn(),
  appsSettingsApiPutUserSetting: vi.fn(),
}));

const definitions = [
  {
    id: 'summary',
    title: '概览',
    defaultWidth: 3 as const,
    allowedWidths: [2, 3] as const,
    defaultVisible: true,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useWorkbenchLayoutPreference', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses defaults when the setting does not exist', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue({
      response: { status: 404 },
    });
    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.committed).toEqual([
      { id: 'summary', width: 3, visible: true },
    ]);
    expect(result.current.loadError).toBe(false);
  });

  it('keeps the draft when saving fails', async () => {
    vi.mocked(appsSettingsApiGetUserSettingView).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(appsSettingsApiPutUserSetting).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(
      () => useWorkbenchLayoutPreference('mine', definitions),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isReady).toBe(true));
    act(() => result.current.beginEditing());
    await expect(result.current.save()).rejects.toThrow('offline');
    expect(result.current.isEditing).toBe(true);
    expect(result.current.draft).toEqual(result.current.committed);
  });
});
```

- [ ] **Step 2：运行 Hook 测试确认失败**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference.test.tsx
```

Expected: FAIL，提示 Hook 不存在。

- [ ] **Step 3：实现设置加载、草稿和保存**

在 `useWorkbenchLayoutPreference.ts` 实现以下公开接口：

```ts
import type { Dispatch, SetStateAction } from 'react';

export type UseWorkbenchLayoutPreferenceResult = {
  committed: WorkbenchLayoutPreference;
  draft: WorkbenchLayoutPreference;
  rendered: WorkbenchLayoutPreference;
  isReady: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isEditing: boolean;
  isDirty: boolean;
  loadError: boolean;
  canSave: boolean;
  beginEditing: () => void;
  cancelEditing: () => void;
  restoreDefaults: () => void;
  setDraft: Dispatch<SetStateAction<WorkbenchLayoutPreference>>;
  retry: () => Promise<unknown>;
  save: () => Promise<void>;
};
```

关键加载函数必须静默处理 404，并为其他错误保留失败状态：

```ts
async function loadWorkbenchLayout(key: string) {
  try {
    const setting = await appsSettingsApiGetUserSettingView(
      { key },
      { skipErrorHandler: true },
    );
    return { found: true as const, value: setting.value };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      return { found: false as const, value: undefined };
    }
    throw error;
  }
}
```

保存必须使用：

```ts
appsSettingsApiPutUserSetting(
  { key: WORKBENCH_LAYOUT_KEYS[view] },
  { value: draft },
  { skipErrorHandler: true },
)
```

保存成功后设置 `committed`、退出编辑并写入 React Query 缓存；保存失败不修改草稿和编辑状态。`canSave` 必须同时满足没有加载错误且至少一个组件可见。

`isDirty` 使用 Task 2 的 `isSameWorkbenchLayout(committed, draft)` 计算；`rendered` 在编辑时返回 `draft`，其他时候返回 `committed`。保存前再次执行 `normalizeWorkbenchLayout(draft, definitions)`，PUT 成功后以规范化结果更新提交态。

当 `view` 或设置 key 改变时，Hook 必须退出编辑、清空旧草稿，并用新视角的查询结果重新初始化，不能让“我的工作台”草稿泄漏到“空间工作台”。

- [ ] **Step 4：实现未保存导航保护**

在 `useUnsavedWorkbenchGuard.ts` 使用 Umi `history.block` 和浏览器 `beforeunload`：

```ts
import { history } from '@umijs/max';
import { Modal } from 'antd';
import { useEffect } from 'react';

export function useUnsavedWorkbenchGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);

    const unblock = history.block((transition) => {
      Modal.confirm({
        title: '放弃未保存的工作台调整？',
        content: '离开后，本次排序、显隐和宽度修改不会保存。',
        okText: '放弃并离开',
        cancelText: '继续编辑',
        onOk: () => {
          unblock();
          transition.retry();
        },
      });
    });

    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      unblock();
    };
  }, [active]);
}
```

- [ ] **Step 5：运行 Hook 测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference.test.tsx
```

Expected: PASS。

---

### Task 4：实现通用三列布局和组件框架

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchWidgetFrame.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1：查询本项目 Ant Design 组件 API**

Run:

```bash
nvm use 22 && npm exec -- antd info Card && npm exec -- antd info Grid
```

Expected: 输出 Ant Design 6 `Card` API；实现时只使用当前版本存在的 props。

- [ ] **Step 2：编写三列布局失败测试**

在 `WorkbenchLayout.test.tsx` 测试可见组件顺序、宽度 class 和隐藏组件不渲染：

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchLayout } from './WorkbenchLayout';

const layout = [
  { id: 'summary', width: 3 as const, visible: true },
  { id: 'hidden', width: 1 as const, visible: false },
  { id: 'tasks', width: 2 as const, visible: true },
];

describe('WorkbenchLayout', () => {
  it('renders visible widgets in preference order and exposes their width', () => {
    render(
      <WorkbenchLayout
        layout={layout}
        renderWidget={({ id }) => <div>{id}</div>}
      />,
    );
    expect(screen.getAllByTestId('workbench-widget')).toHaveLength(2);
    expect(screen.getAllByTestId('workbench-widget')[0]).toHaveAttribute(
      'data-widget-width',
      '3',
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3：运行测试确认失败**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: FAIL，提示组件不存在。

- [ ] **Step 4：实现布局组件**

`WorkbenchLayout.tsx` 使用渲染函数保持通用性：

```tsx
import type { ReactNode } from 'react';
import type { WorkbenchLayoutPreference, WorkbenchWidgetPreference } from '../layout/model';
import { useStyles } from '../styles';

type WorkbenchLayoutProps = {
  layout: WorkbenchLayoutPreference;
  renderWidget: (preference: WorkbenchWidgetPreference) => ReactNode;
};

export function WorkbenchLayout({ layout, renderWidget }: WorkbenchLayoutProps) {
  const { cx, styles } = useStyles();
  return (
    <div className={styles.widgetGrid}>
      {layout.filter((item) => item.visible).map((item) => (
        <section
          key={item.id}
          data-testid="workbench-widget"
          data-widget-id={item.id}
          data-widget-width={item.width}
          className={cx(styles.widgetCell, styles[`widgetWidth${item.width}`])}
        >
          {renderWidget(item)}
        </section>
      ))}
    </div>
  );
}
```

`styles.ts` 新增三列、两列和移动端规则：

```ts
widgetGrid: css`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 1199px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 767px) {
    grid-template-columns: minmax(0, 1fr);
  }
`,
widgetCell: css`
  min-width: 0;
`,
widgetWidth1: css`
  grid-column: span 1;
`,
widgetWidth2: css`
  grid-column: span 2;
  @media (max-width: 767px) { grid-column: span 1; }
`,
widgetWidth3: css`
  grid-column: span 3;
  @media (max-width: 1199px) { grid-column: span 2; }
  @media (max-width: 767px) { grid-column: span 1; }
`,
```

- [ ] **Step 5：实现统一组件框架**

`WorkbenchWidgetFrame.tsx` 负责统一标题、说明、操作、加载、错误与内容卡片：

```tsx
import { Button, Card, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';

type WorkbenchWidgetFrameProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: ReactNode;
};

export function WorkbenchWidgetFrame(props: WorkbenchWidgetFrameProps) {
  if (props.loading) {
    return <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>;
  }
  if (props.error) {
    return (
      <Card>
        <Result
          status="error"
          title="组件数据加载失败"
          extra={<Button onClick={props.onRetry}>重新加载</Button>}
        />
      </Card>
    );
  }
  return (
    <Card title={props.title} extra={props.extra}>
      {props.subtitle ? <div>{props.subtitle}</div> : null}
      {props.children}
    </Card>
  );
}
```

- [ ] **Step 6：运行布局测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: PASS。

---

### Task 5：实现编辑工具栏、组件管理和 dnd-kit 排序

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchEditToolbar.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchCustomizeDrawer.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/components/SortableWorkbenchWidget.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1：查询 Drawer、Segmented 和 Modal API**

Run:

```bash
nvm use 22 && npm exec -- antd info Drawer && npm exec -- antd info Segmented && npm exec -- antd info Modal
```

Expected: 输出当前版本 API，确认 `Drawer`、`Segmented` 与确认弹窗用法。

- [ ] **Step 2：扩展失败测试覆盖编辑控件**

新增测试：正常模式不显示手柄；编辑模式显示手柄；Drawer 只展示 `allowedWidths`；关闭最后一个可见组件时显示校验；拖拽结束调用重排。

核心断言：

```tsx
expect(screen.queryByLabelText('拖动 优先处理')).not.toBeInTheDocument();
await user.click(screen.getByRole('button', { name: '自定义工作台' }));
expect(screen.getByLabelText('拖动 优先处理')).toBeInTheDocument();
expect(screen.queryByRole('radio', { name: '窄' })).not.toBeInTheDocument();
expect(screen.getByRole('radio', { name: '中' })).toBeInTheDocument();
expect(screen.getByRole('radio', { name: '宽' })).toBeInTheDocument();
```

- [ ] **Step 3：实现编辑工具栏**

`WorkbenchEditToolbar.tsx` 接收 `isDirty`、`isSaving`、`canSave`、`onRestore`、`onCancel`、`onSave`，使用固定文案：

```tsx
<div className={styles.editToolbar}>
  <div>
    <strong>正在自定义{viewLabel}</strong>
    <span>{isDirty ? '尚未保存' : '没有未保存修改'}</span>
  </div>
  <Space>
    <Button danger onClick={onRestore}>恢复默认</Button>
    <Button onClick={onCancel}>取消</Button>
    <Button type="primary" loading={isSaving} disabled={!canSave} onClick={onSave}>
      保存布局
    </Button>
  </Space>
</div>
```

`onCancel` 在 `isDirty` 为 true 时必须先显示确认弹窗；用户确认后才调用 `cancelEditing`。没有改动时直接退出编辑。

- [ ] **Step 4：实现组件管理抽屉**

`WorkbenchCustomizeDrawer.tsx` 使用 definition 和 preference 生成每行：标题、Switch、合法宽度 Segmented。移动端通过 `mobile` prop 只显示 Switch，不渲染宽度控件。

宽度选项必须从定义生成：

```ts
const options = definition.allowedWidths.map((width) => ({
  value: width,
  label: WORKBENCH_WIDTH_LABELS[width],
}));
```

关闭最后一个可见组件时不直接修改草稿，并调用 `message.warning('工作台至少需要保留一个组件')`。

- [ ] **Step 5：实现 sortable 卡片包装器**

`SortableWorkbenchWidget.tsx` 使用 `useSortable`，只把 listeners 绑定到手柄：

```tsx
const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
  useSortable({ id: preference.id });
const style = {
  transform: CSS.Transform.toString(transform),
  transition,
};

return (
  <section ref={setNodeRef} style={style} data-dragging={isDragging || undefined}>
    <div className={styles.widgetEditorControls}>
      <Segmented
        aria-label={`${title}宽度`}
        size="small"
        value={preference.width}
        options={allowedWidths.map((width) => ({
          value: width,
          label: WORKBENCH_WIDTH_LABELS[width],
        }))}
        onChange={(value) => onWidthChange(value as WorkbenchWidgetWidth)}
      />
      <button
        type="button"
        aria-label={`拖动 ${title}`}
        {...attributes}
        {...listeners}
      >
        <HolderOutlined />
      </button>
    </div>
    {children}
  </section>
);
```

`WorkbenchLayout` 从注册表取出当前组件的 `allowedWidths` 并传入包装器；因此页面卡片和组件管理抽屉使用同一份宽度能力，不维护两套配置。

- [ ] **Step 6：在 WorkbenchLayout 中接入 DndContext**

编辑模式使用：

```tsx
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={({ active, over }) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  }}
>
  <SortableContext
    items={layout.filter((item) => item.visible).map((item) => item.id)}
    strategy={rectSortingStrategy}
  >
    {content}
  </SortableContext>
  <DragOverlay>{activeWidgetPreview}</DragOverlay>
</DndContext>
```

非编辑模式直接渲染普通 `<section>`，不要初始化拖拽传感器。键盘传感器使用 `sortableKeyboardCoordinates`。

Pointer 传感器使用至少 6px 的激活距离，避免点击卡片操作时误触拖动：

```ts
useSensor(PointerSensor, { activationConstraint: { distance: 6 } });
```

- [ ] **Step 7：运行编辑布局测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx
```

Expected: PASS。

---

### Task 6：重构并重新设计“我的工作台”组件

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/data/MineWorkbenchData.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/TaskSummaryWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/PriorityTasksWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/TaskProgressWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/AnnouncementSummaryWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/mine/MineQuickActionsWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/MineWorkbenchContent.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/MineWorkbenchContent.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/priorityTimeline.ts`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1：新增我的工作台数据 Provider**

Provider 复用当前每日工作台查询、接受任务 Mutation 和完成任务 Mutation，并增加公告摘要查询。公告查询只在公告组件可见时启用。

公开 Context：

```ts
type MineWorkbenchDataValue = {
  dashboard?: DailyDashboard;
  dashboardLoading: boolean;
  dashboardError: boolean;
  retryDashboard: () => void;
  announcements: TeamAnnouncement[];
  announcementsLoading: boolean;
  announcementsError: boolean;
  retryAnnouncements: () => void;
  acceptingId?: number;
  completingId?: number;
  accept: (assignmentId: number) => Promise<unknown>;
  complete: (assignmentId: number) => Promise<unknown>;
};
```

公告查询使用：

```ts
listTeamAnnouncements({ page: 1, page_size: 3, status: 'published' })
```

Provider 接收 `visibleWidgetIds: ReadonlySet<string>`，仅当其中包含 `mine-announcements` 时启用公告查询。每日 dashboard 查询只要摘要、优先任务或进展任一组件可见就启用。

- [ ] **Step 2：实现待办概览组件**

`TaskSummaryWidget` 将四个指标作为一个整体：已逾期、今日到期、待接受、待确认公告。支持宽度 2、3；宽度 2 使用 2×2 网格，宽度 3 使用四列。

指标配置必须从数据生成：

```ts
const items = [
  { key: 'overdue', label: '已逾期', value: dashboard?.overdue ?? 0, tone: 'danger' },
  { key: 'due-today', label: '今日到期', value: dashboard?.due_today ?? 0, tone: 'warning' },
  { key: 'pending', label: '待接受', value: dashboard?.pending_acceptance ?? 0, tone: 'info' },
  { key: 'announcement', label: '公告待确认', value: dashboard?.unacknowledged_announcements ?? 0, tone: 'primary' },
];
```

- [ ] **Step 3：实现优先处理组件**

把当前 `PriorityTimelineItem` 移到 `PriorityTasksWidget.tsx` 内部，继续复用 `formatDueTimeDisplay` 和 `groupUndatedTasksLast`。支持宽度 2、3；宽度 2 使用紧凑时间轴，宽度 3 增加任务说明列。保留接受、完成、查看按钮及 loading 状态。

- [ ] **Step 4：实现任务进展、公告摘要和快捷操作**

- `TaskProgressWidget` 支持宽度 1、2，展示进行中、今日完成和总待处理量。
- `AnnouncementSummaryWidget` 支持宽度 1、2、3；宽度 1 显示标题列表，宽度 2、3 增加发布时间和确认状态。
- `MineQuickActionsWidget` 支持宽度 1、2，至少提供全部任务和团队公告入口；新增入口必须确认当前路由存在。

快捷入口必须通过 `history.push` 进入：

```ts
const links = [
  { key: 'tasks', label: '全部任务', path: '/rental/workbench/tasks' },
  { key: 'announcements', label: '团队公告', path: '/rental/workbench/announcements' },
];
```

- [ ] **Step 5：组合 MineWorkbenchContent**

`MineWorkbenchContent` 接收布局控制器结果和 `onDataStatusChange`，根据 registry renderer 渲染组件，并将可见 ID 传给 Provider。页面不再内联统计、重点待办、任务进展和快捷入口 JSX。

- [ ] **Step 6：补充我的工作台行为测试**

在 `MineWorkbenchContent.test.tsx` 中 mock 数据 Provider，至少验证：

```tsx
expect(screen.getByText('待办概览')).toBeInTheDocument();
expect(screen.getByText('优先处理')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '接受' })).toBeEnabled();
expect(screen.getByRole('button', { name: '完成' })).toBeEnabled();
expect(screen.getByText('公告摘要')).toBeInTheDocument();
```

- [ ] **Step 7：运行我的工作台相关测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench
```

Expected: PASS。

---

### Task 7：重构并重新设计“空间工作台”组件

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/model.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/model.test.ts`
- Create: `frontend_admin/src/pages/team-operations/workbench/data/SpaceWorkbenchData.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/OperatingOverviewWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/PublishWorkspaceWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/SpaceRisksWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/WorkflowWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/widgets/space/SpaceQuickActionsWidget.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/SpaceWorkbenchContent.tsx`
- Modify: `frontend_admin/src/pages/rental/workbench.test.tsx`
- Modify: `frontend_admin/src/pages/rental/workbench.tsx`

- [ ] **Step 1：将空间工作台纯函数测试迁移到新 model**

把 `buildPublishWorkbenchRows`、`buildWorkflowTasks`、`getHouseTaskLink` 及筛选解析测试改为从 `widgets/space/model` 导入。新增风险派生测试：

```ts
expect(
  buildSpaceRisks({ blockedCount: 6, missingContactCount: 4, readyLeaseCount: 9 }),
).toEqual([
  { key: 'blocked-publish', level: 'danger', count: 6, label: '套房源阻断发布' },
  { key: 'missing-contact', level: 'warning', count: 4, label: '条记录待补租客' },
]);
```

数量为 0 的风险不返回，风险按危险级别和数量排序，最多显示 3 项。

- [ ] **Step 2：运行 model 测试确认失败**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/widgets/space/model.test.ts src/pages/rental/workbench.test.tsx
```

Expected: FAIL，新 model 尚不存在。

- [ ] **Step 3：实现空间工作台纯函数 model**

从现有 `rental/workbench.tsx` 移动纯函数到 `widgets/space/model.ts`，保留原有导出签名，并增加：

```ts
export type SpaceRisk = {
  key: string;
  level: 'danger' | 'warning' | 'info';
  count: number;
  label: string;
};

export function buildSpaceRisks(input: {
  blockedCount: number;
  missingContactCount: number;
  readyLeaseCount: number;
}): SpaceRisk[] {
  return [
    { key: 'blocked-publish', level: 'danger' as const, count: input.blockedCount, label: '套房源阻断发布' },
    { key: 'missing-contact', level: 'warning' as const, count: input.missingContactCount, label: '条记录待补租客' },
    { key: 'ready-lease', level: 'info' as const, count: input.readyLeaseCount, label: '条记录待签约' },
  ]
    .filter((item) => item.count > 0)
    .slice(0, 3);
}
```

- [ ] **Step 4：实现空间数据 Provider**

`SpaceWorkbenchData` 复用当前三个查询和发布 Mutation：房源列表、待补租客看房记录、待签约看房记录。Context 暴露：

```ts
type SpaceWorkbenchDataValue = {
  totalHouseCount: number;
  blockedHouseItems: HouseOut[];
  readyHouseItems: HouseOut[];
  missingContactCount: number;
  readyLeaseCount: number;
  publishRows: PublishWorkbenchRow[];
  workflowTasks: WorkflowTaskRow[];
  risks: SpaceRisk[];
  overviewLoading: boolean;
  overviewError: boolean;
  publishLoading: boolean;
  publishError: boolean;
  workflowLoading: boolean;
  workflowError: boolean;
  isFetching: boolean;
  updatedAt: string | null;
  retryOverview: () => void;
  retryPublish: () => void;
  retryWorkflow: () => void;
  publishHouse: (houseId: number) => Promise<unknown>;
  publishing: boolean;
};
```

Provider 接收可见组件 ID，并按依赖启用共享查询：

- 房源查询：经营总览、发布工作区或关键风险任一可见时启用。
- 待补租客与待签约查询：经营总览、关键风险或成交转签任一可见时启用。
- 发布工作区只显示房源查询的局部错误。
- 成交转签只显示看房记录查询的局部错误。
- 经营总览和关键风险依赖全部数据，任一依赖失败时显示各自局部错误，不阻塞其他组件。

- [ ] **Step 5：实现空间组件**

- `OperatingOverviewWidget`：支持宽度 2、3；宽度 2 使用紧凑 2×N 指标布局，宽度 3 使用单行指标。
- `PublishWorkspaceWidget`：只支持宽度 2、3；保留阻断/待发布筛选、补资料、发布确认；宽度 2 使用列表，宽度 3 可使用 ProTable。
- `SpaceRisksWidget`：支持宽度 1、2，展示最多三项关键风险及跳转入口。
- `WorkflowWidget`：只支持宽度 2、3；保留待补租客/待签约筛选和操作。
- `SpaceQuickActionsWidget`：支持宽度 1、2，入口只指向已存在路由。

发布确认继续使用 Modal，并保持：

```ts
await publishHouse(houseId);
message.success('房源已发布');
```

- [ ] **Step 6：组合 SpaceWorkbenchContent 并保留兼容导出**

`SpaceWorkbenchContent` 组合 Provider、通用 WorkbenchLayout 和空间 registry renderer，并接收以下 props：

```ts
type SpaceWorkbenchContentProps = {
  layoutController: UseWorkbenchLayoutPreferenceResult;
  onDataStatusChange?: (isFetching: boolean, updatedAt: string | null) => void;
};
```

`frontend_admin/src/pages/rental/workbench.tsx` 不物理删除，改为兼容包装：

```tsx
import { TenantSelectionGuard } from '@/pages/space/shared';
import { SpaceWorkbenchContent } from '@/pages/team-operations/workbench/SpaceWorkbenchContent';
import { useWorkbenchLayoutPreference } from '@/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference';
import { spaceWidgetDefinitions } from '@/pages/team-operations/workbench/registry';

type RentalOperationsWorkbenchContentProps = {
  onDataStatusChange?: (isFetching: boolean, updatedAt: string | null) => void;
};

export const RentalOperationsWorkbenchContent: React.FC<
  RentalOperationsWorkbenchContentProps
> = ({ onDataStatusChange }) => {
  const layoutController = useWorkbenchLayoutPreference(
    'space',
    spaceWidgetDefinitions,
  );
  return (
    <SpaceWorkbenchContent
      layoutController={layoutController}
      onDataStatusChange={onDataStatusChange}
    />
  );
};

const WorkbenchPage: React.FC = () => (
  <TenantSelectionGuard title="房源工作台">
    <RentalOperationsWorkbenchContent />
  </TenantSelectionGuard>
);

export default WorkbenchPage;
```

更新旧测试的导入路径，但保留对现有业务行为的断言。

- [ ] **Step 7：运行空间工作台测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench/widgets/space/model.test.ts src/pages/rental/workbench.test.tsx
```

Expected: PASS。

---

### Task 8：建立组件注册表并集成统一工作台页面

**Files:**

- Create: `frontend_admin/src/pages/team-operations/workbench/registry.tsx`
- Create: `frontend_admin/src/pages/team-operations/workbench/index.page.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/index.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/index.test.ts`
- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`

- [ ] **Step 1：实现两个注册表**

`registry.tsx` 定义带组件引用的注册项：

```tsx
import type { ComponentType } from 'react';

type WorkbenchWidgetRegistration = WorkbenchWidgetDefinition & {
  component: ComponentType<{ width: WorkbenchWidgetWidth }>;
};

export const mineWidgetDefinitions = [
  { id: 'mine-summary', title: '待办概览', component: TaskSummaryWidget, defaultWidth: 3, allowedWidths: [2, 3], defaultVisible: true },
  { id: 'mine-priority', title: '优先处理', component: PriorityTasksWidget, defaultWidth: 2, allowedWidths: [2, 3], defaultVisible: true },
  { id: 'mine-progress', title: '任务进展', component: TaskProgressWidget, defaultWidth: 1, allowedWidths: [1, 2], defaultVisible: true },
  { id: 'mine-announcements', title: '公告摘要', component: AnnouncementSummaryWidget, defaultWidth: 2, allowedWidths: [1, 2, 3], defaultVisible: true },
  { id: 'mine-quick-actions', title: '快捷操作', component: MineQuickActionsWidget, defaultWidth: 1, allowedWidths: [1, 2], defaultVisible: true },
] as const satisfies readonly WorkbenchWidgetRegistration[];

export const spaceWidgetDefinitions = [
  { id: 'space-overview', title: '经营总览', component: OperatingOverviewWidget, defaultWidth: 3, allowedWidths: [2, 3], defaultVisible: true },
  { id: 'space-publish', title: '发布工作区', component: PublishWorkspaceWidget, defaultWidth: 2, allowedWidths: [2, 3], defaultVisible: true },
  { id: 'space-risks', title: '关键风险', component: SpaceRisksWidget, defaultWidth: 1, allowedWidths: [1, 2], defaultVisible: true },
  { id: 'space-workflow', title: '成交转签', component: WorkflowWidget, defaultWidth: 2, allowedWidths: [2, 3], defaultVisible: true },
  { id: 'space-quick-actions', title: '空间快捷操作', component: SpaceQuickActionsWidget, defaultWidth: 1, allowedWidths: [1, 2], defaultVisible: true },
] as const satisfies readonly WorkbenchWidgetRegistration[];
```

渲染时按 ID 查找注册项并实例化其 `component`；未知 ID 返回 `null`。布局规范化函数仍只依赖注册项的元数据字段，不读取组件引用。

- [ ] **Step 2：把 index.tsx 收敛为页面编排器**

页面只保留：租户 Guard、组织与日期头部、视角权限、数据更新时间、视角切换、自定义按钮和当前视角内容。

页面实现采用以下结构：

```tsx
const definitions = activeView === 'mine' ? mineWidgetDefinitions : spaceWidgetDefinitions;
const layout = useWorkbenchLayoutPreference(activeView, definitions);
useUnsavedWorkbenchGuard(layout.isEditing && layout.isDirty);

<Segmented
  disabled={layout.isEditing}
  value={activeView}
  onChange={changeView}
  options={viewOptions}
/>
<Button
  icon={<SettingOutlined />}
  onClick={layout.beginEditing}
  disabled={!layout.isReady || layout.loadError}
>
  自定义工作台
</Button>
{layout.loadError ? <Alert action={<Button onClick={layout.retry}>重试</Button>} /> : null}
{activeView === 'mine' ? (
  <MineWorkbenchContent layoutController={layout} />
) : (
  <SpaceWorkbenchContent layoutController={layout} />
)}
```

进入编辑后渲染 `WorkbenchEditToolbar` 与 `WorkbenchCustomizeDrawer`。桌面端允许排序和宽度；通过断点 Hook 判定移动端时，只允许显隐。

- [ ] **Step 3：扩展页面测试**

在 `index.test.ts` 保留视角解析测试，并新增：

```ts
it('uses independent personal setting keys for each view', () => {
  expect(WORKBENCH_LAYOUT_KEYS.mine).toBe('internal.workbench.mine.layout.v1');
  expect(WORKBENCH_LAYOUT_KEYS.space).toBe('internal.workbench.space.layout.v1');
});
```

在 `index.page.test.tsx` 编写组件集成测试，验证：

- 没有空间权限时不能切换空间视角。
- 编辑期间 Segmented 禁用。
- 设置加载失败时自定义按钮禁用并显示重试。
- 移动端组件都带 `data-widget-width` 原值，但 CSS 单列，且没有拖动手柄和宽度选择。
- 我的工作台和空间工作台切换后使用不同的配置。

- [ ] **Step 4：运行工作台目录测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench
```

Expected: PASS。

---

### Task 9：从通用个人设置界面隐藏内部配置

**Files:**

- Create: `frontend_admin/src/utils/userSettings.ts`
- Create: `frontend_admin/src/utils/userSettings.test.ts`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.tsx`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.test.tsx`

- [ ] **Step 1：编写内部设置过滤失败测试**

```ts
import { describe, expect, it } from 'vitest';
import {
  isEditableUserSettingKey,
  visibleUserSettings,
} from './userSettings';

describe('internal user settings', () => {
  it('hides internal settings from generic maintenance', () => {
    expect(
      visibleUserSettings([
        { key: 'theme', value: 'dark' },
        { key: 'internal.workbench.mine.layout.v1', value: [] },
      ]),
    ).toEqual([{ key: 'theme', value: 'dark' }]);
  });

  it('prevents generic forms from editing internal keys', () => {
    expect(isEditableUserSettingKey('theme')).toBe(true);
    expect(isEditableUserSettingKey('internal.workbench.space.layout.v1')).toBe(false);
  });
});
```

- [ ] **Step 2：运行测试确认失败**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/utils/userSettings.test.ts
```

Expected: FAIL，工具文件不存在。

- [ ] **Step 3：实现过滤工具**

```ts
const INTERNAL_USER_SETTING_PREFIX = 'internal.';

export const isEditableUserSettingKey = (key: string) =>
  !key.startsWith(INTERNAL_USER_SETTING_PREFIX);

export const visibleUserSettings = <T extends { key: string }>(items: T[]) =>
  items.filter((item) => isEditableUserSettingKey(item.key));
```

- [ ] **Step 4：接入通用个人设置页面**

将：

```ts
const userSettings = (userSettingsQuery.data || []) as API.UserSettingOut[];
```

替换为：

```ts
const userSettings = visibleUserSettings(
  (userSettingsQuery.data || []) as API.UserSettingOut[],
);
```

“设置 Key”表单项增加 validator：

```ts
{
  validator: async (_, value?: string) => {
    if (value && !isEditableUserSettingKey(value)) {
      throw new Error('该设置由对应功能页面内部维护');
    }
  },
}
```

详情弹窗和删除入口只能从过滤后的 `userSettings` 产生，确保内部工作台设置不会在此页面出现或被修改。更新 `overview/index.test.tsx`，mock 列表同时返回普通 key 和 `internal.workbench.mine.layout.v1`，断言页面只显示普通 key，并断言表单输入内部 key 时出现“该设置由对应功能页面内部维护”。

- [ ] **Step 5：运行工具及相关页面测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/utils/userSettings.test.ts src/pages/personal-business/overview/index.test.tsx
```

Expected: 工具测试和个人业务概览页面测试全部通过。

---

### Task 10：完成响应式、可访问性与全量验证

**Files:**

- Modify: `frontend_admin/src/pages/team-operations/workbench/styles.ts`
- Modify: `frontend_admin/src/pages/team-operations/workbench/components/WorkbenchLayout.test.tsx`
- Modify: `frontend_admin/src/pages/team-operations/workbench/index.test.ts`
- Modify: `frontend_admin/src/pages/rental/workbench.test.tsx`

- [ ] **Step 1：补齐响应式和可访问性细节**

确认以下实现存在：

- 拖拽手柄是可聚焦的 `button`，拥有 `aria-label`。
- Drawer 内 Switch 有对应组件标题标签。
- DragOverlay 不重复暴露给读屏器，使用 `aria-hidden="true"`。
- 编辑状态使用 `aria-live="polite"` 宣布“尚未保存 / 保存中 / 已保存”。
- CSS 在 `max-width: 1199px` 使用两列，在 `max-width: 767px` 使用单列。
- 移动端不创建 DndContext，不显示宽度选择。
- 卡片内部内容使用 `min-width: 0`，长标题和表格不会撑破 Grid。

- [ ] **Step 2：运行工作台、租赁工作台和用户设置测试**

Run:

```bash
nvm use 22 && npm exec -- vitest run src/pages/team-operations/workbench src/pages/rental/workbench.test.tsx src/utils/userSettings.test.ts
```

Expected: PASS。

- [ ] **Step 3：运行 TypeScript 检查**

Run:

```bash
nvm use 22 && npm run tsc
```

Expected: 无 TypeScript 错误。

- [ ] **Step 4：运行 Biome lint**

Run:

```bash
nvm use 22 && npm run biome:lint
```

Expected: 无 lint 错误。只修复本次改动涉及的问题，不做无关格式化。

- [ ] **Step 5：运行 Ant Design 用法检查**

Run:

```bash
nvm use 22 && npm exec -- antd lint ./src/pages/team-operations/workbench ./src/pages/personal-business/overview
```

Expected: 本次新增的 Ant Design 用法没有错误。

- [ ] **Step 6：执行管理端生产构建**

Run:

```bash
nvm use 22 && npm run build
```

Expected: 构建成功，工作台相关代码可以由 Umi 正确拆包；不运行 collectstatic，不修改后端静态文件。

- [ ] **Step 7：人工验收关键流程**

启动管理端后依次验证：

1. 我的工作台默认布局正确。
2. 空间工作台默认布局正确且受权限控制。
3. 两个视角分别保存不同顺序和宽度。
4. 拖动只改变顺序，保存值中没有 `x/y/h`。
5. 不支持的宽度不会出现在设置中。
6. 隐藏组件后保存，刷新仍隐藏。
7. 重新显示组件后出现在可见组件末尾。
8. 取消编辑恢复保存前布局。
9. 恢复默认必须再次点击保存才生效。
10. 保存失败后草稿不丢失。
11. 移动端全部单列，只能调整显隐。
12. 个人设置维护页看不到 `internal.workbench.*`。
13. 接受任务、完成任务、发布房源、转签跳转全部可用。

---

## 完成定义

- 所有计划内测试通过。
- TypeScript、Biome、Ant Design lint 和管理端构建通过。
- 两个工作台的配置分别保存到 `internal.workbench.mine.layout.v1` 与 `internal.workbench.space.layout.v1`。
- 保存值仅包含 `{ id, width, visible }[]`，数组顺序表示组件顺序。
- 桌面三列、平板两列、移动端单列行为符合设计。
- 通用个人设置页面无法查看或编辑内部工作台设置。
- 不新增数据库迁移，不修改生成的 OpenAPI 文件，不执行 git 操作。
