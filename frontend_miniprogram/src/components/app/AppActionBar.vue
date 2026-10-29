<script setup lang="ts">
withDefaults(defineProps<{
  elevated?: boolean
  placeholder?: boolean
}>(), {
  elevated: true,
  placeholder: true,
})
</script>

<template>
  <view v-if="placeholder" class="h-safe-action" aria-hidden="true" />
  <view
    class="fixed bottom-0 left-0 right-0 z-20 box-border bg-surface-translucent px-app-gutter pt-2 pb-safe-action"
    :class="elevated ? 'shadow-app-bottom' : ''"
  >
    <view class="flex items-center gap-1.5">
      <slot />
    </view>
  </view>
</template>
