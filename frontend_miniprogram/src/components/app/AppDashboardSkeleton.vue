<script setup lang="ts">
import AppRecordListSkeleton from './AppRecordListSkeleton.vue'

withDefaults(defineProps<{
  metricCount?: number
  compact?: boolean
}>(), {
  metricCount: 4,
  compact: false,
})

const heroRows = [
  { width: '28%', height: '20rpx', borderRadius: '8rpx' },
  { width: '68%', height: '44rpx', borderRadius: '14rpx' },
  { width: '82%', height: '20rpx', borderRadius: '8rpx' },
]
const metricRows = [
  { width: '54%', height: '38rpx', borderRadius: '12rpx' },
  { width: '72%', height: '18rpx', borderRadius: '8rpx' },
]
</script>

<template>
  <view class="dashboard-skeleton" :class="{ 'dashboard-skeleton--compact': compact }" aria-hidden="true">
    <view class="dashboard-skeleton__hero">
      <wd-skeleton animation="gradient" :row-col="heroRows" />
    </view>
    <view class="dashboard-skeleton__metrics" :class="{ 'dashboard-skeleton__metrics--three': metricCount === 3 }">
      <view v-for="item in metricCount" :key="item" class="dashboard-skeleton__metric">
        <wd-skeleton animation="gradient" :row-col="metricRows" />
      </view>
    </view>
    <AppRecordListSkeleton :count="compact ? 2 : 3" />
  </view>
</template>

<style scoped lang="scss">
.dashboard-skeleton {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.dashboard-skeleton__hero {
  min-height: 260rpx;
  padding: 38rpx 36rpx;
  border-radius: var(--app-radius-xl);
  box-sizing: border-box;
  background: linear-gradient(135deg, #e7e3ff, #f2efff);
}

.dashboard-skeleton__hero :deep(.wd-skeleton__content) {
  display: flex;
  min-height: 184rpx;
  flex-direction: column;
  justify-content: space-between;
}

.dashboard-skeleton__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
}

.dashboard-skeleton__metrics--three {
  grid-template-columns: repeat(3, 1fr);
}

.dashboard-skeleton__metric {
  min-height: 126rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
}

.dashboard-skeleton--compact .dashboard-skeleton__hero {
  min-height: 156rpx;
}

.dashboard-skeleton--compact .dashboard-skeleton__hero :deep(.wd-skeleton__content) {
  min-height: 82rpx;
}
</style>
