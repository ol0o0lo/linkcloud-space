# Admin Wallet Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `frontend_admin` 补齐钱包运营后台最小闭环，让超级管理员能查看钱包账户、查看流水、调账、审核提现、发起微信提现和重试失败提现。

**Architecture:** 保持现有 `frontend_admin` 的分层习惯：接口封装放在 `src/api/django/`，后台页面放在 `src/views/admin/`，菜单挂在 `src/router/routes/modules/admin.ts`。页面内部只保留拉数、提交和弹窗状态，状态标签、统计卡片和按钮可见性抽成纯函数到共享工具文件，方便 Vitest 覆盖。

**Tech Stack:** Vue 3, TypeScript, antdv-next, vue-router, existing `djangoGet/djangoPost` client, Vitest, pnpm workspace, Django wallet admin APIs.

---

## Scope

本计划覆盖：

- `frontend_admin` 新增“钱包账户”“提现审核”两个后台页面
- 钱包 API client、类型定义、分页处理
- 钱包账户列表、流水抽屉、调账弹窗
- 提现列表、状态标签、审核/驳回/发起微信提现/失败重试动作
- 钱包菜单路由接入
- 共享展示逻辑与 Vitest 测试

本计划不覆盖：

- 主站 `frontend` 钱包页面
- 钱包图表、报表导出、批量操作
- 真实微信提现请求调试工具
- 后端钱包接口变更

## File Structure

- Create: `frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts`
  - Responsibility: 钱包账户、流水、提现、调账、审核、打款、重试的类型和 API 封装。
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts`
  - Responsibility: 钱包统计卡片、状态标签、操作按钮可见性等纯函数。
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue`
  - Responsibility: 钱包账户页，包含账户表格、流水抽屉、调账弹窗。
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue`
  - Responsibility: 提现审核页，包含状态筛选、审核/驳回/打款/重试。
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts`
  - Responsibility: 共享纯函数测试，验证状态标签、统计和按钮可见性。
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`
  - Responsibility: 新增 `AdminWalletAccounts`、`AdminWalletWithdrawals` 菜单路由。

## Verification Commands

从仓库根目录执行：

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
pnpm --dir frontend_admin/apps/web-antdv-next typecheck
```

Expected result:

- `wallet-shared.test.ts` 通过，覆盖状态标签、统计值和按钮可见性。
- `typecheck` 通过，没有新的 TS 类型错误。

---

### Task 1: 新增钱包 API client 与类型定义

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts`

- [ ] **Step 1: 写失败测试，先锁定共享状态需要的输入类型**

在 `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts` 先放入最小类型依赖：

```ts
import { describe, expect, it } from 'vitest';

import type { WalletAccountRow, WithdrawalRow } from '#/api/django/wallet';
import { buildWalletAccountStats, buildWalletWithdrawalStats } from '../wallet-shared';

describe('wallet-shared', () => {
  it('汇总钱包账户统计', () => {
    const rows: WalletAccountRow[] = [
      { available_balance: 1000, frozen_balance: 200, id: 1, total_income: 3000, total_withdrawn: 800, user_id: 11, user_label: 'u1' },
      { available_balance: 500, frozen_balance: 100, id: 2, total_income: 1800, total_withdrawn: 200, user_id: 12, user_label: 'u2' },
    ];

    const stats = buildWalletAccountStats(rows);

    expect(stats.map((item) => item.value)).toEqual([2, 1500, 300, 1000]);
  });

  it('汇总提现统计', () => {
    const rows: WithdrawalRow[] = [
      { amount: 1000, created_at: '', fee_amount: 100, id: 1, net_amount: 900, pay_channel: 'wechat', reject_reason: '', reviewed_at: null, status: 'pending_review', user_id: 11, user_label: 'u1' },
      { amount: 800, created_at: '', fee_amount: 80, id: 2, net_amount: 720, pay_channel: 'wechat', reject_reason: '', reviewed_at: null, status: 'failed', user_id: 12, user_label: 'u2' },
    ];

    const stats = buildWalletWithdrawalStats(rows);

    expect(stats.map((item) => item.value)).toEqual([2, 1, 0, 1]);
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- FAIL with module not found for `#/api/django/wallet` or `wallet-shared`.

- [ ] **Step 3: 新建钱包 API client 与类型定义**

创建 `frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts`：

```ts
import { djangoGet, djangoPost } from './client';

interface PaginatedResponse<T> {
  items: T[];
  page: number;
  page_size: number;
  total: number;
}

export interface WalletAccountRow {
  available_balance: number;
  frozen_balance: number;
  id: number;
  total_income: number;
  total_withdrawn: number;
  user_id: number;
  user_label?: string;
}

export interface WalletLedgerRow {
  amount_delta: number;
  available_balance_after: number;
  biz_id: string;
  biz_type: string;
  created_at: string;
  entry_type: string;
  frozen_balance_after: number;
  id: number;
  remark: string;
}

export interface WithdrawalRow {
  amount: number;
  created_at: string;
  fee_amount: number;
  id: number;
  net_amount: number;
  pay_channel: string;
  reject_reason: string;
  reviewed_at: null | string;
  status: string;
  user_id?: number;
  user_label?: string;
}

export interface WalletAdjustmentPayload {
  amount: number;
  idempotency_key: string;
  remark: string;
  user_id: number;
}

export interface WalletReviewPayload {
  approved: boolean;
  idempotency_key: string;
  reason: string;
}

export interface WalletPayoutPayload {
  idempotency_key: string;
  out_trade_no: string;
  provider: 'wechat';
  request_payload: Record<string, unknown>;
}

export const listWalletAccountsApi = (params: Record<string, string | number> = {}) =>
  djangoGet<PaginatedResponse<WalletAccountRow>>('/admin/wallet/accounts/', params);

export const getWalletLedgerApi = (userId: number, params: Record<string, string | number> = {}) =>
  djangoGet<PaginatedResponse<WalletLedgerRow>>(`/admin/wallet/accounts/${userId}/ledger/`, params);

export const createWalletAdjustmentApi = (payload: WalletAdjustmentPayload) =>
  djangoPost<WalletLedgerRow>('/admin/wallet/adjustments/', payload);

export const listWalletWithdrawalsApi = (params: Record<string, string | number> = {}) =>
  djangoGet<PaginatedResponse<WithdrawalRow>>('/admin/wallet/withdrawals/', params);

export const reviewWalletWithdrawalApi = (withdrawalId: number, payload: WalletReviewPayload) =>
  djangoPost<WithdrawalRow>(`/admin/wallet/withdrawals/${withdrawalId}/review/`, payload);

export const payoutWalletWithdrawalApi = (withdrawalId: number, payload: WalletPayoutPayload) =>
  djangoPost(`/admin/wallet/withdrawals/${withdrawalId}/payout/`, payload);

export const retryWalletWithdrawalApi = (withdrawalId: number, payload: WalletPayoutPayload) =>
  djangoPost(`/internal/wallet/withdrawals/${withdrawalId}/retry/`, payload);
```

- [ ] **Step 4: 运行测试确认类型可被消费**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- FAIL only on missing `wallet-shared` exports, not on API types.

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts
git commit -m "新增钱包后台API封装"
```


### Task 2: 提取钱包后台共享展示逻辑并补测试

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts`

- [ ] **Step 1: 扩充失败测试，锁定状态标签和操作按钮逻辑**

在 `wallet-shared.test.ts` 追加：

```ts
import { describe, expect, it } from 'vitest';

import { buildWalletAccountStats, buildWalletWithdrawalStats, getWalletWithdrawalActions, getWalletWithdrawalStatusMeta } from '../wallet-shared';

it('正确映射提现状态标签', () => {
  expect(getWalletWithdrawalStatusMeta('pending_review')).toEqual({ color: 'gold', text: '待审核' });
  expect(getWalletWithdrawalStatusMeta('approved')).toEqual({ color: 'blue', text: '待打款' });
  expect(getWalletWithdrawalStatusMeta('failed')).toEqual({ color: 'red', text: '打款失败' });
});

it('只在允许状态返回可操作按钮', () => {
  expect(getWalletWithdrawalActions('pending_review')).toEqual(['approve', 'reject']);
  expect(getWalletWithdrawalActions('approved')).toEqual(['payout']);
  expect(getWalletWithdrawalActions('failed')).toEqual(['retry']);
  expect(getWalletWithdrawalActions('paid')).toEqual([]);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- FAIL with missing `wallet-shared.ts` exports.

- [ ] **Step 3: 新建共享纯函数文件**

创建 `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts`：

```ts
import type { WalletAccountRow, WithdrawalRow } from '#/api/django/wallet';

export function buildWalletAccountStats(rows: WalletAccountRow[]) {
  return [
    { key: 'accounts', label: '钱包账户数', value: rows.length },
    { key: 'available', label: '可用余额', value: rows.reduce((sum, item) => sum + item.available_balance, 0) },
    { key: 'frozen', label: '冻结余额', value: rows.reduce((sum, item) => sum + item.frozen_balance, 0) },
    { key: 'withdrawn', label: '累计提现', value: rows.reduce((sum, item) => sum + item.total_withdrawn, 0) },
  ];
}

export function buildWalletWithdrawalStats(rows: WithdrawalRow[]) {
  return [
    { key: 'total', label: '全部提现', value: rows.length },
    { key: 'pending', label: '待审核', value: rows.filter((item) => item.status === 'pending_review').length },
    { key: 'paying', label: '打款中', value: rows.filter((item) => item.status === 'paying').length },
    { key: 'failed', label: '失败', value: rows.filter((item) => item.status === 'failed').length },
  ];
}

export function getWalletWithdrawalStatusMeta(status: string) {
  switch (status) {
    case 'pending_review':
      return { color: 'gold', text: '待审核' };
    case 'approved':
      return { color: 'blue', text: '待打款' };
    case 'paying':
      return { color: 'processing', text: '打款中' };
    case 'paid':
      return { color: 'green', text: '已打款' };
    case 'failed':
      return { color: 'red', text: '打款失败' };
    case 'rejected':
      return { color: 'default', text: '已驳回' };
    case 'cancelled':
      return { color: 'default', text: '已撤销' };
    default:
      return { color: 'default', text: status };
  }
}

export function getWalletWithdrawalActions(status: string) {
  if (status === 'pending_review') return ['approve', 'reject'];
  if (status === 'approved') return ['payout'];
  if (status === 'failed') return ['retry'];
  return [];
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- PASS, 状态标签、统计和按钮可见性测试全部通过。

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts
git commit -m "提取钱包后台共享展示逻辑"
```


### Task 3: 实现钱包账户页与菜单入口

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts`

- [ ] **Step 1: 写失败测试，先锁定菜单路由存在**

在 `wallet-shared.test.ts` 追加：

```ts
import adminRoutes from '#/router/routes/modules/admin';

it('后台管理菜单包含钱包账户和提现审核入口', () => {
  const admin = adminRoutes[0];
  const names = admin.children?.map((item) => item.name);
  expect(names).toContain('AdminWalletAccounts');
  expect(names).toContain('AdminWalletWithdrawals');
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- FAIL because the admin route module does not yet contain wallet routes.

- [ ] **Step 3: 新增钱包账户路由**

修改 `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`，在 `推广管理` 后追加：

```ts
      {
        component: () => import('#/views/admin/wallet-accounts.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:wallet',
          title: '钱包账户',
        },
        name: 'AdminWalletAccounts',
        path: '/admin/wallet/accounts',
      },
      {
        component: () => import('#/views/admin/wallet-withdrawals.vue'),
        meta: {
          authority: ['admin', 'super'],
          icon: 'lucide:arrow-right-left',
          title: '提现审核',
        },
        name: 'AdminWalletWithdrawals',
        path: '/admin/wallet/withdrawals',
      },
```

- [ ] **Step 4: 创建钱包账户页最小实现**

创建 `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue`：

```vue
<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Drawer, Form, FormItem, Input, InputNumber, Space, Table, message } from 'antdv-next';

import { createWalletAdjustmentApi, getWalletLedgerApi, listWalletAccountsApi, type WalletAccountRow, type WalletLedgerRow } from '#/api/django/wallet';
import { buildWalletAccountStats } from './wallet-shared';

const loading = ref(false);
const ledgerLoading = ref(false);
const adjusting = ref(false);
const rows = ref<WalletAccountRow[]>([]);
const ledgerRows = ref<WalletLedgerRow[]>([]);
const drawerVisible = ref(false);
const selectedUserId = ref<number | null>(null);
const adjustmentForm = reactive({ amount: 0, idempotency_key: '', remark: '' });

const stats = computed(() => buildWalletAccountStats(rows.value));

async function loadAccounts() {
  loading.value = true;
  try {
    const data = await listWalletAccountsApi();
    rows.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function openLedger(userId: number) {
  drawerVisible.value = true;
  selectedUserId.value = userId;
  ledgerLoading.value = true;
  try {
    const data = await getWalletLedgerApi(userId);
    ledgerRows.value = data.items ?? [];
  } finally {
    ledgerLoading.value = false;
  }
}

async function submitAdjustment(userId: number) {
  adjusting.value = true;
  try {
    await createWalletAdjustmentApi({ ...adjustmentForm, user_id: userId });
    message.success('调账成功');
    adjustmentForm.amount = 0;
    adjustmentForm.idempotency_key = '';
    adjustmentForm.remark = '';
    await loadAccounts();
    await openLedger(userId);
  } finally {
    adjusting.value = false;
  }
}

onMounted(loadAccounts);
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="钱包账户">
    <div class="flex flex-col gap-6">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.key" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950">{{ item.value }}</div>
        </Card>
      </div>

      <Card variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div class="text-base font-semibold text-zinc-950">账户列表</div>
          <Button :loading="loading" @click="loadAccounts">刷新</Button>
        </div>
        <Table
          :columns="[
            { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 100 },
            { title: '用户', dataIndex: 'user_label', key: 'user_label' },
            { title: '可用余额', dataIndex: 'available_balance', key: 'available_balance' },
            { title: '冻结余额', dataIndex: 'frozen_balance', key: 'frozen_balance' },
            { title: '累计收入', dataIndex: 'total_income', key: 'total_income' },
            { title: '累计提现', dataIndex: 'total_withdrawn', key: 'total_withdrawn' },
            { title: '操作', key: 'actions', width: 220 },
          ]"
          :data-source="rows"
          :loading="loading"
          :pagination="false"
          class="mt-6"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <Space>
                <Button size="small" @click="openLedger(record.user_id)">查看流水</Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Drawer v-model:open="drawerVisible" :width="760" title="钱包流水">
        <Form layout="vertical" class="mb-6">
          <FormItem label="调账金额">
            <InputNumber v-model:value="adjustmentForm.amount" class="!w-full" />
          </FormItem>
          <FormItem label="幂等键">
            <Input v-model:value="adjustmentForm.idempotency_key" />
          </FormItem>
          <FormItem label="备注">
            <Input v-model:value="adjustmentForm.remark" />
          </FormItem>
          <Button :disabled="selectedUserId === null" :loading="adjusting" type="primary" @click="submitAdjustment(selectedUserId!)">提交调账</Button>
        </Form>

        <Table
          :columns="[
            { title: '类型', dataIndex: 'entry_type', key: 'entry_type', width: 180 },
            { title: '金额变化', dataIndex: 'amount_delta', key: 'amount_delta', width: 120 },
            { title: '可用余额', dataIndex: 'available_balance_after', key: 'available_balance_after', width: 120 },
            { title: '冻结余额', dataIndex: 'frozen_balance_after', key: 'frozen_balance_after', width: 120 },
            { title: '业务类型', dataIndex: 'biz_type', key: 'biz_type', width: 180 },
            { title: '备注', dataIndex: 'remark', key: 'remark' },
          ]"
          :data-source="ledgerRows"
          :loading="ledgerLoading"
          :pagination="false"
          row-key="id"
        />
      </Drawer>
    </div>
  </Page>
</template>
```

- [ ] **Step 5: 运行测试确认路由存在，页面通过类型检查**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
pnpm --dir frontend_admin/apps/web-antdv-next typecheck
```

Expected:

- Vitest PASS，菜单包含钱包路由。
- `typecheck` PASS，钱包账户页无类型错误。

- [ ] **Step 6: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts
git commit -m "新增钱包账户后台页面"
```


### Task 4: 实现提现审核页并完成整体验证

**Files:**
- Create: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts`

- [ ] **Step 1: 写失败测试，锁定提现按钮可见性和状态标签**

在 `wallet-shared.test.ts` 再追加一条：

```ts
it('已打款和已撤销状态不暴露任何操作按钮', () => {
  expect(getWalletWithdrawalActions('paid')).toEqual([]);
  expect(getWalletWithdrawalActions('cancelled')).toEqual([]);
});
```

- [ ] **Step 2: 运行测试确认当前通过**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- PASS, 说明共享状态逻辑已经完整覆盖该断言，可以继续实现提现页面。

- [ ] **Step 3: 创建提现审核页**

创建 `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue`：

```vue
<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Input, Modal, Select, Space, Table, Tag, message } from 'antdv-next';

import { listWalletWithdrawalsApi, payoutWalletWithdrawalApi, reviewWalletWithdrawalApi, retryWalletWithdrawalApi, type WithdrawalRow } from '#/api/django/wallet';
import { buildWalletWithdrawalStats, getWalletWithdrawalActions, getWalletWithdrawalStatusMeta } from './wallet-shared';

const loading = ref(false);
const rows = ref<WithdrawalRow[]>([]);
const keyword = ref('');
const statusFilter = ref<string | undefined>(undefined);
const actingId = ref<number | null>(null);
const rejectModalVisible = ref(false);
const selectedRow = ref<null | WithdrawalRow>(null);
const rejectForm = reactive({ idempotency_key: '', reason: '' });

const stats = computed(() => buildWalletWithdrawalStats(rows.value));

const filteredRows = computed(() => rows.value.filter((item) => {
  const matchStatus = statusFilter.value ? item.status === statusFilter.value : true;
  const matchKeyword = keyword.value ? `${item.user_label || ''} ${item.id}`.includes(keyword.value) : true;
  return matchStatus && matchKeyword;
}));

function createBizKey(prefix: string, id: number) {
  return `${prefix}-${id}-${Date.now()}`;
}

async function loadData() {
  loading.value = true;
  try {
    const data = await listWalletWithdrawalsApi();
    rows.value = data.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function approveRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await reviewWalletWithdrawalApi(row.id, { approved: true, idempotency_key: createBizKey('review-approve', row.id), reason: '' });
    message.success('审核通过');
    await loadData();
  } finally {
    actingId.value = null;
  }
}

function openRejectModal(row: WithdrawalRow) {
  selectedRow.value = row;
  rejectModalVisible.value = true;
  rejectForm.idempotency_key = createBizKey('review-reject', row.id);
  rejectForm.reason = '';
}

async function submitReject() {
  if (!selectedRow.value) return;
  actingId.value = selectedRow.value.id;
  try {
    await reviewWalletWithdrawalApi(selectedRow.value.id, { approved: false, idempotency_key: rejectForm.idempotency_key, reason: rejectForm.reason });
    message.success('已驳回');
    rejectModalVisible.value = false;
    await loadData();
  } finally {
    actingId.value = null;
  }
}

async function payoutRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await payoutWalletWithdrawalApi(row.id, { idempotency_key: createBizKey('payout', row.id), out_trade_no: createBizKey('wechat-out', row.id), provider: 'wechat', request_payload: {} });
    message.success('已发起微信提现');
    await loadData();
  } finally {
    actingId.value = null;
  }
}

async function retryRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await retryWalletWithdrawalApi(row.id, { idempotency_key: createBizKey('retry', row.id), out_trade_no: createBizKey('wechat-retry', row.id), provider: 'wechat', request_payload: {} });
    message.success('已提交重试');
    await loadData();
  } finally {
    actingId.value = null;
  }
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="提现审核">
    <div class="flex flex-col gap-6">
      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.key" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950">{{ item.value }}</div>
        </Card>
      </div>

      <Card variant="borderless">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <Space>
            <Input v-model:value="keyword" placeholder="搜索用户或提现单号" style="width: 220px" />
            <Select v-model:value="statusFilter" allow-clear placeholder="状态筛选" style="width: 180px"
              :options="[
                { label: '待审核', value: 'pending_review' },
                { label: '待打款', value: 'approved' },
                { label: '打款中', value: 'paying' },
                { label: '打款失败', value: 'failed' },
                { label: '已打款', value: 'paid' },
              ]" />
          </Space>
          <Button :loading="loading" @click="loadData">刷新</Button>
        </div>

        <Table
          :columns="[
            { title: '提现单ID', dataIndex: 'id', key: 'id', width: 110 },
            { title: '用户', dataIndex: 'user_label', key: 'user_label' },
            { title: '提现金额', dataIndex: 'amount', key: 'amount', width: 120 },
            { title: '手续费', dataIndex: 'fee_amount', key: 'fee_amount', width: 120 },
            { title: '到账金额', dataIndex: 'net_amount', key: 'net_amount', width: 120 },
            { title: '渠道', dataIndex: 'pay_channel', key: 'pay_channel', width: 100 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
            { title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 220 },
            { title: '操作', key: 'actions', width: 260 },
          ]"
          :data-source="filteredRows"
          :loading="loading"
          :pagination="false"
          class="mt-6"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <Tag :color="getWalletWithdrawalStatusMeta(record.status).color">{{ getWalletWithdrawalStatusMeta(record.status).text }}</Tag>
            </template>
            <template v-else-if="column.key === 'created_at'">
              {{ new Date(record.created_at).toLocaleString() }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('approve')" :loading="actingId === record.id" size="small" type="primary" @click="approveRow(record)">通过</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('reject')" :loading="actingId === record.id" danger size="small" @click="openRejectModal(record)">驳回</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('payout')" :loading="actingId === record.id" size="small" type="primary" @click="payoutRow(record)">发起微信提现</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('retry')" :loading="actingId === record.id" size="small" @click="retryRow(record)">重试</Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Modal v-model:open="rejectModalVisible" title="驳回提现" @ok="submitReject">
        <div class="space-y-4">
          <Input v-model:value="rejectForm.idempotency_key" placeholder="幂等键" />
          <Input v-model:value="rejectForm.reason" placeholder="驳回原因" />
        </div>
      </Modal>
    </div>
  </Page>
</template>
```

- [ ] **Step 4: 运行测试与类型检查确认通过**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
pnpm --dir frontend_admin/apps/web-antdv-next typecheck
```

Expected:

- Vitest PASS。
- `typecheck` PASS。

- [ ] **Step 5: Commit**

```bash
git add frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts
git commit -m "新增提现审核后台页面"
```


### Task 5: 全量检查与整理

**Files:**
- Modify: `frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue`
- Modify: `frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts`
- Modify: `frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts`

- [ ] **Step 1: 跑共享测试**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next exec vitest run src/views/admin/__tests__/wallet-shared.test.ts
```

Expected:

- PASS。

- [ ] **Step 2: 跑前端类型检查**

Run:

```bash
pnpm --dir frontend_admin/apps/web-antdv-next typecheck
```

Expected:

- PASS，没有新增 TS 错误。

- [ ] **Step 3: 提交最终前端后台闭环改动**

```bash
git add frontend_admin/apps/web-antdv-next/src/api/django/wallet.ts frontend_admin/apps/web-antdv-next/src/views/admin/wallet-shared.ts frontend_admin/apps/web-antdv-next/src/views/admin/wallet-accounts.vue frontend_admin/apps/web-antdv-next/src/views/admin/wallet-withdrawals.vue frontend_admin/apps/web-antdv-next/src/views/admin/__tests__/wallet-shared.test.ts frontend_admin/apps/web-antdv-next/src/router/routes/modules/admin.ts
git commit -m "实现钱包运营后台页面"
```

Expected:

- Commit succeeds with only `frontend_admin` wallet operation files staged.
