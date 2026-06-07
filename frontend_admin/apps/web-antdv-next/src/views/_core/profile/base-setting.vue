<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { Avatar, Button, Card, Input, Select, Spin, Tag, message } from 'antdv-next';

import type { ProfileSectionKey } from './profile-dashboard';

import {
  deleteCurrentUserAvatarApi,
  getCurrentUserApi,
  type UserRow,
  updateCurrentUserApi,
  uploadCurrentUserAvatarApi,
} from '#/api/django/resources';
import { useAuthStore } from '#/store';

const props = withDefaults(defineProps<{
  activeEditSection?: null | ProfileSectionKey;
}>(), {
  activeEditSection: null,
});

const emit = defineEmits<{
  editChange: [editing: boolean];
  profileUpdated: [];
}>();

const authStore = useAuthStore();
const sectionKey: ProfileSectionKey = 'basic';

const loading = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const avatarDeleting = ref(false);
const isEditing = ref(false);
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
const isLockedByOtherSection = computed(() => props.activeEditSection !== null && props.activeEditSection !== sectionKey);

const fullName = computed(() => {
  const current = profile.value;
  if (!current) return '';
  return [current.first_name, current.last_name].filter(Boolean).join(' ') || current.email || current.username;
});

const phoneStatus = computed(() => (profile.value?.phone_verified ? '已验证' : '未验证'));

function startEditing() {
  if (isLockedByOtherSection.value) return;
  isEditing.value = true;
  emit('editChange', true);
}

function cancelEditing() {
  if (profile.value) syncProfile(profile.value);
  isEditing.value = false;
  emit('editChange', false);
}

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
    isEditing.value = false;
    emit('editChange', false);
    emit('profileUpdated');
    message.success('个人资料已更新');
  } finally {
    saving.value = false;
  }
}

function triggerAvatarSelect() {
  if (isLockedByOtherSection.value) return;
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
    emit('profileUpdated');
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
    emit('profileUpdated');
    message.success('头像已移除');
  } finally {
    avatarDeleting.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <Spin :spinning="loading">
    <Card :bordered="false" class="shadow-sm">
      <input
        ref="fileInputRef"
        accept="image/*"
        class="hidden"
        type="file"
        @change="handleAvatarChange"
      >

      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div class="text-base font-semibold text-zinc-950 dark:text-zinc-50">基本信息</div>
          <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            这里集中管理你的基础资料，默认先展示，再按需进入编辑。
          </div>
        </div>

        <div class="flex w-full flex-wrap justify-end gap-3 sm:w-auto">
          <Button :disabled="isLockedByOtherSection" :loading="avatarUploading" @click="triggerAvatarSelect">上传头像</Button>
          <Button
            :disabled="isLockedByOtherSection || !profile?.avatar_url"
            :loading="avatarDeleting"
            danger
            ghost
            @click="removeAvatar"
          >
            移除头像
          </Button>
          <Button
            v-if="!isEditing"
            :disabled="isLockedByOtherSection"
            class="w-full sm:w-auto"
            type="primary"
            @click="startEditing"
          >
            编辑资料
          </Button>
          <template v-else>
            <Button class="w-full sm:w-auto" @click="cancelEditing">取消</Button>
            <Button :loading="saving" class="w-full sm:w-auto" type="primary" @click="saveProfile">保存资料</Button>
          </template>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div class="rounded-3xl border border-zinc-200/80 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/60">
          <div class="flex flex-col items-start gap-4">
            <Avatar :size="80" :src="profile?.avatar_url || undefined">
              {{ (fullName || profile?.username || '?').slice(0, 1).toUpperCase() }}
            </Avatar>
            <div>
              <div class="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{{ fullName || '当前用户' }}</div>
              <div class="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{{ profile?.email || '未设置邮箱' }}</div>
            </div>
            <div class="flex flex-wrap gap-2 text-xs">
              <Tag color="blue">{{ profile?.username || 'anonymous' }}</Tag>
              <Tag :color="profile?.phone_verified ? 'green' : 'gold'">手机号{{ phoneStatus }}</Tag>
              <Tag>{{ profile?.timezone || form.timezone }}</Tag>
            </div>
            <div class="rounded-2xl bg-white px-4 py-3 text-sm text-zinc-500 shadow-sm dark:bg-zinc-950/70 dark:text-zinc-400">
              资料会同步用于消息提醒、组织协作和后台审计展示，建议保持最新。
            </div>
          </div>
        </div>

        <div v-if="!isEditing" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">姓名</div>
            <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ fullName || '-' }}</div>
          </div>
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮箱</div>
            <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.email || '-' }}</div>
          </div>
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">手机号</div>
            <div class="mt-2 flex items-center gap-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">
              <span>{{ profile?.phone || '未绑定' }}</span>
              <Tag :color="profile?.phone_verified ? 'green' : 'gold'">{{ phoneStatus }}</Tag>
            </div>
          </div>
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">用户名</div>
            <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.username || '-' }}</div>
          </div>
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">时区</div>
            <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.timezone || form.timezone }}</div>
          </div>
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">资料状态</div>
            <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ profile?.avatar_url ? '头像已设置' : '建议补充头像' }}</div>
          </div>
        </div>

        <div v-else class="space-y-6">
          <div class="rounded-2xl border border-zinc-200/80 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
            <div class="text-sm font-medium text-zinc-950 dark:text-zinc-50">账号信息</div>
            <div class="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Tag color="blue">{{ profile?.username || 'anonymous' }}</Tag>
              <Tag>{{ profile?.email || '未设置邮箱' }}</Tag>
              <Tag :color="profile?.phone_verified ? 'green' : 'gold'">手机号{{ phoneStatus }}</Tag>
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
        </div>
      </div>
    </Card>
  </Spin>
</template>
