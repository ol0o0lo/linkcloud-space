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
  <view class="map-result-sheet" @tap.stop>
    <view class="map-result-sheet__heading">
      <view class="map-result-sheet__main">
        <view class="map-result-sheet__eyebrow">
          <view class="map-result-sheet__eyebrow-dot" />
          <text>已选楼栋</text>
        </view>
        <view class="map-result-sheet__title-row">
          <text class="map-result-sheet__title">{{ marker.name }}</text>
          <text class="map-result-sheet__count">{{ marker.house_count }} 套</text>
        </view>
        <view class="map-result-sheet__address">
          <view class="i-carbon-location" />
          <text class="map-result-sheet__address-text">{{ [marker.district, marker.address].filter(Boolean).join(' · ') || '位置已标注' }}</text>
        </view>
      </view>
      <button class="map-result-sheet__icon-button" aria-label="导航到楼栋" @click="emit('navigate')">
        <view class="i-carbon-direction-straight-right map-result-sheet__navigate-icon" />
        <text>导航</text>
      </button>
      <button class="map-result-sheet__close" aria-label="关闭房源结果" @click="emit('close')">
        <view class="i-carbon-close" />
      </button>
    </view>

    <view class="map-result-sheet__price">
      <template v-if="marker.min_rent != null">
        <text>¥</text>
        <text class="map-result-sheet__price-value">{{ formatAmount(Number(marker.min_rent)) }}</text>
        <text>/月起</text>
      </template>
      <text v-else>租金面议</text>
    </view>

    <view v-if="loading" class="map-result-sheet__loading">
      <AppLoading text="正在读取房源…" />
    </view>
    <view v-else-if="error" class="map-result-sheet__error">
      <view class="i-carbon-warning-alt map-result-sheet__error-icon" />
      <view class="map-result-sheet__error-copy">
        <text class="map-result-sheet__error-title">房源暂时未加载</text>
        <text>{{ error }}</text>
      </view>
      <button class="map-result-sheet__retry" @click="emit('retry')">
        重试
      </button>
    </view>
    <scroll-view v-else-if="houses.length" class="map-result-sheet__scroll" scroll-x :show-scrollbar="false" enhanced>
      <view class="map-result-sheet__row">
        <view v-for="house in houses" :key="house.id" class="map-result-sheet__card">
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
    <view v-else class="map-result-sheet__empty">
      当前楼栋没有可展示的房源
    </view>
  </view>
</template>

<style scoped lang="scss">
.map-result-sheet {
  position: absolute;
  z-index: 70;
  right: 20rpx;
  bottom: calc(18rpx + env(safe-area-inset-bottom));
  left: 20rpx;
  max-width: 760rpx;
  max-height: 48vh;
  margin: 0 auto;
  padding: 22rpx 22rpx 22rpx;
  overflow: hidden;
  border: 1rpx solid rgb(255 255 255 / 84%);
  border-radius: 30rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 95%);
  box-shadow: 0 18rpx 54rpx rgb(23 35 61 / 17%);
  animation: map-result-sheet-enter 180ms cubic-bezier(0.22, 1, 0.36, 1);
  backdrop-filter: blur(20rpx);
}
.map-result-sheet__heading {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}
.map-result-sheet__main {
  min-width: 0;
  flex: 1;
}
.map-result-sheet__eyebrow {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 8rpx;
  color: var(--app-color-brand-active);
  font-size: 19rpx;
  font-weight: 700;
}
.map-result-sheet__eyebrow-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: var(--app-color-brand);
  box-shadow: 0 0 0 5rpx rgb(0 129 255 / 12%);
}
.map-result-sheet__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
}
.map-result-sheet__title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-result-sheet__count {
  flex: 0 0 auto;
  padding: 6rpx 12rpx;
  border-radius: 16rpx;
  color: var(--app-color-brand-active);
  font-size: 19rpx;
  background: var(--app-bg-brand-soft);
}
.map-result-sheet__address {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.map-result-sheet__address-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-result-sheet__icon-button {
  display: flex;
  width: 82rpx;
  height: 68rpx;
  margin: 0;
  padding: 0;
  flex: 0 0 82rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 3rpx;
  border: 0;
  border-radius: 20rpx;
  color: var(--app-color-brand);
  font-size: 18rpx;
  line-height: 1;
  background: var(--app-bg-brand-soft);
}
.map-result-sheet__navigate-icon {
  font-size: 26rpx;
}
.map-result-sheet__close {
  display: flex;
  width: 54rpx;
  height: 54rpx;
  margin: 0;
  padding: 0;
  flex: 0 0 54rpx;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--app-text-secondary);
  font-size: 28rpx;
  line-height: 1;
  background: var(--app-bg-subtle);
}
.map-result-sheet__icon-button::after {
  border: 0;
}
.map-result-sheet__close::after {
  border: 0;
}
.map-result-sheet__retry::after {
  border: 0;
}
.map-result-sheet__price {
  display: flex;
  align-items: baseline;
  margin-top: 12rpx;
  color: var(--app-color-price);
  font-size: 21rpx;
}
.map-result-sheet__price-value {
  margin: 0 4rpx;
  font-size: 38rpx;
  font-weight: 700;
}
.map-result-sheet__scroll {
  width: 100%;
  margin-top: 14rpx;
  white-space: nowrap;
}
.map-result-sheet__row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 4rpx;
}
.map-result-sheet__card {
  width: 560rpx;
  white-space: normal;
}
.map-result-sheet__loading {
  min-height: 154rpx;
}
.map-result-sheet__empty {
  padding: 30rpx 0 16rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
  text-align: center;
}
.map-result-sheet__error {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
  background: var(--app-bg-subtle);
}
.map-result-sheet__error-icon {
  flex: 0 0 auto;
  color: var(--app-color-warning);
  font-size: 32rpx;
}
.map-result-sheet__error-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.map-result-sheet__error-title {
  color: var(--app-text-primary);
  font-weight: 650;
}
.map-result-sheet__retry {
  width: auto;
  height: 50rpx;
  margin: 0;
  padding: 0 18rpx;
  flex: 0 0 auto;
  border: 0;
  border-radius: 17rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  line-height: 50rpx;
  background: var(--app-bg-brand-soft);
}

@keyframes map-result-sheet-enter {
  from {
    opacity: 0;
    transform: translateY(24rpx) scale(0.985);
  }
}
</style>
