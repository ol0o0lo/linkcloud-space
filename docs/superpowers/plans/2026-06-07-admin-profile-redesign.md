# Admin 个人中心重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 admin `/profile` 重构为资料主导型单页个人中心，保留安全与通知能力，但不再把密码作为独立大区块。

**Architecture:** 复用现有 `profile-dashboard.ts`、`base-setting.vue`、`security-setting.vue`、`notification-setting.vue` 的 API 和状态逻辑，重点重排页面骨架与区块职责。顶层页面收敛为“顶部名片 + 基本信息 + 合并后的安全区 + 通知区”，并通过单区块编辑锁协调交互。

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Ant Design Vue (`antdv-next`), Vben Admin `Page`, Vitest, Tailwind utilities.

---

### Task 1: 先锁定新页面结构的失败测试

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/profile-dashboard.test.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/overview.test.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/__tests__/security-setting.test.ts`

- [ ] 写失败测试，约束三件事：状态卡不再单独展示密码；锚点导航不再出现密码；安全区内出现登录密码子卡并可完成更新密码流程。
- [ ] 运行受影响 Vitest 用例，确认它们先红。

### Task 2: 重排 `/profile` 页面骨架

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/profile-dashboard.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-hero.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-status-cards.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/components/profile-anchor-nav.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/overview.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/index.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/base-setting.vue`

- [ ] 将顶部名片区改成更克制的 admin 风格资料卡，保留主操作并补足核心资料展示。
- [ ] 将状态摘要缩减为“资料 / 安全 / 通知”三张卡。
- [ ] 将锚点导航缩减为“资料 / 安全 / 通知”，并把旧的 `?tab=password` 路由兼容到安全区。
- [ ] 将基本信息区改成更明确的展示优先布局，移除重复的小型个人名片卡。

### Task 3: 合并密码到安全区并完成验证

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/security-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/password-setting.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/_core/profile/notification-setting.vue`

- [ ] 在安全区摘要中增加“登录密码”子卡，并把密码编辑表单嵌入安全区详情，不再作为独立页面区块。
- [ ] 保持通知区在同页底部，继续使用摘要态 + 编辑态。
- [ ] 运行受影响测试、typecheck，并在必要时执行 build 验证。
