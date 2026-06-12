<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Card, InputNumber, Space, Switch, Table, Tag, message } from 'antdv-next';

import { getReferralConfigApi, listReferralRecordsApi, reviewReferralRecordApi, updateReferralConfigApi, type ReferralConfigRow, type ReferralRecordRow } from '#/api/django/referrals';

const loading = ref(false);
const saving = ref(false);
const reviewingId = ref<number | null>(null);
const config = ref<null | ReferralConfigRow>(null);
const records = ref<ReferralRecordRow[]>([]);

const stats = computed(() => {
  const total = records.value.length;
  const pending = records.value.filter((item) => item.status === 'pending_review').length;
  const rewarded = records.value.filter((item) => item.status === 'reward_issued').length;
  const rejected = records.value.filter((item) => item.status === 'review_rejected').length;
  return [
    { label: '当前记录', value: total },
    { label: '待审核', value: pending },
    { label: '已发奖', value: rewarded },
    { label: '已驳回', value: rejected },
  ];
});

async function loadData() {
  loading.value = true;
  try {
    const [configData, recordsData] = await Promise.all([
      getReferralConfigApi(),
      listReferralRecordsApi(),
    ]);
    config.value = configData;
    records.value = recordsData.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function saveConfig() {
  if (!config.value) return;
  saving.value = true;
  try {
    config.value = await updateReferralConfigApi({
      allow_code: config.value.allow_code,
      allow_link: config.value.allow_link,
      invitee_reward_amount: config.value.invitee_reward_amount,
      inviter_reward_amount: config.value.inviter_reward_amount,
      requires_manual_review: config.value.requires_manual_review,
    });
    message.success('推广规则已更新');
  } finally {
    saving.value = false;
  }
}

async function reviewRecord(record: ReferralRecordRow, approved: boolean) {
  reviewingId.value = record.id;
  try {
    await reviewReferralRecordApi(record.id, {
      approved,
      remark: approved ? '后台审核通过' : '后台审核驳回',
    });
    message.success(approved ? '已通过并发奖' : '已驳回');
    await loadData();
  } finally {
    reviewingId.value = null;
  }
}

function formatStatus(status: string) {
  switch (status) {
    case 'pending_review': {
      return { color: 'gold', text: '待审核' };
    }
    case 'registered': {
      return { color: 'blue', text: '已注册' };
    }
    case 'reward_issued': {
      return { color: 'green', text: '已发奖' };
    }
    case 'review_rejected': {
      return { color: 'red', text: '已驳回' };
    }
    default: {
      return { color: 'default', text: status };
    }
  }
}

onMounted(loadData);
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="推广管理">
    <div class="flex flex-col gap-6 sm:gap-8">
      <div class="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card v-for="item in stats" :key="item.label" class="shadow-sm" variant="borderless">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{{ item.label }}</div>
          <div class="mt-3 text-3xl font-semibold text-zinc-950 dark:text-zinc-50">{{ item.value }}</div>
        </Card>
      </div>

      <Card class="shadow-sm" variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">推广规则配置</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">管理邀请奖励、邀请码能力以及人工审核开关。</div>
          </div>
          <Button :loading="saving" type="primary" @click="saveConfig">保存配置</Button>
        </div>

        <div v-if="config" class="mt-6 grid gap-4 lg:grid-cols-2">
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">邀请人奖励（分）</div>
            <InputNumber v-model:value="config.inviter_reward_amount" class="!w-full" :min="0" />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">被邀请人奖励（分）</div>
            <InputNumber v-model:value="config.invitee_reward_amount" class="!w-full" :min="0" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <div class="text-sm font-medium text-zinc-700 dark:text-zinc-200">开启链接邀请</div>
              <div class="text-xs text-zinc-500">允许用户分享专属注册链接</div>
            </div>
            <Switch v-model:checked="config.allow_link" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <div class="text-sm font-medium text-zinc-700 dark:text-zinc-200">开启邀请码</div>
              <div class="text-xs text-zinc-500">允许用户通过邀请码建立归因</div>
            </div>
            <Switch v-model:checked="config.allow_code" />
          </div>
          <div class="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 dark:border-zinc-800 lg:col-span-2">
            <div>
              <div class="text-sm font-medium text-zinc-700 dark:text-zinc-200">人工审核后发奖</div>
              <div class="text-xs text-zinc-500">邀请记录完成关键行为后，需管理员审核通过才会实际发奖</div>
            </div>
            <Switch v-model:checked="config.requires_manual_review" />
          </div>
        </div>
      </Card>

      <Card class="shadow-sm" variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">邀请记录与审核</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">查看所有裂变邀请记录，并对达到条件的记录执行审核发奖。</div>
          </div>
          <Button :loading="loading" @click="loadData">刷新</Button>
        </div>

        <Table
          :columns="[
            { title: '记录 ID', dataIndex: 'id', key: 'id', width: 100 },
            { title: '被邀请人', dataIndex: 'invitee_display', key: 'invitee_display' },
            { title: '状态', dataIndex: 'status', key: 'status', width: 140 },
            { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 220 },
            { title: '操作', key: 'actions', width: 220 },
          ]"
          :data-source="records"
          :loading="loading"
          :pagination="false"
          class="mt-6"
          row-key="id"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'">
              <Tag :color="formatStatus(record.status).color">{{ formatStatus(record.status).text }}</Tag>
            </template>
            <template v-else-if="column.key === 'created_at'">
              {{ new Date(record.created_at).toLocaleString() }}
            </template>
            <template v-else-if="column.key === 'actions'">
              <Space>
                <Button
                  :disabled="record.status !== 'pending_review'"
                  :loading="reviewingId === record.id"
                  size="small"
                  type="primary"
                  @click="reviewRecord(record, true)"
                >
                  通过
                </Button>
                <Button
                  :disabled="record.status !== 'pending_review'"
                  :loading="reviewingId === record.id"
                  danger
                  size="small"
                  @click="reviewRecord(record, false)"
                >
                  驳回
                </Button>
              </Space>
            </template>
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>
