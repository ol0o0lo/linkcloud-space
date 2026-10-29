<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMapMarker } from '@/features/houses/service'
import AppLoading from '@/components/app/AppLoading.vue'
import HouseCard from '@/components/house/HouseCard.vue'

defineProps<{
  error: string
  houses: PublicHouseListOut[]
  isFavoriteLoading: (houseId: number) => boolean
  isFavorited: (houseId: number) => boolean
  loading: boolean
  marker: PublicHouseMapMarker
}>()

const emit = defineEmits<{
  'close': []
  'navigate': []
  'open-house': [houseId: number]
  'retry': []
  'toggle-favorite': [houseId: number]
}>()

function formatAmount(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
</script>

<template>
  <view class="map-result-sheet absolute left-2.5 right-2.5 z-70 mx-auto my-0 box-border max-w-95 overflow-hidden border-hairline border-hex-ffffff/84 rounded-4 border-solid bg-hex-ffffff/95 px-3 pb-3 pt-3 backdrop-blur-10" @tap.stop>
    <view class="map-result-sheet__heading flex items-start gap-2">
      <view class="map-result-sheet__main min-w-0 flex-1">
        <view class="map-result-sheet__eyebrow mb-1 flex items-center gap-1 text-size-2xs text-app-brand-active font-bold">
          <view class="map-result-sheet__eyebrow-dot h-1.5 w-1.5 rounded-full bg-app-brand" />
          <text>已选楼栋</text>
        </view>
        <view class="map-result-sheet__title-row min-w-0 flex items-center gap-1.5">
          <text class="map-result-sheet__title overflow-hidden text-ellipsis whitespace-nowrap text-size-base text-content-primary font-bold">{{ marker.name }}</text>
          <text class="map-result-sheet__count flex-none rounded-2 bg-surface-brand-soft px-1.5 py-1 text-size-2xs text-app-brand-active">{{ marker.house_count }} 套</text>
        </view>
        <view class="map-result-sheet__address mt-1.5 min-w-0 flex items-center gap-1 text-size-2xs text-content-muted">
          <view class="i-carbon-location" />
          <text class="map-result-sheet__address-text overflow-hidden text-ellipsis whitespace-nowrap">{{ [marker.district, marker.address].filter(Boolean).join(' · ') || '位置已标注' }}</text>
        </view>
      </view>
      <button class="map-result-sheet__icon-button m-0 h-8.5 w-10.5 flex items-center justify-center gap-0.5 border-0 rounded-2.5 bg-surface-brand-soft p-0 text-size-3xs text-app-brand leading-none" aria-label="导航到楼栋" @click="emit('navigate')">
        <view class="i-carbon-direction-straight-right map-result-sheet__navigate-icon text-size-xs" />
        <text>导航</text>
      </button>
      <button class="map-result-sheet__close m-0 h-7 w-7 flex shrink-0 grow-0 basis-7 items-center justify-center border-0 rounded-full bg-surface-subtle p-0 text-size-sm text-content-secondary leading-none" aria-label="关闭房源结果" @click="emit('close')">
        <view class="i-carbon-close" />
      </button>
    </view>

    <view class="map-result-sheet__price mt-1.5 flex items-baseline text-size-2xs text-app-price">
      <template v-if="marker.min_rent != null">
        <text>¥</text>
        <text class="map-result-sheet__price-value mx-0.5 my-0 text-size-lg font-bold">{{ formatAmount(Number(marker.min_rent)) }}</text>
        <text>/月起</text>
      </template>
      <text v-else>租金面议</text>
    </view>

    <view v-if="loading" class="map-result-sheet__loading min-h-19">
      <AppLoading text="正在读取房源…" />
    </view>
    <view v-else-if="error" class="map-result-sheet__error mt-2.5 flex items-center gap-2 rounded-3 bg-surface-subtle p-2.5 text-size-2xs text-content-muted">
      <view class="i-carbon-warning-alt map-result-sheet__error-icon flex-none text-size-base text-app-warning" />
      <view class="map-result-sheet__error-copy min-w-0 flex gap-0.5">
        <text class="map-result-sheet__error-title text-content-primary font-bold">房源暂时未加载</text>
        <text>{{ error }}</text>
      </view>
      <button class="map-result-sheet__retry m-0 h-6.5 w-auto flex-none border-0 rounded-2 bg-surface-brand-soft px-2.5 py-0 text-size-2xs text-app-brand-active leading-6.5" @click="emit('retry')">
        重试
      </button>
    </view>
    <scroll-view v-else-if="houses.length" class="map-result-sheet__scroll" scroll-x :show-scrollbar="false" enhanced>
      <view class="map-result-sheet__row inline-flex gap-2 pr-0.5">
        <view v-for="house in houses" :key="house.id" class="map-result-sheet__card w-70 whitespace-normal">
          <HouseCard
            :house="house"
            variant="compact"
            favorite-visible
            :favorited="isFavorited(house.id)"
            :favorite-loading="isFavoriteLoading(house.id)"
            @click="emit('open-house', house.id)"
            @favorite="emit('toggle-favorite', house.id)"
          />
        </view>
      </view>
    </scroll-view>
    <view v-else class="map-result-sheet__empty px-0 pb-2 pt-4 text-center text-size-2xs text-content-muted">
      当前楼栋没有可展示的房源
    </view>
  </view>
</template>

<style scoped lang="scss">
.map-result-sheet {
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  max-height: 48vh;
  box-shadow: 0 18rpx 54rpx rgb(23 35 61 / 17%);
  animation: map-result-sheet-enter 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.map-result-sheet__eyebrow-dot {
  box-shadow: 0 0 0 5rpx rgb(0 129 255 / 12%);
}
.map-result-sheet__icon-button {
  @apply grow-0 shrink-0 basis-10.5;
  @apply flex-col;
}
.map-result-sheet__icon-button::after {
  @apply border-0;
}
.map-result-sheet__close::after {
  @apply border-0;
}
.map-result-sheet__retry::after {
  @apply border-0;
}
.map-result-sheet__scroll {
  @apply w-full;
  @apply mt-2;
  @apply whitespace-nowrap;
}
.map-result-sheet__error-copy {
  @apply flex-1;
  @apply flex-col;
}

@keyframes map-result-sheet-enter {
  from {
    opacity: 0;
    transform: translateY(24rpx) scale(0.985);
  }
}
</style>
