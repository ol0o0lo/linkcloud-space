<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Card, Empty, Spin, Switch } from 'antdv-next';

import {
  listNotificationPreferencesApi,
  type NotificationPreferenceRow,
  updateNotificationPreferenceApi,
} from '#/api/django/resources';

const loading = ref(false);
const categories = ref<NotificationPreferenceRow[]>([]);
const savingKeys = ref<Record<string, boolean>>({});

async function loadData() {
  loading.value = true;
  try {
    categories.value = await listNotificationPreferencesApi().catch(() => []);
  } finally {
    loading.value = false;
  }
}

async function togglePreference(record: NotificationPreferenceRow, field: 'email' | 'in_app', checked: boolean) {
  const key = `${record.key}:${field}`;
  savingKeys.value = {
    ...savingKeys.value,
    [key]: true,
  };
  try {
    const updated = await updateNotificationPreferenceApi(record.key, { [field]: checked });
    const index = categories.value.findIndex((item) => item.key === record.key);
    if (index >= 0) {
      categories.value.splice(index, 1, updated);
    }
  } finally {
    savingKeys.value = {
      ...savingKeys.value,
      [key]: false,
    };
  }
}

onMounted(loadData);
</script>

<template>
  <Spin :spinning="loading">
    <Card :bordered="false" class="shadow-sm">
      <div class="mb-6">
        <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">消息提醒偏好</div>
        <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          管理站内信与邮件两个通道的开关，和旧用户端 `/accounts/notifications/` 使用同一套后端偏好配置。
        </div>
      </div>

      <div v-if="categories.length === 0" class="py-8">
        <Empty description="暂时还没有可配置的通知分类" />
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="record in categories"
          :key="record.key"
          class="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{{ record.label }}</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {{ record.description || '未填写说明，默认按系统策略处理。' }}
              </div>
            </div>
            <div class="grid gap-3 sm:min-w-72 sm:grid-cols-2">
              <div class="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60">
                <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">站内信</div>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <span class="text-sm text-zinc-700 dark:text-zinc-200">应用内提醒</span>
                  <Switch
                    :checked="record.in_app"
                    :loading="savingKeys[`${record.key}:in_app`]"
                    @change="(checked) => togglePreference(record, 'in_app', checked)"
                  />
                </div>
              </div>
              <div class="rounded-xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900/60">
                <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮件</div>
                <div class="mt-3 flex items-center justify-between gap-3">
                  <span class="text-sm text-zinc-700 dark:text-zinc-200">收件箱提醒</span>
                  <Switch
                    :checked="record.email"
                    :loading="savingKeys[`${record.key}:email`]"
                    @change="(checked) => togglePreference(record, 'email', checked)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  </Spin>
</template>
