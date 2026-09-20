<script setup lang="ts" generic="T extends Record<string, any>">
import type { AppError } from '@/core/errors/app-error'
import { computed } from 'vue'
import { distributeWaterfallItems } from './waterfall'
import AppEmpty from './AppEmpty.vue'
import AppErrorView from './AppErrorView.vue'
import AppLoading from './AppLoading.vue'

const props = withDefaults(defineProps<{
  items: T[]
  itemKey?: keyof T | ((item: T, index: number) => string | number)
  itemWeight?: (item: T, index: number) => number
  columns?: number
  gap?: string
  loading?: boolean
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
}>(), {
  columns: 2,
  gap: '18rpx',
  loading: false,
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
})

const emit = defineEmits<{
  retry: []
  emptyAction: []
}>()

const waterfallColumns = computed(() => distributeWaterfallItems(
  props.items,
  props.columns,
  props.itemWeight || (() => 1),
))
const waterfallStyle = computed(() => ({ gap: props.gap }))
const columnStyle = computed(() => ({ gap: props.gap }))

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
    <view class="app-waterfall-list" :style="waterfallStyle">
      <view v-for="(column, columnIndex) in waterfallColumns" :key="columnIndex" class="app-waterfall-list__column" :style="columnStyle">
        <view v-for="entry in column.items" :key="resolveKey(entry.item, entry.index)" class="app-waterfall-list__item">
          <slot name="item" :item="entry.item" :index="entry.index" :weight="entry.weight" :column="columnIndex" />
        </view>
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
.app-waterfall-list {
  display: flex;
  align-items: flex-start;
}

.app-waterfall-list__column {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.app-waterfall-list__item {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
</style>
