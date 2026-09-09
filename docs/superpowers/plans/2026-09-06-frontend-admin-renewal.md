# Frontend Admin Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐管理端当前套餐的手动续费入口、试用转付费入口、临期提醒和续费支付说明。

**Architecture:** 保留现有单页与购买 mutation，不新增接口或支付组件。页面根据当前订阅 `kind/status` 派生操作类型，所有动作仍提交同一个创建订单 API，并由后端判定订单类型。

**Tech Stack:** React 19、TypeScript、TanStack Query、Ant Design 6、antd-style、Vitest、Testing Library。

---

### Task 1: 用页面测试锁定续费行为

**Files:**
- Modify: `frontend_admin/src/pages/space/subscription/index.test.tsx`
- Test: `frontend_admin/src/pages/space/subscription/index.test.tsx`

- [ ] **Step 1: 增加当前付费套餐的失败测试**

构造 `kind: 'paid'`、`status: 'active'`、30 天内到期的专业版订阅，断言页面存在“续费专业版”和临期提醒；点击续费按钮后断言：

```tsx
expect(await screen.findByRole('button', { name: /续费 专业版（月付）/ })).toBeInTheDocument();
expect(screen.getByText(/续费后将从当前到期日顺延/)).toBeInTheDocument();
fireEvent.click(screen.getByRole('button', { name: /续费 专业版（月付）/ }));
await waitFor(() => {
  expect(mockCreateOrder).toHaveBeenCalledWith({
    target_plan_code: 'professional',
    billing_cycle: 'month',
    payment_mode: 'native',
  });
});
```

- [ ] **Step 2: 增加试用转付费与非临期测试**

分别断言试用当前套餐显示“开通正式版”，以及剩余超过 30 天时不显示临期提醒。

- [ ] **Step 3: 运行测试并确认 RED**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/space/subscription/index.test.tsx
```

Expected: 新增断言因当前套餐没有按钮、没有临期提醒而失败。

### Task 2: 实现当前套餐动作与临期提醒

**Files:**
- Modify: `frontend_admin/src/pages/space/subscription/index.tsx`
- Test: `frontend_admin/src/pages/space/subscription/index.test.tsx`

- [ ] **Step 1: 派生可续费状态和支付动作**

在读取 `currentSubscription`、`daysLeft` 后增加：

```tsx
const isPaidRenewal =
  currentPlanCode !== 'free' &&
  currentSubscription?.kind === 'paid' &&
  currentSubscription.status === 'active';
const isTrialPurchase =
  currentPlanCode !== 'free' &&
  currentSubscription?.kind === 'trial' &&
  currentSubscription.status === 'trialing';
const showRenewalReminder =
  isPaidRenewal && daysLeft != null && daysLeft <= 30;
```

- [ ] **Step 2: 允许当前付费或试用套餐产生订单**

套餐列的禁用条件调整为只禁用不可操作的当前套餐：

```tsx
const currentPlanCanPurchase =
  isCurrent && (isPaidRenewal || isTrialPurchase);
const disabled =
  (isCurrent && !currentPlanCanPurchase) ||
  (!isCurrent && lowerPlan) ||
  !selectedPrice;
```

当前付费套餐文案为 `续费${plan.name}`，当前试用套餐文案为 `开通正式版`，并继续提交现有订单 payload。

- [ ] **Step 3: 增加临期 Alert**

在套餐摘要与升级建议之间使用 Ant Design `Alert`，展示剩余天数、绝对到期日和顺延规则。Alert 的按钮调用共享的滚动聚焦函数，将用户定位到当前套餐按钮。

- [ ] **Step 4: 增加续费支付说明**

根据当前购买变量与订阅状态派生 `checkoutAction`，续费时将 Modal 标题改为“微信扫码续费”，并将信息提示改为：

```tsx
支付成功后将从当前到期日顺延，页面会自动同步套餐有效期。
```

- [ ] **Step 5: 运行页面测试并确认 GREEN**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin exec -- vitest run src/pages/space/subscription/index.test.tsx
```

Expected: 订阅页面测试全部通过。

### Task 3: 范围验证

**Files:**
- Verify: `frontend_admin/src/pages/space/subscription/index.tsx`
- Verify: `frontend_admin/src/pages/space/subscription/index.test.tsx`

- [ ] **Step 1: 运行 TypeScript 与 Biome 检查**

Run:

```bash
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin run tsc
source /Users/lan/.nvm/nvm.sh && nvm use 22 && npm --prefix frontend_admin exec -- biome check src/pages/space/subscription/index.tsx src/pages/space/subscription/index.test.tsx
```

Expected: 两条命令退出码均为 0。

- [ ] **Step 2: 浏览器验证真实页面**

使用已有企业版临期空间验证：当前套餐能看到续费入口、点击可创建扫码订单、支付弹窗包含顺延说明；取消测试订单后页面可再次续费。

- [ ] **Step 3: 不执行 Git 操作**

本仓库要求未明确授权时不进行提交、暂存、分支或推送，本计划不包含 Git 写操作。
