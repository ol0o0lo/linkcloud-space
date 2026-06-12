<script setup lang="ts">
import { computed } from 'vue';

import { Avatar, Button, Tag } from 'antdv-next';

import type { ProfileHeroModel, ProfileSectionKey } from '../profile-dashboard';

const props = defineProps<{
  loading?: boolean;
  model: ProfileHeroModel;
}>();

const emit = defineEmits<{
  editSection: [section: ProfileSectionKey];
  openSection: [section: ProfileSectionKey];
}>();

const initials = computed(() => props.model.displayName.trim().slice(0, 1).toUpperCase() || 'U');
</script>

<template>
  <div class="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90 sm:p-6">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-4">
        <Avatar :size="76" :src="model.avatarUrl || undefined" class="shrink-0 bg-slate-900 text-xl font-semibold text-white dark:bg-slate-100 dark:text-slate-900">
          {{ initials }}
        </Avatar>

        <div>
          <div class="text-xs font-medium tracking-[0.24em] text-zinc-500 dark:text-zinc-400">个人中心</div>
          <div class="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            {{ model.displayName }}
          </div>
          <div class="mt-2 text-xl font-medium text-zinc-600 dark:text-zinc-300 sm:text-2xl">
            {{ model.email }}
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Tag :color="model.primaryBadge === '已认证' ? 'green' : model.primaryBadge === '审核中' ? 'gold' : 'default'">
              {{ model.primaryBadge }}
            </Tag>
            <Tag color="blue">{{ model.secondaryBadge }}</Tag>
          </div>
          <div class="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {{ model.currentOrgLabel || '个人资料管理与账户设置' }}
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-3 lg:justify-end lg:pt-1">
        <Button :disabled="loading" size="large" type="primary" @click="emit('editSection', 'basic')">编辑资料</Button>
        <Button :disabled="loading" size="large" @click="emit('editSection', 'security')">管理安全</Button>
      </div>
    </div>
  </div>
</template>
