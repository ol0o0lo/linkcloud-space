<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Button, Empty, Spin, Switch } from 'antdv-next';

import {
  listNotificationPreferencesApi,
  type NotificationPreferenceRow,
  updateNotificationPreferenceApi,
} from '#/api/django/resources';

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const loading = ref(false);
const categories = ref<NotificationPreferenceRow[]>([]);
const savingKeys = ref<Record<string, boolean>>({});
const isEditing = ref(false);
const summary = computed(() => ({
  emailEnabled: categories.value.filter((item) => item.email).length,
  inAppEnabled: categories.value.filter((item) => item.in_app).length,
  total: categories.value.length,
}));

function toggleEditing(open: boolean) {
  isEditing.value = open;
  emit('editChange', open);
}

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
    emit('statusChange');
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
    <div>
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="text-xl font-semibold text-zinc-950 dark:text-zinc-50">通知设置</div>
          <div class="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            支持先查看通知渠道状态，也支持从个人中心直接进入编辑态逐项调整触达方式。
          </div>
        </div>

        <Button v-if="!isEditing" class="w-full sm:w-auto" type="primary" @click="toggleEditing(true)">
          编辑通知
        </Button>
        <Button v-else class="w-full sm:w-auto" type="primary" @click="toggleEditing(false)">完成</Button>
      </div>

      <div v-if="categories.length === 0" class="py-8">
        <Empty description="暂时还没有可配置的通知分类" />
      </div>

      <div v-else-if="!isEditing" class="overflow-hidden rounded-[28px] border border-slate-200/80 bg-slate-50/50 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">站内提醒</div>
            <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">组织邀请、系统通知和协作变更会在后台内实时显示。</div>
          </div>
          <div class="text-sm font-medium text-zinc-950 dark:text-zinc-50">已开启 {{ summary.inAppEnabled }} / {{ summary.total }} 类</div>
        </div>

        <div class="border-t border-slate-200/80 dark:border-zinc-800"></div>

        <div class="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">邮件通知</div>
            <div class="mt-2 text-sm text-zinc-500 dark:text-zinc-400">需要留痕或需要离线触达的消息，会根据分类发送到收件箱。</div>
          </div>
          <div class="text-sm font-medium text-zinc-950 dark:text-zinc-50">已开启 {{ summary.emailEnabled }} / {{ summary.total }} 类</div>
        </div>
      </div>

      <div v-else class="space-y-4 rounded-[28px] border border-slate-200/80 bg-slate-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/40 sm:p-6">
        <div
          v-for="record in categories"
          :key="record.key"
          class="rounded-2xl border border-white/90 bg-white p-4 dark:border-white/10 dark:bg-zinc-950/60"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{{ record.label }}</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {{ record.description || '未填写说明，默认按系统策略处理。' }}
              </div>
            </div>
            <div class="grid gap-3 sm:min-w-72 sm:grid-cols-2">
              <div class="rounded-xl bg-slate-50 px-4 py-3 dark:bg-zinc-900/60">
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
              <div class="rounded-xl bg-slate-50 px-4 py-3 dark:bg-zinc-900/60">
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
    </div>
  </Spin>
</template>
