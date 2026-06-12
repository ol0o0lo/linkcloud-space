<script setup lang="ts">
import type { Props } from './types';

import { computed } from 'vue';

import { preferences } from '@vben-core/preferences';
import { VbenAvatar } from '@vben-core/shadcn-ui';

import { Page } from '../../components';

defineOptions({
  name: 'ProfileUI',
});

const props = withDefaults(defineProps<Props>(), {
  title: '个人中心',
});

const displayName = computed(() => props.userInfo?.realName || props.userInfo?.username || props.title);
</script>
<template>
  <Page auto-content-height content-class="overflow-x-hidden">
    <div class="flex flex-col gap-6">
      <div class="overflow-hidden rounded-lg border border-zinc-200/80 bg-linear-to-r from-white via-sky-50/70 to-emerald-50/40 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-sky-950/20 dark:to-emerald-950/10 sm:p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="text-sm font-medium text-zinc-500 dark:text-zinc-400">账户中心</div>
            <h1 class="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
              {{ props.title }}
            </h1>
            <p class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              管理个人资料、安全方式和提醒偏好，让常用设置更容易查看和调整。
            </p>
          </div>

          <div class="flex min-w-0 items-center gap-4 rounded-lg border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
            <VbenAvatar
              :src="props.userInfo?.avatar ?? preferences.app.defaultAvatar"
              class="size-14 flex-none sm:size-16"
            />
            <div class="min-w-0">
              <div class="truncate text-base font-semibold text-zinc-950 dark:text-zinc-50">
                {{ displayName }}
              </div>
              <div class="truncate text-sm text-zinc-500 dark:text-zinc-400">
                @{{ props.userInfo?.username ?? 'account' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full min-w-0">
        <slot name="content"></slot>
      </div>
    </div>
  </Page>
</template>
