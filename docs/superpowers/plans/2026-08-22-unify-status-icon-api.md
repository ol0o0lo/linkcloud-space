# 统一状态图标 API 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除公开的 `AppStatusIcon`，由 `AppIcon` 的可选 `state` 属性统一渲染对象图标和状态图标。

**Architecture:** 页面只使用 `<AppIcon name />`、`<AppIcon name state />` 和 `<AppStatusTag />`。状态枚举、图标、语义色和插件注册移到 `AppStatus/registry.ts`；`AppIcon` 只调用该注册表得到展示结果，`AppStatusTag` 复用同一入口渲染图标。

**Tech Stack:** React、TypeScript、Ant Design、antd-style、Vitest、Biome。

---

### Task 1: 为统一入口补充回归测试

**Files:**

- Modify: `frontend_admin/src/components/AppIcon/index.test.tsx`
- Modify: `frontend_admin/src/components/AppStatus/index.test.tsx`

- [x] **Step 1: 将状态图标测试改为 `AppIcon` 入口**

在 `AppIcon/index.test.tsx` 添加以下断言，验证状态模式解析状态专用图标和语义色：

```tsx
render(<AppIcon data-testid="rented-house" name="house" state="rented" />);

const icon = screen.getByTestId('rented-house');
expect(icon).toHaveAttribute('data-app-status-name', 'house');
expect(icon).toHaveAttribute('data-app-status-state', 'rented');
expect(icon).toHaveAttribute('data-app-status-tone', 'success');
expect(icon).toHaveStyle({ color: theme.getDesignToken().colorSuccess });
```

- [x] **Step 2: 删除 `AppStatusIcon` 的测试依赖**

在 `AppStatus/index.test.tsx` 中将状态图标参数化测试改为导入并渲染：

```tsx
<AppIcon
  data-testid={`status-icon-${name}-${state}`}
  name={name}
  state={state}
/>
```

- [x] **Step 3: 运行测试确认当前实现失败**

运行：

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm test -- src/components/AppIcon/index.test.tsx src/components/AppStatus/index.test.tsx
```

预期：`AppIcon` 尚未接收 `state`，TypeScript 或测试失败。

### Task 2: 抽离状态注册表并使 `AppIcon` 支持状态模式

**Files:**

- Create: `frontend_admin/src/components/AppStatus/registry.ts`
- Modify: `frontend_admin/src/components/AppIcon/index.tsx`
- Modify: `frontend_admin/src/components/AppStatus/index.tsx`

- [x] **Step 1: 创建无 UI 的状态注册表**

将当前 `AppStatus/index.tsx` 的第 10–191 行原样移到 `registry.ts`，其中状态常量必须保持以下三组稳定对象名和枚举键：

```tsx
export const APP_STATUS_DEFINITIONS = {
  house: {
    states: {
      vacant: { description: '收益中断：当前没有租约且尚未进入招租流程，需优先处理', icon: 'house.vacant', tone: 'error' },
      listed: { description: '正常经营：房源正在对外招租', icon: 'house.listed', tone: 'info' },
      rented: { description: '经营健康：房源已出租并处于有效占用', icon: 'house.rented', tone: 'success' },
      renovating: { description: '待跟进：房源暂不可出租，需关注装修进度', icon: 'house.renovating', tone: 'warning' },
      inactive: { description: '已退出日常管理和经营操作范围', icon: 'house.inactive', tone: 'disabled' },
    },
  },
  lease: {
    states: {
      pending: { icon: 'lease.pending', tone: 'warning' },
      active: { icon: 'lease.active', tone: 'success' },
      expired: { icon: 'lease.expired', tone: 'secondary' },
      terminated: { icon: 'lease.terminated', tone: 'error' },
    },
  },
  viewing: {
    states: {
      scheduled: { icon: 'viewing.scheduled', tone: 'info' },
      viewed: { icon: 'viewing.viewed', tone: 'default' },
      converted: { icon: 'viewing.converted', tone: 'success' },
      canceled: { icon: 'viewing.canceled', tone: 'error' },
      no_show: { icon: 'viewing.no_show', tone: 'error' },
      signed: { icon: 'viewing.signed', tone: 'success' },
      unsigned: { icon: 'viewing.unsigned', tone: 'secondary' },
    },
  },
} as const satisfies AppStatusDefinitions;

export function defineAppStatusDefinitions<const T extends AppStatusDefinitions>(definitions: T): T;
export function registerAppStatusDefinitions<const T extends AppStatusDefinitions>(source: string, definitions: T): () => void;
export function resolveAppStatusDefinition(name: AppStatusName, state: string): ResolvedAppStatus;
export function useResolvedAppStatus(name: AppStatusName, state: string): ResolvedAppStatus;
```

`registry.ts` 保持现有“未知状态回退为同名对象图标 + default 色”的行为，并继续用 `useSyncExternalStore` 让插件注册变化触发重新渲染。

- [x] **Step 2: 在 `AppIcon` 中实现可选状态解析**

为 `AppIconProps` 采用以下联合类型：

```tsx
type ObjectAppIconProps = Omit<IconProps, 'icon'> & {
  name: AppIconName;
  state?: never;
};

type StatusAppIconProps = Omit<IconProps, 'color' | 'icon'> & {
  name: AppStatusName;
  state: string;
};

export type AppIconProps = ObjectAppIconProps | StatusAppIconProps;
```

`state` 存在时调用 `useResolvedAppStatus(name, state)`，使用 `SEMANTIC_TONE_TOKEN` 和 `theme.useToken()` 设置图标颜色，并输出 `data-app-status-name`、`data-app-status-state`、`data-app-status-tone`。没有 `state` 时保留现有对象图标解析和调用方自定义颜色能力。

- [x] **Step 3: 将 `AppStatus` 收敛为规则导出和标签**

`AppStatus/index.tsx` 从 `registry.ts` 重新导出类型、注册函数和解析函数；删除 `AppStatusIcon` 与其 props。`AppStatusTag` 使用：

```tsx
const definition = useResolvedAppStatus(name, state);

<Tag
  color={STATUS_TONE_TAG_COLOR[definition.tone]}
  icon={<AppIcon name={name} state={state} />}
  title={title ?? definition.description}
>
  {children}
</Tag>
```

移除 `AppStatusTagProps.tone`，禁止页面覆盖同一状态的既定语义色。

- [x] **Step 4: 运行定向测试确认通过**

运行：

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm test -- src/components/AppIcon/index.test.tsx src/components/AppStatus/index.test.tsx
```

预期：两个测试文件全部通过，且不再有 `AppStatusIcon` 导出或调用。

### Task 3: 收尾文档和静态验证

**Files:**

- Modify: `frontend_admin/docs/design-system.md`
- Modify: `docs/superpowers/specs/2026-08-21-property-list-polish-design.md`

- [x] **Step 1: 核对文档 API 与实现一致**

确认规范只展示以下两种状态 UI 用法：

```tsx
<AppIcon name="house" state={house.status} />
<AppStatusTag name="house" state={house.status}>已出租</AppStatusTag>
```

- [x] **Step 2: 运行 Biome、类型检查和残留扫描**

运行：

```bash
source "$HOME/.nvm/nvm.sh" && nvm use 22 && npm exec -- biome check src/components/AppIcon src/components/AppStatus
rg -n "AppStatusIcon|<AppIcon[^>]*tone=" frontend_admin/src frontend_admin/docs docs/superpowers/specs
git diff --check
```

预期：Biome 通过；残留搜索没有页面实现命中；`git diff --check` 通过。完整类型检查若仍只报告 `wallet-management/withdrawals/index.tsx` 的既有 `WithdrawalRetryIn` 缺失，则记录为本次范围外问题。

## 自检结果

- 规格中的两个公开 UI 入口分别由 Task 2 的 `AppIcon` 和 `AppStatusTag` 覆盖。
- 状态注册、未知状态回退、插件注册和主题色映射均保留在 Task 2 的 `registry.ts` 与 `AppIcon` 解析路径中。
- 本计划不创建 Git 提交，遵循仓库“未经要求不操作 Git”的约定。
