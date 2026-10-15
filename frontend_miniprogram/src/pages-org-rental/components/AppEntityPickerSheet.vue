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
    height="tall"
    @update:visible="emit('update:visible', $event)"
  >
    <view class="flex flex-col gap-2">
      <wd-search
        v-if="searchable"
        :model-value="keyword"
        :placeholder="searchPlaceholder"
        hide-cancel
        @update:model-value="emit('update:keyword', $event)"
        @search="emit('search')"
        @clear="emit('search')"
      />
      <slot name="before-list" />
      <AppLoading v-if="loading && !items.length" />
      <AppErrorView
        v-else-if="error && !items.length"
        :error="typeof error === 'string' ? null : error"
        :message="typeof error === 'string' ? error : ''"
        @retry="emit('search')"
      />
      <AppEmpty v-else-if="!items.length" :title="emptyText" icon="no-result" compact />
      <view v-else class="flex flex-col">
        <view
          v-for="(item, index) in items"
          :key="resolveKey(item, index)"
          class="app-touchable border-0 border-b border-app-divider border-solid py-2.5 last:border-b-0"
          @click="emit('select', item)"
        >
          <slot name="item" :item="item" :index="index" :selected="isSelected(item, index)" />
        </view>
        <wd-loadmore
          v-if="!finished"
          :state="loading ? 'loading' : 'finished'"
          @click="emit('load-more')"
        />
      </view>
      <slot name="create" />
    </view>
    <template v-if="selection === 'multiple'" #footer>
      <slot name="footer">
        <wd-button block @click="emit('confirm')">
          确定
        </wd-button>
      </slot>
    </template>
  </AppBottomSheet>
</template>
