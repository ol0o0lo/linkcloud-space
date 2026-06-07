<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Avatar, Button, Card, Input, Select, Spin, Tag, message } from 'antdv-next';

import {
  deleteCurrentUserAvatarApi,
  getCurrentUserApi,
  type UserRow,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
} from '#/api/django/resources';
import { useAuthStore } from '#/store';

const authStore = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const avatarDeleting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const profile = ref<null | UserRow>(null);
const form = ref({
  first_name: '',
  last_name: '',
  timezone: 'Asia/Shanghai',
});

function buildTimezoneOptions(currentTimezone = '') {
  const values = new Set<string>(currentTimezone ? [currentTimezone] : []);
  const supportedValuesOf = (Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  }).supportedValuesOf;

  if (typeof supportedValuesOf === 'function') {
    for (const timezone of supportedValuesOf('timeZone')) {
      values.add(timezone);
    }
  }
  return [...values].sort((left, right) => left.localeCompare(right)).map((value) => ({
    label: value,
    value,
  }));
}

const timezoneOptions = computed(() => buildTimezoneOptions(form.value.timezone));

const fullName = computed(() => {
  const current = profile.value;
  if (!current) return '';
  return [current.first_name, current.last_name].filter(Boolean).join(' ') || current.email || current.username;
});

const phoneStatus = computed(() => (profile.value?.phone_verified ? '已验证' : '未验证'));

function syncProfile(data: UserRow) {
  profile.value = data;
  form.value = {
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    timezone: data.timezone || 'Asia/Shanghai',
  };
}

async function refreshProfile() {
  const data = await getCurrentUserApi();
  syncProfile(data);
}

async function loadData() {
  loading.value = true;
  try {
    await refreshProfile();
  } finally {
    loading.value = false;
  }
}

async function saveProfile() {
  if (!profile.value) return;
  saving.value = true;
  try {
    const data = await updateCurrentUserApi(profile.value.id, {
      first_name: form.value.first_name.trim(),
      last_name: form.value.last_name.trim(),
      timezone: form.value.timezone,
    });
    syncProfile(data);
    await authStore.fetchUserInfo();
    message.success('个人资料已更新');
  } finally {
    saving.value = false;
  }
}

function triggerAvatarSelect() {
  fileInputRef.value?.click();
}

async function handleAvatarChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';

  if (!file) return;

  avatarUploading.value = true;
  try {
    const result = await uploadCurrentUserAvatarApi(file);
    if (profile.value) {
      profile.value = {
        ...profile.value,
        avatar_url: result.avatar_url,
      };
    }
    await authStore.fetchUserInfo();
    message.success('头像已更新');
  } finally {
    avatarUploading.value = false;
  }
}

async function removeAvatar() {
  const currentProfile = profile.value;
  if (!currentProfile?.avatar_url) return;
  avatarDeleting.value = true;
  try {
    await deleteCurrentUserAvatarApi();
    profile.value = {
      ...currentProfile,
      avatar_url: null,
    };
    await authStore.fetchUserInfo();
    message.success('头像已移除');
  } finally {
    avatarDeleting.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <Spin :spinning="loading">
    <div class="space-y-6">
      <Card :bordered="false" class="shadow-sm">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div class="flex items-center gap-4">
            <Avatar :size="72" :src="profile?.avatar_url || undefined">
              {{ (fullName || profile?.username || '?').slice(0, 1).toUpperCase() }}
            </Avatar>
            <div>
              <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {{ fullName || '当前用户' }}
              </div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {{ profile?.email || '未设置邮箱' }}
              </div>
              <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <Tag color="blue">{{ profile?.username || 'anonymous' }}</Tag>
                <Tag :color="profile?.phone_verified ? 'green' : 'default'">手机号{{ phoneStatus }}</Tag>
                <Tag>{{ profile?.timezone || form.timezone }}</Tag>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap gap-3">
            <input
              ref="fileInputRef"
              accept="image/*"
              class="hidden"
              type="file"
              @change="handleAvatarChange"
            >
            <Button :loading="avatarUploading" @click="triggerAvatarSelect">上传头像</Button>
            <Button
              :disabled="!profile?.avatar_url"
              :loading="avatarDeleting"
              danger
              ghost
              @click="removeAvatar"
            >
              移除头像
            </Button>
          </div>
        </div>
      </Card>

      <Card :bordered="false" class="shadow-sm">
        <div class="mb-6">
          <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">基本资料</div>
          <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            这里维护登录后用户常用的个人资料，后续消息通知、租户协作和审计展示都复用这里的数据。
          </div>
        </div>

        <div class="grid gap-5 xl:grid-cols-2">
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">姓</div>
            <Input v-model:value="form.first_name" placeholder="请输入姓氏" />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">名</div>
            <Input v-model:value="form.last_name" placeholder="请输入名字" />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">用户名</div>
            <Input :value="profile?.username" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">邮箱</div>
            <Input :value="profile?.email || ''" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">手机号</div>
            <Input :value="profile?.phone || '未绑定'" disabled />
          </div>
          <div>
            <div class="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">时区</div>
            <Select
              v-model:value="form.timezone"
              :options="timezoneOptions"
              option-filter-prop="label"
              placeholder="请选择时区"
              show-search
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end">
          <Button :loading="saving" type="primary" @click="saveProfile">保存资料</Button>
        </div>
      </Card>
    </div>
  </Spin>
</template>
