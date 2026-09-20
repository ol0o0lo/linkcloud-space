<script setup lang="ts">
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { parsePublicHouseSearchPreset } from '@/domain/home-content'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import PublicHouseLocationDropdown from '@/features/houses/components/PublicHouseLocationDropdown.vue'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

type TopFilter = 'nearby' | 'location' | 'rent' | 'bedroom' | 'area'

interface QuickRangeOption {
  label: string
  min: string
  max: string
}

const RENT_RANGE_OPTIONS: QuickRangeOption[] = [
  { label: '不限', min: '', max: '' },
  { label: '1500 以下', min: '', max: '1500' },
  { label: '1500-2500', min: '1500', max: '2500' },
  { label: '2500-3500', min: '2500', max: '3500' },
  { label: '3500-5000', min: '3500', max: '5000' },
  { label: '5000 以上', min: '5000', max: '' },
]

const AREA_RANGE_OPTIONS: QuickRangeOption[] = [
  { label: '不限', min: '', max: '' },
  { label: '30㎡以下', min: '', max: '30' },
  { label: '30-50㎡', min: '30', max: '50' },
  { label: '50-70㎡', min: '50', max: '70' },
  { label: '70-90㎡', min: '70', max: '90' },
  { label: '90㎡以上', min: '90', max: '' },
]

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '',
    enablePullDownRefresh: true,
  },
})

const houseFavorites = useHouseCardFavorites()
const regionStore = usePublicHouseRegionStore()
const spatialFilter = usePublicHouseSpatialFilter()
const filters = ref<PublicHouseFiltersOut | null>(null)
const activeTopFilter = ref<TopFilter | null>(null)
const filterOverlayOpen = computed(() => activeTopFilter.value !== null)
const pendingLocationMode = ref<'metro' | null>(null)
const locatingNearby = ref(false)
const nearbyRadiusM = computed<PublicHouseRadiusM | null>(() => spatialFilter.nearbyRadiusM.value)
const nearbyDraftRadiusM = ref<PublicHouseRadiusM>(spatialFilter.radiusM.value)
const nearbyRadiusOptions = PUBLIC_HOUSE_RADIUS_OPTIONS
const rentRangeOptions = RENT_RANGE_OPTIONS
const areaRangeOptions = AREA_RANGE_OPTIONS
const rentDraft = reactive({ min: '', max: '' })
const areaDraft = reactive({ min: '', max: '' })
const query = reactive({
  keyword: '',
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  elevatorOnly: false,
  sort: 'latest' as NonNullable<PublicHousesUsingGetParams['sort']>,
})

const activeFilterCount = computed(() => [
  Boolean(query.minRent || query.maxRent),
  Boolean(query.minArea || query.maxArea),
  query.bedrooms !== '',
  query.elevatorOnly,
  spatialFilter.hasAnyFilter.value,
].filter(Boolean).length)
const hasPublicFilters = computed(() => Boolean(query.keyword.trim() || activeFilterCount.value))
const emptyTitle = computed(() => hasPublicFilters.value ? '没有找到符合条件的房源' : '暂时没有公开房源')
const emptyDescription = computed(() => hasPublicFilters.value ? '试试清空关键词，或放宽区域、租金和户型条件。' : '新房源发布后会显示在这里。')
const districtFilterText = computed(() => spatialFilter.locationLabel.value)
const rentFilterText = computed(() => {
  if (query.minRent && query.maxRent)
    return `¥${query.minRent}-${query.maxRent}`
  if (query.minRent)
    return `¥${query.minRent}以上`
  if (query.maxRent)
    return `¥${query.maxRent}以下`
  return '租金'
})
const bedroomFilterText = computed(() => query.bedrooms === '' ? '户型' : `${query.bedrooms}室`)
const areaFilterText = computed(() => {
  if (query.minArea && query.maxArea)
    return `${query.minArea}-${query.maxArea}㎡`
  if (query.minArea)
    return `${query.minArea}㎡以上`
  if (query.maxArea)
    return `${query.maxArea}㎡以下`
  return '面积'
})
const bedroomOptions = computed(() => filters.value?.bedrooms.length ? filters.value.bedrooms : [1, 2, 3, 4])

function requestParams(page: number, pageSize: number): PublicHousesUsingGetParams {
  return {
    keyword: query.keyword,
    min_rent: query.minRent,
    max_rent: query.maxRent,
    min_area: query.minArea,
    max_area: query.maxArea,
    bedrooms: query.bedrooms === '' ? undefined : Number(query.bedrooms),
    has_elevator_access: query.elevatorOnly ? true : undefined,
    ...spatialFilter.requestParams.value,
    sort: query.sort,
    page,
    page_size: pageSize,
  }
}

const housePage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize }) => listPublicHouses(requestParams(page, pageSize)),
  pageSize: 12,
  refreshOnShow: false,
  keyOf: item => item.id,
})
let initialized = false
let lastLoadedScopeKey = ''

async function refreshHouses() {
  await housePage.refresh()
  lastLoadedScopeKey = spatialFilter.scopeKey.value
}

function search() {
  activeTopFilter.value = null
  void refreshHouses()
}

function resetFilters() {
  Object.assign(query, {
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    elevatorOnly: false,
    sort: 'latest',
  })
  Object.assign(rentDraft, { min: '', max: '' })
  Object.assign(areaDraft, { min: '', max: '' })
  pendingLocationMode.value = null
  spatialFilter.reset()
}

function clearPublicFilters() {
  query.keyword = ''
  resetFilters()
  search()
}

async function selectNearbyRadius(radius: number | null): Promise<boolean> {
  if (radius == null) {
    spatialFilter.exitNearby()
    return true
  }
  if (spatialFilter.nearbyLocation.value) {
    spatialFilter.setNearbyRadius(radius)
    return true
  }
  if (locatingNearby.value)
    return false
  locatingNearby.value = true
  try {
    const location = await uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, radius)
    return true
  }
  catch {
    spatialFilter.exitNearby()
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能筛选附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: '无法获取当前位置，请检查浏览器定位权限', icon: 'none' })
    // #endif
    return false
  }
  finally {
    locatingNearby.value = false
  }
}

function toggleTopFilter(filter: TopFilter) {
  if (activeTopFilter.value === filter) {
    activeTopFilter.value = null
    return
  }
  if (filter === 'nearby')
    nearbyDraftRadiusM.value = spatialFilter.radiusM.value
  if (filter === 'rent')
    Object.assign(rentDraft, { min: query.minRent, max: query.maxRent })
  if (filter === 'area')
    Object.assign(areaDraft, { min: query.minArea, max: query.maxArea })
  if (filter === 'bedroom' && !filters.value)
    void getPublicHouseFilters().then(result => filters.value = result).catch(() => undefined)
  activeTopFilter.value = filter
}

function closeTopFilter() {
  activeTopFilter.value = null
}

async function applyNearbyFilter() {
  const applied = await selectNearbyRadius(nearbyDraftRadiusM.value)
  if (!applied)
    return
  query.sort = 'distance_asc'
  activeTopFilter.value = null
  void refreshHouses()
}

function clearNearbyFilter() {
  spatialFilter.exitNearby()
  if (query.sort === 'distance_asc')
    query.sort = 'latest'
  activeTopFilter.value = null
  void refreshHouses()
}

function applyLocationFilter(value: PublicHouseLocationFilterValue) {
  spatialFilter.setLocationFilter(value)
  pendingLocationMode.value = null
  query.sort = spatialFilter.hasSpatialCenter.value ? 'distance_asc' : query.sort === 'distance_asc' ? 'latest' : query.sort
  activeTopFilter.value = null
  void refreshHouses()
}

function isRangeSelected(option: QuickRangeOption, draft: { min: string, max: string }) {
  return option.min === draft.min && option.max === draft.max
}

function selectRangeOption(draft: { min: string, max: string }, option: QuickRangeOption) {
  Object.assign(draft, { min: option.min, max: option.max })
}

function isValidRange(min: string, max: string, label: string) {
  if (min && max && Number(min) > Number(max)) {
    uni.showToast({ title: `${label}最低值不能高于最高值`, icon: 'none' })
    return false
  }
  return true
}

function applyRentFilter() {
  if (!isValidRange(rentDraft.min, rentDraft.max, '租金'))
    return
  query.minRent = rentDraft.min
  query.maxRent = rentDraft.max
  activeTopFilter.value = null
  void refreshHouses()
}

function clearRentFilter() {
  Object.assign(rentDraft, { min: '', max: '' })
  query.minRent = ''
  query.maxRent = ''
  activeTopFilter.value = null
  void refreshHouses()
}

function applyAreaFilter() {
  if (!isValidRange(areaDraft.min, areaDraft.max, '面积'))
    return
  query.minArea = areaDraft.min
  query.maxArea = areaDraft.max
  activeTopFilter.value = null
  void refreshHouses()
}

function clearAreaFilter() {
  Object.assign(areaDraft, { min: '', max: '' })
  query.minArea = ''
  query.maxArea = ''
  activeTopFilter.value = null
  void refreshHouses()
}

function selectBedroomFilter(value: string | number) {
  query.bedrooms = value
  activeTopFilter.value = null
  void refreshHouses()
}

function toggleElevatorFilter() {
  activeTopFilter.value = null
  query.elevatorOnly = !query.elevatorOnly
  void refreshHouses()
}

function handleRegionChange() {
  if (pendingLocationMode.value === 'metro' && regionStore.selection.city) {
    spatialFilter.setLocationFilter({ mode: 'metro', district: '', stationNames: [] })
    activeTopFilter.value = 'location'
  }
  else {
    activeTopFilter.value = null
  }
  if (!spatialFilter.hasSpatialCenter.value && query.sort === 'distance_asc')
    query.sort = 'latest'
  void refreshHouses()
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

onLoad(async (options) => {
  const preset = parsePublicHouseSearchPreset((options || {}) as Record<string, string | undefined>)
  query.keyword = preset.keyword || ''
  query.maxRent = preset.max_rent || ''
  query.bedrooms = preset.bedrooms ?? ''
  query.sort = preset.sort || 'latest'
  await regionStore.initializeDefaultRegion()
  if (preset.location_mode === 'metro') {
    pendingLocationMode.value = 'metro'
    if (regionStore.selection.city)
      spatialFilter.setLocationFilter({ mode: 'metro', district: '', stationNames: [] })
    else
      spatialFilter.locationMode.value = 'metro'
    activeTopFilter.value = 'location'
  }
  await Promise.all([
    getPublicHouseFilters().then(result => filters.value = result).catch(() => undefined),
    refreshHouses(),
    houseFavorites.refreshFavorites(),
  ])
  initialized = true
})

onShow(() => {
  void houseFavorites.refreshFavorites()
  if (initialized && lastLoadedScopeKey !== spatialFilter.scopeKey.value)
    void refreshHouses()
})

onPullDownRefresh(async () => {
  try {
    await refreshHouses()
  }
  finally {
    uni.stopPullDownRefresh()
  }
})

onReachBottom(() => void housePage.loadMore())
</script>

<template>
  <page-meta :page-style="`overflow:${filterOverlayOpen ? 'hidden' : 'visible'};`" />
  <AppPage class="public-house-search-page" ai-background>
    <template #navigation>
      <AppCustomNavigation title="" align="start" back transparent scroll-mode="sticky" scrolled :fallback-url="APP_ROUTES.home">
        <template #content>
          <view class="navigation-search-row">
            <view class="navigation-search-bar">
              <button class="navigation-search-submit" aria-label="搜索" @click="search">
                <view class="i-carbon-search" />
              </button>
              <view class="navigation-search-input">
                <wd-input v-model="query.keyword" compact placeholder="搜索小区、区域或房源" clearable confirm-type="search" @confirm="search" />
              </view>
            </view>
            <view class="navigation-region">
              <PublicHouseRegionTrigger @change="handleRegionChange" />
            </view>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view class="quick-filter-shell" :class="{ 'quick-filter-shell--open': activeTopFilter }">
      <scroll-view class="quick-filter-scroll" scroll-x enhanced :show-scrollbar="false">
        <view class="quick-filter-row">
          <view class="quick-filter" :class="{ 'quick-filter--active': nearbyRadiusM, 'quick-filter--open': activeTopFilter === 'nearby' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('nearby')">
            <view class="i-carbon-location-current" />
            <text>{{ nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': spatialFilter.hasLocationFilter.value, 'quick-filter--open': activeTopFilter === 'location' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('location')">
            <view class="i-carbon-map" />
            <text>{{ districtFilterText }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': query.minRent || query.maxRent, 'quick-filter--open': activeTopFilter === 'rent' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('rent')">
            <view class="i-carbon-currency-yen" />
            <text>{{ rentFilterText }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': query.bedrooms !== '', 'quick-filter--open': activeTopFilter === 'bedroom' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('bedroom')">
            <view class="i-carbon-hotel" />
            <text>{{ bedroomFilterText }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': query.minArea || query.maxArea, 'quick-filter--open': activeTopFilter === 'area' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('area')">
            <view class="i-carbon-ruler" />
            <text>{{ areaFilterText }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': query.elevatorOnly }" hover-class="quick-filter--pressed" @click="toggleElevatorFilter">
            <view class="i-carbon-building" />
            <text>{{ query.elevatorOnly ? '有电梯' : '电梯' }}</text>
          </view>
        </view>
      </scroll-view>

      <view v-if="activeTopFilter && activeTopFilter !== 'location'" class="top-filter-popover-host">
        <view class="top-filter-mask" @touchmove.stop.prevent @click="closeTopFilter" />
        <view class="top-filter-popover">
          <template v-if="activeTopFilter === 'nearby'">
            <view class="top-filter-popover__heading">
              <view class="top-filter-popover__heading-main">
                <view class="i-carbon-location-current" />
                <view class="top-filter-popover__heading-copy">
                  <strong>附近找房</strong>
                  <text>以当前位置为中心筛选房源</text>
                </view>
              </view>
              <text v-if="locatingNearby" class="nearby-filter-status">定位中…</text>
            </view>
            <wd-radio-group v-model="nearbyDraftRadiusM" type="button" direction="horizontal" custom-class="top-filter-popover__radio-options">
              <wd-radio v-for="radius in nearbyRadiusOptions" :key="radius" :value="radius">
                {{ formatPublicHouseRadiusLabel(radius) }}
              </wd-radio>
            </wd-radio-group>
            <view class="top-filter-popover__footer">
              <button class="top-filter-popover__reset" @click="clearNearbyFilter">
                不限附近
              </button>
              <button class="top-filter-popover__apply" :disabled="locatingNearby" @click="applyNearbyFilter">
                {{ locatingNearby ? '定位中…' : '查看房源' }}
              </button>
            </view>
          </template>

          <template v-else-if="activeTopFilter === 'rent'">
            <view class="top-filter-popover__heading">
              <view class="top-filter-popover__heading-main">
                <view class="i-carbon-currency-yen" />
                <view class="top-filter-popover__heading-copy">
                  <strong>租金</strong>
                  <text>元 / 月</text>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid">
              <button
                v-for="option in rentRangeOptions"
                :key="option.label"
                class="top-filter-popover__choice"
                :class="{ 'top-filter-popover__choice--active': isRangeSelected(option, rentDraft) }"
                @click="selectRangeOption(rentDraft, option)"
              >
                {{ option.label }}
              </button>
            </view>
            <view class="top-filter-popover__range">
              <view class="top-filter-popover__field">
                <wd-input v-model="rentDraft.min" type="number" placeholder="最低租金" />
              </view>
              <text>—</text>
              <view class="top-filter-popover__field">
                <wd-input v-model="rentDraft.max" type="number" placeholder="最高租金" />
              </view>
            </view>
            <view class="top-filter-popover__footer">
              <button class="top-filter-popover__reset" @click="clearRentFilter">
                不限租金
              </button>
              <button class="top-filter-popover__apply" @click="applyRentFilter">
                确定
              </button>
            </view>
          </template>

          <template v-else-if="activeTopFilter === 'bedroom'">
            <view class="top-filter-popover__heading">
              <view class="top-filter-popover__heading-main">
                <view class="i-carbon-hotel" />
                <view class="top-filter-popover__heading-copy">
                  <strong>户型</strong>
                  <text>选择卧室数量</text>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid top-filter-popover__choice-grid--compact">
              <button class="top-filter-popover__choice" :class="{ 'top-filter-popover__choice--active': query.bedrooms === '' }" @click="selectBedroomFilter('')">
                不限
              </button>
              <button
                v-for="item in bedroomOptions"
                :key="item"
                class="top-filter-popover__choice"
                :class="{ 'top-filter-popover__choice--active': query.bedrooms === item }"
                @click="selectBedroomFilter(item)"
              >
                {{ item }} 室
              </button>
            </view>
          </template>

          <template v-else-if="activeTopFilter === 'area'">
            <view class="top-filter-popover__heading">
              <view class="top-filter-popover__heading-main">
                <view class="i-carbon-ruler" />
                <view class="top-filter-popover__heading-copy">
                  <strong>面积</strong>
                  <text>建筑面积 · ㎡</text>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid">
              <button
                v-for="option in areaRangeOptions"
                :key="option.label"
                class="top-filter-popover__choice"
                :class="{ 'top-filter-popover__choice--active': isRangeSelected(option, areaDraft) }"
                @click="selectRangeOption(areaDraft, option)"
              >
                {{ option.label }}
              </button>
            </view>
            <view class="top-filter-popover__range">
              <view class="top-filter-popover__field">
                <wd-input v-model="areaDraft.min" type="digit" placeholder="最小面积" />
              </view>
              <text>—</text>
              <view class="top-filter-popover__field">
                <wd-input v-model="areaDraft.max" type="digit" placeholder="最大面积" />
              </view>
            </view>
            <view class="top-filter-popover__footer">
              <button class="top-filter-popover__reset" @click="clearAreaFilter">
                不限面积
              </button>
              <button class="top-filter-popover__apply" @click="applyAreaFilter">
                确定
              </button>
            </view>
          </template>
        </view>
      </view>

      <PublicHouseLocationDropdown
        :visible="activeTopFilter === 'location'"
        :value="spatialFilter.locationFilter.value"
        @update:visible="activeTopFilter = $event ? 'location' : null"
        @apply="applyLocationFilter"
      />
    </view>

    <view class="sort-row">
      <view class="result-summary">
        <strong>筛选结果</strong><text>共 {{ housePage.total.value }} 套公开房源</text>
      </view>
      <view class="sort-actions">
        <text v-if="spatialFilter.hasSpatialCenter.value" :class="{ active: query.sort === 'distance_asc' }" @click="query.sort = 'distance_asc'; search()">距离</text>
        <text :class="{ active: query.sort === 'latest' }" @click="query.sort = 'latest'; search()">最新</text>
        <text :class="{ active: query.sort === 'rent_asc' }" @click="query.sort = 'rent_asc'; search()">租金</text>
      </view>
    </view>

    <AppPagedList
      :items="housePage.items.value"
      item-key="id"
      :loading="housePage.loading.value"
      :refreshing="housePage.refreshing.value"
      :loading-more="housePage.loadingMore.value"
      :finished="housePage.finished.value"
      :error="housePage.error.value"
      :empty-text="emptyTitle"
      :empty-description="emptyDescription"
      empty-icon="no-result"
      :empty-action-text="hasPublicFilters ? '清除筛选' : ''"
      loading-text="正在加载房源…"
      finished-text="已经到底了"
      @retry="search"
      @empty-action="clearPublicFilters"
    >
      <template #loading>
        <AppHouseCardSkeleton />
      </template>
      <template #item="{ item }">
        <HouseCard
          :house="item"
          favorite-visible
          :favorited="houseFavorites.isFavorited(item.id)"
          :favorite-loading="houseFavorites.isLoading(item.id)"
          @click="openHouse(item.id)"
          @favorite="houseFavorites.toggleFavorite(item.id)"
        />
      </template>
    </AppPagedList>
  </AppPage>
</template>

<style scoped lang="scss">
button::after {
  border: 0;
}

.navigation-search-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
}
.navigation-search-bar {
  display: flex;
  height: 64rpx;
  min-width: 0;
  flex: 1;
  align-items: center;
  padding: 0 14rpx;
  border: 1rpx solid rgb(255 255 255 / 76%);
  border-radius: 34rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 78%);
  box-shadow: 0 10rpx 30rpx rgb(31 91 161 / 9%);
  backdrop-filter: blur(20rpx);
}
.navigation-search-submit {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 44rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  color: var(--app-text-muted);
  font-size: 28rpx;
  line-height: 1;
  background: transparent;
}
.navigation-search-input {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
:deep(.navigation-search-input .wd-input) {
  padding: 0;
  background: transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 60rpx;
  --wot-input-inner-font-size: 23rpx;
  --wot-input-padding: 0;
}
.navigation-region {
  min-width: 0;
  max-width: 132rpx;
  flex: 0 0 auto;
  overflow: hidden;
}
:deep(.navigation-region .public-house-region-trigger) {
  max-width: 132rpx;
  padding-right: 4rpx;
  padding-left: 4rpx;
}
.quick-filter-shell {
  --public-house-filter-popover-width: 680rpx;

  position: relative;
  z-index: 20;
  margin-top: 0;
}
.quick-filter-shell--open {
  z-index: 1100;
}
.quick-filter-scroll {
  width: 100%;
  white-space: nowrap;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.quick-filter-scroll::-webkit-scrollbar,
:deep(.quick-filter-scroll .uni-scroll-view::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}
.quick-filter-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 24rpx;
}
.quick-filter {
  position: relative;
  display: inline-flex;
  min-width: 140rpx;
  height: 58rpx;
  flex: 0 0 auto;
  box-sizing: border-box;
  align-items: center;
  gap: 8rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 24rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 58rpx;
  background: var(--app-bg-card);
}
.quick-filter--active {
  border-color: rgb(22 119 255 / 24%);
  color: #1677ff;
  font-weight: 600;
  background: #eef5ff;
}
.quick-filter--open {
  border-color: #1677ff;
  color: #0f63d8;
  box-shadow: 0 8rpx 22rpx rgb(22 119 255 / 12%);
}
.quick-filter--open::after {
  position: absolute;
  bottom: 4rpx;
  left: 50%;
  width: 0;
  height: 0;
  border-top: 8rpx solid #1677ff;
  border-right: 8rpx solid transparent;
  border-left: 8rpx solid transparent;
  content: '';
  transform: translateX(-50%);
}
.quick-filter > .i-carbon-chevron-down {
  transition: transform 160ms ease;
}
.quick-filter--open > .i-carbon-chevron-down {
  transform: rotate(180deg);
}
.quick-filter--pressed {
  opacity: 0.72;
}
.top-filter-popover-host {
  position: absolute;
  z-index: 1;
  top: 100%;
  left: 0;
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width);
}
.top-filter-mask {
  position: fixed;
  z-index: 1;
  inset: 0;
  background: rgb(15 23 42 / 28%);
  backdrop-filter: blur(3rpx);
}
.top-filter-popover {
  --filter-popover-primary: #1677ff;
  --filter-popover-primary-active: #0f63d8;
  --filter-popover-primary-soft: #eef5ff;

  position: relative;
  z-index: 2;
  margin-top: 14rpx;
  padding: 28rpx;
  border: 1rpx solid rgb(255 255 255 / 80%);
  border-radius: 28rpx;
  background: linear-gradient(145deg, rgb(255 255 255 / 99%), #f2f7ff);
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
  animation: top-filter-dropdown-in 180ms ease-out;
}
.top-filter-popover__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.top-filter-popover__heading-main {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.top-filter-popover__heading-main > view:first-child {
  flex: 0 0 auto;
  color: var(--filter-popover-primary);
  font-size: 30rpx;
}
.top-filter-popover__heading-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.top-filter-popover__heading strong {
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.top-filter-popover__heading text {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
:deep(.top-filter-popover__radio-options) {
  display: grid;
  margin-top: 24rpx;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
  --wot-radio-button-margin: 0;
  --wot-radio-button-min-width: 0;
  --wot-radio-checked-color: var(--filter-popover-primary);
  --wot-radio-button-bg: #f5f8fc;
  --wot-radio-button-checked-bg: var(--filter-popover-primary-soft);
  --wot-radio-button-border-radius: 18rpx;
}
.top-filter-popover__choice-grid {
  display: grid;
  margin-top: 24rpx;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}
.top-filter-popover__choice-grid--compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.top-filter-popover__choice {
  min-width: 0;
  height: 66rpx;
  margin: 0;
  padding: 0 10rpx;
  overflow: hidden;
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 66rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: #f5f8fc;
}
.top-filter-popover__choice--active {
  border-color: rgb(22 119 255 / 25%);
  color: var(--filter-popover-primary-active);
  font-weight: 700;
  background: var(--filter-popover-primary-soft);
}
.top-filter-popover__range {
  display: grid;
  margin-top: 20rpx;
  align-items: center;
  grid-template-columns: minmax(0, 1fr) 28rpx minmax(0, 1fr);
  gap: 10rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: center;
}
.top-filter-popover__field {
  min-width: 0;
  padding: 10rpx 16rpx;
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  background: #f5f8fc;
}
:deep(.top-filter-popover__field .wd-input) {
  padding: 0;
  background: transparent;
  --wot-input-bg: transparent;
  --wot-input-padding: 0;
  --wot-input-inner-height: 44rpx;
  --wot-input-inner-font-size: 23rpx;
}
.top-filter-popover__footer {
  display: grid;
  margin-top: 24rpx;
  grid-template-columns: 1fr 2fr;
  gap: 16rpx;
}
.top-filter-popover__reset,
.top-filter-popover__apply {
  height: 76rpx;
  margin: 0;
  border: 0;
  border-radius: 18rpx;
  font-size: 25rpx;
  line-height: 76rpx;
}
.top-filter-popover__reset {
  border: 1rpx solid rgb(22 119 255 / 24%);
  color: var(--filter-popover-primary);
  background: #fff;
}
.top-filter-popover__apply {
  color: #fff;
  font-weight: 700;
  background: linear-gradient(135deg, var(--filter-popover-primary), #3b8fff);
  box-shadow: 0 12rpx 24rpx rgb(22 119 255 / 20%);
}
.top-filter-popover__apply[disabled] {
  opacity: 0.6;
}
.nearby-filter-status {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 32rpx 0 24rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.result-summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.result-summary strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.result-summary text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.sort-actions {
  display: flex;
  gap: 24rpx;
  white-space: nowrap;
}
.sort-actions .active {
  color: var(--app-color-brand);
  font-weight: 600;
}
@keyframes top-filter-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .top-filter-popover {
    animation: none;
  }
}
</style>
