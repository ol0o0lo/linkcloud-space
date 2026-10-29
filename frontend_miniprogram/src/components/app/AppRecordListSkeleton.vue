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
  <view class="record-skeleton-list flex flex-col gap-2.5" aria-hidden="true">
    <view v-for="item in props.count" :key="item" class="record-skeleton-card box-border min-h-18 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5" :class="`record-skeleton-card--${props.variant}`">
      <wd-skeleton v-if="props.variant === 'member'" animation="gradient" :row-col="avatarRow" />
      <view class="record-skeleton-content min-w-0 flex-1">
        <wd-skeleton animation="gradient" :row-col="props.variant === 'member' ? memberRows : recordRows" />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.record-skeleton-card--member {
  @apply flex min-h-14.5 items-center gap-2.5 py-3 px-3.5;
}
</style>
