<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
}>(), {
  text: '正在加载…',
})
</script>

<template>
  <view class="app-loading">
    <wd-loading direction="horizontal" :text="text" />
  </view>
</template>

<style scoped lang="scss">
.app-loading {
  display: flex;
  min-height: 240rpx;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  font-size: 26rpx;
}
</style>
