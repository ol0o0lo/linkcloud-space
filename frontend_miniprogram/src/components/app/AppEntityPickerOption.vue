<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  selected?: boolean
  disabled?: boolean
}>(), {
  description: '',
  selected: false,
  disabled: false,
})
</script>

<template>
  <view class="app-row-between" :class="disabled ? 'opacity-45' : ''">
    <slot name="leading" />
    <view class="min-w-0 flex-1">
      <view class="truncate text-sm font-semibold" :class="selected ? 'text-app-brand' : 'text-content-primary'">
        {{ title }}
      </view>
      <view v-if="description" class="mt-1 truncate text-xs text-content-muted">
        {{ description }}
      </view>
    </view>
    <slot name="trailing">
      <view v-if="selected" class="i-carbon-checkmark text-base text-app-brand" />
    </slot>
  </view>
</template>
