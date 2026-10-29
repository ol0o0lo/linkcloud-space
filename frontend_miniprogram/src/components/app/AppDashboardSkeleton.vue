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
  <view class="dashboard-skeleton flex flex-col gap-3" :class="{ 'dashboard-skeleton--compact': compact }" aria-hidden="true">
    <view class="dashboard-skeleton__hero box-border min-h-33 rounded-app-xl px-4.5 py-5">
      <wd-skeleton animation="gradient" :row-col="heroRows" />
    </view>
    <view class="dashboard-skeleton__metrics grid gap-2.5" :class="{ 'dashboard-skeleton__metrics--three': metricCount === 3 }">
      <view v-for="item in metricCount" :key="item" class="dashboard-skeleton__metric box-border min-h-16 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3">
        <wd-skeleton animation="gradient" :row-col="metricRows" />
      </view>
    </view>
    <AppRecordListSkeleton :count="compact ? 2 : 3" />
  </view>
</template>

<style scoped lang="scss">
.dashboard-skeleton__hero {
  background: linear-gradient(135deg, #e7e3ff, #f2efff);
}

.dashboard-skeleton__hero :deep(.wd-skeleton__content) {
  @apply flex min-h-23 flex-col justify-between;
}

.dashboard-skeleton__metrics {
  @apply grid-cols-2;
}

.dashboard-skeleton__metrics--three {
  @apply grid-cols-3;
}

.dashboard-skeleton--compact .dashboard-skeleton__hero {
  @apply min-h-20;
}

.dashboard-skeleton--compact .dashboard-skeleton__hero :deep(.wd-skeleton__content) {
  @apply min-h-10.5;
}
</style>
