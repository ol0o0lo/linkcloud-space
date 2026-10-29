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
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

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

    let location: Awaited<ReturnType<typeof getCurrentLocationGcj02>>
    try {
      location = await getCurrentLocationGcj02()
    }
    catch (error) {
      locationStatus.value = '定位失败，点击重试'
      if (interactive) {
        // #ifdef MP-WEIXIN
        const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后可识别当前城市，也可以继续手动选择。', confirmText: '去设置' })
        if (modal.confirm)
          await uni.openSetting()
        // #endif
        // #ifndef MP-WEIXIN
        uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
        // #endif
      }
      // #ifdef H5
      locationStatus.value = getLocationErrorMessage(error)
      // #endif
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
  <view class="city-selector-page flex flex-col overflow-hidden bg-surface-card">
    <view class="city-search flex-none bg-surface-card px-4 pb-2.5 pt-3">
      <wd-search
        v-model="keyword"
        custom-style="padding: 0; --wot-search-input-height: 76rpx; --wot-search-input-radius: 999rpx; --wot-search-bg: var(--app-bg-card); --wot-search-input-bg: var(--city-neutral-bg); --wot-search-cover-bg: var(--city-neutral-bg); --wot-search-block-margin-right: 0;"
        variant="filled"
        hide-cancel
        placeholder-left
        placeholder="输入城市名称"
      />
    </view>

    <view v-if="regionStore.loading" class="city-state flex items-center justify-center gap-1.5 p-5 text-center text-content-muted">
      <AppLoading text="正在加载已开通城市…" />
    </view>
    <view v-else-if="regionStore.error" class="city-state flex items-center justify-center gap-1.5 p-5 text-center text-content-muted">
      <view class="i-carbon-warning-alt city-state__icon text-size-2xl text-app-brand" />
      <strong>城市列表加载失败</strong>
      <text>请检查网络后重新加载</text>
      <button class="city-state__action mt-1 rounded-full bg-surface-brand-soft px-3.5 py-2 text-size-2xs text-app-brand-active" @click="loadCities(true)">
        重新加载
      </button>
    </view>
    <view v-else class="city-index min-h-0 flex-1" :class="{ 'city-index--compact': !showIndexSidebar }">
      <wd-index-bar sticky>
        <view v-if="!keyword" class="city-overview pb-4 pl-4 pr-6.5 pt-2">
          <button class="located-city min-h-9.5 w-full flex items-center justify-between gap-2.5 rounded-0 bg-surface-card p-0 text-left" :disabled="locating" @click="chooseLocatedCity">
            <view class="located-city__content min-w-0 flex flex-1 items-center gap-0.5">
              <text>当前定位：</text>
              <view class="located-city__value min-w-0 flex items-center gap-1 text-size-xs text-content-muted">
                <view class="i-carbon-location-filled" />
                <strong>{{ locatedCityLabel }}</strong>
              </view>
            </view>
            <view class="located-city__action flex flex-none items-center gap-1 text-size-2xs text-app-brand-active font-medium" @click.stop="locateCurrentCity(true)">
              <view class="i-carbon-renew" :class="{ 'located-city__loading': locating }" />
              <text>{{ locatedSelection ? '重新定位' : '定位' }}</text>
            </view>
          </button>

          <view class="popular-section mt-3.5">
            <view class="popular-section__heading mb-2 flex items-center justify-between">
              <strong>热门城市</strong>
              <button :class="{ active: !regionStore.selection.city }" @click="chooseNationwide">
                全国房源
              </button>
            </view>
            <view class="popular-grid grid grid-cols-3 gap-2" :class="{ 'popular-grid--compact': popularCities.length < 3 }">
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
            class="city-list-item min-h-11.5 flex items-center justify-between rounded-0 bg-surface-card px-4 py-0 text-left text-size-sm text-content-primary"
            :class="{ 'city-list-item--active': regionStore.selection.province === item.province && regionStore.selection.city === item.city.city }"
            @click="chooseCity(item)"
          >
            <text>{{ item.label }}</text>
            <view v-if="regionStore.selection.province === item.province && regionStore.selection.city === item.city.city" class="i-carbon-checkmark" />
          </button>
        </view>

        <view v-if="!filteredCityGroups.length" class="city-state city-state--inside flex items-center justify-center gap-1.5 p-5 text-center text-content-muted">
          <view class="i-carbon-search-locate city-state__icon text-size-2xl text-app-brand" />
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
  @apply h-screen;
  height: calc(100vh - var(--window-top));
  height: calc(100vh - var(--window-top) - env(safe-area-inset-bottom));
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
}

.city-index--compact :deep(.wd-index-bar__sidebar) {
  @apply hidden;
}

.city-index--compact .city-overview {
  @apply pr-4;
}

.located-city,
.popular-section button,
.city-list-item,
.city-state__action {
  @apply m-0;
  @apply border-0;
  @apply box-border;
  @apply leading-tight;
}

.located-city::after,
.popular-section button::after,
.city-list-item::after,
.city-state__action::after {
  @apply border-0;
}

.located-city[disabled] {
  @apply opacity-70;
}

.located-city__content > text {
  @apply flex-none;
  @apply text-content-primary;
  @apply text-size-sm;
  @apply font-semibold;
}

.located-city__value strong {
  @apply overflow-hidden;
  @apply text-content-primary;
  @apply text-size-sm;
  @apply font-semibold;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}

.located-city__loading {
  animation: location-spin 900ms linear infinite;
}

.popular-section__heading strong {
  @apply text-content-primary;
  @apply text-size-sm;
}

.popular-section__heading button {
  @apply w-auto;
  @apply pt-1 pr-0 pb-1 pl-2.5;
  @apply rounded-0;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply bg-transparent;
}

.popular-section__heading button.active {
  @apply text-app-brand-active;
  @apply bg-transparent;
}

.popular-grid--compact {
  grid-template-columns: repeat(auto-fit, minmax(240rpx, 1fr));
}

.popular-grid button {
  @apply flex;
  @apply h-9.5;
  @apply items-center;
  @apply justify-center;
  @apply py-0 px-1.5;
  @apply overflow-hidden;
  @apply border-0;
  @apply rounded-1.5;
  @apply text-content-primary;
  @apply text-size-xs;
  @apply bg-$city-neutral-bg;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}

.popular-grid button.active {
  @apply text-app-brand-active;
  @apply bg-$city-neutral-bg;
}

.city-list-item {
  width: calc(100% - 52rpx);
}

.city-list-item + .city-list-item {
  @apply border-t-hairline border-t-solid border-t-app-divider;
}

.city-list-item--active {
  @apply text-app-brand-active;
  @apply font-semibold;
}

.city-index--compact .city-list-item {
  @apply w-full;
}

.city-list-item--active view {
  @apply text-app-brand;
  @apply text-size-xs;
}

.city-state {
  @apply min-h-53;
  @apply flex-1;
  @apply flex-col;
}

.city-state--inside {
  @apply min-h-45;
}

.city-state strong {
  @apply text-content-primary;
  @apply text-size-sm;
}

.city-state text {
  @apply text-size-2xs;
}

@keyframes location-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
