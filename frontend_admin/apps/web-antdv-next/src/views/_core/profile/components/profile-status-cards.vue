<script setup lang="ts">
import { Button, Tag } from 'antdv-next';

import type { ProfileStatusCard, ProfileSectionKey } from '../profile-dashboard';

defineProps<{
  cards: ProfileStatusCard[];
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();

function toneClass(tone: ProfileStatusCard['tone']) {
  if (tone === 'positive') {
    return 'border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20';
  }
  if (tone === 'warning') {
    return 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20';
  }
  return 'border-zinc-200/80 bg-white dark:border-zinc-800 dark:bg-zinc-950';
}
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-4">
    <div
      v-for="card in cards"
      :key="card.key"
      :class="toneClass(card.tone)"
      class="rounded-3xl border p-5 shadow-sm transition-colors"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{{ card.title }}</div>
          <div class="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{{ card.summary }}</div>
        </div>
      </div>

      <div class="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{{ card.description }}</div>

      <div class="mt-4 flex flex-wrap gap-2">
        <Tag v-for="tag in card.tags" :key="tag">{{ tag }}</Tag>
      </div>

      <div class="mt-5">
        <Button block type="primary" @click="emit('openSection', card.key)">{{ card.actionLabel }}</Button>
      </div>
    </div>
  </div>
</template>
