<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Input, Table, Tag, message } from 'antdv-next';

import { getMyReferralSummaryApi, listMyReferralRecordsApi, type ReferralRecordRow, type ReferralSummaryRow } from '#/api/django/referrals';

const loading = ref(false);
const initialized = ref(false);
const errorMessage = ref('');
const recordsErrorMessage = ref('');
const summary = ref<null | ReferralSummaryRow>(null);
const records = ref<ReferralRecordRow[]>([]);

const journey = [
  '分享',
  '注册',
  '生成邀请记录',
  '完成关键行为',
  '管理员审核',
  '发奖',
];

const shareUrl = computed(() => {
  const link = summary.value?.share_link;
  if (!link) return '';
  return link.startsWith('http') ? link : `${window.location.origin}${link}`;
});

async function loadData() {
  loading.value = true;
  errorMessage.value = '';
  recordsErrorMessage.value = '';
  try {
    const summaryData = await getMyReferralSummaryApi();
    summary.value = summaryData;
    initialized.value = true;

    try {
      const recordsData = await listMyReferralRecordsApi();
      records.value = recordsData.items ?? [];
    } catch {
      records.value = [];
      recordsErrorMessage.value = '邀请记录加载失败，已保留推广链接，你可以先继续分享。';
    }
  } catch {
    summary.value = null;
    records.value = [];
    initialized.value = false;
    errorMessage.value = '推广链接生成失败，请稍后重试。';
  } finally {
    loading.value = false;
  }
}

async function createPromotionLink() {
  await loadData();
}

async function copyText(value: string, successText: string) {
  if (!value) return;
  await navigator.clipboard.writeText(value);
  message.success(successText);
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

onMounted(() => {
  summary.value = null;
  records.value = [];
  void loadData();
});
</script>

<template>
  <Page auto-content-height content-class="p-4 sm:p-6" title="推广奖励">
    <div class="flex flex-col gap-6 sm:gap-8">
      <Card class="shadow-sm" variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">分享推广</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">先创建你的专属推广链接，再分享给好友完成注册归因，后续关键行为和审核发奖都会沿这条链路推进。</div>
          </div>
          <Button v-if="initialized" :loading="loading" @click="loadData">刷新</Button>
          <Button v-else :loading="loading" type="primary" @click="createPromotionLink">{{ errorMessage ? '重新生成推广链接' : '生成中...' }}</Button>
        </div>

        <Alert v-if="errorMessage" class="mt-6" :message="errorMessage" type="warning" />

        <div class="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">推广链路</div>
          <div class="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
            {{ journey.join(' -> ') }}
          </div>
        </div>

        <div v-if="initialized" class="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div class="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-5 py-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div class="text-xs uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">我的推广链接</div>
            <div class="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <div class="text-sm text-zinc-500 dark:text-zinc-400">邀请码</div>
                <div class="mt-1 text-3xl font-semibold tracking-[0.12em] text-zinc-950 dark:text-zinc-50">
                  {{ summary?.invite_code || '--' }}
                </div>
              </div>
              <Button @click="copyText(summary?.invite_code || '', '邀请码已复制')">复制邀请码</Button>
            </div>

            <div class="mt-5">
              <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">分享链接</div>
              <div class="flex flex-col gap-3 lg:flex-row">
                <Input :value="shareUrl" readonly />
                <Button type="primary" @click="copyText(shareUrl, '分享链接已复制')">复制分享链接</Button>
              </div>
            </div>

          </div>

          <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div class="rounded-2xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div class="text-sm text-zinc-500 dark:text-zinc-400">已邀请</div>
              <div class="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{{ summary?.registered_count ?? 0 }}</div>
              <div class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">已完成注册并产生邀请记录</div>
            </div>

            <div class="rounded-2xl border border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div class="text-sm text-zinc-500 dark:text-zinc-400">待奖励</div>
              <div class="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{{ summary?.pending_review_count ?? 0 }}</div>
              <div class="mt-1 text-xs text-zinc-400 dark:text-zinc-500">完成关键行为后等待管理员审核</div>
            </div>
          </div>
        </div>

        <div v-else class="mt-6 rounded-2xl border border-zinc-200 bg-white px-5 py-8 text-center dark:border-zinc-800 dark:bg-zinc-950/40">
          <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">{{ errorMessage ? '推广链接生成失败' : '正在生成分享资产' }}</div>
          <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {{ errorMessage ? '你可以立即重试，系统会重新为当前账号生成专属分享链接和邀请码。' : '系统正在为当前账号生成专属分享链接和邀请码，生成完成后会自动展示，无需额外操作。' }}
          </div>
          <div v-if="!errorMessage" class="mx-auto mt-5 grid max-w-xl gap-3 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/70 px-4 py-4 text-left dark:border-zinc-800 dark:bg-zinc-900/40">
            <div class="h-3 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800"></div>
            <div class="h-10 rounded-xl bg-white dark:bg-zinc-950/50"></div>
            <div class="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
              <div class="h-9 rounded-xl bg-zinc-200/80 dark:bg-zinc-800"></div>
              <div class="h-9 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/70"></div>
            </div>
          </div>
          <Button v-if="errorMessage" class="mt-5" :loading="loading" type="primary" @click="createPromotionLink">重新生成推广链接</Button>
        </div>
      </Card>

      <Card class="shadow-sm" variant="borderless">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">我的邀请记录</div>
            <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">注册成功后会产生邀请记录；完成关键行为并经管理员审核通过后，才会发放奖励。</div>
          </div>
        </div>

        <Alert v-if="recordsErrorMessage" class="mt-6" :message="recordsErrorMessage" type="warning" />

        <div v-if="!initialized" class="mt-6 rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/80 px-6 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
          先创建推广链接，后续邀请记录会在这里按链路自动累积。
        </div>

        <Table
          v-else
          :columns="[
            { title: '记录 ID', dataIndex: 'id', key: 'id', width: 100 },
            { title: '被邀请人', dataIndex: 'invitee_display', key: 'invitee_display' },
            { title: '状态', dataIndex: 'status', key: 'status', width: 140 },
            { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 220 },
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
          </template>
        </Table>
      </Card>
    </div>
  </Page>
</template>
