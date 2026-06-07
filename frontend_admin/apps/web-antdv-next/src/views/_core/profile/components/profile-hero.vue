<script setup lang="ts">
import { computed } from 'vue';

import { Button, Tag } from 'antdv-next';

import type { ProfileHeroModel, ProfileSectionKey } from '../profile-dashboard';

const props = defineProps<{
  loading?: boolean;
  model: ProfileHeroModel;
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();

const initials = computed(() => props.model.displayName.trim().slice(0, 1).toUpperCase() || 'U');
</script>

<template>
  <div class="overflow-hidden rounded-[32px] border border-slate-200 bg-linear-to-br from-slate-50 via-white to-sky-50 p-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-950 dark:to-sky-950/20 sm:p-7">
    <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-4">
        <div class="flex size-20 shrink-0 items-center justify-center rounded-[26px] bg-linear-to-br from-blue-100 to-slate-200 text-3xl font-semibold text-blue-700 shadow-inner dark:from-slate-800 dark:to-slate-700 dark:text-sky-200">
          {{ initials }}
        </div>

        <div>
          <div class="text-sm font-medium tracking-[0.18em] text-zinc-500 dark:text-zinc-400">个人中心</div>
          <div class="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-4xl">
            {{ model.displayName }}
          </div>
          <div class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ model.currentOrgLabel || '个人资料管理与账户设置' }}</div>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs">
            <Tag color="blue">@{{ model.username }}</Tag>
            <Tag :color="model.phoneVerified ? 'green' : 'gold'">{{ model.phoneVerified ? '手机号已验证' : '手机号待验证' }}</Tag>
            <Tag>{{ model.completionText }}</Tag>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap gap-3 lg:justify-end">
        <Button :disabled="loading" type="primary" @click="emit('openSection', 'basic')">编辑资料</Button>
        <Button :disabled="loading" @click="emit('openSection', 'security')">安全设置</Button>
      </div>
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-white/10 dark:bg-zinc-950/40">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">邮箱</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ model.email }}</div>
      </div>
      <div class="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-white/10 dark:bg-zinc-950/40">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">手机号</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ model.phone }}</div>
      </div>
      <div class="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-white/10 dark:bg-zinc-950/40">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">时区</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ model.timezone }}</div>
      </div>
      <div class="rounded-2xl border border-white/80 bg-white/90 p-4 dark:border-white/10 dark:bg-zinc-950/40">
        <div class="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">资料进度</div>
        <div class="mt-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">{{ model.completionText }}</div>
      </div>
    </div>
  </div>
</template>
