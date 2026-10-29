<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  total?: number | null
  unit?: string
}>()
</script>

<template>
  <view class="rental-heading min-w-0 flex items-center justify-between gap-2.5 px-0 py-3.5">
    <view class="rental-heading__copy min-w-0">
      <view class="rental-heading__title flex flex-wrap items-center gap-2 text-size-xl text-content-primary leading-snug">
        <strong>{{ title }}</strong>
        <text v-if="total != null" class="rental-heading__count rounded-1.5 bg-surface-brand-soft text-size-xs text-app-brand-active font-medium">{{ total }}{{ unit }}</text>
      </view>
      <text v-if="description" class="rental-heading__description mt-1 block text-size-xs text-content-secondary leading-relaxed">{{ description }}</text>
    </view>
    <view v-if="$slots.default" class="rental-heading__action shrink-0">
      <slot />
    </view>
  </view>
</template>

<style scoped lang="scss">
.rental-heading__count {
  padding: 3rpx 12rpx;
}
</style>
