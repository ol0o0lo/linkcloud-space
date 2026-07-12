# 实体预览只读跳转 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让实体预览链接进入只读详情承载界面，而不是打开编辑抽屉。

**Architecture:** `EntityPreview` 继续只负责悬停卡片和默认链接；注册表把非房源实体改为带 `preview` 查询参数的列表页。各列表页把 URL 的 `preview` 与既有 `edit` 状态分离：前者打开只读 Drawer，后者保持编辑表单和保存能力。

**Tech Stack:** React 19、Umi Max、Ant Design 6、TanStack Query、Vitest。

---

## 文件结构

- 修改 `frontend_admin/src/components/EntityPreview/registry.ts`：为项目、楼栋、联系人、租约和带看生成只读 URL。
- 修改 `frontend_admin/src/components/EntityPreview/__tests__/EntityPreview.test.tsx`：锁定默认链接不会包含 `edit` 参数。
- 修改 `frontend_admin/src/pages/property-rental/estates/index.tsx`：解析并呈现项目/楼栋只读 Drawer。
- 修改 `frontend_admin/src/pages/property-rental/contacts/index.tsx`、`leases/index.tsx`、`viewings/index.tsx`：分别承载各自的只读详情。
- 修改 `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`：覆盖 `preview` URL 不进入编辑态。

### Task 1: 将预览默认路由改为只读 URL

**Files:**

- Modify: `frontend_admin/src/components/EntityPreview/registry.ts`
- Modify: `frontend_admin/src/components/EntityPreview/__tests__/EntityPreview.test.tsx`

- [ ] **Step 1: 写出默认路由的失败测试**

```tsx
expect(entityPreviewRegistry.estate.getHref(3)).toBe('/property-rental/estates?preview_estate=3');
expect(entityPreviewRegistry.building.getHref(5)).toBe('/property-rental/estates?view=buildings&preview_building=5');
expect(entityPreviewRegistry.contact.getHref(7)).toBe('/property-rental/contacts?preview=7');
expect(entityPreviewRegistry.lease.getHref(11)).toBe('/property-rental/leases?preview=11');
expect(entityPreviewRegistry.viewing.getHref(13)).toBe('/property-rental/viewings?preview=13');
```

- [ ] **Step 2: 运行测试确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/components/EntityPreview/__tests__/EntityPreview.test.tsx`

Expected: FAIL，当前注册表生成 `edit`、`estate_edit` 或 `building_edit` 参数。

- [ ] **Step 3: 最小化修改注册表**

```tsx
estate: { getHref: (id) => `/property-rental/estates?preview_estate=${id}` },
building: { getHref: (id) => `/property-rental/estates?view=buildings&preview_building=${id}` },
contact: { getHref: (id) => `/property-rental/contacts?preview=${id}` },
lease: { getHref: (id) => `/property-rental/leases?preview=${id}` },
viewing: { getHref: (id) => `/property-rental/viewings?preview=${id}` },
```

房源保留 `/property-rental/houses/:id`，因为已有独立详情页。

- [ ] **Step 4: 运行测试确认通过**

运行同一 Vitest 命令；预期 PASS。

### Task 2: 在列表页承载只读详情

**Files:**

- Modify: `frontend_admin/src/pages/property-rental/estates/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/contacts/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/leases/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/viewings/index.tsx`
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 写出失败测试**

以 `?preview_estate=1`、`?view=buildings&preview_building=1` 和各页面的 `?preview=1` 渲染页面，断言打开标题为“项目详情”“楼栋详情”“联系人详情”“租约详情”“带看详情”的 Drawer，且不出现“保存”按钮或编辑表单控件。

- [ ] **Step 2: 运行测试确认失败**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

Expected: FAIL，当前 `preview*` 参数不会打开 Drawer。

- [ ] **Step 3: 最小实现只读 Drawer**

每个页面独立解析、同步和关闭 `preview` 状态，不能复用或覆盖既有 `edit` 参数。只读 Drawer 使用 `Descriptions` 与该页已有格式化函数展示当前实体字段，不渲染 `Form`、保存 mutation 或编辑操作；关闭时仅移除对应 `preview*` 参数。原编辑按钮和 `?edit=` 行为保持不变。

- [ ] **Step 4: 运行测试确认通过**

运行同一领域页面 Vitest 命令；预期 PASS。

### Task 3: 回归验证与提交

**Files:**

- Modify: 上述所有前端文件

- [ ] **Step 1: 运行相关测试**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm exec -- vitest run src/components/EntityPreview/__tests__/EntityPreview.test.tsx src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

Expected: PASS。

- [ ] **Step 2: 运行类型检查与生产构建**

Run: `source ~/.nvm/nvm.sh && nvm use 22 && npm run tsc && npm run build`

Expected: 两个命令均以 exit code 0 结束。

- [ ] **Step 3: 提交**

```bash
git add frontend_admin/src/components/EntityPreview frontend_admin/src/pages/property-rental/estates/index.tsx frontend_admin/src/pages/property-rental/contacts/index.tsx frontend_admin/src/pages/property-rental/leases/index.tsx frontend_admin/src/pages/property-rental/viewings/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git commit -m "feat: 增加实体预览只读详情"
```

提交前确认不暂存用户已有的 `frontend_admin/public/logo.png` 和无关工作区改动。

