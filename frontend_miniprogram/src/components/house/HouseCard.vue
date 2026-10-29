<script setup lang="ts">
import type { HouseCardModel, HouseCardSource } from '@/domain/house-card'
import { computed } from 'vue'
import { buildHouseCardModel } from '@/domain/house-card'
import AppStatusTag from '@/components/app/AppStatusTag.vue'

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
    class="house-card relative box-border min-h-32 min-w-0 flex gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-2.5 shadow-app-card"
    :class="rootClass"
    :hover-class="disabled ? 'none' : 'house-card--pressed'"
    :hover-stay-time="80"
    :aria-disabled="disabled"
    @click="handleClick"
  >
    <view class="house-card__media relative h-26 w-26 shrink-0 grow-0 basis-26 overflow-hidden rounded-3 bg-surface-subtle" :class="{ 'house-card__media--empty': !model.coverUrl }">
      <image v-if="model.coverUrl" class="house-card__cover h-full w-full" :src="model.coverUrl" mode="aspectFill" lazy-load />
      <view v-else class="house-card__cover house-card__cover--empty h-full w-full">
        <view class="house-card__empty-symbol h-9 w-9 flex flex-none items-center justify-center rounded-full bg-hex-ffffff/86" aria-hidden="true">
          <view class="house-card__empty-icon i-carbon-image text-size-xl text-app-brand-active opacity-65" />
        </view>
        <text>暂无图片</text>
      </view>
      <view v-if="model.coverUrl" class="house-card__cover-shade pointer-events-none absolute bottom-0 left-0 right-0 h-11" />
      <view
        v-if="model.showStatusDot"
        class="house-card__status-dot absolute bottom-2 right-2 z-2 h-2 w-2 border-1.5 border-hex-ffffff/92 rounded-full border-solid bg-app-warning"
        :class="`house-card__status-dot--${model.statusTone}`"
        :aria-label="model.statusLabel"
      />
      <view v-if="model.imageCount" class="house-card__media-count absolute bottom-1.5 left-1.5 h-5 flex items-center gap-1 border-hairline border-hex-ffffff/28 rounded-2.5 border-solid bg-hex-0c1b31/48 px-1.5 py-0 text-size-2xs text-hex-fff leading-5 backdrop-blur-4">
        <view class="i-carbon-image" />
        <text>{{ model.imageCount }}</text>
      </view>
      <button
        v-if="favoriteVisible && !selectable"
        class="house-card__favorite absolute right-1.5 top-1.5 m-0 h-7.5 w-7.5 flex items-center justify-center border-hairline border-hex-ffffff/56 rounded-full border-solid bg-hex-0c1b31/42 p-0 text-size-sm text-hex-fff leading-none backdrop-blur-6"
        :class="{ 'house-card__favorite--active': favorited, 'house-card__favorite--loading': favoriteLoading }"
        :disabled="favoriteLoading"
        :aria-label="favorited ? '取消收藏' : '收藏房源'"
        @click.stop="$emit('favorite')"
      >
        <view :class="favorited ? 'i-carbon-bookmark-filled' : 'i-carbon-bookmark'" />
      </button>
      <view
        v-if="selectable && !disabled"
        class="house-card__selection absolute right-2 top-2 z-3 box-border h-6 w-6 flex items-center justify-center border-1.5 border-hex-ffffff/94 rounded-full border-solid bg-hex-14263f/26 text-size-sm text-hex-fff backdrop-blur-4"
        :class="{ 'house-card__selection--selected': selected }"
        :aria-label="selected ? '已选择' : '未选择'"
      >
        <view v-if="selected" class="i-carbon-checkmark" />
      </view>
    </view>

    <view class="house-card__body min-w-0 flex">
      <view class="house-card__title line-clamp-1 overflow-hidden text-size-sm text-content-primary font-bold leading-snug">
        {{ variant === 'waterfall' ? model.heading || model.title : model.title }}
      </view>
      <view v-if="model.auxiliaryLabels?.length" class="mt-1 flex flex-wrap gap-1">
        <AppStatusTag v-for="label in model.auxiliaryLabels" :key="label" :text="label" tone="default" />
      </view>
      <view v-if="variant === 'waterfall' && model.subtitle" class="house-card__subtitle mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-secondary leading-normal">
        {{ model.subtitle }}
      </view>
      <view v-if="model.location && variant !== 'compact'" class="house-card__location mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted leading-normal">
        {{ model.location }}
      </view>
      <view v-if="model.distanceText" class="house-card__distance mt-1 flex items-center gap-1 text-size-2xs text-app-brand-active leading-snug">
        <view class="i-carbon-location-current" />
        <text>{{ model.distanceText }}</text>
      </view>
      <view v-if="commuteMinutes != null" class="house-card__commute mt-1 flex items-center gap-1 text-size-2xs text-app-brand-active leading-snug">
        <view class="i-carbon-time" />
        <text>{{ commuteModeLabel || '通勤' }}约 {{ commuteMinutes }} 分钟</text>
      </view>
      <view class="house-card__facts mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-secondary leading-normal">
        {{ model.facts }}
      </view>
      <view class="house-card__price-area mt-auto min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 pt-1.5">
        <view class="house-card__rent whitespace-nowrap text-size-2xs text-app-price font-medium">
          <text v-if="model.hasRent">¥</text><text class="house-card__amount mx-0.5 my-0 text-size-base font-bold tracking-tight">{{ model.rentAmountText }}</text><text v-if="model.hasRent">/月</text>
        </view>
        <view class="house-card__deposit whitespace-nowrap text-size-2xs text-content-muted">
          押金 <text>{{ model.depositAmountText }}</text>
        </view>
      </view>
    </view>

    <button v-if="actionText && !selectable" class="house-card__action mx-0 mb-0 mt-auto h-6.5 min-w-11 flex-none self-end border-0 rounded-2 bg-surface-brand-soft px-2 py-0 text-size-2xs text-app-brand leading-6.5" @click.stop="$emit('action')">
      {{ actionText }}
    </button>
  </view>
</template>

<style scoped lang="scss">
.house-card {
  transform: translateZ(0);
  transition:
    transform var(--app-motion-duration-fast) var(--app-motion-ease-out),
    opacity var(--app-motion-duration-fast) ease,
    box-shadow var(--app-motion-duration-base) ease;
}

.house-card--pressed {
  @apply opacity-90;
  box-shadow: 0 2rpx 8rpx rgb(23 35 61 / 3%);
  transform: scale(0.988);
}

.house-card--selected {
  @apply border-app-brand;
  background: linear-gradient(135deg, var(--app-bg-brand-soft), var(--app-bg-card) 52%);
  box-shadow: 0 8rpx 24rpx rgb(0 129 255 / 10%);
}

.house-card--disabled {
  @apply opacity-50;
  @apply shadow-none;
}

.house-card__cover {
  @apply bg-surface-subtle;
}

.house-card__cover--empty {
  @apply flex;
  @apply flex-col;
  @apply items-center;
  @apply justify-center;
  @apply gap-1.5;
  background: linear-gradient(135deg, var(--app-bg-brand-soft), var(--app-bg-page));
  @apply text-content-secondary;
  @apply text-size-2xs;
  @apply leading-snug;
}

.house-card__cover-shade {
  background: linear-gradient(180deg, transparent, rgb(12 27 49 / 46%));
}

.house-card__status-dot {
  box-shadow: 0 2rpx 8rpx rgb(12 27 49 / 24%);
}

.house-card__status-dot--primary {
  @apply bg-app-brand;
}

.house-card__status-dot--success {
  @apply bg-app-success;
}

.house-card__status-dot--muted {
  @apply bg-content-muted;
}

.house-card__favorite::after {
  @apply border-0;
}

.house-card__favorite--active {
  @apply text-hex-fff;
  @apply bg-app-brand;
}

.house-card__media--empty .house-card__favorite:not(.house-card__favorite--active) {
  @apply border-app-card;
  @apply bg-surface-card;
  @apply text-content-secondary;
}

.house-card__favorite--loading {
  @apply opacity-60;
}

.house-card__selection {
  box-shadow: 0 3rpx 12rpx rgb(12 27 49 / 18%);
}

.house-card__selection--selected {
  @apply border-app-brand;
  @apply bg-app-brand;
}

.house-card__body {
  @apply flex-1;
  @apply flex-col;
}

.house-card__deposit text {
  @apply text-content-secondary;
  @apply font-semibold;
}

.house-card__action::after {
  @apply border-0;
}

.house-card--waterfall {
  @apply block;
  @apply min-h-0;
  @apply p-0;
  @apply overflow-hidden;
}

.house-card--waterfall .house-card__media {
  @apply w-full;
  @apply h-28;
  @apply rounded-0;
}

.house-card--waterfall.house-card--image-tall .house-card__media {
  @apply h-36;
}

.house-card--waterfall .house-card__body {
  @apply pt-2.5 px-2.5 pb-2.5;
}

.house-card--waterfall .house-card__title {
  @apply text-size-sm;
  @apply leading-snug;
  @apply line-clamp-2;
}

.house-card--waterfall .house-card__location,
.house-card--waterfall .house-card__facts {
  @apply mt-1;
  @apply text-size-2xs;
}

.house-card--waterfall .house-card__price-area {
  @apply items-start;
  @apply flex-col;
  @apply gap-0.5;
  @apply mt-2;
  @apply pt-0;
}

.house-card--waterfall .house-card__amount {
  @apply text-size-base;
}

.house-card--waterfall .house-card__media-count {
  @apply bottom-1.5;
}

.house-card--compact {
  @apply gap-2;
  @apply min-h-22;
  @apply p-2;
  @apply rounded-3;
  @apply shadow-none;
}

.house-card--compact .house-card__media {
  @apply basis-19;
  @apply w-19;
  @apply h-18;
  @apply rounded-2.5;
}

.house-card--compact .house-card__cover-shade,
.house-card--compact .house-card__media-count {
  @apply hidden;
}

.house-card--compact .house-card__title {
  @apply text-size-xs;
  @apply line-clamp-1;
}

.house-card--compact .house-card__facts {
  @apply mt-1;
  @apply text-size-2xs;
}

.house-card--compact .house-card__price-area {
  @apply gap-y-0.5 gap-x-1.5;
  @apply pt-1;
}

.house-card--compact .house-card__amount {
  @apply text-size-sm;
}

.house-card--compact .house-card__rent,
.house-card--compact .house-card__deposit {
  @apply text-size-2xs;
}

.house-card--compact .house-card__status-dot {
  @apply right-1.5;
  @apply bottom-1.5;
}

.house-card--compact .house-card__selection {
  @apply top-1.5;
  @apply right-1.5;
  @apply w-5.5;
  @apply h-5.5;
  @apply text-size-xs;
}

@media (prefers-reduced-motion: reduce) {
  .house-card {
    transition: none;
  }
}
</style>
