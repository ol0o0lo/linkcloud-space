<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Drawer, Form, FormItem, Input, InputNumber, message, Space, Table } from 'antdv-next';

import {
  createWalletAdjustmentApi,
  getWalletLedgerApi,
  listWalletAccountsApi,
  type WalletAccountRow,
  type WalletLedgerRow,
} from '#/api/django/wallet';

import { buildWalletAccountStats } from './wallet-shared';

const loading = ref(false);
const ledgerLoading = ref(false);
const adjusting = ref(false);
const rows = ref<WalletAccountRow[]>([]);
const ledgerRows = ref<WalletLedgerRow[]>([]);
const total = ref(0);
const drawerVisible = ref(false);
const selectedUserId = ref<null | number>(null);
const adjustmentForm = reactive({ amount: 0, idempotency_key: '', remark: '' });
const accountPager = reactive({ current: 1, pageSize: 10 });
const ledgerPager = reactive({ current: 1, pageSize: 10, total: 0 });

const stats = computed(() => buildWalletAccountStats(rows.value));

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function resetAdjustmentForm() {
  adjustmentForm.amount = 0;
  adjustmentForm.idempotency_key = '';
  adjustmentForm.remark = '';
}

function buildIdempotencyKey(userId: number) {
  return `wallet-adjust-${userId}-${Date.now()}`;
}

async function loadAccounts() {
  loading.value = true;
  try {
    const data = await listWalletAccountsApi({ page: accountPager.current, page_size: accountPager.pageSize });
    rows.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (error: any) {
    message.error(error?.message || '读取钱包账户失败，请稍后重试。');
  } finally {
    loading.value = false;
  }
}

async function loadLedger() {
  if (selectedUserId.value === null) return;
  ledgerLoading.value = true;
  try {
    const data = await getWalletLedgerApi(selectedUserId.value, { page: ledgerPager.current, page_size: ledgerPager.pageSize });
    ledgerRows.value = data.items ?? [];
    ledgerPager.total = data.total ?? 0;
  } catch (error: any) {
    message.error(error?.message || '读取钱包流水失败，请稍后重试。');
  } finally {
    ledgerLoading.value = false;
  }
}

async function openLedger(userId: number) {
  selectedUserId.value = userId;
  ledgerPager.current = 1;
  drawerVisible.value = true;
  resetAdjustmentForm();
  adjustmentForm.idempotency_key = buildIdempotencyKey(userId);
  await loadLedger();
}

async function submitAdjustment() {
  if (selectedUserId.value === null) return;
  if (!adjustmentForm.amount) {
    message.warning('请输入调账金额。');
    return;
  }
  if (!adjustmentForm.idempotency_key.trim()) {
    message.warning('请输入幂等键。');
    return;
  }
  adjusting.value = true;
  try {
    await createWalletAdjustmentApi({
      amount: adjustmentForm.amount,
      idempotency_key: adjustmentForm.idempotency_key.trim(),
      remark: adjustmentForm.remark.trim(),
      user_id: selectedUserId.value,
    });
    message.success('调账成功');
    resetAdjustmentForm();
    adjustmentForm.idempotency_key = buildIdempotencyKey(selectedUserId.value);
    await Promise.all([loadAccounts(), loadLedger()]);
  } catch (error: any) {
    message.error(error?.message || '调账失败，请检查金额或幂等键。');
  } finally {
    adjusting.value = false;
  }
}

function handleAccountTableChange(pagination: { current?: number; pageSize?: number }) {
  accountPager.current = pagination.current ?? 1;
  accountPager.pageSize = pagination.pageSize ?? 10;
  void loadAccounts();
}

function handleLedgerTableChange(pagination: { current?: number; pageSize?: number }) {
  ledgerPager.current = pagination.current ?? 1;
  ledgerPager.pageSize = pagination.pageSize ?? 10;
  void loadLedger();
}

onMounted(() => {
  void loadAccounts();
});
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="钱包账户">
    <div class="flex flex-col gap-6 sm:gap-8">
      <div class="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.key" class="shadow-sm" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{{ item.value }}</div>
        </Card>
      </div>

      <Card class="shadow-sm" variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">账户列表</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">查看余额结构、累计收入与累计提现，并支持人工调账。</div>
          </div>
          <Button :loading="loading" @click="loadAccounts">刷新</Button>
        </div>

        <Table
          :columns="[
            { title: '钱包ID', dataIndex: 'id', key: 'id', width: 100 },
            { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 110 },
            { title: '可用余额', dataIndex: 'available_balance', key: 'available_balance', width: 130 },
            { title: '冻结余额', dataIndex: 'frozen_balance', key: 'frozen_balance', width: 130 },
            { title: '累计收入', dataIndex: 'total_income', key: 'total_income', width: 130 },
            { title: '累计提现', dataIndex: 'total_withdrawn', key: 'total_withdrawn', width: 130 },
            { title: '操作', key: 'actions', width: 120 },
          ]"
          :data-source="rows"
          :loading="loading"
          :pagination="{ current: accountPager.current, pageSize: accountPager.pageSize, showSizeChanger: true, total }"
          class="mt-6"
          row-key="id"
          @change="handleAccountTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'actions'">
              <Space>
                <Button size="small" type="primary" @click="openLedger(record.user_id)">查看流水</Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Drawer v-model:open="drawerVisible" :width="820" title="钱包流水">
        <div class="flex flex-col gap-6">
          <Card variant="borderless">
            <div class="mb-4 text-base font-semibold text-zinc-950 dark:text-zinc-50">超级管理员调账</div>
            <Form layout="vertical">
              <FormItem label="调账金额（分）">
                <InputNumber v-model:value="adjustmentForm.amount" class="!w-full" />
              </FormItem>
              <FormItem label="幂等键">
                <Input v-model:value="adjustmentForm.idempotency_key" />
              </FormItem>
              <FormItem label="备注">
                <Input v-model:value="adjustmentForm.remark" placeholder="例如：活动补贴、人工修正" />
              </FormItem>
              <Button :disabled="selectedUserId === null" :loading="adjusting" type="primary" @click="submitAdjustment">提交调账</Button>
            </Form>
          </Card>

          <Table
            :columns="[
              { title: '流水ID', dataIndex: 'id', key: 'id', width: 100 },
              { title: '类型', dataIndex: 'entry_type', key: 'entry_type', width: 180 },
              { title: '金额变化', dataIndex: 'amount_delta', key: 'amount_delta', width: 120 },
              { title: '可用余额', dataIndex: 'available_balance_after', key: 'available_balance_after', width: 120 },
              { title: '冻结余额', dataIndex: 'frozen_balance_after', key: 'frozen_balance_after', width: 120 },
              { title: '业务类型', dataIndex: 'biz_type', key: 'biz_type', width: 180 },
              { title: '业务ID', dataIndex: 'biz_id', key: 'biz_id', width: 180 },
              { title: '备注', dataIndex: 'remark', key: 'remark', width: 180 },
              { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 200 },
            ]"
            :data-source="ledgerRows"
            :loading="ledgerLoading"
            :pagination="{ current: ledgerPager.current, pageSize: ledgerPager.pageSize, showSizeChanger: true, total: ledgerPager.total }"
            row-key="id"
            @change="handleLedgerTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'created_at'">
                {{ formatDate(record.created_at) }}
              </template>
            </template>
          </Table>
        </div>
      </Drawer>
    </div>
  </Page>
</template>
