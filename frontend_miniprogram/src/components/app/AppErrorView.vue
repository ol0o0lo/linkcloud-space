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
  <view class="min-h-40 center flex-col p-4 text-center">
    <wd-empty icon="warning" :tip="title" />
    <view class="flex flex-col items-center gap-2.5 -mt-2.5">
      <text class="text-sm text-content-muted leading-relaxed">{{ message || error?.message || '请稍后重试' }}</text>
      <wd-button v-if="retryable && error?.retryable !== false" size="small" variant="plain" @click="$emit('retry')">
        {{ retryText }}
      </wd-button>
    </view>
  </view>
</template>
