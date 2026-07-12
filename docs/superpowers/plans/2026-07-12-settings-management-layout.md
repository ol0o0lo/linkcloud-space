# 设置管理页面精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除房源发布规则的状态汇总标签，并将团队选择器移至“团队设置”标题右侧。

**Architecture:** 发布规则控件仍负责预设选择和逐项校验编辑，只去掉派生出的展示性标签。`TenantSelectionGuard` 增加可选标题区扩展节点并透传给 ProComponents `PageContainer`，团队设置页借此将已有选择器放入标题右侧，无需新增布局容器或改变请求状态。

**Tech Stack:** React 19、TypeScript、Ant Design 6、Ant Design ProComponents、Vitest、Testing Library。

---

### Task 1: 为移除汇总标签添加回归测试

**Files:**
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx:219-226`
- Modify: `frontend_admin/src/pages/settings-management/team/index.test.tsx:95-106`

- [ ] **Step 1: 写出失败的页面断言**

将两处断言从元素存在改为不存在：

```tsx
expect(screen.queryByText('阻断发布：房东主体、租金')).not.toBeInTheDocument();
expect(screen.queryByText('仅提醒：封面图、房源图片、户型图')).not.toBeInTheDocument();
expect(screen.queryByText('不校验：视频')).not.toBeInTheDocument();
```

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx`

Expected: FAIL；现有 `PublishRulesControl` 仍渲染三个状态标签。

- [ ] **Step 3: 最小化移除展示性标签**

在 `frontend_admin/src/pages/settings-management/shared.tsx` 中从 `PublishRulesControl` 删除汇总 `Space` 和三个 `Tag`，并移除不再使用的 `Tag` 与 `summarizeHousePublishRules` 导入。保留预设按钮和规则表格：

```tsx
return (
  <Space orientation="vertical" size={12} style={{ width: '100%' }}>
    <Space wrap size={8}>
      {presetKeys.map((presetKey) => (
        <Button key={presetKey} type={activePreset === presetKey ? 'primary' : 'default'} onClick={() => onCommit(buildHousePublishRulesPreset(presetKey))}>
          {HOUSE_PUBLISH_RULE_PRESETS[presetKey].title}
        </Button>
      ))}
    </Space>
    <div style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid var(--ant-color-border-secondary)', borderRadius: 8, background: 'var(--ant-color-fill-quaternary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 140px 140px', gap: 12, padding: '0 12px 8px', color: 'var(--ant-color-text-secondary)' }}>
        <span>资料项</span><span>校验</span><span>数量</span>
      </div>
      {HOUSE_PUBLISH_RULE_ROWS.map((rule, index) => (
        /* 保留当前文件中该映射的完整实现 */
      ))}
    </div>
  </Space>
);
```

- [ ] **Step 4: 重新运行目标测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交阶段性变更**

```bash
git add frontend_admin/src/pages/settings-management/shared.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx frontend_admin/src/pages/settings-management/team/index.test.tsx
git commit -m "refactor: 精简发布规则提示"
```

### Task 2: 将团队选择器移入标题右侧

**Files:**
- Modify: `frontend_admin/src/pages/tenant/shared.tsx:142-164`
- Modify: `frontend_admin/src/pages/settings-management/team/index.tsx:1-129`
- Modify: `frontend_admin/src/pages/settings-management/team/index.test.tsx:18-22, 108-109`

- [ ] **Step 1: 写出失败的标题区位置测试**

让 `TenantSelectionGuard` 测试替身渲染标题与扩展区：

```tsx
TenantSelectionGuard: ({ title, extra, children }: { title: string; extra?: React.ReactNode; children: React.ReactNode }) => (
  <section>
    <div>
      <h1>{title}</h1>
      {extra}
    </div>
    {children}
  </section>
),
```

并在首个测试中断言：

```tsx
const teamSelect = screen.getByLabelText('团队');
expect(screen.getByRole('heading', { name: '团队设置' }).parentElement).toContainElement(teamSelect);
expect(container.querySelectorAll('.ant-card')).toHaveLength(1);
```

- [ ] **Step 2: 运行团队设置测试并确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/team/index.test.tsx`

Expected: FAIL；选择器仍在独立卡片中，且尚未传入标题区扩展节点。

- [ ] **Step 3: 增加标题区扩展接口并复用已有选择器**

将守卫组件改为可选 `extra` 属性，并在两处 `PageContainer` 透传：

```tsx
export const TenantSelectionGuard: React.FC<{
  title: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, extra, children }) => {
  const workspace = useTenantWorkspace();
  if (!workspace.selectedOrgSlug || !workspace.selectedOrganization) {
    return <PageContainer title={title} extra={extra}><Alert type="warning" title="尚未选择空间，请在右上角空间切换器中选择。" showIcon /></PageContainer>;
  }
  return <PageContainer title={title} extra={extra}>{children}</PageContainer>;
};
```

在团队设置页删除 `SettingsToolbarCard` 和其导入，改为：

```tsx
<TenantSelectionGuard
  title="团队设置"
  extra={
    <Select
      aria-label="团队"
      loading={teamsQuery.isLoading}
      options={(teamsQuery.data?.items || []).map((team) => ({ label: team.name, value: team.id }))}
      placeholder="选择团队"
      value={selectedTeamId}
      onChange={setSelectedTeamId}
      style={{ width: 320, maxWidth: '100%' }}
    />
  }
>
```

- [ ] **Step 4: 重新运行团队设置测试并确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/team/index.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交阶段性变更**

```bash
git add frontend_admin/src/pages/tenant/shared.tsx frontend_admin/src/pages/settings-management/team/index.tsx frontend_admin/src/pages/settings-management/team/index.test.tsx
git commit -m "refactor: 调整团队选择位置"
```

### Task 3: 执行管理端验证

**Files:**
- Verify only: `frontend_admin/src/pages/settings-management/shared.tsx`
- Verify only: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`
- Verify only: `frontend_admin/src/pages/settings-management/team/index.test.tsx`
- Verify only: `frontend_admin/src/pages/tenant/shared.tsx`

- [ ] **Step 1: 运行相关页面测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/settings-management/organization/index.test.tsx src/pages/settings-management/team/index.test.tsx`

Expected: PASS。

- [ ] **Step 2: 执行静态检查**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run lint`

Expected: exit code 0。

- [ ] **Step 3: 检查提交范围**

Run: `git status --short && git log -2 --oneline`

Expected: 仅包含本计划产生的提交；不暂存已有未跟踪文件。
