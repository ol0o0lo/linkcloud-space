<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  selected?: boolean
  disabled?: boolean
  wrap?: boolean
  indicator?: 'check' | 'radio'
}>(), {
  description: '',
  selected: false,
  disabled: false,
  wrap: false,
  indicator: 'check',
})
</script>

<template>
  <view class="app-row-between" :class="disabled ? 'opacity-45' : ''">
    <slot name="leading" />
    <view class="min-w-0 flex-1">
      <view class="text-sm font-semibold" :class="[selected ? 'text-app-brand' : 'text-content-primary', wrap ? 'break-words whitespace-normal' : 'truncate']">
        {{ title }}
      </view>
      <view v-if="description" class="mt-1 text-xs text-content-muted" :class="wrap ? 'break-words whitespace-normal' : 'truncate'">
        {{ description }}
      </view>
    </view>
    <slot name="trailing">
      <view v-if="indicator === 'radio'" class="entity-option__radio ml-1.5 box-border h-4.5 w-4.5 flex shrink-0 items-center justify-center rounded-full" :class="{ 'entity-option__radio--selected': selected }">
        <view v-if="selected" class="i-carbon-checkmark text-xs text-content-on-brand" />
      </view>
      <view v-else-if="selected" class="i-carbon-checkmark text-base text-app-brand" />
    </slot>
  </view>
</template>

<style lang="scss" scoped>
.entity-option__radio {
  @apply border-1 border-solid border-app-border bg-surface-card;
}
.entity-option__radio--selected {
  @apply border-app-brand bg-app-brand;
}
</style>
