<script setup lang="ts">
import { Button } from 'antdv-next';

import type { ProfileSectionKey } from '../profile-dashboard';

const items = [
  { key: 'basic', label: '资料' },
  { key: 'security', label: '安全' },
  { key: 'password', label: '密码' },
  { key: 'notification', label: '通知' },
] as const satisfies Array<{ key: ProfileSectionKey; label: string }>;

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();
</script>

<template>
  <div class="flex flex-wrap gap-3 rounded-2xl border border-zinc-200/80 bg-white/80 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
    <Button v-for="item in items" :key="item.key" @click="emit('openSection', item.key)">{{ item.label }}</Button>
  </div>
</template>
