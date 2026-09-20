<script setup lang="ts">
withDefaults(defineProps<{
  text?: string
}>(), {
  text: '正在加载…',
})
</script>

<template>
  <view class="min-h-32 center text-sm text-content-muted">
    <wd-loading direction="horizontal" :text="text" />
  </view>
</template>
