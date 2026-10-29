<script setup lang="ts" generic="T extends Record<string, any>">
import type { AppError } from '@/core/errors/app-error'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'

const props = withDefaults(defineProps<{
  visible: boolean
  keyword?: string
  title: string
  description?: string
  items: T[]
  itemKey?: keyof T | ((item: T, index: number) => string | number)
  selected?: Array<string | number>
  selection?: 'single' | 'multiple'
  searchable?: boolean
  searchPlaceholder?: string
  loading?: boolean
  finished?: boolean
  error?: AppError | string | null
  emptyText?: string
  itemIcon?: string
}>(), {
  keyword: '',
  description: '',
  selected: () => [],
  selection: 'single',
  searchable: true,
  searchPlaceholder: '搜索',
  loading: false,
  finished: true,
  error: null,
  emptyText: '暂无可选项',
  itemIcon: '',
})

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'update:keyword': [value: string]
  'search': []
  'load-more': []
  'select': [item: T]
  'confirm': []
}>()

function resolveKey(item: T, index: number) {
  const itemKey = props.itemKey || 'id'
  return typeof itemKey === 'function' ? itemKey(item, index) : item[itemKey] ?? index
}

function isSelected(item: T, index: number) {
  return props.selected.includes(resolveKey(item, index))
}
</script>

<template>
  <AppBottomSheet
    :visible="visible"
    :title="title"
    :description="description"
    show-handle
    panel-height="min(76vh, 680px)"
    custom-style="--wot-popup-radius: 24px; --wot-popup-close-size: 20px;"
    @update:visible="emit('update:visible', $event)"
  >
    <template #header>
      <view class="pb-4 pr-9 pt-1">
        <view class="text-lg text-content-primary font-semibold">
          {{ title }}
        </view>
        <view v-if="description" class="mt-1 text-xs text-content-muted leading-relaxed">
          {{ description }}
        </view>
      </view>
    </template>
    <template #toolbar>
      <view class="entity-picker__toolbar">
        <wd-search
          v-if="searchable"
          :model-value="keyword"
          :placeholder="searchPlaceholder"
          variant="filled"
          placeholder-left
          hide-cancel
          @update:model-value="emit('update:keyword', $event)"
          @search="emit('search')"
          @clear="emit('search')"
        />
        <view v-if="$slots['before-list']" class="mt-3">
          <slot name="before-list" />
        </view>
        <view class="flex items-center justify-between pb-2 pt-3 text-xs text-content-muted">
          <text>{{ keyword ? '搜索结果' : '可选列表' }}</text>
          <text>{{ loading ? '加载中…' : `当前 ${items.length} 项` }}</text>
        </view>
      </view>
    </template>
    <view class="entity-picker__list">
      <AppLoading v-if="loading && !items.length" />
      <AppErrorView
        v-else-if="error && !items.length"
        :error="typeof error === 'string' ? null : error"
        :message="typeof error === 'string' ? error : ''"
        @retry="emit('search')"
      />
      <AppEmpty v-else-if="!items.length" :title="emptyText" icon="no-result" compact />
      <view v-else class="flex flex-col gap-2">
        <button
          v-for="(item, index) in items"
          :key="resolveKey(item, index)"
          class="entity-picker__option m-0 box-border w-full flex items-center gap-2.5 rounded-app-lg p-3 text-left leading-normal"
          :class="{ 'entity-picker__option--selected': isSelected(item, index) }"
          :aria-pressed="isSelected(item, index)"
          @click="emit('select', item)"
        >
          <view v-if="itemIcon" class="entity-picker__icon h-9 w-9 flex shrink-0 items-center justify-center rounded-app-md text-size-lg" :class="{ 'entity-picker__icon--selected': isSelected(item, index) }">
            <view :class="itemIcon" />
          </view>
          <view class="min-w-0 flex-1">
            <slot name="item" :item="item" :index="index" :selected="isSelected(item, index)" />
          </view>
        </button>
        <wd-loadmore
          v-if="!finished"
          :state="loading ? 'loading' : 'finished'"
          @click="emit('load-more')"
        />
      </view>
      <slot name="create" />
    </view>
    <template v-if="selection === 'multiple' || $slots.footer" #footer>
      <slot name="footer">
        <wd-button block @click="emit('confirm')">
          确定
        </wd-button>
      </slot>
    </template>
  </AppBottomSheet>
</template>

<style lang="scss" scoped>
.entity-picker__toolbar {
  --wot-search-padding: 0;
  --wot-search-input-height: 88rpx;
  --wot-search-input-radius: var(--app-radius-lg);
  --wot-search-input-bg: var(--app-bg-page);
  --wot-search-bg: transparent;
  --wot-search-input-font-size: 28rpx;
  --wot-search-placeholder-font-size: 26rpx;
}
.entity-picker__list {
  padding: 2rpx 0 8rpx;
}
.entity-picker__option {
  @apply border-hairline border-solid border-app-card bg-surface-page;
  &::after {
    @apply border-0;
  }
}
.entity-picker__option--selected {
  @apply border-app-brand bg-surface-brand-soft;
}
.entity-picker__icon {
  @apply bg-surface-card text-content-secondary;
}
.entity-picker__icon--selected {
  @apply text-app-brand;
}
</style>
