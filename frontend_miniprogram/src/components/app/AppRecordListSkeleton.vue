<script setup lang="ts">
const props = withDefaults(defineProps<{
  count?: number
  variant?: 'member' | 'record'
}>(), {
  count: 4,
  variant: 'record',
})

const avatarRow = [{ type: 'rect' as const, width: '72rpx', height: '72rpx', borderRadius: '22rpx' }]
const memberRows = [
  { width: '48%', height: '24rpx', borderRadius: '9rpx' },
  { width: '82%', height: '18rpx', borderRadius: '8rpx' },
]
const recordRows = [
  [
    { width: '58%', height: '24rpx', borderRadius: '9rpx', marginRight: '24rpx' },
    { width: '18%', height: '28rpx', borderRadius: '14rpx' },
  ],
  { width: '88%', height: '18rpx', borderRadius: '8rpx' },
  { width: '42%', height: '18rpx', borderRadius: '8rpx' },
]
</script>

<template>
  <view class="record-skeleton-list" aria-hidden="true">
    <view v-for="item in props.count" :key="item" class="record-skeleton-card" :class="`record-skeleton-card--${props.variant}`">
      <wd-skeleton v-if="props.variant === 'member'" animation="gradient" :row-col="avatarRow" />
      <view class="record-skeleton-content">
        <wd-skeleton animation="gradient" :row-col="props.variant === 'member' ? memberRows : recordRows" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.record-skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.record-skeleton-card {
  min-height: 142rpx;
  padding: 26rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
}

.record-skeleton-card--member {
  display: flex;
  min-height: 116rpx;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 26rpx;
}

.record-skeleton-content {
  min-width: 0;
  flex: 1;
}
</style>
