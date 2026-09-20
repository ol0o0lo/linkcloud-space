<script setup lang="ts">
import AppNotice from './AppNotice.vue'

export type AppStateTone = 'info' | 'success' | 'warning' | 'danger'

withDefaults(defineProps<{
  title: string
  description?: string
  tone?: AppStateTone
  icon?: string
}>(), {
  description: '',
  tone: 'info',
  icon: '',
})
</script>

<template>
  <AppNotice :title="title" :description="description" :tone="tone" :icon="icon">
    <slot />
    <template v-if="$slots.action" #action>
      <slot name="action" />
    </template>
  </AppNotice>
</template>
