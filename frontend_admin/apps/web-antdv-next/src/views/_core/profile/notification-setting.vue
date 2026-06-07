<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { Button, Card, Empty, Spin, Switch } from 'antdv-next';

import type { ProfileSectionKey } from './profile-dashboard';

import {
  listNotificationPreferencesApi,
  type NotificationPreferenceRow,
  updateNotificationPreferenceApi,
} from '#/api/django/resources';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  statusChange: [];
}>();

const sectionKey: ProfileSectionKey = 'notification';
const loading = ref(false);
const categories = ref<NotificationPreferenceRow[]>([]);
const savingKeys = ref<Record<string, boolean>>({});
const isEditing = ref(false);
const isLockedByOtherSection = computed(() => props.activeEditSection !== null && props.activeEditSection !== sectionKey);
const summary = computed(() => ({
  emailEnabled: categories.value.filter((item) => item.email).length,
  inAppEnabled: categories.value.filter((item) => item.in_app).length,
  total: categories.value.length,
}));

watch(
  () => props.activeEditSection,
  (section) => {
    if (section !== sectionKey) {
      isEditing.value = false;
    }
  },
);

function toggleEditing(open: boolean) {
  if (open && isLockedByOtherSection.value) return;
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
    <Card :bordered="false" class="shadow-sm">
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">消息提醒</div>
          <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            先看当前提醒覆盖情况，再进入编辑模式统一调整站内信和邮件触达。
          </div>
        </div>

        <Button v-if="!isEditing" :disabled="isLockedByOtherSection" class="w-full sm:w-auto" type="primary" @click="toggleEditing(true)">
          编辑提醒方式
        </Button>
        <Button v-else class="w-full sm:w-auto" type="primary" @click="toggleEditing(false)">完成</Button>
      </div>

      <div v-if="categories.length === 0" class="py-8">
        <Empty description="暂时还没有可配置的通知分类" />
      </div>

      <div v-else-if="!isEditing" class="mt-6 grid gap-4 md:grid-cols-3">
        <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">通知分类</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ summary.total }} 个分类</div>
        </div>
        <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">站内信</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">开启 {{ summary.inAppEnabled }} 项</div>
        </div>
        <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮件</div>
          <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">开启 {{ summary.emailEnabled }} 项</div>
        </div>
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
