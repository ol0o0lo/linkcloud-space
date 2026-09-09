# 小程序三角色业务闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. 本仓库未经授权不得执行 Git 操作，因此不创建 worktree、不暂存、不提交。

**Goal:** 在 `frontend_miniprogram/` 中完成租客、房东和中介三种视角的真实业务入口，使移动端复用管理端的后端接口、权限和状态流转，并排除超级管理员能力。

**Architecture:** 页面只依赖 `features/**`，feature 只依赖 `services/manual/**`，manual adapter 才能依赖生成的 OpenAPI 客户端。主包五个 Tab 只负责当前身份下的摘要和导航，复杂列表、详情和动作放入 `pages-org-rental`、`pages-org-work`、`pages-org-admin` 分包。组织请求统一显式携带当前组织 slug；个人和房东请求绝不携带组织头。

**Tech Stack:** uni-app、Vue 3、TypeScript、Pinia、Wot UI v2、Node test runner、生成 OpenAPI client。

---

### Task 1: 收口模块目录基线

**Files:**
- Modify: `frontend_miniprogram/tests/module-catalog.test.ts`
- Modify: `frontend_miniprogram/tests/module-registry.test.ts`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Verify: `frontend_miniprogram/src/modules/catalog.ts`

- [ ] **Step 1: 保留当前红灯并补充真实分包路由断言**

```ts
assert.deepEqual(getBuildSubpackages('production').map(item => item.root), [
  'pages-housing',
  'pages-personal-rental',
  'pages-landlord',
  'pages-org-rental',
  'pages-org-work',
  'pages-org-admin',
])
assert.equal(APP_ROUTES.organizationRental, '/pages-org-rental/index')
assert.equal(APP_ROUTES.organizationWork, '/pages-org-work/index')
assert.equal(APP_ROUTES.organizationAdmin, '/pages-org-admin/index')
```

- [ ] **Step 2: 运行测试并确认因路由常量或旧期望失败**

Run: `source /Users/lan/.nvm/nvm.sh && nvm use 22 && cd frontend_miniprogram && pnpm test tests/module-catalog.test.ts tests/module-registry.test.ts`

Expected: FAIL，失败点为旧分包/Tab 期望或缺少组织路由常量。

- [ ] **Step 3: 增加组织根路由常量并同步目录期望**

```ts
organizationRental: buildSubpackageRoute('organization-rental', 'index'),
organizationWork: buildSubpackageRoute('organization-work', 'index'),
organizationAdmin: buildSubpackageRoute('organization-admin', 'index'),
```

- [ ] **Step 4: 重跑定向测试**

Expected: PASS。

### Task 2: 实现三种作用域的真实消息中心

**Files:**
- Create: `frontend_miniprogram/src/domain/notifications.ts`
- Create: `frontend_miniprogram/src/services/manual/notifications.ts`
- Create: `frontend_miniprogram/src/features/notifications/service.ts`
- Modify: `frontend_miniprogram/src/pages/messages/index.vue`
- Create: `frontend_miniprogram/src/pages/messages/detail.vue`
- Create: `frontend_miniprogram/src/pages/messages/preferences.vue`
- Modify: `frontend_miniprogram/src/modules/routes.ts`
- Create: `frontend_miniprogram/tests/notifications.test.ts`

- [ ] **Step 1: 写作用域、状态和批量动作失败测试**

```ts
assert.deepEqual(resolveNotificationScope({ mode: 'personal' }), { kind: 'personal' })
assert.deepEqual(resolveNotificationScope({ mode: 'landlord', landlordContactId: 8 }), { kind: 'landlord', landlordContactId: 8 })
assert.deepEqual(resolveNotificationScope({ mode: 'organization', organizationSlug: 'demo' }), { kind: 'organization', organizationSlug: 'demo' })
assert.equal(getNotificationTone(false), 'warning')
assert.equal(getNotificationTone(true), 'default')
```

- [ ] **Step 2: 运行测试并确认缺少领域函数**

Run: `pnpm test tests/notifications.test.ts`

Expected: FAIL with module/function not found。

- [ ] **Step 3: 实现最小领域规则和 manual adapter**

```ts
export function notificationOptions(scope: RequestScope) {
  return { requestScope: scope, authRetry: 'safe' as const }
}
```

适配通知列表、详情、单条已读/未读、批量已读、删除、未读数、偏好读取和偏好更新。

- [ ] **Step 4: 实现列表、详情和偏好页面**

列表支持当前身份标题、已读筛选、下拉刷新、触底分页、全部已读；详情打开后沿用后端接口标记已读；偏好页使用 `wd-switch` 更新站内/邮件开关。

- [ ] **Step 5: 重跑消息测试和类型检查**

Run: `pnpm test tests/notifications.test.ts && pnpm type-check`

Expected: PASS。

### Task 3: 实现组织经营分包

**Files:**
- Create: `frontend_miniprogram/src/domain/organization-rental.ts`
- Create: `frontend_miniprogram/src/services/manual/organization-rental.ts`
- Create: `frontend_miniprogram/src/features/organization-rental/service.ts`
- Create: `frontend_miniprogram/src/pages-org-rental/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/houses/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/houses/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/estates/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/buildings/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/map/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/vacancy-sync/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/contacts/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/viewings/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/viewings/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/leases/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/leases/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/signing/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/allocation/index.vue`
- Create: `frontend_miniprogram/src/pages-org-rental/analytics/index.vue`
- Create: `frontend_miniprogram/tests/organization-rental.test.ts`

- [ ] **Step 1: 写组织请求与状态动作失败测试**

```ts
assert.deepEqual(buildOrganizationScope('demo'), { kind: 'organization', organizationSlug: 'demo' })
assert.deepEqual(getViewingActions('scheduled').map(item => item.value), ['viewed', 'canceled', 'no_show', 'converted'])
assert.deepEqual(getViewingActions('converted'), [])
assert.equal(canOpenOrganizationCapability({ allocation: false }, 'allocation'), false)
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `pnpm test tests/organization-rental.test.ts`

Expected: FAIL with missing module/functions。

- [ ] **Step 3: 实现组织经营 adapter 和 feature service**

复用 `guanli.ts` 的房源、小区、楼栋、地图、联系人、带看、租约、登记签约和房表同步接口，复用 `shouyifenpei.ts` 与 `jingyingfenxi.ts`；所有调用显式传入组织 scope。

- [ ] **Step 4: 实现移动端页面**

列表使用分页和状态筛选；详情显示后端映射值；带看只展示后端允许的状态动作；登记签约使用后端现有输入结构；收益和分析按导航能力裁剪，无权限不展示入口。

- [ ] **Step 5: 重跑领域测试、架构边界和类型检查**

Run: `pnpm test tests/organization-rental.test.ts tests/architecture-boundaries.test.ts && pnpm type-check`

Expected: PASS。

### Task 4: 实现组织协作分包

**Files:**
- Create: `frontend_miniprogram/src/domain/organization-work.ts`
- Create: `frontend_miniprogram/src/services/manual/organization-work.ts`
- Create: `frontend_miniprogram/src/features/organization-work/service.ts`
- Create: `frontend_miniprogram/src/pages-org-work/index.vue`
- Create: `frontend_miniprogram/src/pages-org-work/tasks/index.vue`
- Create: `frontend_miniprogram/src/pages-org-work/tasks/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-work/announcements/index.vue`
- Create: `frontend_miniprogram/src/pages-org-work/announcements/detail.vue`
- Create: `frontend_miniprogram/tests/organization-work.test.ts`

- [ ] **Step 1: 写任务动作和公告状态失败测试**

```ts
assert.deepEqual(getAssignmentActions('pending'), ['accept', 'reject'])
assert.deepEqual(getAssignmentActions('accepted'), ['complete'])
assert.deepEqual(getAssignmentActions('completed'), [])
assert.equal(needsAnnouncementAcknowledge({ acknowledged_at: null }), true)
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `pnpm test tests/organization-work.test.ts`

Expected: FAIL with missing module/functions。

- [ ] **Step 3: 接入日常工作台、任务和公告接口**

读取 dashboard、任务摘要、分配摘要、本人分配列表、公告列表与详情；接受、完成、拒绝、取消和确认公告均直接复用后端命令。

- [ ] **Step 4: 实现页面与动作反馈**

工作台提供摘要和快捷入口；任务详情仅按当前状态展示可执行动作；公告详情只在未确认时展示确认按钮。

- [ ] **Step 5: 重跑定向测试和类型检查**

Run: `pnpm test tests/organization-work.test.ts tests/architecture-boundaries.test.ts && pnpm type-check`

Expected: PASS。

### Task 5: 实现组织管理分包

**Files:**
- Create: `frontend_miniprogram/src/domain/organization-admin.ts`
- Create: `frontend_miniprogram/src/services/manual/organization-admin.ts`
- Create: `frontend_miniprogram/src/features/organization-admin/service.ts`
- Create: `frontend_miniprogram/src/pages-org-admin/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/members/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/members/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/invitations/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/teams/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/teams/detail.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/roles/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/responsibilities/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/settings/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/subscription/index.vue`
- Create: `frontend_miniprogram/src/pages-org-admin/notification-dispatches/index.vue`
- Create: `frontend_miniprogram/tests/organization-admin.test.ts`

- [ ] **Step 1: 写能力裁剪和管理入口失败测试**

```ts
assert.deepEqual(getOrganizationAdminSections({ role_management: true, subscriptions: false }).map(item => item.key), ['members', 'teams', 'roles', 'responsibilities', 'settings'])
assert.equal(canManageTeam({ team_update_ids: [2] }, 2), true)
assert.equal(canManageTeam({ team_update_ids: [2] }, 3), false)
```

- [ ] **Step 2: 运行测试确认红灯**

Run: `pnpm test tests/organization-admin.test.ts`

Expected: FAIL with missing module/functions。

- [ ] **Step 3: 接入组织架构与管理接口**

成员、邀请、团队、角色、绑定、职责、组织/团队设置、订阅订单与发票、通知分发全部经 manual adapter 使用组织 scope；超级管理员生成接口不得导入。

- [ ] **Step 4: 实现页面和安全动作**

按 `/api/access/navigation/` 与组织工作台能力隐藏入口；删除、取消、重新发送、角色解绑等动作二次确认；复杂编辑使用整页或弹层表单并沿用服务端字段错误。

- [ ] **Step 5: 重跑定向测试和类型检查**

Run: `pnpm test tests/organization-admin.test.ts tests/architecture-boundaries.test.ts && pnpm type-check`

Expected: PASS。

### Task 6: 替换组织 Tab 占位并更新能力矩阵

**Files:**
- Modify: `frontend_miniprogram/src/pages/index/index.vue`
- Modify: `frontend_miniprogram/src/pages/houses/index.vue`
- Modify: `frontend_miniprogram/src/pages/favorites/index.vue`
- Modify: `frontend_miniprogram/src/pages/messages/index.vue`
- Modify: `frontend_miniprogram/src/pages/me/me.vue`
- Modify: `frontend_miniprogram/src/pages.json`
- Modify: `docs/miniprogram-capability-matrix.md`

- [ ] **Step 1: 添加页面清单和无占位内容断言**

```ts
assert.equal(source.includes('归入租赁经营分包'), false)
assert.equal(source.includes('敬请期待'), false)
```

- [ ] **Step 2: 运行测试确认当前组织 Tab 仍为占位**

Run: `pnpm test tests/module-catalog.test.ts tests/module-registry.test.ts`

Expected: FAIL at placeholder/page manifest assertions。

- [ ] **Step 3: 将五个 Tab 接到真实摘要和分包入口**

工作台读取日常摘要；业务进入组织经营首页；待办读取本人任务和公告摘要；消息使用真实通知；我的展示有权组织管理入口和个人共用能力。

- [ ] **Step 4: 更新能力矩阵**

逐项记录管理端页面、移动端入口、后端接口、权限、静态检查、H5 浏览器、微信开发者工具和真机状态；无法完成的真实环境验收明确标为未验证。

### Task 7: 全量验证

**Files:**
- Verify only

- [ ] **Step 1: 小程序完整静态检查**

```bash
source /Users/lan/.nvm/nvm.sh
nvm use 22
cd frontend_miniprogram
pnpm lint
pnpm type-check
pnpm test
```

- [ ] **Step 2: H5 与微信生产构建**

```bash
pnpm build:h5:prod
pnpm build:mp:prod
```

- [ ] **Step 3: 回跑租客后端测试**

Run: `docker compose exec web pytest tests/house/test_tenant_portal.py -q`

Expected: 13 passed。

- [ ] **Step 4: 记录验证边界**

只有实际跑过的检查才标记通过；浏览器、微信开发者工具和真机未执行时必须明确标记未验证。
