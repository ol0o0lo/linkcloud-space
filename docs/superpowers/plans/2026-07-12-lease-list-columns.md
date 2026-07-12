# 租约列表字段拆分实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将租约列表的聚合副标题拆分为房源、租客、租期和月租等独立字段，同时保留现有业务操作。

**Architecture:** 仅调整 `LeasesPage` 的展示辅助函数和 ProTable 列定义，复用现有 `LeaseOut` 数据、`LeasePreview`、枚举映射、金额格式化及横向滚动。通过现有页面级 Vitest 测试验证新表头、真实单元格内容和旧聚合副标题消失。

**Tech Stack:** React 19、TypeScript、Ant Design 6、ProComponents、Vitest、Testing Library

---

### Task 1: 用测试定义租约列表新字段

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 将原聚合列测试改为独立字段测试**

将 `keeps the lease list compact with grouped lease information` 测试替换为 `shows lease business details in dedicated columns`，使用包含项目、楼栋、房号、租客手机号、租期、月租和合同文件的租约数据，并断言：

```tsx
expect(await screen.findByRole('columnheader', { name: '房源' })).toBeInTheDocument();
expect(screen.getByRole('columnheader', { name: '租客' })).toBeInTheDocument();
expect(screen.getByRole('columnheader', { name: '租期' })).toBeInTheDocument();
expect(screen.getByRole('columnheader', { name: '月租' })).toBeInTheDocument();
expect(screen.queryByRole('columnheader', { name: '租约信息' })).not.toBeInTheDocument();
expect(screen.getByText('A-101')).toBeInTheDocument();
expect(screen.getByText('星河湾花园 / 1 栋')).toBeInTheDocument();
expect(screen.getByText('王租客')).toBeInTheDocument();
expect(screen.getByText('137****0000')).toBeInTheDocument();
expect(screen.getByText('2026-07-01')).toBeInTheDocument();
expect(screen.getByText('至 2027-06-30')).toBeInTheDocument();
expect(screen.getByText('¥4200.00')).toBeInTheDocument();
expect(screen.getByText('1 份')).toBeInTheDocument();
```

- [ ] **Step 2: 调整依赖旧聚合文本定位行的操作测试**

将 `301 / 王租客`、`302 / 李租客` 的行定位改为通过独立房号 `301`、`302` 定位，保持对编辑按钮、更多操作菜单及状态动作的原有断言。

- [ ] **Step 3: 运行测试并确认因新列尚未实现而失败**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx -t "shows lease business details in dedicated columns|keeps lease status actions inside the row overflow menu"
```

Expected: FAIL，新测试找不到“房源”“租客”“租期”“月租”表头或独立单元格内容。

### Task 2: 实现租约列表字段拆分

**Files:**
- Modify: `frontend_admin/src/pages/property-rental/leases/index.tsx`

- [ ] **Step 1: 将聚合展示辅助函数拆为房源和租客展示数据**

保留 `houseLabel(record)` 的项目、楼栋、房号解析逻辑，返回房号和项目/楼栋辅助文本；新增本地手机号脱敏逻辑，将 `+8613900139033` 或 `13700000000` 的最后 11 位显示为前三位、四个星号、后四位。租客姓名缺失时使用 `联系人 #<id>`，完整缺失时显示 `-`。

- [ ] **Step 2: 替换 ProTable 列定义**

用以下列顺序替换原“租约信息”列：

```text
房源（房号 + 项目/楼栋）
租客（姓名 + 脱敏手机号）
租期（起租日 + 至 到期日）
月租
状态
合同
操作
```

房号继续包裹 `LeasePreview`，弱辅助信息使用 `Typography.Text type="secondary"`；状态、合同和操作列保持现有逻辑。

- [ ] **Step 3: 运行定向测试并确认通过**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx -t "shows lease business details in dedicated columns|keeps lease status actions inside the row overflow menu"
```

Expected: 2 tests PASS。

### Task 3: 回归验证

**Files:**
- Verify: `frontend_admin/src/pages/property-rental/leases/index.tsx`
- Verify: `frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx`

- [ ] **Step 1: 运行租赁领域列表测试文件**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin exec -- vitest run src/pages/property-rental/__tests__/domain-list-pages.test.tsx
```

Expected: 全部测试 PASS。

- [ ] **Step 2: 运行 TypeScript 类型检查**

Run:

```bash
source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm --prefix frontend_admin run tsc
```

Expected: 命令退出码为 0。

- [ ] **Step 3: 检查变更范围和格式问题**

Run:

```bash
git diff --check -- frontend_admin/src/pages/property-rental/leases/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
git diff -- frontend_admin/src/pages/property-rental/leases/index.tsx frontend_admin/src/pages/property-rental/__tests__/domain-list-pages.test.tsx
```

Expected: `git diff --check` 无输出；变更仅涉及租约列表列结构及对应测试。
