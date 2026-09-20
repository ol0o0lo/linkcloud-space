<script setup lang="ts" generic="T extends Record<string, any>">
import type { AppError } from '@/core/errors/app-error'
import AppEmpty from './AppEmpty.vue'
import AppErrorView from './AppErrorView.vue'
import AppLoading from './AppLoading.vue'

const props = withDefaults(defineProps<{
  items: T[]
  itemKey?: keyof T | ((item: T, index: number) => string | number)
  loading?: boolean
  refreshing?: boolean
  loadingMore?: boolean
  finished?: boolean
  error?: AppError | string | null
  emptyText?: string
  emptyDescription?: string
  emptyIcon?: string
  emptyActionText?: string
  emptyCompact?: boolean
  loadingText?: string
  finishedText?: string
  layout?: 'stack' | 'cell' | 'grid' | 'custom'
}>(), {
  loading: false,
  refreshing: false,
  loadingMore: false,
  finished: false,
  error: null,
  emptyText: '暂无内容',
  emptyDescription: '',
  emptyIcon: 'no-content',
  emptyActionText: '',
  emptyCompact: false,
  loadingText: '正在加载…',
  finishedText: '已经到底了',
  layout: 'stack',
})

const emit = defineEmits<{
  retry: []
  emptyAction: []
}>()

function resolveKey(item: T, index: number) {
  const itemKey = props.itemKey || 'id'
  return typeof itemKey === 'function' ? itemKey(item, index) : String(item[itemKey] ?? index)
}
</script>

<template>
  <slot name="before" />
  <slot v-if="loading && !items.length" name="loading">
    <AppLoading :text="loadingText" />
  </slot>
  <slot v-else-if="error && !items.length" name="error" :error="error">
    <AppErrorView
      :error="typeof error === 'string' ? null : error"
      :message="typeof error === 'string' ? error : ''"
      @retry="emit('retry')"
    />
  </slot>
  <slot v-else-if="!items.length" name="empty">
    <AppEmpty
      :title="emptyText"
      :description="emptyDescription"
      :icon="emptyIcon"
      :action-text="emptyActionText"
      :compact="emptyCompact"
      @action="emit('emptyAction')"
    />
  </slot>
  <template v-else>
    <view
      :class="{
        'app-stack-list': layout === 'stack',
        'flex flex-col': layout === 'cell',
        'grid grid-cols-2 gap-2': layout === 'grid',
      }"
    >
      <view v-for="(item, index) in items" :key="resolveKey(item, index)" class="app-paged-list__item">
        <slot name="item" :item="item" :index="index" />
      </view>
    </view>
    <slot name="loadmore">
      <wd-loadmore
        :state="loadingMore ? 'loading' : error ? 'error' : finished ? 'finished' : undefined"
        :loading-text="loadingText"
        :finished-text="finishedText"
        :error-text="typeof error === 'string' ? error : error?.message"
        @reload="emit('retry')"
      />
    </slot>
  </template>
  <slot name="after" />
</template>

<style scoped>
.app-paged-list__item {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>
