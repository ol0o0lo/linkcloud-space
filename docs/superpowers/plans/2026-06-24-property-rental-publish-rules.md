# 房源发布规则与后台页面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让房源租赁后台的发布规则、房源新建、房源详情和空间设置形成统一的企业级工作流，支持“阻断发布 / 仅提醒 / 不校验”的空间级配置。

**Architecture:** 发布规则以空间设置 `property_rental.publish_rules` 为唯一配置源，前端房源新建和详情页只消费同一套规则计算结果。界面上把“可发布但有提醒”和“阻断发布”分层表达，减少单页堆叠和误判，保持企业后台常见的摘要-操作-明细结构。

**Tech Stack:** React + TypeScript + Ant Design + antd-style + TanStack Query + Vitest + Playwright

---

### Task 1: 对齐发布规则数据与提示文案

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/constants.ts`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.tsx`
- Modify: `frontend_admin/src/pages/settings-management/organization/index.test.tsx`
- Test: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 写出覆盖阻断 / 提醒 / 不校验的单测**

```ts
it('treats warning-only media gaps as publishable under organization publish rules', async () => {
  const result = evaluateHousePublishState(
    { landlord_id: 1, asking_rent: '4200', images: [] },
    {
      landlord: { mode: 'required' },
      rent: { mode: 'required' },
      cover: { mode: 'warn' },
      images: { mode: 'warn', min_count: 3 },
      floor_plan: { mode: 'warn' },
      video: { mode: 'off', min_count: 1 },
    },
  );

  expect(result.canPublish).toBe(true);
  expect(result.blockingIssues).toEqual([]);
  expect(result.warningIssues).toEqual(['缺封面', '图片不足', '缺户型图']);
});
```

- [ ] **Step 2: 运行相关单测确认当前实现覆盖不足**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/settings-management/organization/index.test.tsx`

Expected: 至少会暴露发布规则文案、默认值或提示表达需要调整的断言。

- [ ] **Step 3: 实现统一的规则默认值、规则标签和提示文案**

```ts
export const DEFAULT_HOUSE_PUBLISH_RULES: HousePublishRuleSnapshot = {
  landlord: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED, label: '房东主体' },
  rent: { mode: HOUSE_PUBLISH_RULE_MODE.REQUIRED, label: '租金' },
  cover: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING, label: '封面图' },
  images: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING, label: '房源图片', min_count: 3 },
  floor_plan: { mode: HOUSE_PUBLISH_RULE_MODE.WARNING, label: '户型图' },
  video: { mode: HOUSE_PUBLISH_RULE_MODE.OFF, label: '视频', min_count: 1 },
};
```

- [ ] **Step 4: 运行单测确认配置页和规则计算一致**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/settings-management/organization/index.test.tsx src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx`

Expected: 通过，且空间设置页能保存发布规则 JSON 控件的预期值。

- [ ] **Step 5: 提交一次可回退的中文 commit**

```bash
git add frontend_admin/src/pages/property-rental/constants.ts frontend_admin/src/pages/settings-management/organization/index.tsx frontend_admin/src/pages/settings-management/organization/index.test.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 统一房源发布规则配置"
```

### Task 2: 收紧房源新建页的首屏和步骤提示

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/houses/new.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx`

- [ ] **Step 1: 写出首屏摘要和步骤提示的断言**

```ts
expect(screen.getByText('录入状态')).toBeInTheDocument();
expect(screen.getByText('带看基础')).toBeInTheDocument();
expect(screen.getByText('发布检查')).toBeInTheDocument();
expect(screen.getByText('当前缺口清单')).toBeInTheDocument();
```

- [ ] **Step 2: 运行新建页测试看首屏和步骤流**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/new.test.tsx`

Expected: 通过基础流后，新增的企业级摘要与缺口提示断言稳定。

- [ ] **Step 3: 把 4 步向导整理成“摘要 + 主表单 + 右侧规则提示”**

```tsx
<Row gutter={16}>
  <Col span={16}>
    <section>{/* 主向导表单 */}</section>
  </Col>
  <Col span={8}>
    <aside>{/* 当前步骤提醒、阻断项、发布规则来源 */}</aside>
  </Col>
</Row>
```

- [ ] **Step 4: 运行新建页测试并补浏览器确认**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/new.test.tsx`

Expected: 新建页仍可创建草稿，且媒体提醒不阻断保存。

- [ ] **Step 5: 提交一次可回退的中文 commit**

```bash
git add frontend_admin/src/pages/property-rental/houses/new.tsx frontend_admin/src/pages/property-rental/houses/__tests__/new.test.tsx
git commit -m "feat: 优化房源新建页结构"
```

### Task 3: 重整房源详情页的摘要、发布和媒体区

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/houses/detail.tsx`
- Modify: `frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx`

- [ ] **Step 1: 写出详情页摘要、发布状态和空间设置入口的断言**

```ts
expect(screen.getByText('业务工作面板')).toBeInTheDocument();
expect(screen.getByText('发布与阻塞')).toBeInTheDocument();
expect(screen.getByRole('link', { name: '去空间设置' })).toHaveAttribute('href', '/dashboard/settings-management/organization');
```

- [ ] **Step 2: 运行详情页测试确认当前布局回归点**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/detail.test.tsx`

Expected: 通过，且可发布/仅提醒/阻断三种状态都能被稳定识别。

- [ ] **Step 3: 将详情页整理成摘要区、主操作区、媒体区、记录区**

```tsx
<Row gutter={16}>
  <Col span={16}>{/* 摘要 + 主操作 + 媒体 */}</Col>
  <Col span={8}>{/* 发布状态、下一步建议、空间设置入口 */}</Col>
</Row>
```

- [ ] **Step 4: 运行详情页测试并补一轮工作台相关回归**

Run: `pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/property-rental/workbench.test.tsx`

Expected: 详情页信息层级更清楚，工作台里的缺口提示仍然正确。

- [ ] **Step 5: 提交一次可回退的中文 commit**

```bash
git add frontend_admin/src/pages/property-rental/houses/detail.tsx frontend_admin/src/pages/property-rental/houses/__tests__/detail.test.tsx
git commit -m "feat: 重整房源详情页布局"
```

### Task 4: 浏览器验收和最终回归

**Files:**
- Modify: 如有必要，回调前述页面的样式细节

- [ ] **Step 1: 打开 workbench、houses、houses/new、houses/:id 和空间设置页**

```js
await tab.goto('http://localhost:8080/dashboard/property-rental/workbench');
await tab.goto('http://localhost:8080/dashboard/property-rental/houses');
await tab.goto('http://localhost:8080/dashboard/property-rental/houses/new');
await tab.goto('http://localhost:8080/dashboard/property-rental/houses/1');
await tab.goto('http://localhost:8080/dashboard/settings-management/organization');
```

- [ ] **Step 2: 检查首屏是否存在卡片堆叠、按钮过密或提示过长**

```js
const snapshot = await tab.playwright.domSnapshot();
```

- [ ] **Step 3: 如有必要，做最后一轮样式收束**

```tsx
// 只调整布局和提示密度，不再加新的业务分支。
```

- [ ] **Step 4: 运行最终验证命令**

Run: `pnpm --dir frontend_admin exec tsc --noEmit && pnpm --dir frontend_admin exec vitest run src/pages/property-rental/houses/__tests__/new.test.tsx src/pages/property-rental/houses/__tests__/detail.test.tsx src/pages/settings-management/organization/index.test.tsx`

Expected: TypeScript 和核心页面测试都通过。

- [ ] **Step 5: 记录最终状态**

```text
确认空间级发布规则已生效，房源新建/详情/设置页对“阻断发布、仅提醒、不校验”的表达一致。
```
