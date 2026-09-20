<script setup lang="ts">
import type { AppError } from '@/core/errors/app-error'
import AppEmpty from './AppEmpty.vue'
import AppErrorView from './AppErrorView.vue'
import AppLoading from './AppLoading.vue'

withDefaults(defineProps<{
  loading?: boolean
  refreshing?: boolean
  error?: AppError | string | null
  empty?: boolean
  retryable?: boolean
  loadingText?: string
  emptyText?: string
  emptyDescription?: string
  emptyIcon?: string
  emptyActionText?: string
  emptyCompact?: boolean
  errorTitle?: string
  keepContentOnRefresh?: boolean
}>(), {
  loading: false,
  refreshing: false,
  error: null,
  empty: false,
  retryable: true,
  loadingText: '正在加载…',
  emptyText: '暂无内容',
  emptyDescription: '',
  emptyIcon: 'no-content',
  emptyActionText: '',
  emptyCompact: false,
  errorTitle: '加载失败',
  keepContentOnRefresh: true,
})

defineEmits<{
  retry: []
  emptyAction: []
}>()
</script>

<template>
  <slot v-if="loading && !(refreshing && keepContentOnRefresh)" name="loading">
    <AppLoading :text="loadingText" />
  </slot>
  <slot v-else-if="error && !refreshing" name="error" :error="error">
    <AppErrorView
      :error="typeof error === 'string' ? null : error"
      :message="typeof error === 'string' ? error : ''"
      :title="errorTitle"
      :retryable="retryable"
      @retry="$emit('retry')"
    />
  </slot>
  <slot v-else-if="empty" name="empty">
    <AppEmpty
      :title="emptyText"
      :description="emptyDescription"
      :icon="emptyIcon"
      :action-text="emptyActionText"
      :compact="emptyCompact"
      @action="$emit('emptyAction')"
    />
  </slot>
  <template v-else>
    <slot />
    <view v-if="refreshing && keepContentOnRefresh" class="pointer-events-none fixed left-0 right-0 top-3 z-50 center">
      <view class="rounded-full bg-surface-translucent px-2.5 py-1.5 shadow-app-card">
        <wd-loading size="18px" direction="horizontal" text="刷新中…" />
      </view>
    </view>
  </template>
</template>
