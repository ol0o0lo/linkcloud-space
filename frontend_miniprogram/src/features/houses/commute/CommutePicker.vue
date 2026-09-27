<script setup lang="ts">
import type { CommuteDraft, CommutePlace } from '@/features/houses/commute'
import { computed } from 'vue'
import { COMMUTE_MODES } from '@/features/houses/commute'
import { APP_ROUTES } from '@/modules/routes'

const props = defineProps<{
  modelValue: CommuteDraft
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CommuteDraft]
}>()

function change(value: Partial<CommuteDraft>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

const sliderMinutes = computed({
  get: () => props.modelValue.maxMinutes,
  set: value => change({ maxMinutes: Number(value) }),
})

function openPlaceSearch() {
  uni.navigateTo({
    url: `${APP_ROUTES.houseCommutePlace}${props.modelValue.place?.destinationId ? `?selected_id=${props.modelValue.place.destinationId}` : ''}`,
    events: { selectCommutePlace: (place: CommutePlace) => change({ place }) },
  })
}
</script>

<template>
  <view class="commute-picker" :class="{ 'commute-picker--compact': compact }">
    <view class="commute-picker__label">
      目的地
    </view>
    <button class="commute-picker__destination" @click="openPlaceSearch">
      <view class="i-carbon-search commute-picker__destination-icon" />
      <text class="commute-picker__destination-text" :class="{ 'commute-picker__destination-text--placeholder': !modelValue.place }">{{ modelValue.place?.name || '搜索公司、学校或地标' }}</text>
    </button>

    <view class="commute-picker__label commute-picker__label--spaced">
      出行方式
    </view>
    <view class="commute-picker__modes">
      <button v-for="item in COMMUTE_MODES" :key="item.value" class="commute-picker__mode" :class="{ active: modelValue.mode === item.value }" @click="change({ mode: item.value })">
        {{ item.label }}
      </button>
    </view>

    <view class="commute-picker__time">
      <text>最长通勤时间</text><strong>{{ modelValue.maxMinutes }} 分钟</strong>
    </view>
    <view class="commute-picker__slider">
      <wd-slider v-model="sliderMinutes" :min="15" :max="120" :step="5" show-extreme-value popover-visible="never" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.commute-picker {
  padding: 4rpx 0;
}
.commute-picker__label {
  margin-bottom: 12rpx;
  color: var(--app-text-primary);
  font-size: 25rpx;
  font-weight: 700;
}
.commute-picker__label--spaced {
  margin-top: 28rpx;
}
.commute-picker__destination {
  display: flex;
  width: 100%;
  min-height: 82rpx;
  align-items: center;
  gap: 16rpx;
  margin: 0;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 14rpx;
  text-align: left;
  background: var(--app-bg-page);
}
.commute-picker__destination::after,
.commute-picker__mode::after {
  border: 0;
}
.commute-picker__destination-text {
  display: block;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.commute-picker__destination-text--placeholder,
.commute-picker__destination-icon {
  color: var(--app-text-muted);
}
.commute-picker__destination-icon {
  font-size: 27rpx;
}
.commute-picker__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.commute-picker__mode {
  margin: 0;
  padding: 0 15rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 12rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
  line-height: 54rpx;
  background: var(--app-bg-page);
}
.commute-picker__mode.active {
  border-color: var(--app-color-brand);
  color: var(--app-color-brand);
  background: var(--app-bg-brand-soft);
}
.commute-picker__time {
  display: flex;
  justify-content: space-between;
  margin-top: 30rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
.commute-picker__time strong {
  color: var(--app-color-brand);
}
.commute-picker__slider {
  margin-top: 24rpx;
}
.commute-picker--compact {
  padding: 20rpx;
}
.commute-picker--compact .commute-picker__modes {
  gap: 6rpx;
}
.commute-picker--compact .commute-picker__mode {
  padding: 0 10rpx;
  font-size: 19rpx;
}
</style>
