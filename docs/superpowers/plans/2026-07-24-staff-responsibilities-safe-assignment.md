# 员工分工安全配置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让员工分工的列表与配置抽屉清晰展示职责层级，并在整体替换分工前要求用户核对确认。

**Architecture:** 在现有 `StaffResponsibilitiesPage` 内保持数据查询和保存接口不变。新增纯展示型的范围摘要与分层配置区；将表单提交改为先记录待确认 payload，随后由确认弹窗调用既有 mutation。

**Tech Stack:** React 19、TypeScript、Ant Design 6、ProTable、TanStack Query、Vitest、Testing Library。

---

### Task 1: 编写安全保存与分层信息的回归测试

**Files:**
- Create: `frontend_admin/src/pages/property-rental/responsibilities/index.test.tsx`

- [ ] **Step 1: 写出失败测试**

```tsx
it('保存前展示分层核对，并在确认后才提交整体替换', async () => {
  renderPage(<StaffResponsibilitiesPage />);
  fireEvent.click(await screen.findByRole('button', { name: '分配范围' }));

  expect(await screen.findByText('房东范围')).toBeInTheDocument();
  expect(screen.getByText('房东范围 > 楼栋范围 > 小区范围')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '保存分工' }));

  expect(await screen.findByText('确认替换分工')).toBeInTheDocument();
  expect(mockReplaceStaffResponsibilities).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '确认替换分工' }));
  await waitFor(() =>
    expect(mockReplaceStaffResponsibilities).toHaveBeenCalledWith(1, {
      landlord_ids: [7], building_ids: [], estate_ids: [8],
    }),
  );
});
```

- [ ] **Step 2: 运行测试，确认当前实现失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/property-rental/responsibilities/index.test.tsx`

Expected: FAIL，因为尚未存在“房东范围”与“确认替换分工”。

### Task 2: 实现范围摘要、分层字段和确认保存

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/responsibilities/index.tsx:42-466`

- [ ] **Step 1: 将三列范围合并为摘要列**

```tsx
{
  title: '负责范围',
  dataIndex: 'responsibility_scope',
  width: 360,
  render: (_value, record) => <ResponsibilityScopeSummary record={record} />,
}
```

摘要按房东、楼栋、小区的顺序展示已选数量和标签，保留“负责房源”数量与操作列。

- [ ] **Step 2: 将表单改为三段分层配置**

```tsx
<Alert
  type="info"
  showIcon
  title="房东范围 > 楼栋范围 > 小区范围"
  description="同一房源只按命中的最高层级归属。留空表示不在该层分配。"
/>
<ResponsibilityScopeField priority={1} title="房东范围" selectedCount={draftLandlordIds.length} />
<ResponsibilityScopeField priority={2} title="楼栋范围" selectedCount={draftBuildingIds.length} />
<ResponsibilityScopeField priority={3} title="小区范围" selectedCount={draftEstateIds.length} />
```

每段继续使用现有 `Select` 的多选、搜索和清空能力，使用 `Form.useWatch` 读取当前选择数量。

- [ ] **Step 3: 在提交与 mutation 之间加入核对状态**

```tsx
const [pendingResponsibilities, setPendingResponsibilities] =
  useState<PropertyResponsibilityUpdateIn | null>(null);

onFinish={(values) => setPendingResponsibilities(normalizeResponsibilities(values))}

<Modal
  title="确认替换分工"
  open={Boolean(pendingResponsibilities)}
  okText="确认替换分工"
  onCancel={() => setPendingResponsibilities(null)}
  onOk={() => saveResponsibilities.mutateAsync(pendingResponsibilities!)}
/>
```

确认内容显示三层范围的数量和标签；全部为空时展示 `type="error"` 的取消全部范围提示。取消弹窗不得清空表单值；mutation 成功后同时关闭抽屉和核对弹窗。

- [ ] **Step 4: 运行新增测试，确认通过**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/property-rental/responsibilities/index.test.tsx`

Expected: PASS。

### Task 3: 完成页面级验证

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/responsibilities/index.test.tsx`

- [ ] **Step 1: 覆盖全空范围的危险确认提示**

```tsx
expect(screen.getByText('取消全部负责范围')).toBeInTheDocument();
expect(mockReplaceStaffResponsibilities).not.toHaveBeenCalled();
```

通过清空三个范围后保存，断言确认前不会提交，取消确认后抽屉仍保留打开和表单状态。

- [ ] **Step 2: 执行范围内质量检查**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/property-rental/responsibilities/index.test.tsx && npm run tsc && npm exec -- biome lint src/pages/property-rental/responsibilities/index.tsx src/pages/property-rental/responsibilities/index.test.tsx`

Expected: 测试、类型检查和格式检查均通过。
