# Frontend Admin 实名认证并入安全设置 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `frontend_admin` 用户侧实名认证从独立设置页收回到“安全设置”中的一项，并保持个人业务页只做引导跳转的闭环。

**Architecture:** 复用现有实名认证接口与轻量表单逻辑，但不再保留独立左侧菜单。`security.tsx` 扩展一个“实名认证”条目，并在当前页内按状态显示最少必要的信息、提交或重提入口；`personal-business` 统一跳到 `tab=security`。

**Tech Stack:** React 19、@tanstack/react-query、Ant Design 6、Vitest、TypeScript

---

### Task 1: 调整设置导航与安全设置测试

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/index.test.tsx`
- Modify: `frontend_admin/src/pages/account/settings/components/security.test.tsx`

- [ ] **Step 1: Write the failing test**

为设置页测试改成不再出现“实名认证”独立按钮；为安全设置测试增加“实名认证”行与操作文案断言。

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/security.test.tsx`
Expected: FAIL，因为当前代码仍保留独立实名认证 tab，且 `SecurityView` 还没有实名认证行。

- [ ] **Step 3: Write minimal implementation**

在设置页移除 `real-name` tab，并在 `security.tsx` 中增加实名认证条目与轻量内嵌区域。

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/security.test.tsx`
Expected: PASS

### Task 2: 收口实名认证交互到安全设置

**Files:**
- Modify: `frontend_admin/src/pages/account/settings/components/security.tsx`
- Delete/Keep unused logic out of routing: `frontend_admin/src/pages/account/settings/components/real-name.tsx`
- Test: `frontend_admin/src/pages/account/settings/components/security.test.tsx`

- [ ] **Step 1: Write the failing test**

在 `security.test.tsx` 增加点击“去认证/重新提交”后出现实名表单、能显示状态提示的断言。

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/components/security.test.tsx`
Expected: FAIL，因为当前安全设置未集成实名表单与实名接口查询。

- [ ] **Step 3: Write minimal implementation**

把实名逻辑直接嵌到 `security.tsx`，保留状态、失败原因、提交/重提与最简日志或提示，不再展示完整独立页结构。

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/components/security.test.tsx`
Expected: PASS

### Task 3: 调整个人业务页闭环

**Files:**
- Modify: `frontend_admin/src/pages/personal-business/overview/index.tsx`
- Modify: `frontend_admin/src/pages/personal-business/overview/index.test.tsx`

- [ ] **Step 1: Write the failing test**

把现有跳转断言从 `/account/settings?tab=real-name` 改成 `/account/settings?tab=security`。

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/personal-business/overview/index.test.tsx`
Expected: FAIL，因为当前跳转仍指向独立实名认证 tab。

- [ ] **Step 3: Write minimal implementation**

更新文案与跳转地址，确保用户从个人业务页回到安全设置即可完成实名闭环。

- [ ] **Step 4: Run test to verify it passes**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/personal-business/overview/index.test.tsx`
Expected: PASS

### Task 4: 完整验证

**Files:**
- Verify only: `frontend_admin/src/pages/account/settings/index.tsx`
- Verify only: `frontend_admin/src/pages/account/settings/components/security.tsx`
- Verify only: `frontend_admin/src/pages/personal-business/overview/index.tsx`

- [ ] **Step 1: Run focused tests**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/security.test.tsx src/pages/personal-business/overview/index.test.tsx`
Expected: PASS

- [ ] **Step 2: Run broader regression tests**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec vitest run src/pages/account/settings/index.test.tsx src/pages/account/settings/components/base.test.tsx src/pages/account/settings/components/security.test.tsx src/pages/account/settings/service.test.ts src/pages/personal-business/overview/index.test.tsx`
Expected: PASS

- [ ] **Step 3: Run type check**

Run: `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && pnpm exec tsc --noEmit`
Expected: PASS
