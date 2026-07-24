# 普通用户通知创建器美化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将通知创建弹窗改造成面向空间所有者/管理员的紧凑引导式单页，同时保留现有发送、校验、目标搜索和权限行为。

**Architecture:** 继续复用 `NotificationDispatchesPage` 内现有表单和请求状态，不拆分 API 或生成服务。仅重组 Modal 的标题、发送范围、内容区、可选链接和 footer，并在同目录 `styles.ts` 中集中管理响应式与紧凑样式。

**Tech Stack:** React 19、TypeScript、Ant Design 6、antd-style、Vitest、Testing Library。

**Worktree note:** 目标页面和测试已有用户未提交改动，因此在当前工作区增量实施，不创建分支或提交，避免混入用户现有修改。

---

### Task 1: 用用户可见行为锁定新编辑器

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`
- Test: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`

- [x] **Step 1: 为租户模式补充引导式编辑器断言**

在现有 `uses tenant-safe defaults...` 用例打开弹窗后断言：

```tsx
expect(
  screen.getByText('重要消息将通过通知中心送达成员'),
).toBeInTheDocument();
expect(screen.getByText('选择接收人')).toBeInTheDocument();
expect(screen.getByText('填写消息内容')).toBeInTheDocument();
expect(
  screen.getByText('将发送给「LAN 空间」的全部成员'),
).toBeInTheDocument();
expect(screen.getByText('准备发送给当前空间全部成员')).toBeInTheDocument();
```

- [x] **Step 2: 为可选链接补充折叠与展开行为测试**

把非法链接用例改为先验证链接输入框未出现，再点击“添加链接”并填写：

```tsx
expect(
  screen.queryByLabelText('点击后前往（可选）'),
).not.toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: '添加链接' }));
fireEvent.change(screen.getByLabelText('点击后前往（可选）'), {
  target: { value: 'example.com/path' },
});
```

- [x] **Step 3: 运行目标测试并确认 RED**

Run from `frontend_admin/`:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/platform-management/notification-dispatches/index.test.tsx'
```

Expected: FAIL，缺少引导标题、接收摘要、“添加链接”按钮，证明测试覆盖的是尚未实现的新界面。

### Task 2: 实现紧凑引导式通知编辑器

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/styles.ts`
- Test: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`

- [x] **Step 1: 增加编辑器所需状态与派生文案**

在页面中加入 `linkExpanded` 状态，并在打开、关闭、发送成功和租户边界切换时同步重置。依据 `scopeValue`、`selectedTargetIds`、`isTenantMode` 和 `currentOrganization` 派生两类文案：

```tsx
const recipientSummary =
  scopeValue === 'platform'
    ? '将发送给全平台用户'
    : scopeValue === 'organization'
      ? isTenantMode
        ? `将发送给「${currentOrganization?.name || '当前空间'}」的全部成员`
        : selectedTargetIds.length
          ? `已选择 ${selectedTargetIds.length} 个空间`
          : '请选择接收空间'
      : scopeValue === 'teams'
        ? selectedTargetIds.length
          ? `已选择 ${selectedTargetIds.length} 个团队，最终人数发送后统计`
          : '请选择接收团队'
        : selectedTargetIds.length
          ? `已选择 ${selectedTargetIds.length} 名${isTenantMode ? '成员' : '用户'}`
          : `请选择接收${isTenantMode ? '成员' : '用户'}`;
```

footer 文案使用更短的自然语言，例如租户空间全员为“准备发送给当前空间全部成员”。

- [x] **Step 2: 重组 Modal 语义结构**

将 Modal 设置为约 `720` 宽，使用自定义标题和函数式 footer：

```tsx
<Modal
  className={styles.createModal}
  width={720}
  title={
    <div className={styles.createTitle}>
      <span className={styles.createTitleIcon}><SendOutlined /></span>
      <div>
        <Typography.Text strong>
          {isTenantMode ? '发送空间通知' : '发送平台通知'}
        </Typography.Text>
        <Typography.Text type="secondary" className={styles.createSubtitle}>
          {isTenantMode
            ? '重要消息将通过通知中心送达成员'
            : '向平台用户发送重要通知'}
        </Typography.Text>
      </div>
    </div>
  }
  footer={(_originNode, { OkBtn, CancelBtn }) => (
    <div className={styles.createFooter}>
      <div className={styles.footerSummary}>
        <Typography.Text strong>{footerSummary}</Typography.Text>
        <Typography.Text type="secondary">发送后可查看投递结果</Typography.Text>
      </div>
      <Space><CancelBtn /><OkBtn /></Space>
    </div>
  )}
>
```

Modal 内分为“1 选择接收人”和“2 填写消息内容”两个紧凑 section。发送范围继续使用 `Radio.Group`，但每个 `Radio.Button` 渲染图标、标签和短说明，并用 `aria-label` 保留现有可访问名称与测试契约。

- [x] **Step 3: 收起低频链接字段**

默认只显示一行可选操作：

```tsx
<Button
  type="link"
  size="small"
  icon={<PlusOutlined />}
  onClick={() => setLinkExpanded(true)}
>
  添加链接
</Button>
```

点击后渲染原有 URL `Form.Item`，继续复用最大长度和协议校验。复用历史通知且已有 URL 时自动展开。

- [x] **Step 4: 实现适度紧凑与响应式样式**

在 `styles.ts` 增加：

- Modal header/body/footer 的紧凑 padding，body 最大高度 `calc(100vh - 180px)` 并纵向滚动。
- 三列发送范围卡片；小于 `576px` 时改为单列。
- section 标题、数字徽标、接收摘要、可选链接行和 footer 摘要样式。
- pressable 卡片只过渡 `transform`、`border-color`、`background-color`，按下时 `scale(0.98)`；在 `prefers-reduced-motion` 下移除 transform 反馈。
- 表单项间距压缩，正文框使用 `rows={3}`。

- [x] **Step 5: 运行目标测试并确认 GREEN**

Run from `frontend_admin/`:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/platform-management/notification-dispatches/index.test.tsx'
```

Expected: PASS，创建请求参数、租户隔离、链接校验和新增可见行为全部通过。

### Task 3: 静态检查与视觉回归

**Files:**
- Verify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
- Verify: `frontend_admin/src/pages/platform-management/notification-dispatches/styles.ts`

- [x] **Step 1: 运行 TypeScript 检查**

Run from `frontend_admin/`:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run tsc'
```

Expected: PASS，无新增类型错误。

- [x] **Step 2: 运行 Ant Design 用法检查**

Run from `frontend_admin/`:

```bash
/bin/zsh -lc 'source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- antd lint ./src/pages/platform-management/notification-dispatches'
```

Expected: PASS，无不兼容或废弃 API。

- [x] **Step 3: 检查最终差异**

确认差异仅落在计划文件、通知分发页面、页面样式和对应测试；不覆盖用户在同一文件中的既有功能改造，也不修改生成服务。

### Task 4: 根据代码复核补齐边界状态

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.tsx`
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/styles.ts`
- Test: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`

- [x] **Step 1: 对齐前后端 URL 安全规则**

前端按后端模型规则接受大小写不敏感的 HTTP(S)，并拒绝协议相对路径 `//...` 与反斜杠路径 `/\\...`；测试覆盖安全和不安全边界。

- [x] **Step 2: 区分目标为空与加载失败**

目标查询失败时在 Select 空状态中显示“接收目标加载失败”和具名重试按钮，点击后调用 `targetQuery.refetch()`；测试验证首次失败和重试请求。

- [x] **Step 3: 增强步骤语义**

两个步骤使用 `h3` 标题，`section` 与发送范围 `Radio.Group` 通过 `aria-labelledby` 关联；步骤数字设为装饰性内容，避免污染可访问名称。
