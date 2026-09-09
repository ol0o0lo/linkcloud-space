<script setup lang="ts">
withDefaults(defineProps<{
  elevated?: boolean
}>(), {
  elevated: true,
})
</script>

<template>
  <view class="app-bottom-action" :class="{ 'app-bottom-action--elevated': elevated }">
    <slot />
  </view>
</template>

<style scoped lang="scss">
.app-bottom-action {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  padding: 18rpx var(--app-page-gutter) calc(18rpx + env(safe-area-inset-bottom));
  background: var(--app-bg-elevated-translucent);
}

.app-bottom-action--elevated {
  box-shadow: var(--app-shadow-bottom-action);
}
</style>
