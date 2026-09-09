<script setup lang="ts">
import type { AppError } from '@/core/errors/app-error'

withDefaults(defineProps<{
  error?: AppError | null
  message?: string
  title?: string
  retryText?: string
  retryable?: boolean
}>(), {
  error: null,
  message: '',
  title: '加载失败',
  retryText: '重新加载',
  retryable: true,
})

defineEmits<{
  retry: []
}>()
</script>

<template>
  <view class="app-error-view">
    <wd-empty icon="warning" :tip="title" />
    <view class="app-error-view__content">
      <text class="app-error-view__message">{{ message || error?.message || '请稍后重试' }}</text>
      <wd-button v-if="retryable && error?.retryable !== false" size="small" variant="plain" @click="$emit('retry')">
        {{ retryText }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.app-error-view {
  display: flex;
  min-height: 320rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  text-align: center;
}

.app-error-view__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  margin-top: -20rpx;
}

.app-error-view__message {
  color: var(--app-text-muted);
  font-size: 26rpx;
  line-height: 1.7;
}
</style>
