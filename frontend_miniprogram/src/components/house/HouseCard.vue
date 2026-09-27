<script setup lang="ts">
import type { HouseCardModel, HouseCardSource } from '@/domain/house-card'
import { computed } from 'vue'
import { buildHouseCardModel } from '@/domain/house-card'

const props = withDefaults(defineProps<{
  house?: HouseCardSource
  card?: HouseCardModel
  variant?: 'horizontal' | 'waterfall' | 'compact'
  imageRatio?: 'standard' | 'tall'
  favoriteVisible?: boolean
  favorited?: boolean
  favoriteLoading?: boolean
  selectable?: boolean
  selected?: boolean
  disabled?: boolean
  actionText?: string
  commuteMinutes?: number
  commuteModeLabel?: string
}>(), {
  variant: 'horizontal',
  imageRatio: 'standard',
  favoriteVisible: false,
  favorited: false,
  favoriteLoading: false,
  selectable: false,
  selected: false,
  disabled: false,
  actionText: '',
})

const emit = defineEmits<{
  click: []
  favorite: []
  action: []
}>()

const model = computed<HouseCardModel>(() => {
  if (props.card)
    return props.card
  if (props.house)
    return buildHouseCardModel(props.house)
  throw new Error('HouseCard requires either house or card')
})
const rootClass = computed(() => [
  `house-card--${props.variant}`,
  `house-card--image-${props.imageRatio}`,
  {
    'house-card--selected': props.selectable && props.selected,
    'house-card--disabled': props.disabled,
  },
])

function handleClick() {
  if (!props.disabled)
    emit('click')
}
</script>

<template>
  <view
    class="house-card"
    :class="rootClass"
    :hover-class="disabled ? 'none' : 'house-card--pressed'"
    :hover-stay-time="80"
    :aria-disabled="disabled"
    @click="handleClick"
  >
    <view class="house-card__media">
      <image v-if="model.coverUrl" class="house-card__cover" :src="model.coverUrl" mode="aspectFill" lazy-load />
      <view v-else class="house-card__cover house-card__cover--empty">
        <view class="house-card__empty-icon i-carbon-image" />
        <text>暂无图片</text>
      </view>
      <view class="house-card__cover-shade" />
      <view
        v-if="model.showStatusDot"
        class="house-card__status-dot"
        :class="`house-card__status-dot--${model.statusTone}`"
        :aria-label="model.statusLabel"
      />
      <view v-if="model.imageCount" class="house-card__media-count">
        <view class="i-carbon-image" />
        <text>{{ model.imageCount }}</text>
      </view>
      <button
        v-if="favoriteVisible && !selectable"
        class="house-card__favorite"
        :class="{ 'house-card__favorite--active': favorited, 'house-card__favorite--loading': favoriteLoading }"
        :disabled="favoriteLoading"
        :aria-label="favorited ? '取消收藏' : '收藏房源'"
        @click.stop="$emit('favorite')"
      >
        <view :class="favorited ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" />
      </button>
      <view
        v-if="selectable && !disabled"
        class="house-card__selection"
        :class="{ 'house-card__selection--selected': selected }"
        :aria-label="selected ? '已选择' : '未选择'"
      >
        <view v-if="selected" class="i-carbon-checkmark" />
      </view>
    </view>

    <view class="house-card__body">
      <view class="house-card__title">
        {{ model.title }}
      </view>
      <view v-if="model.location && variant !== 'compact'" class="house-card__location">
        {{ model.location }}
      </view>
      <view v-if="model.distanceText" class="house-card__distance">
        <view class="i-carbon-location-current" />
        <text>{{ model.distanceText }}</text>
      </view>
      <view v-if="commuteMinutes != null" class="house-card__commute">
        <view class="i-carbon-time" />
        <text>{{ commuteModeLabel || '通勤' }}约 {{ commuteMinutes }} 分钟</text>
      </view>
      <view class="house-card__facts">
        {{ model.facts }}
      </view>
      <view class="house-card__price-area">
        <view class="house-card__rent">
          <text v-if="model.hasRent">¥</text><text class="house-card__amount">{{ model.rentAmountText }}</text><text v-if="model.hasRent">/月</text>
        </view>
        <view class="house-card__deposit">
          押金 <text>{{ model.depositAmountText }}</text>
        </view>
      </view>
    </view>

    <button v-if="actionText && !selectable" class="house-card__action" @click.stop="$emit('action')">
      {{ actionText }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.house-card {
  position: relative;
  display: flex;
  min-width: 0;
  gap: 20rpx;
  min-height: 252rpx;
  padding: 20rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
  transform: translateZ(0);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    opacity var(--app-motion-duration-fast) ease,
    box-shadow var(--app-motion-duration-base) ease;
}

.house-card--pressed {
  opacity: 0.88;
  box-shadow: 0 2rpx 8rpx rgb(23 35 61 / 3%);
  transform: scale(0.988);
}

.house-card--selected {
  border-color: var(--app-color-brand);
  background: linear-gradient(135deg, var(--app-bg-brand-soft), var(--app-bg-card) 52%);
  box-shadow: 0 8rpx 24rpx rgb(0 129 255 / 10%);
}

.house-card--disabled {
  opacity: 0.5;
  box-shadow: none;
}

.house-card__media {
  position: relative;
  flex: 0 0 210rpx;
  width: 210rpx;
  height: 210rpx;
  overflow: hidden;
  border-radius: 22rpx;
  background: var(--app-bg-subtle);
}

.house-card__cover {
  width: 100%;
  height: 100%;
  background: var(--app-bg-subtle);
}

.house-card__cover--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}

.house-card__empty-icon {
  font-size: 38rpx;
}

.house-card__cover-shade {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 88rpx;
  background: linear-gradient(180deg, transparent, rgb(12 27 49 / 46%));
  pointer-events: none;
}

.house-card__status-dot {
  position: absolute;
  right: 15rpx;
  bottom: 16rpx;
  z-index: 2;
  width: 15rpx;
  height: 15rpx;
  border: 3rpx solid rgb(255 255 255 / 92%);
  border-radius: 50%;
  box-shadow: 0 2rpx 8rpx rgb(12 27 49 / 24%);
  background: var(--app-color-warning);
}

.house-card__status-dot--primary {
  background: var(--app-color-brand);
}

.house-card__status-dot--success {
  background: var(--app-color-success);
}

.house-card__status-dot--muted {
  background: var(--app-text-muted);
}

.house-card__media-count {
  position: absolute;
  bottom: 12rpx;
  left: 12rpx;
  display: flex;
  height: 38rpx;
  align-items: center;
  gap: 7rpx;
  padding: 0 13rpx;
  border: 1rpx solid rgb(255 255 255 / 28%);
  border-radius: 19rpx;
  color: #fff;
  font-size: 19rpx;
  line-height: 38rpx;
  background: rgb(12 27 49 / 48%);
  backdrop-filter: blur(8rpx);
}

.house-card__favorite {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  display: flex;
  width: 58rpx;
  height: 58rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(255 255 255 / 56%);
  border-radius: 50%;
  color: #fff;
  font-size: 29rpx;
  line-height: 1;
  background: rgb(12 27 49 / 42%);
  backdrop-filter: blur(12rpx);
}

.house-card__favorite::after {
  border: 0;
}

.house-card__favorite--active {
  color: #fff;
  background: var(--app-color-brand);
}

.house-card__favorite--loading {
  opacity: 0.6;
}

.house-card__selection {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  z-index: 3;
  display: flex;
  width: 46rpx;
  height: 46rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid rgb(255 255 255 / 94%);
  border-radius: 50%;
  box-sizing: border-box;
  color: #fff;
  font-size: 27rpx;
  background: rgb(20 38 63 / 26%);
  box-shadow: 0 3rpx 12rpx rgb(12 27 49 / 18%);
  backdrop-filter: blur(8rpx);
}

.house-card__selection--selected {
  border-color: var(--app-color-brand);
  background: var(--app-color-brand);
}

.house-card__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.house-card__title {
  display: -webkit-box;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 700;
  line-height: 1.42;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.house-card__location {
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.house-card__distance {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 8rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  line-height: 1.4;
}

.house-card__commute {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 8rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  line-height: 1.4;
}

.house-card__facts {
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 21rpx;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.house-card__price-area {
  display: flex;
  min-width: 0;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 5rpx 14rpx;
  margin-top: auto;
  padding-top: 12rpx;
}

.house-card__rent {
  color: var(--app-color-price);
  font-size: 20rpx;
  font-weight: 500;
  white-space: nowrap;
}

.house-card__amount {
  margin: 0 2rpx;
  font-size: 34rpx;
  font-weight: 700;
  letter-spacing: -1rpx;
}

.house-card__deposit {
  color: var(--app-text-muted);
  font-size: 20rpx;
  white-space: nowrap;
}

.house-card__deposit text {
  color: var(--app-text-secondary);
  font-weight: 600;
}

.house-card__action {
  align-self: flex-end;
  flex: 0 0 auto;
  min-width: 88rpx;
  height: 52rpx;
  margin: auto 0 0;
  padding: 0 16rpx;
  border: 0;
  border-radius: 16rpx;
  color: var(--app-color-brand);
  font-size: 21rpx;
  line-height: 52rpx;
  background: var(--app-bg-brand-soft);
}

.house-card__action::after {
  border: 0;
}

.house-card--waterfall {
  display: block;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.house-card--waterfall .house-card__media {
  width: 100%;
  height: 224rpx;
  border-radius: 0;
}

.house-card--waterfall.house-card--image-tall .house-card__media {
  height: 286rpx;
}

.house-card--waterfall .house-card__body {
  padding: 18rpx 18rpx 20rpx;
}

.house-card--waterfall .house-card__title {
  font-size: 27rpx;
  line-height: 1.42;
  -webkit-line-clamp: 2;
}

.house-card--waterfall .house-card__location,
.house-card--waterfall .house-card__facts {
  margin-top: 9rpx;
  font-size: 20rpx;
}

.house-card--waterfall .house-card__price-area {
  align-items: flex-start;
  flex-direction: column;
  gap: 4rpx;
  margin-top: 14rpx;
  padding-top: 0;
}

.house-card--waterfall .house-card__amount {
  font-size: 32rpx;
}

.house-card--waterfall .house-card__media-count {
  bottom: 13rpx;
}

.house-card--compact {
  gap: 16rpx;
  min-height: 176rpx;
  padding: 16rpx;
  border-radius: 24rpx;
  box-shadow: none;
}

.house-card--compact .house-card__media {
  flex-basis: 152rpx;
  width: 152rpx;
  height: 142rpx;
  border-radius: 18rpx;
}

.house-card--compact .house-card__cover-shade,
.house-card--compact .house-card__media-count {
  display: none;
}

.house-card--compact .house-card__title {
  font-size: 26rpx;
  -webkit-line-clamp: 1;
}

.house-card--compact .house-card__facts {
  margin-top: 8rpx;
  font-size: 20rpx;
}

.house-card--compact .house-card__price-area {
  gap: 4rpx 12rpx;
  padding-top: 8rpx;
}

.house-card--compact .house-card__amount {
  font-size: 29rpx;
}

.house-card--compact .house-card__rent,
.house-card--compact .house-card__deposit {
  font-size: 19rpx;
}

.house-card--compact .house-card__status-dot {
  right: 11rpx;
  bottom: 11rpx;
}

.house-card--compact .house-card__selection {
  top: 10rpx;
  right: 10rpx;
  width: 42rpx;
  height: 42rpx;
  font-size: 24rpx;
}

@media (prefers-reduced-motion: reduce) {
  .house-card {
    transition: none;
  }
}
</style>
