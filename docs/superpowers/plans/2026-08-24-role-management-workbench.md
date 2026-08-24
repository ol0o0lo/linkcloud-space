# 角色管理工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将原四项权限菜单收敛为单一“角色管理”页面，在同一工作台管理空间角色和按团队划分的团队角色，并将实际成员授权保留在组织架构。

**Architecture:** 以 `/space/access` 为唯一角色管理入口，由页面级 URL 状态控制“空间角色 / 团队角色”Tab 和选中团队。现有空间角色、团队角色业务逻辑拆成可嵌入 Panel；共享角色表格和只读授权成员 Drawer，组织架构通过查询参数带入上下文。

**Tech Stack:** React 19、Umi Max 4、Ant Design 6、React Query 5、antd-style、Vitest、Testing Library。

---

## 文件结构

- Modify: `frontend_admin/config/routes.ts` — 单一角色管理菜单和隐藏旧权限路由。
- Modify: `frontend_admin/src/routes.test.ts` — 验证菜单和路由结构。
- Modify: `frontend_admin/src/pages/access/index.tsx` — 统一工作台、Tab 与 URL 状态。
- Modify: `frontend_admin/src/pages/access/index.test.tsx` — 工作台交互和 URL 测试。
- Modify: `frontend_admin/src/pages/access/organization-roles/index.tsx` — 导出可嵌入空间角色 Panel。
- Modify: `frontend_admin/src/pages/access/team-roles/index.tsx` — 导出可嵌入团队角色 Panel。
- Modify: `frontend_admin/src/pages/access/shared.tsx` — 共享角色表格、授权 Drawer、团队导航。
- Create: `frontend_admin/src/pages/access/roleManagement.styles.ts` — 工作台分栏、团队列表和窄屏样式。
- Modify: `frontend_admin/src/pages/space/organization/index.tsx` — 角色管理上下文链接统一指向新页面。
- Modify: relevant access and organization tests — 覆盖权限、Drawer 和上下文跳转。

### Task 1: 收敛菜单和规范路由

- [ ] **Step 1: 更新路由测试为单一角色管理入口**

在 `src/routes.test.ts` 断言空间管理直接子路由包含一个：

```ts
expect(accessRoute).toMatchObject({
  name: '角色管理',
  locale: false,
  icon: 'key',
  path: SPACE_PATHS.access,
  component: './access',
});
```

并断言空间授权、团队授权不再出现在可见菜单中。

- [ ] **Step 2: 运行路由测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/routes.test.ts`
Expected: FAIL，当前路由仍为“权限管理”嵌套分组。

- [ ] **Step 3: 修改 `config/routes.ts`**

目标结构：

```ts
{
  name: '角色管理',
  locale: false,
  icon: 'key',
  path: SPACE_PATHS.access,
  component: './access',
},
```

旧空间角色、团队角色、空间授权和团队授权路由不再作为菜单项。

- [ ] **Step 4: 运行路由测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/routes.test.ts`
Expected: PASS。

### Task 2: 建立统一页面和 URL 状态

- [ ] **Step 1: 重写 `src/pages/access/index.test.tsx`**

覆盖：

```ts
expect(screen.getByRole('tab', { name: '空间角色' })).toHaveAttribute('aria-selected', 'true');
fireEvent.click(screen.getByRole('tab', { name: '团队角色' }));
expect(mockHistoryPush).toHaveBeenCalledWith('/space/access?tab=team');
```

并覆盖 `?tab=team&team=3` 恢复团队上下文。

- [ ] **Step 2: 运行页面测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/index.test.tsx`
Expected: FAIL，当前页面仍为四个入口链接。

- [ ] **Step 3: 实现 `RoleManagementPage`**

页面使用：

```tsx
<TenantSelectionGuard title="角色管理">
  <Card>
    <Tabs
      activeKey={activeTab}
      onChange={changeTab}
      items={[
        { key: 'space', label: '空间角色', children: <OrganizationRolesPanel /> },
        { key: 'team', label: '团队角色', children: <TeamRolesPanel selectedTeamId={teamId} onTeamChange={changeTeam} /> },
      ]}
    />
  </Card>
</TenantSelectionGuard>
```

URL 规则遵循设计文档，并保留其他合法查询参数时只更新 `tab` 和 `team`。

- [ ] **Step 4: 运行页面测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/index.test.tsx`
Expected: PASS。

### Task 3: 抽取空间角色 Panel 和授权 Drawer

- [ ] **Step 1: 为授权人数交互增加失败测试**

在空间角色测试中断言：

```ts
fireEvent.click(screen.getByRole('button', { name: '查看运营的已授权成员' }));
expect(screen.getByRole('dialog', { name: '运营 · 已授权成员' })).toBeInTheDocument();
expect(screen.getByText('Alice Zhang')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '前往组织架构调整' })).toBeInTheDocument();
```

- [ ] **Step 2: 运行空间角色测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/organization-roles/index.test.tsx`
Expected: FAIL，授权数量当前只是 Tag。

- [ ] **Step 3: 在 `shared.tsx` 增加 `RoleUsageDrawer`**

组件接口：

```ts
type RoleUsageDrawerProps = {
  open: boolean;
  role?: API.AccessRoleOut | null;
  bindings: Array<API.OrganizationBindingOut | API.TeamBindingOut>;
  team?: API.WorkspaceTeamSummaryOut;
  onClose: () => void;
  onOpenOrganization: () => void;
};
```

Drawer 只读展示匹配角色的成员，并提供“前往组织架构调整”。

- [ ] **Step 4: 将空间角色页面拆为 `OrganizationRolesPanel`**

Panel 不再创建 `TenantSelectionGuard` 或外层 Card，只返回加载、权限状态、标题操作、表格和 Modal/Drawer。默认导出页面保留薄包装，便于已有测试和直接组件复用。

- [ ] **Step 5: 运行空间角色测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/organization-roles/index.test.tsx`
Expected: PASS。

### Task 4: 建立团队导航和团队角色 Panel

- [ ] **Step 1: 增加团队导航失败测试**

覆盖：团队搜索、只显示允许团队、选中团队、无权限深链接和授权 Drawer。

```ts
expect(screen.getByRole('button', { name: '选择 Growth 团队' })).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '选择 Finance 团队' }));
expect(onTeamChange).toHaveBeenCalledWith(4);
```

- [ ] **Step 2: 运行团队角色测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/team-roles/index.test.tsx`
Expected: FAIL，当前页面使用顶部团队 Card。

- [ ] **Step 3: 新增 `roleManagement.styles.ts` 和团队导航**

样式使用主题 token：桌面端固定宽度团队导航和右侧内容；`max-width: 768px` 时隐藏列表、显示顶部 Select。团队列表使用导航接口已有的 `member_count` 作为稳定辅助信息，避免为角色数量制造按团队 N+1 请求；角色数量在当前团队标题区域由已加载角色数据显示。

- [ ] **Step 4: 将团队角色页面拆为 `TeamRolesPanel`**

Panel 接收：

```ts
type TeamRolesPanelProps = {
  selectedTeamId?: number;
  requestedTeamId?: number;
  onTeamChange: (teamId?: number) => void;
};
```

`requestedTeamId` 无权限时显示明确警告，不自动选择其他团队；无显式请求时自动选择第一个可见团队。

- [ ] **Step 5: 运行团队角色测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/access/team-roles/index.test.tsx`
Expected: PASS。

### Task 5: 更新组织架构上下文入口

- [ ] **Step 1: 更新组织架构模型测试**

断言空间入口为：

```text
/space/access?tab=space
```

团队入口为：

```text
/space/access?tab=team&team=<团队ID>
```

- [ ] **Step 2: 运行相关测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/space/organization`
Expected: FAIL，当前入口仍指向独立空间/团队角色路由。

- [ ] **Step 3: 修改 `src/pages/space/organization/index.tsx`**

统一通过 `SPACE_PATHS.access` 构造角色管理链接，并保留未保存内容保护逻辑。

- [ ] **Step 4: 运行组织架构相关测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/space/organization`
Expected: PASS。

### Task 6: 完整验证

- [ ] **Step 1: 格式化改动文件**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- biome check --write config/routes.ts src/routes.test.ts src/pages/access/index.tsx src/pages/access/index.test.tsx src/pages/access/shared.tsx src/pages/access/organization-roles/index.tsx src/pages/access/organization-roles/index.test.tsx src/pages/access/team-roles/index.tsx src/pages/access/team-roles/index.test.tsx src/pages/access/roleManagement.styles.ts src/pages/space/organization/index.tsx`
Expected: exit 0。

- [ ] **Step 2: 运行角色管理与路由测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/routes.test.ts src/pages/access src/pages/space/organization`
Expected: 所有测试通过。

- [ ] **Step 3: 运行 TypeScript 和 Ant Design 检查**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run tsc`
Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- antd lint ./src/pages/access`
Expected: TypeScript 无错误；Ant Design 无新增 usage/a11y/performance 错误。

- [ ] **Step 4: 构建并浏览器验收**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run build`
Expected: 构建成功；浏览器确认单一菜单、Tab、团队导航、Drawer、权限状态和组织架构跳转。
