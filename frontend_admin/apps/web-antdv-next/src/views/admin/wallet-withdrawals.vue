<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Input, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import {
  listWalletWithdrawalsApi,
  payoutWalletWithdrawalApi,
  reviewWalletWithdrawalApi,
  retryWalletWithdrawalApi,
  type WithdrawalRow,
} from '#/api/django/wallet';

import { buildWalletWithdrawalStats, getWalletWithdrawalActions, getWalletWithdrawalStatusMeta } from './wallet-shared';

const loading = ref(false);
const rows = ref<WithdrawalRow[]>([]);
const total = ref(0);
const keyword = ref('');
const statusFilter = ref<string>();
const actingId = ref<null | number>(null);
const rejectModalVisible = ref(false);
const selectedRow = ref<null | WithdrawalRow>(null);
const tablePager = reactive({ current: 1, pageSize: 10 });
const rejectForm = reactive({ idempotency_key: '', reason: '' });

const stats = computed(() => buildWalletWithdrawalStats(rows.value));

const filteredRows = computed(() => rows.value.filter((item) => {
  const matchStatus = statusFilter.value ? item.status === statusFilter.value : true;
  const keywordValue = keyword.value.trim();
  const payeeText = JSON.stringify(item.payee_account_snapshot || {});
  const matchKeyword = keywordValue ? `${item.id} ${item.user_id || ''} ${item.user_label || ''} ${payeeText}`.includes(keywordValue) : true;
  return matchStatus && matchKeyword;
}));

function formatDate(value: string) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildBizKey(prefix: string, id: number) {
  return `${prefix}-${id}-${Date.now()}`;
}

function formatPayChannel(channel: string) {
  return channel === 'wechat' ? '微信' : channel;
}

function formatPayee(snapshot: Record<string, unknown>) {
  const textKeys = ['name', 'nickname', 'openid', 'unionid'];
  for (const key of textKeys) {
    const value = snapshot?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return Object.keys(snapshot || {}).length ? JSON.stringify(snapshot) : '-';
}

async function loadData() {
  loading.value = true;
  try {
    const data = await listWalletWithdrawalsApi({ page: tablePager.current, page_size: tablePager.pageSize });
    rows.value = data.items ?? [];
    total.value = data.total ?? 0;
  } catch (error: any) {
    message.error(error?.message || '读取提现申请失败，请稍后重试。');
  } finally {
    loading.value = false;
  }
}

async function approveRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await reviewWalletWithdrawalApi(row.id, {
      approved: true,
      idempotency_key: buildBizKey('review-approve', row.id),
      reason: '',
    });
    message.success('审核通过');
    await loadData();
  } catch (error: any) {
    message.error(error?.message || '审核失败，请稍后重试。');
  } finally {
    actingId.value = null;
  }
}

function openRejectModal(row: WithdrawalRow) {
  selectedRow.value = row;
  rejectModalVisible.value = true;
  rejectForm.idempotency_key = buildBizKey('review-reject', row.id);
  rejectForm.reason = row.reject_reason || '';
}

async function submitReject() {
  if (!selectedRow.value) return;
  if (!rejectForm.reason.trim()) {
    message.warning('请输入驳回原因。');
    return;
  }
  actingId.value = selectedRow.value.id;
  try {
    await reviewWalletWithdrawalApi(selectedRow.value.id, {
      approved: false,
      idempotency_key: rejectForm.idempotency_key.trim(),
      reason: rejectForm.reason.trim(),
    });
    message.success('已驳回');
    rejectModalVisible.value = false;
    await loadData();
  } catch (error: any) {
    message.error(error?.message || '驳回失败，请稍后重试。');
  } finally {
    actingId.value = null;
  }
}

async function payoutRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await payoutWalletWithdrawalApi(row.id, {
      idempotency_key: buildBizKey('payout', row.id),
      out_trade_no: buildBizKey('wechat-out', row.id),
      provider: 'wechat',
      request_payload: {},
    });
    message.success('已发起微信提现');
    await loadData();
  } catch (error: any) {
    message.error(error?.message || '发起微信提现失败，请稍后重试。');
  } finally {
    actingId.value = null;
  }
}

async function retryRow(row: WithdrawalRow) {
  actingId.value = row.id;
  try {
    await retryWalletWithdrawalApi(row.id, {
      idempotency_key: buildBizKey('retry', row.id),
      out_trade_no: buildBizKey('wechat-retry', row.id),
      provider: 'wechat',
      request_payload: {},
    });
    message.success('已提交重试');
    await loadData();
  } catch (error: any) {
    message.error(error?.message || '重试失败，请稍后重试。');
  } finally {
    actingId.value = null;
  }
}

function handleTableChange(pagination: { current?: number; pageSize?: number }) {
  tablePager.current = pagination.current ?? 1;
  tablePager.pageSize = pagination.pageSize ?? 10;
  void loadData();
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="提现审核">
    <div class="flex flex-col gap-6 sm:gap-8">
      <div class="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.key" class="shadow-sm" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{{ item.value }}</div>
        </Card>
      </div>

      <Card class="shadow-sm" variant="borderless">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">提现申请列表</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">支持审核通过、驳回、发起微信提现和失败重试。</div>
          </div>
          <Space wrap>
            <Input v-model:value="keyword" placeholder="搜索提现单号或收款信息" style="width: 220px" />
            <Select
              v-model:value="statusFilter"
              allow-clear
              placeholder="状态筛选"
              style="width: 180px"
              :options="[
                { label: '待审核', value: 'pending_review' },
                { label: '待打款', value: 'approved' },
                { label: '打款中', value: 'paying' },
                { label: '打款失败', value: 'failed' },
                { label: '已打款', value: 'paid' },
                { label: '已驳回', value: 'rejected' },
              ]"
            />
            <Button :loading="loading" @click="loadData">刷新</Button>
          </Space>
        </div>

        <Table
          :columns="[
            { title: '提现单ID', dataIndex: 'id', key: 'id', width: 110 },
            { title: '提现金额', dataIndex: 'amount', key: 'amount', width: 120 },
            { title: '手续费', dataIndex: 'fee_amount', key: 'fee_amount', width: 110 },
            { title: '到账金额', dataIndex: 'net_amount', key: 'net_amount', width: 120 },
            { title: '渠道', dataIndex: 'pay_channel', key: 'pay_channel', width: 90 },
            { title: '收款快照', dataIndex: 'payee_account_snapshot', key: 'payee_account_snapshot', width: 220 },
            { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
            { title: '驳回原因', dataIndex: 'reject_reason', key: 'reject_reason', width: 180 },
            { title: '提交时间', dataIndex: 'created_at', key: 'created_at', width: 200 },
            { title: '操作', key: 'actions', width: 260 },
          ]"
          :data-source="filteredRows"
          :loading="loading"
          :pagination="{ current: tablePager.current, pageSize: tablePager.pageSize, showSizeChanger: true, total }"
          class="mt-6"
          row-key="id"
          @change="handleTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'pay_channel'">
              {{ formatPayChannel(record.pay_channel) }}
            </template>
            <template v-else-if="column.key === 'payee_account_snapshot'">
              <div class="truncate" :title="JSON.stringify(record.payee_account_snapshot)">{{ formatPayee(record.payee_account_snapshot) }}</div>
            </template>
            <template v-else-if="column.key === 'status'">
              <Tag :color="getWalletWithdrawalStatusMeta(record.status).color">{{ getWalletWithdrawalStatusMeta(record.status).text }}</Tag>
            </template>
            <template v-else-if="column.key === 'reject_reason'">
              {{ record.reject_reason || '-' }}
            </template>
            <template v-else-if="column.key === 'created_at'">
              {{ formatDate(record.created_at) }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space wrap>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('approve')" :loading="actingId === record.id" size="small" type="primary" @click="approveRow(record)">通过</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('reject')" :loading="actingId === record.id" danger size="small" @click="openRejectModal(record)">驳回</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('payout')" :loading="actingId === record.id" size="small" type="primary" @click="payoutRow(record)">发起微信提现</Button>
                <Button v-if="getWalletWithdrawalActions(record.status).includes('retry')" :loading="actingId === record.id" size="small" @click="retryRow(record)">重试</Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>

      <Modal v-model:open="rejectModalVisible" :confirm-loading="actingId === selectedRow?.id" title="驳回提现" @ok="submitReject">
        <div class="space-y-4">
          <Input v-model:value="rejectForm.idempotency_key" placeholder="幂等键" />
          <Input v-model:value="rejectForm.reason" placeholder="驳回原因" />
        </div>
      </Modal>
    </div>
  </Page>
</template>
