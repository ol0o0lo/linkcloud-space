# 管理端单元测试提速与精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除管理端租赁与通知页面的低价值页面级断言，保留关键业务回归覆盖并缩短默认 Vitest 套件的反馈时间。

**Architecture:** 只调整测试源码，不调整产品运行时代码或 Vitest 全局超时。每个重型页面文件仅保留能唯一验证 API 载荷、权限、URL 状态、关键用户操作或错误恢复的路径；纯文案、元素位置、历史文案不存在和相同状态机的重复组合从页面级套件移除。

**Tech Stack:** Vitest 4、Testing Library、React 19、TanStack Query、Ant Design。

---

### Task 1: 精简租赁聚合列表测试

**Files:**
- Modify: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx:1013-6943`
- Test: `frontend_admin/src/pages/rental/__tests__/domain-list-pages.test.tsx`

- [x] **Step 1: 保留每个列表页面的唯一业务路径**

保留小区/楼栋创建和更新、联系人角色与状态更新、房源状态/范围/排序 URL 同步、带看转签约、租约创建与编辑等用例；这些断言覆盖请求载荷、权限或 URL 状态。

- [x] **Step 2: 删除展示性与重复状态用例**

从文件中移除只断言以下类型行为的 `it` 块：头像 fallback、列文案与位置、旧入口不存在、摘要卡和提示文本、已被相同页面操作覆盖的单一字段展示。保留参数化测试来验证不支持排序字段的归一化。

- [x] **Step 3: 运行目标文件**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/rental/__tests__/domain-list-pages.test.tsx --silent`

Expected: 所有保留用例执行结束；记录通过/失败数与耗时，不接受超时掩盖。

### Task 2: 精简房源新建与详情页测试

**Files:**
- Modify: `frontend_admin/src/pages/rental/houses/__tests__/new.test.tsx:150-748`
- Modify: `frontend_admin/src/pages/rental/houses/__tests__/detail.test.tsx:248-1871`
- Test: `frontend_admin/src/pages/rental/houses/__tests__/new.test.tsx`
- Test: `frontend_admin/src/pages/rental/houses/__tests__/detail.test.tsx`

- [x] **Step 1: 保留房源建档的最短关键链路**

保留四步建档提交、来源参数预填、远程楼栋检索、创建房东/楼栋和必填地址校验。删除仅验证向导标题、旧辅助文案和最终摘要排版的用例。

- [x] **Step 2: 保留详情页的请求载荷与工作流操作**

保留字段局部更新、发布/下架、收藏、媒体保存、带看/租约工作流跳转与受限状态；删除只验证资料分组、纯只读字段、标题重复与展示顺序的用例。针对同一编辑抽屉，把同类扩展字段操作合并为一个载荷断言。

- [x] **Step 3: 运行两个目标文件**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/rental/houses/__tests__/new.test.tsx src/pages/rental/houses/__tests__/detail.test.tsx --silent`

Expected: 所有保留用例执行结束；记录通过/失败数与耗时。

### Task 3: 精简通知分发和经营分析页面测试

**Files:**
- Modify: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx:277-712`
- Modify: `frontend_admin/src/pages/rental/analytics/index.test.tsx:208-406`
- Test: `frontend_admin/src/pages/platform-management/notification-dispatches/index.test.tsx`
- Test: `frontend_admin/src/pages/rental/analytics/index.test.tsx`

- [x] **Step 1: 收敛通知分发页面覆盖**

保留租户默认作用域提交、平台指定用户、团队指定团队、非法链接和接收目标重试。移除重复的行详情加载、模态提示文本、关闭重开表单和空间切换动画断言。

- [x] **Step 2: 收敛经营分析展示覆盖**

保留趋势切换、来源筛选、日期范围、URL 分页和单模块失败重试。移除图表实现细节、静态标题、冗余预览内容、无业务副作用的文案检查。

- [x] **Step 3: 运行目标文件**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 >/dev/null && npm exec -- vitest run src/pages/platform-management/notification-dispatches/index.test.tsx src/pages/rental/analytics/index.test.tsx --silent`

Expected: 所有保留用例执行结束；记录通过/失败数与耗时。

### Task 4: 验证精简后的全量套件

**Files:**
- Verify: `frontend_admin/src/**/*.test.{ts,tsx}`

- [x] **Step 1: 执行类型与风格检查**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run lint`

Expected: 新改动不产生 TypeScript 或 Biome 错误。

- [x] **Step 2: 运行完整单测并对比基线**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 >/dev/null && npm test -- --run --silent`

Expected: 记录新的测试文件数、用例数、失败数、墙钟耗时与 Vitest `Duration`，并与 393.23 秒基线比较。
