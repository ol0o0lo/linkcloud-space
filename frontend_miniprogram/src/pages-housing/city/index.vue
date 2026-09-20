<script setup lang="ts">
import type { PublicHouseCityOption, PublicHouseLocatedRegion, PublicHouseRegionSelection } from '@/domain/public-house-region'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppLoading from '@/components/app/AppLoading.vue'
import {
  buildPublicHouseCityIndex,
  formatPublicHouseRegionLabel,
  getPopularPublicHouseCities,
} from '@/domain/public-house-region'
import { getLocatedPublicHouseRegion } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

definePage({
  style: {
    navigationBarTitleText: '城市选择',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
  },
})

interface OpenerPage {
  getOpenerEventChannel?: () => {
    emit: (event: string, value: PublicHouseRegionSelection) => void
  }
}

const regionStore = usePublicHouseRegionStore()
const keyword = ref('')
const locating = ref(false)
const locationStatus = ref('正在定位…')
const locatedSelection = ref<PublicHouseRegionSelection | null>(null)

const cityGroups = computed(() => buildPublicHouseCityIndex(regionStore.regions))
const popularCities = computed(() => getPopularPublicHouseCities(regionStore.regions, 6))
const filteredCityGroups = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  if (!query)
    return cityGroups.value
  return cityGroups.value.flatMap((group) => {
    const cities = group.cities.filter(item => item.label.toLocaleLowerCase().includes(query)
      || item.city.city.toLocaleLowerCase().includes(query)
      || item.province.toLocaleLowerCase().includes(query)
      || item.initial.toLocaleLowerCase() === query)
    return cities.length ? [{ ...group, cities }] : []
  })
})
const showIndexSidebar = computed(() => filteredCityGroups.value.length > 1)
const locatedCityLabel = computed(() => locatedSelection.value
  ? formatPublicHouseRegionLabel(locatedSelection.value)
  : locationStatus.value)

function notifySelection(selection: PublicHouseRegionSelection) {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
  currentPage?.getOpenerEventChannel?.().emit('change', selection)
  uni.navigateBack()
}

function chooseCity(item: PublicHouseCityOption) {
  const selection = { province: item.province, city: item.city.city, district: '' }
  regionStore.selectRegion(selection)
  notifySelection(selection)
}

function chooseLocatedCity() {
  if (!locatedSelection.value) {
    void locateCurrentCity(true)
    return
  }
  regionStore.selectRegion(locatedSelection.value)
  notifySelection(locatedSelection.value)
}

function chooseNationwide() {
  const selection = { province: '', city: '', district: '' }
  regionStore.selectRegion(selection)
  notifySelection(selection)
}

async function locateCurrentCity(interactive = true) {
  if (locating.value)
    return
  locating.value = true
  locationStatus.value = '正在定位…'
  locatedSelection.value = null
  try {
    try {
      await regionStore.loadRegions()
    }
    catch {
      locationStatus.value = '城市列表加载失败'
      return
    }

    let location: Awaited<ReturnType<typeof uni.getLocation>>
    try {
      location = await uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
    }
    catch {
      locationStatus.value = '定位失败，点击重试'
      if (interactive) {
        // #ifdef MP-WEIXIN
        const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后可识别当前城市，也可以继续手动选择。', confirmText: '去设置' })
        if (modal.confirm)
          await uni.openSetting()
        // #endif
        // #ifndef MP-WEIXIN
        uni.showToast({ title: '无法获取当前位置，请检查浏览器位置权限', icon: 'none' })
        // #endif
      }
      return
    }

    let located: PublicHouseLocatedRegion
    try {
      located = await getLocatedPublicHouseRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        coordinate_system: 'gcj02',
      })
    }
    catch {
      locationStatus.value = '定位服务暂不可用'
      return
    }

    const selection = regionStore.findLocatedRegion(located)
    if (!selection) {
      locationStatus.value = '当前城市暂未开通'
      return
    }
    locatedSelection.value = selection
  }
  finally {
    locating.value = false
  }
}

async function loadCities(force = false) {
  try {
    await regionStore.loadRegions(force)
    void locateCurrentCity(false)
  }
  catch {
    // 错误状态由 Store 展示。
  }
}

onLoad(() => {
  void loadCities()
})
</script>

<template>
  <view class="city-selector-page">
    <view class="city-search">
      <wd-search
        v-model="keyword"
        custom-style="padding: 0; --wot-search-input-height: 76rpx; --wot-search-input-radius: 999rpx; --wot-search-bg: var(--app-bg-card); --wot-search-input-bg: var(--city-neutral-bg); --wot-search-cover-bg: var(--city-neutral-bg); --wot-search-block-margin-right: 0;"
        variant="filled"
        hide-cancel
        placeholder-left
        placeholder="输入城市名称"
      />
    </view>

    <view v-if="regionStore.loading" class="city-state">
      <AppLoading text="正在加载已开通城市…" />
    </view>
    <view v-else-if="regionStore.error" class="city-state">
      <view class="i-carbon-warning-alt city-state__icon" />
      <strong>城市列表加载失败</strong>
      <text>请检查网络后重新加载</text>
      <button class="city-state__action" @click="loadCities(true)">
        重新加载
      </button>
    </view>
    <view v-else class="city-index" :class="{ 'city-index--compact': !showIndexSidebar }">
      <wd-index-bar sticky>
        <view v-if="!keyword" class="city-overview">
          <button class="located-city" :disabled="locating" @click="chooseLocatedCity">
            <view class="located-city__content">
              <text>当前定位：</text>
              <view class="located-city__value">
                <view class="i-carbon-location-filled" />
                <strong>{{ locatedCityLabel }}</strong>
              </view>
            </view>
            <view class="located-city__action" @click.stop="locateCurrentCity(true)">
              <view class="i-carbon-renew" :class="{ 'located-city__loading': locating }" />
              <text>{{ locatedSelection ? '重新定位' : '定位' }}</text>
            </view>
          </button>

          <view class="popular-section">
            <view class="popular-section__heading">
              <strong>热门城市</strong>
              <button :class="{ active: !regionStore.selection.city }" @click="chooseNationwide">
                全国房源
              </button>
            </view>
            <view class="popular-grid" :class="{ 'popular-grid--compact': popularCities.length < 3 }">
              <button
                v-for="item in popularCities"
                :key="`${item.province}-${item.city.city}`"
                :class="{ active: regionStore.selection.province === item.province && regionStore.selection.city === item.city.city }"
                @click="chooseCity(item)"
              >
                {{ item.label }}
              </button>
            </view>
          </view>
        </view>

        <view v-for="group in filteredCityGroups" :key="group.index">
          <wd-index-anchor :index="group.index" />
          <button
            v-for="item in group.cities"
            :key="`${item.province}-${item.city.city}`"
            class="city-list-item"
            :class="{ 'city-list-item--active': regionStore.selection.province === item.province && regionStore.selection.city === item.city.city }"
            @click="chooseCity(item)"
          >
            <text>{{ item.label }}</text>
            <view v-if="regionStore.selection.province === item.province && regionStore.selection.city === item.city.city" class="i-carbon-checkmark" />
          </button>
        </view>

        <view v-if="!filteredCityGroups.length" class="city-state city-state--inside">
          <view class="i-carbon-search-locate city-state__icon" />
          <strong>{{ keyword ? '没有找到相关城市' : '暂无已开通城市' }}</strong>
          <text>{{ keyword ? '试试输入城市全称或省份名称' : '公开房源发布后会自动出现在这里' }}</text>
        </view>
      </wd-index-bar>
    </view>
  </view>
</template>

<style scoped lang="scss">
.city-selector-page {
  --city-neutral-bg: #f5f6f8;
  --city-section-bg: #f6f7f9;

  display: flex;
  height: 100vh;
  height: calc(100vh - var(--window-top));
  height: calc(100vh - var(--window-top) - env(safe-area-inset-bottom));
  flex-direction: column;
  overflow: hidden;
  background: var(--app-bg-card);
}

.city-search {
  flex: 0 0 auto;
  padding: 22rpx 32rpx 20rpx;
  background: var(--app-bg-card);
}

.city-index {
  --wot-index-bar-sidebar-right: 8rpx;
  --wot-index-bar-index-font-size: 20rpx;
  --wot-index-bar-index-width: 40rpx;
  --wot-index-bar-index-height: 36rpx;
  --wot-index-bar-index-color: var(--app-text-secondary);
  --wot-index-bar-index-color-active: var(--app-color-brand-active);
  --wot-index-bar-index-bg-active: transparent;
  --wot-index-bar-current-index-bg: var(--app-color-brand);
  --wot-index-anchor-bg: var(--city-section-bg);
  --wot-index-anchor-padding: 10rpx 32rpx;
  --wot-index-anchor-font-size: 22rpx;
  --wot-index-anchor-color: var(--app-text-muted);
  min-height: 0;
  flex: 1;
}

.city-overview {
  padding: 16rpx 52rpx 30rpx 32rpx;
}

.city-index--compact :deep(.wd-index-bar__sidebar) {
  display: none;
}

.city-index--compact .city-overview {
  padding-right: 32rpx;
}

.located-city,
.popular-section button,
.city-list-item,
.city-state__action {
  margin: 0;
  border: 0;
  box-sizing: border-box;
  line-height: 1.3;
}

.located-city::after,
.popular-section button::after,
.city-list-item::after,
.city-state__action::after {
  border: 0;
}

.located-city {
  display: flex;
  width: 100%;
  min-height: 76rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 0;
  border-radius: 0;
  text-align: left;
  background: var(--app-bg-card);
}

.located-city[disabled] {
  opacity: 0.7;
}

.located-city__content {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 2rpx;
}

.located-city__content > text {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 600;
}

.located-city__value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
  color: var(--app-text-muted);
  font-size: 26rpx;
}

.located-city__value strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.located-city__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  color: var(--app-color-brand-active);
  font-size: 22rpx;
  font-weight: 500;
}

.located-city__loading {
  animation: location-spin 900ms linear infinite;
}

.popular-section {
  margin-top: 26rpx;
}

.popular-section__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.popular-section__heading strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}

.popular-section__heading button {
  width: auto;
  padding: 8rpx 0 8rpx 18rpx;
  border-radius: 0;
  color: var(--app-text-muted);
  font-size: 20rpx;
  background: transparent;
}

.popular-section__heading button.active {
  color: var(--app-color-brand-active);
  background: transparent;
}

.popular-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
}

.popular-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(240rpx, 1fr));
}

.popular-grid button {
  display: flex;
  height: 74rpx;
  align-items: center;
  justify-content: center;
  padding: 0 12rpx;
  overflow: hidden;
  border: 0;
  border-radius: 12rpx;
  color: var(--app-text-primary);
  font-size: 24rpx;
  background: var(--city-neutral-bg);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popular-grid button.active {
  color: var(--app-color-brand-active);
  background: var(--city-neutral-bg);
}

.city-list-item {
  display: flex;
  width: calc(100% - 52rpx);
  min-height: 92rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx;
  border-radius: 0;
  color: var(--app-text-primary);
  font-size: 27rpx;
  text-align: left;
  background: var(--app-bg-card);
}

.city-list-item + .city-list-item {
  border-top: 1rpx solid var(--app-divider-color);
}

.city-list-item--active {
  color: var(--app-color-brand-active);
  font-weight: 600;
}

.city-index--compact .city-list-item {
  width: 100%;
}

.city-list-item--active view {
  color: var(--app-color-brand);
  font-size: 25rpx;
}

.city-state {
  display: flex;
  min-height: 420rpx;
  align-items: center;
  justify-content: center;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
  padding: 40rpx;
  color: var(--app-text-muted);
  text-align: center;
}

.city-state--inside {
  min-height: 360rpx;
}

.city-state__icon {
  color: var(--app-color-brand);
  font-size: 50rpx;
}

.city-state strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}

.city-state text {
  font-size: 22rpx;
}

.city-state__action {
  margin-top: 8rpx;
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 22rpx;
  background: var(--app-bg-brand-soft);
}

@keyframes location-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
