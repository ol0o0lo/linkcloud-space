<script setup lang="ts">
import type { AppError } from '@/core/errors/app-error'
import { computed, useSlots } from 'vue'
import AppActionBar from './AppActionBar.vue'
import AppAsyncContent from './AppAsyncContent.vue'
import AppPage from './AppPage.vue'

const props = withDefaults(defineProps<{
  loading?: boolean
  refreshing?: boolean
  error?: AppError | string | null
  empty?: boolean
  emptyText?: string
  emptyDescription?: string
  emptyIcon?: string
  emptyActionText?: string
  emptyCompact?: boolean
  loadingText?: string
  errorTitle?: string
  retryable?: boolean
  showActions?: boolean
  reserveActionSpace?: boolean
  contentClass?: string
}>(), {
  loading: false,
  refreshing: false,
  error: null,
  empty: false,
  emptyText: '暂无详情',
  emptyDescription: '',
  emptyIcon: 'no-content',
  emptyActionText: '',
  emptyCompact: false,
  loadingText: '正在加载…',
  errorTitle: '加载失败',
  retryable: true,
  showActions: true,
  reserveActionSpace: true,
  contentClass: 'flex flex-col gap-2.5 py-3',
})

const emit = defineEmits<{
  retry: []
  emptyAction: []
}>()

const slots = useSlots()
const actionsVisible = computed(() => Boolean(slots.actions) && props.showActions && !props.loading && !props.error && !props.empty)
</script>

<template>
  <AppPage variant="detail" gutter="none" :reserve-footer-space="actionsVisible && reserveActionSpace">
    <template #navigation>
      <slot name="navigation" />
    </template>
    <template #header>
      <slot name="header" />
    </template>
    <template #before>
      <slot name="feedback" />
    </template>
    <AppAsyncContent
      :loading="loading"
      :refreshing="refreshing"
      :error="error"
      :empty="empty"
      :empty-text="emptyText"
      :empty-description="emptyDescription"
      :empty-icon="emptyIcon"
      :empty-action-text="emptyActionText"
      :empty-compact="emptyCompact"
      :loading-text="loadingText"
      :error-title="errorTitle"
      :retryable="retryable"
      @retry="emit('retry')"
      @empty-action="emit('emptyAction')"
    >
      <slot name="hero" />
      <view :class="contentClass">
        <slot />
      </view>
    </AppAsyncContent>
    <template v-if="actionsVisible" #footer>
      <AppActionBar :placeholder="reserveActionSpace">
        <slot name="actions" />
      </AppActionBar>
    </template>
    <template v-if="slots.overlay" #overlay>
      <slot name="overlay" />
    </template>
  </AppPage>
</template>
