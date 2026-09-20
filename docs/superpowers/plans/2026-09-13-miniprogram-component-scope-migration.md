# 小程序组件作用域迁移 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将小程序公共组件迁入 `src/components/`，将分包专属组件、接口适配和领域规则迁入所属分包，并保持现有页面行为不变。

**Architecture:** 组件按实际可见范围归属：跨主包模块或跨分包复用的组件进入 `src/components/`，分包与页面模块专属组件就近放置。组织租赁通过 `pages-org-rental/api/organization-rental.ts` 暴露稳定请求接口，`client.ts` 作为内部 OpenAPI 适配实现；生成的 OpenAPI client 保持原位。

**Tech Stack:** uni-app、Vue 3、TypeScript、Wot UI v2、pnpm、Node.js test runner、vue-tsc、ESLint

**Project constraint:** 本计划不执行 Git 命令，不修改多语言文件、`package.json` 或锁文件。

---

## 文件结构

新增或迁入：

```text
frontend_miniprogram/src/
├── components/
│   ├── app/                              # App* 公共组件
│   └── house/                            # 跨包房源组件
├── pages/me/components/
│   └── AppModeSwitcher.vue               # 我的页面专属
└── pages-org-rental/
    ├── api/
    │   ├── organization-rental.ts        # 页面使用的稳定请求接口
    │   └── client.ts                     # OpenAPI、HTTP、上传内部适配
    ├── domain/
    │   └── organization-rental.ts
    ├── components/
    │   ├── AppActionSheetRow.vue
    │   ├── AppEntityPickerSheet.vue
    │   └── AppFormPage.vue
    ├── buildings/components/BuildingCard.vue
    ├── estates/components/EstateCard.vue
    ├── houses/components/OrganizationHouseCard.vue
    ├── leases/components/OrganizationLeaseCard.vue
    └── viewings/components/OrganizationViewingCard.vue
```

旧 `shared/components/` 下全部 Vue 文件均迁出，不保留第二套组件归属目录。`AppBottomAction.vue` 与 `AppListState.vue` 一并迁入 `components/app/`，但不扩展功能。

### Task 1: 用边界测试固定新目录规则

**Files:**
- Modify: `frontend_miniprogram/tests/architecture-boundaries.test.ts`
- Modify: `frontend_miniprogram/tests/organization-rental.test.ts`
- Modify: `frontend_miniprogram/tests/tenant-rental.test.ts`
- Modify: `frontend_miniprogram/tests/custom-navigation-layout.test.ts`
- Modify: `frontend_miniprogram/tests/module-catalog.test.ts`
- Modify: `frontend_miniprogram/tests/module-registry.test.ts`

- [x] **Step 1: 更新组件路径断言**

将测试中的旧路径替换为新路径：

```ts
src/shared/components/AppBottomSheet.vue
  -> src/components/app/AppBottomSheet.vue

src/shared/components/AppCustomNavigation.vue
  -> src/components/app/AppCustomNavigation.vue

src/shared/components/AppLoginGuide.vue
  -> src/components/app/AppLoginGuide.vue

src/shared/components/AppPage.vue
  -> src/components/app/AppPage.vue
```

- [x] **Step 2: 更新组织租赁模块测试路径**

统一使用：

```ts
const apiPath = join(sourceRoot, 'pages-org-rental/api/organization-rental.ts')
const clientPath = join(sourceRoot, 'pages-org-rental/api/client.ts')
const domainPath = join(sourceRoot, 'pages-org-rental/domain/organization-rental.ts')
```

测试中的动态导入改为：

```ts
await import('../src/pages-org-rental/domain/organization-rental.ts')
```

接口依赖断言改为：

```ts
assert.equal(apiSource.includes('./client'), true)
assert.equal(clientSource.includes('@/services/openapi/guanli'), true)
assert.equal(clientSource.includes('@/services/openapi/shouyifenpei'), true)
assert.equal(clientSource.includes('@/services/openapi/jingyingfenxi'), true)
```

- [x] **Step 3: 调整 OpenAPI 边界测试**

页面、组件和 feature 仍禁止直接依赖生成目录，但 `pages-*/api/` 是允许的接口适配 seam：

```ts
const applicationFiles = [
  ...sourceFiles(join(sourceRoot, 'pages')),
  ...sourceFiles(join(sourceRoot, 'pages-housing')),
  ...sourceFiles(join(sourceRoot, 'pages-org-rental')),
  ...sourceFiles(join(sourceRoot, 'pages-org-work')),
  ...sourceFiles(join(sourceRoot, 'pages-org-admin')),
  ...sourceFiles(join(sourceRoot, 'features')),
].filter(path => !path.includes('/api/'))

const violations = applicationFiles.filter(path => readFileSync(path, 'utf8').includes('@/services/openapi'))
assert.deepEqual(violations, [])
```

增加组件和分包依赖规则：

```ts
test('全局组件不依赖分包且分包之间不互相引用', () => {
  const globalComponents = sourceFiles(join(sourceRoot, 'components'))
  const globalViolations = globalComponents.filter(path => /@\/pages-[^/]+\//.test(readFileSync(path, 'utf8')))
  assert.deepEqual(globalViolations, [])

  const subpackageRoots = ['pages-housing', 'pages-personal-rental', 'pages-landlord', 'pages-org-rental', 'pages-org-work', 'pages-org-admin']
  for (const root of subpackageRoots) {
    const files = sourceFiles(join(sourceRoot, root))
    const otherRoots = subpackageRoots.filter(candidate => candidate !== root)
    const violations = files.filter(path => otherRoots.some(candidate => readFileSync(path, 'utf8').includes(`@/${candidate}/`)))
    assert.deepEqual(violations, [], `${root} 不得引用其他分包`)
  }
})
```

- [x] **Step 4: 运行测试并确认新路径尚未实现时失败**

Run:

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm test
```

Expected: FAIL，失败原因是新的组件、组织租赁 API 或 domain 路径尚不存在。

### Task 2: 迁移全局公共组件

**Files:**
- Move: `frontend_miniprogram/src/shared/components/App*.vue` 中除 `AppModeSwitcher.vue`、`AppActionSheetRow.vue`、`AppEntityPickerSheet.vue`、`AppFormPage.vue` 外的文件到 `frontend_miniprogram/src/components/app/`
- Move: `frontend_miniprogram/src/shared/components/HouseDetailNavigation.vue` to `frontend_miniprogram/src/components/house/HouseDetailNavigation.vue`
- Move: `frontend_miniprogram/src/shared/components/HouseMediaGallery.vue` to `frontend_miniprogram/src/components/house/HouseMediaGallery.vue`
- Move: `frontend_miniprogram/src/features/houses/components/HouseCard.vue` to `frontend_miniprogram/src/components/house/HouseCard.vue`
- Modify: all imports under `frontend_miniprogram/src/`

- [x] **Step 1: 创建目标目录并迁移公共组件**

公共 App 组件清单：

```text
AppActionBar.vue
AppAsyncContent.vue
AppBottomAction.vue
AppBottomSheet.vue
AppCustomNavigation.vue
AppDetailPage.vue
AppEmpty.vue
AppEntityPickerOption.vue
AppErrorView.vue
AppListState.vue
AppListToolbar.vue
AppLoading.vue
AppLoginGuide.vue
AppPage.vue
AppPagedList.vue
AppRecordCard.vue
AppSection.vue
AppStateCard.vue
AppStatusTag.vue
```

- [x] **Step 2: 修正公共组件内部依赖**

`components/house/HouseCard.vue` 使用绝对路径导入公共房源 service：

```ts
import type { PublicHouseListOut } from '@/features/houses/service'
```

`components/app/AppListState.vue` 内部的反馈组件继续使用同目录相对导入，不改变其接口。

- [x] **Step 3: 批量替换公共组件导入**

所有调用方按类别改为：

```ts
import AppPage from '@/components/app/AppPage.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import HouseDetailNavigation from '@/components/house/HouseDetailNavigation.vue'
import HouseMediaGallery from '@/components/house/HouseMediaGallery.vue'
```

完成后以下搜索必须无结果：

```bash
rg "@/shared/components|@/features/houses/components/HouseCard" src
```

Expected: 无匹配。

- [x] **Step 4: 运行公共组件相关测试**

Run:

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm test -- tests/custom-navigation-layout.test.ts tests/module-catalog.test.ts tests/module-registry.test.ts tests/tenant-rental.test.ts
```

Expected: PASS。

### Task 3: 迁移页面和组织租赁分包专属组件

**Files:**
- Move: `frontend_miniprogram/src/shared/components/AppModeSwitcher.vue` to `frontend_miniprogram/src/pages/me/components/AppModeSwitcher.vue`
- Move: `frontend_miniprogram/src/shared/components/AppActionSheetRow.vue` to `frontend_miniprogram/src/pages-org-rental/components/AppActionSheetRow.vue`
- Move: `frontend_miniprogram/src/shared/components/AppEntityPickerSheet.vue` to `frontend_miniprogram/src/pages-org-rental/components/AppEntityPickerSheet.vue`
- Move: `frontend_miniprogram/src/shared/components/AppFormPage.vue` to `frontend_miniprogram/src/pages-org-rental/components/AppFormPage.vue`
- Move: five files under `frontend_miniprogram/src/features/organization-rental/components/` into their owning page modules
- Modify: owning pages and moved components

- [x] **Step 1: 迁移主包单页面组件**

`pages/me/me.vue` 改为：

```ts
import AppModeSwitcher from './components/AppModeSwitcher.vue'
```

`pages/me/components/AppModeSwitcher.vue` 改为：

```ts
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
```

- [x] **Step 2: 迁移分包级组件**

组织租赁表单页面统一导入：

```ts
import AppEntityPickerSheet from '@/pages-org-rental/components/AppEntityPickerSheet.vue'
import AppFormPage from '@/pages-org-rental/components/AppFormPage.vue'
```

房源详情页导入：

```ts
import AppActionSheetRow from '@/pages-org-rental/components/AppActionSheetRow.vue'
```

移动后的 `AppEntityPickerSheet.vue` 和 `AppFormPage.vue` 必须从 `@/components/app/` 导入公共依赖，不使用原目录相对路径。

- [x] **Step 3: 迁移业务模块卡片**

调用方改为：

```ts
import BuildingCard from './components/BuildingCard.vue'
import EstateCard from './components/EstateCard.vue'
import OrganizationHouseCard from './components/OrganizationHouseCard.vue'
import OrganizationLeaseCard from './components/OrganizationLeaseCard.vue'
import OrganizationViewingCard from './components/OrganizationViewingCard.vue'
```

卡片内部公共组件导入统一为：

```ts
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
```

- [x] **Step 4: 验证组件目录已经收口**

Run:

```bash
rg "@/shared/components|@/features/organization-rental/components" frontend_miniprogram/src frontend_miniprogram/tests
```

Expected: 无匹配。

### Task 4: 迁移组织租赁 API 和领域代码

**Files:**
- Move: `frontend_miniprogram/src/features/organization-rental/service.ts` to `frontend_miniprogram/src/pages-org-rental/api/organization-rental.ts`
- Move: `frontend_miniprogram/src/services/manual/organization-rental.ts` to `frontend_miniprogram/src/pages-org-rental/api/client.ts`
- Move: `frontend_miniprogram/src/domain/organization-rental.ts` to `frontend_miniprogram/src/pages-org-rental/domain/organization-rental.ts`
- Modify: all organization-rental pages and moved cards
- Modify: `frontend_miniprogram/tests/organization-rental.test.ts`
- Modify: `frontend_miniprogram/tests/architecture-boundaries.test.ts`

- [x] **Step 1: 迁移 domain 并更新引用**

所有组织租赁分包内部导入改为：

```ts
import { /* ... */ } from '@/pages-org-rental/domain/organization-rental'
```

测试动态导入和源码路径同步更新。

- [x] **Step 2: 迁移内部接口 client**

`pages-org-rental/api/client.ts` 保留对生成代码、HTTP 和上传模块的调用，并更新 domain 导入：

```ts
import { buildOrganizationScope } from '@/pages-org-rental/domain/organization-rental'
```

- [x] **Step 3: 迁移页面请求接口**

`pages-org-rental/api/organization-rental.ts` 将内部依赖改为：

```ts
import type { /* existing types */ } from './client'
import { /* existing request functions */ } from './client'
export { HouseStatus } from './client'
export type { /* existing exported types */ } from './client'
```

所有组织租赁页面和组件统一从以下接口导入：

```ts
import type { HouseOut } from '@/pages-org-rental/api/organization-rental'
import { listOrganizationHouses } from '@/pages-org-rental/api/organization-rental'
```

- [x] **Step 4: 更新测试对模块职责的断言**

测试确认：

```ts
assert.equal(apiSource.includes('@/services/openapi'), false)
assert.equal(apiSource.includes('./client'), true)
assert.equal(clientSource.includes('@/services/openapi/guanli'), true)
assert.equal(clientSource.includes('buildOrganizationScope'), true)
```

- [x] **Step 5: 运行组织租赁和架构测试**

Run:

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm test -- tests/organization-rental.test.ts tests/architecture-boundaries.test.ts
```

Expected: PASS。

### Task 5: 完整验证和残留检查

**Files:**
- Verify: `frontend_miniprogram/src/`
- Verify: `frontend_miniprogram/tests/`
- Verify: `docs/superpowers/specs/2026-09-12-miniprogram-layered-componentization-design.md`

- [x] **Step 1: 检查旧路径残留**

Run:

```bash
rg "@/shared/components|@/features/organization-rental|@/services/manual/organization-rental|@/domain/organization-rental" frontend_miniprogram/src frontend_miniprogram/tests
```

Expected: 无匹配。

- [x] **Step 2: 检查所有组件实际位置**

Run:

```bash
find frontend_miniprogram/src/shared/components frontend_miniprogram/src/components frontend_miniprogram/src/pages frontend_miniprogram/src/pages-* -path '*/components/*.vue' -o -path '*/components/*/*.vue'
```

Expected: `shared/components` 不再包含 Vue 文件；全局和局部组件均位于对应 `components/`。

- [x] **Step 3: 执行 Wot UI 规则检查**

通过已配置的 Wot UI v2 MCP 对 `frontend_miniprogram` 执行 lint。

Expected: 不新增 Wot UI 相关问题。

- [x] **Step 4: 执行完整前端验证**

Run:

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm lint
pnpm type-check
pnpm test
pnpm build:h5:prod
pnpm build:mp:prod
```

Expected: 全部命令退出码为 0。

- [x] **Step 5: 核对非目标文件**

确认未修改：

```text
frontend_miniprogram/src/locale/*
frontend_miniprogram/package.json
frontend_miniprogram/pnpm-lock.yaml
frontend_miniprogram/src/services/openapi/*
```

## Task 7: 取消 shared 兜底目录

- [x] **Step 1: 公共基础能力按职责归位**

```text
src/shared/composables/*  → src/hooks/*
src/shared/navigation/*   → src/navigation/*
src/shared/pagination/*   → src/utils/pagination/*
src/shared/theme/*        → src/style/theme/*
```

- [x] **Step 2: 更新源码、测试与架构约束**

所有旧导入切换到职责目录，并由 `module-catalog.test.ts` 保证 `src/shared` 不再承载源码、源码不再导入 `shared`。

- [x] **Step 3: 执行完整前端验证**

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm verify
```

## Task 8: 导航能力归入 hooks 与 utils

- [x] **Step 1: 保持导航组件和响应式 Hook 的明确归属**

```text
src/components/app/AppCustomNavigation.vue
src/components/house/HouseDetailNavigation.vue
src/hooks/useNavigationScrollState.ts
```

- [x] **Step 2: 合并导航纯函数**

将原 `src/navigation/layout.ts` 和 `src/navigation/scroll.ts` 合并为 `src/utils/navigation.ts`，统一提供布局计算、滚动阈值、透明度计算和相关类型。

- [x] **Step 3: 更新引用并执行完整前端验证**

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm verify
```

## Task 9: 组件表现层工具归入 components/utils

- [x] **Step 1: 移动导航纯函数**

```text
src/utils/navigation.ts → src/components/utils/navigation.ts
```

- [x] **Step 2: 保持 Hook 与组件边界**

`useNavigationScrollState.ts` 继续放在 `src/hooks/`，组件和 Hook 统一依赖 `src/components/utils/navigation.ts`；不新增 `components/navigation/` 目录。

- [x] **Step 3: 更新架构约束并执行完整验证**

```bash
cd frontend_miniprogram
source /Users/lan/.nvm/nvm.sh && nvm use 22
pnpm verify
```
