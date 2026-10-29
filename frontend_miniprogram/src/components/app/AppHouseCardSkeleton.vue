<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  count?: number
  variant?: 'horizontal' | 'waterfall' | 'compact'
}>(), {
  count: 3,
  variant: 'horizontal',
})

const coverRows = computed(() => [{
  type: 'rect' as const,
  width: props.variant === 'waterfall' ? '100%' : props.variant === 'compact' ? '152rpx' : '210rpx',
  height: props.variant === 'waterfall' ? '224rpx' : props.variant === 'compact' ? '142rpx' : '210rpx',
  borderRadius: props.variant === 'waterfall' ? '0' : props.variant === 'compact' ? '18rpx' : '22rpx',
}])

const contentRows = computed(() => props.variant === 'waterfall'
  ? [
      { width: '84%', height: '26rpx', borderRadius: '9rpx' },
      { width: '66%', height: '19rpx', borderRadius: '7rpx' },
      { width: '92%', height: '19rpx', borderRadius: '7rpx' },
      { width: '58%', height: '30rpx', borderRadius: '9rpx' },
      { width: '42%', height: '18rpx', borderRadius: '7rpx' },
    ]
  : [
      { width: '76%', height: props.variant === 'compact' ? '24rpx' : '28rpx', borderRadius: '10rpx' },
      { width: '94%', height: '20rpx', borderRadius: '8rpx' },
      [
        { width: '42%', height: props.variant === 'compact' ? '28rpx' : '34rpx', borderRadius: '10rpx', marginRight: '18rpx' },
        { width: '34%', height: '20rpx', borderRadius: '8rpx' },
      ],
    ])
</script>

<template>
  <view class="house-skeleton-list flex flex-col gap-3" :class="`house-skeleton-list--${variant}`" aria-hidden="true">
    <view v-for="item in count" :key="item" class="house-skeleton-card box-border min-h-32 flex gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-2.5" :class="`house-skeleton-card--${variant}`">
      <wd-skeleton animation="gradient" :row-col="coverRows" />
      <view class="house-skeleton-content min-w-0 flex-1 pt-1">
        <wd-skeleton animation="gradient" :row-col="contentRows" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-skeleton-content :deep(.wd-skeleton__content) {
  @apply flex min-h-24 flex-col justify-between;
}

.house-skeleton-list--waterfall {
  @apply grid grid-cols-2 gap-2.5;
}

.house-skeleton-card--waterfall {
  @apply block min-h-0 p-0 overflow-hidden;
}

.house-skeleton-card--waterfall .house-skeleton-content {
  @apply p-2.5;
}

.house-skeleton-card--waterfall .house-skeleton-content :deep(.wd-skeleton__content) {
  @apply min-h-26;
}

.house-skeleton-card--compact {
  @apply gap-2 min-h-22 p-2 rounded-3;
}

.house-skeleton-card--compact .house-skeleton-content {
  @apply pt-0.5;
}

.house-skeleton-card--compact .house-skeleton-content :deep(.wd-skeleton__content) {
  @apply min-h-16;
}
</style>
