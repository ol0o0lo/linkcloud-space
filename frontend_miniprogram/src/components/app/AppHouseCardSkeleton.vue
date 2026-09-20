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
  <view class="house-skeleton-list" :class="`house-skeleton-list--${variant}`" aria-hidden="true">
    <view v-for="item in count" :key="item" class="house-skeleton-card" :class="`house-skeleton-card--${variant}`">
      <wd-skeleton animation="gradient" :row-col="coverRows" />
      <view class="house-skeleton-content">
        <wd-skeleton animation="gradient" :row-col="contentRows" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.house-skeleton-card {
  display: flex;
  gap: 20rpx;
  min-height: 252rpx;
  padding: 20rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
}

.house-skeleton-content {
  min-width: 0;
  flex: 1;
  padding-top: 8rpx;
}

.house-skeleton-content :deep(.wd-skeleton__content) {
  display: flex;
  min-height: 194rpx;
  flex-direction: column;
  justify-content: space-between;
}

.house-skeleton-list--waterfall {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18rpx;
}

.house-skeleton-card--waterfall {
  display: block;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.house-skeleton-card--waterfall .house-skeleton-content {
  padding: 18rpx;
}

.house-skeleton-card--waterfall .house-skeleton-content :deep(.wd-skeleton__content) {
  min-height: 210rpx;
}

.house-skeleton-card--compact {
  gap: 16rpx;
  min-height: 176rpx;
  padding: 16rpx;
  border-radius: 24rpx;
}

.house-skeleton-card--compact .house-skeleton-content {
  padding-top: 4rpx;
}

.house-skeleton-card--compact .house-skeleton-content :deep(.wd-skeleton__content) {
  min-height: 126rpx;
}
</style>
