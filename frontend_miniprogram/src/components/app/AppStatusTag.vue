<script setup lang="ts">
import { computed } from 'vue'

export type AppStatusTone = 'default' | 'primary' | 'success' | 'warning' | 'danger'

const props = withDefaults(defineProps<{
  text: string
  tone?: AppStatusTone
  size?: 'small' | 'medium' | 'large'
}>(), {
  tone: 'default',
  size: 'small',
})

const type = computed(() => props.tone)
</script>

<template>
  <wd-tag :type="type" variant="light" :size="size">
    {{ text }}
  </wd-tag>
</template>
