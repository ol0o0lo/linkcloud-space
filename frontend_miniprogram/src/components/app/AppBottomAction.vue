<script setup lang="ts">
withDefaults(defineProps<{
  elevated?: boolean
}>(), {
  elevated: true,
})
</script>

<template>
  <view class="app-bottom-action fixed bottom-0 left-0 right-0 z-20 bg-surface-translucent" :class="{ 'app-bottom-action--elevated': elevated }">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-bottom-action {
  padding: 18rpx var(--app-page-gutter) calc(18rpx + env(safe-area-inset-bottom));
}

.app-bottom-action--elevated {
  @apply shadow-app-bottom;
}
</style>
