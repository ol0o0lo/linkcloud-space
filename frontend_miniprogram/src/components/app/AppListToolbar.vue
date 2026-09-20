<script setup lang="ts">
import { useSlots } from 'vue'

withDefaults(defineProps<{
  keyword?: string
  searchable?: boolean
  searchPlaceholder?: string
  actionText?: string
  actionLoading?: boolean
  actionDisabled?: boolean
  card?: boolean
}>(), {
  keyword: '',
  searchable: true,
  searchPlaceholder: '搜索',
  actionText: '',
  actionLoading: false,
  actionDisabled: false,
  card: false,
})

const emit = defineEmits<{
  'update:keyword': [value: string]
  'search': []
  'clear': []
  'action': []
}>()

const slots = useSlots()
</script>

<template>
  <view class="flex flex-col gap-1.5" :class="card ? 'app-card-plain p-1.5' : ''">
    <slot name="before" />
    <view class="flex items-center gap-1.5">
      <wd-search
        v-if="searchable"
        class="min-w-0 flex-1"
        :model-value="keyword"
        :placeholder="searchPlaceholder"
        hide-cancel
        @update:model-value="emit('update:keyword', $event)"
        @search="emit('search')"
        @clear="emit('clear')"
      />
      <slot name="actions">
        <wd-button
          v-if="actionText"
          size="small"
          :loading="actionLoading"
          :disabled="actionDisabled"
          @click="emit('action')"
        >
          {{ actionText }}
        </wd-button>
      </slot>
    </view>
    <slot name="filters" />
    <slot name="after" />
  </view>
</template>
