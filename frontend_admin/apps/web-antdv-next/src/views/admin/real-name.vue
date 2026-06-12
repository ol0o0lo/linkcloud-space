<script lang="ts" setup>
import type { RealNameVerificationDetailRow, RealNameVerificationRow } from '#/api/django/resources';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, Empty, Input, InputSearch, message, Modal, Select, Space, Table, Tag } from 'antdv-next';

import {
  approveAdminRealNameApi,
  getAdminRealNameVerificationApi,
  listAdminRealNameVerificationsApi,
  moveAdminRealNameToManualReviewApi,
  rejectAdminRealNameApi,
  revokeAdminRealNameApi,
} from '#/api/django/resources';

const loading = ref(false);
const detailLoading = ref(false);
const detailVisible = ref(false);
const rows = ref<RealNameVerificationRow[]>([]);
const detail = ref<null | RealNameVerificationDetailRow>(null);
const keyword = ref('');
const statusFilter = ref<string | undefined>(undefined);
const decisionNote = ref('');

const statusOptions = [
  { label: '未实名', value: 'unverified' },
  { label: '待校验', value: 'pending' },
  { label: '已实名', value: 'verified' },
  { label: '已驳回', value: 'rejected' },
  { label: '人工复核', value: 'manual_review' },
  { label: '已撤销', value: 'revoked' },
];

const stats = computed(() => {
  const total = rows.value.length;
  const verified = rows.value.filter((item) => item.status === 'verified').length;
  const manualReview = rows.value.filter((item) => item.status === 'manual_review').length;
  const rejected = rows.value.filter((item) => item.status === 'rejected').length;
  return [
    { label: '当前结果', value: total },
    { label: '已实名', value: verified },
    { label: '人工复核', value: manualReview },
    { label: '已驳回', value: rejected },
  ];
});

function statusColor(status: string) {
  switch (status) {
    case 'manual_review': {
      return 'orange';
    }
    case 'pending': {
      return 'blue';
    }
    case 'rejected':
    case 'revoked': {
      return 'red';
    }
    case 'verified': {
      return 'green';
    }
    default: {
      return 'default';
    }
  }
}

async function loadData() {
  loading.value = true;
  try {
    rows.value = await listAdminRealNameVerificationsApi({
      q: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
    });
  } finally {
    loading.value = false;
  }
}

async function openDetail(record: RealNameVerificationRow) {
  detailVisible.value = true;
  detailLoading.value = true;
  decisionNote.value = '';
  try {
    detail.value = await getAdminRealNameVerificationApi(record.id);
  } finally {
    detailLoading.value = false;
  }
}

function confirmAction(options: {
  content: string;
  okText?: string;
  onOk: () => Promise<void> | void;
  title: string;
}) {
  Modal.confirm({
    cancelText: '取消',
    okText: options.okText || '确认',
    onOk: options.onOk,
    title: options.title,
    content: options.content,
  });
}

async function runDecision(
  action: 'approve' | 'manual_review' | 'reject' | 'revoke',
) {
  if (!detail.value) return;
  const current = detail.value;
  const actionMap = {
    approve: {
      api: approveAdminRealNameApi,
      message: '实名认证已人工通过',
      title: '确认通过实名认证',
      content: `这会把 ${current.user.username} 的实名认证标记为已通过。`,
      okText: '确认通过',
    },
    manual_review: {
      api: moveAdminRealNameToManualReviewApi,
      message: '实名认证已转人工复核',
      title: '确认转人工复核',
      content: `这会把 ${current.user.username} 的实名认证转为人工复核。`,
      okText: '确认转复核',
    },
    reject: {
      api: rejectAdminRealNameApi,
      message: '实名认证已驳回',
      title: '确认驳回实名认证',
      content: `这会驳回 ${current.user.username} 的当前实名认证申请。`,
      okText: '确认驳回',
    },
    revoke: {
      api: revokeAdminRealNameApi,
      message: '实名认证已撤销',
      title: '确认撤销实名认证',
      content: `这会撤销 ${current.user.username} 当前的实名认证状态。`,
      okText: '确认撤销',
    },
  } as const;

  const target = actionMap[action];
  confirmAction({
    title: target.title,
    content: target.content,
    okText: target.okText,
    onOk: async () => {
      detail.value = await target.api(current.id, decisionNote.value.trim());
      message.success(target.message);
      await loadData();
    },
  });
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="p-6" title="实名认证">
    <div class="space-y-8">
      <div class="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.label" class="shadow-sm" size="small" variant="borderless">
          <div class="text-xs text-zinc-500">{{ item.label }}</div>
          <div class="mt-2 text-2xl font-semibold text-zinc-950">{{ item.value }}</div>
        </Card>
      </div>

      <Card class="shadow-sm" variant="borderless">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950">实名审核队列</div>
            <div class="mt-1 text-sm text-zinc-500">这里处理移动端发起的实名认证结果、冲突复核和人工兜底审核。</div>
          </div>
          <Space>
            <InputSearch
              v-model:value="keyword"
              allow-clear
              class="w-72"
              placeholder="搜索用户名、邮箱、手机号或身份证后四位"
              @search="loadData"
            />
            <Select
              v-model:value="statusFilter"
              allow-clear
              class="w-44"
              :options="statusOptions"
              placeholder="筛选状态"
              @change="loadData"
            />
            <Button @click="loadData">刷新</Button>
          </Space>
        </div>
        <Table
          :columns="[
            { dataIndex: 'user', title: '账号', width: 220 },
            { dataIndex: 'identity', title: '实名信息', width: 240 },
            { dataIndex: 'status', title: '状态', width: 120 },
            { dataIndex: 'source', title: '来源', width: 120 },
            { dataIndex: 'reviewed_at', title: '最近处理', width: 180 },
            { dataIndex: 'actions', title: '操作', width: 120, fixed: 'right' },
          ]"
          :data-source="rows"
          :loading="loading"
          :locale="{ emptyText: '当前没有实名认证记录' }"
          :pagination="{ pageSize: 10, showSizeChanger: false }"
          :scroll="{ x: 980 }"
          row-key="id"
        >
          <template #emptyText>
            <Empty description="当前没有实名认证记录" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'user'">
              <div class="space-y-1">
                <div class="font-medium text-zinc-950">{{ record.user.username }}</div>
                <div class="text-sm text-zinc-500">{{ record.user.email || '-' }}</div>
                <div class="text-xs text-zinc-400">{{ record.user.phone || '未绑定手机号' }}</div>
              </div>
            </template>
            <template v-if="column.dataIndex === 'identity'">
              <div class="space-y-1">
                <div class="font-medium text-zinc-900">{{ record.real_name_masked || '-' }}</div>
                <div class="text-sm text-zinc-500">{{ record.id_number_masked || '-' }}</div>
                <div v-if="record.failure_reason" class="text-xs text-red-500">{{ record.failure_reason }}</div>
              </div>
            </template>
            <template v-if="column.dataIndex === 'status'">
              <Tag :color="statusColor(record.status)">{{ record.status_label }}</Tag>
            </template>
            <template v-if="column.dataIndex === 'source'">
              <div class="space-y-1">
                <div>{{ record.source_label }}</div>
                <div class="text-xs text-zinc-400">{{ record.provider_label }}</div>
              </div>
            </template>
            <template v-if="column.dataIndex === 'reviewed_at'">
              <div class="space-y-1">
                <div>{{ record.reviewed_at ? new Date(record.reviewed_at).toLocaleString() : '-' }}</div>
                <div class="text-xs text-zinc-400">{{ record.reviewed_by || '系统自动处理' }}</div>
              </div>
            </template>
            <template v-if="column.dataIndex === 'actions'">
              <Button size="small" type="primary" @click="openDetail(record)">查看详情</Button>
            </template>
          </template>
        </Table>
      </Card>
    </div>

    <Modal
      v-model:open="detailVisible"
      :footer="null"
      :title="detail ? `实名认证详情 · ${detail.user.username}` : '实名认证详情'"
      :width="840"
      destroy-on-close
    >
      <div v-if="detailLoading" class="py-12 text-center text-sm text-zinc-500">加载中...</div>
      <div v-else-if="detail" class="space-y-4">
        <Card size="small">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <div class="text-xs text-zinc-500">账号信息</div>
              <div class="mt-2 space-y-1 text-sm">
                <div>用户名：{{ detail.user.username }}</div>
                <div>邮箱：{{ detail.user.email || '-' }}</div>
                <div>手机号：{{ detail.user.phone || '-' }}</div>
              </div>
            </div>
            <div>
              <div class="text-xs text-zinc-500">实名主体</div>
              <div class="mt-2 space-y-1 text-sm">
                <div>真实姓名：{{ detail.real_name }}</div>
                <div>身份证号：{{ detail.id_number }}</div>
                <div>来源：{{ detail.source_label }}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card size="small">
          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <div class="text-xs text-zinc-500">当前状态</div>
              <div class="mt-2"><Tag :color="statusColor(detail.status)">{{ detail.status_label }}</Tag></div>
            </div>
            <div>
              <div class="text-xs text-zinc-500">校验渠道</div>
              <div class="mt-2 text-sm">{{ detail.provider_label }}</div>
            </div>
            <div>
              <div class="text-xs text-zinc-500">最近处理</div>
              <div class="mt-2 text-sm">{{ detail.reviewed_at ? new Date(detail.reviewed_at).toLocaleString() : '-' }}</div>
            </div>
          </div>
          <div class="mt-4 space-y-2 text-sm">
            <div v-if="detail.failure_reason"><span class="text-zinc-500">失败原因：</span>{{ detail.failure_reason }}</div>
            <div v-if="detail.review_note"><span class="text-zinc-500">审核备注：</span>{{ detail.review_note }}</div>
            <div v-if="detail.provider_request_id"><span class="text-zinc-500">请求流水：</span>{{ detail.provider_request_id }}</div>
          </div>
        </Card>

        <Card size="small">
          <div class="mb-3 text-base font-semibold text-zinc-950">审核动作</div>
          <div class="mb-3 text-sm text-zinc-500">备注会随当前动作一起写入审核日志，便于 app 侧展示驳回原因和人工处理说明。</div>
          <Input
            v-model:value="decisionNote"
            placeholder="输入审核备注、驳回原因或复核说明"
          />
          <Space class="mt-3" wrap>
            <Button @click="runDecision('manual_review')">转人工复核</Button>
            <Button type="primary" @click="runDecision('approve')">人工通过</Button>
            <Button danger @click="runDecision('reject')">人工驳回</Button>
            <Button danger ghost @click="runDecision('revoke')">撤销实名</Button>
          </Space>
        </Card>

        <Card size="small">
          <div class="mb-3 text-base font-semibold text-zinc-950">状态时间线</div>
          <div v-if="detail.logs.length === 0" class="text-sm text-zinc-500">还没有审核日志。</div>
          <div v-else class="space-y-3">
            <div
              v-for="log in detail.logs"
              :key="`${log.action}-${log.created_at}`"
              class="rounded border border-zinc-200 px-3 py-3"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="font-medium text-zinc-950">{{ log.action_label }}</div>
                <div class="text-xs text-zinc-400">{{ new Date(log.created_at).toLocaleString() }}</div>
              </div>
              <div class="mt-1 text-sm text-zinc-500">
                {{ log.from_status_label || '无' }} -> {{ log.to_status_label || '无' }}
              </div>
              <div v-if="log.note" class="mt-2 text-sm text-zinc-700">{{ log.note }}</div>
              <div v-if="log.operator" class="mt-1 text-xs text-zinc-400">处理人：{{ log.operator }}</div>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  </Page>
</template>
