<script setup lang="ts">
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import type { AppliedCommute, CommuteDraft, CommuteProgress } from '@/features/houses/commute'
import type { CommuteMode } from '@/services/manual/house-commute'
import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { resolveCustomNavigationLayout } from '@/components/utils/navigation'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { parsePublicHouseSearchPreset } from '@/domain/home-content'
import { normalizePublicHouseQuery } from '@/domain/house'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import PublicHouseLocationDropdown from '@/features/houses/components/PublicHouseLocationDropdown.vue'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { commuteModeLabel, createCommuteSearch, getCommuteProgress } from '@/features/houses/commute'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { AppError } from '@/core/errors/app-error'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import { usePublicHouseRegionStore } from '@/store/public-house-region'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

type TopFilter = 'nearby' | 'location' | 'rent' | 'bedroom' | 'area' | 'elevator'

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
  },
})

const houseFavorites = useHouseCardFavorites()
const workPlacePreference = useWorkPlacePreferenceStore()
const regionStore = usePublicHouseRegionStore()
const spatialFilter = usePublicHouseSpatialFilter()
const commute = ref<AppliedCommute | null>(null)
const commuteProgress = ref<CommuteProgress | null>(null)
const commuteError = ref('')
let commuteTimer: ReturnType<typeof setTimeout> | undefined
let commuteVersion = 0
let pollingCommuteVersion: number | null = null
let commuteFilterKey = ''
let creatingCommuteKey = ''
let creatingCommutePromise: Promise<boolean> | null = null
let pageVisible = false
const filters = ref<PublicHouseFiltersOut | null>(null)
const activeTopFilter = ref<TopFilter | null>(null)
const filterPointerX = ref('50%')
const preferredLocationMode = ref<'commute' | null>(null)
const filterOverlayOpen = computed(() => activeTopFilter.value !== null)
const pendingLocationMode = ref<'metro' | null>(null)
const locatingNearby = ref(false)
const resultsRefreshing = ref(false)
const nearbyRadiusM = computed<PublicHouseRadiusM | null>(() => spatialFilter.nearbyRadiusM.value)
const nearbyDraftRadiusM = ref<PublicHouseRadiusM>(spatialFilter.radiusM.value)
const nearbyRadiusOptions = PUBLIC_HOUSE_RADIUS_OPTIONS
const rentRangeOptions = RENT_RANGE_OPTIONS
const areaRangeOptions = AREA_RANGE_OPTIONS
const windowInfo = uni.getWindowInfo()
const baseSearchNavigationHeight = resolveCustomNavigationLayout({
  windowWidth: windowInfo.windowWidth,
  // #ifdef MP-WEIXIN
  statusBarHeight: windowInfo.statusBarHeight,
  menuButton: uni.getMenuButtonBoundingClientRect(),
  // #endif
}).height
const rentDraft = reactive({ min: '', max: '' })
const areaDraft = reactive({ min: '', max: '' })
const query = reactive({
  keyword: '',
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  elevator: null as boolean | null,
  sort: 'latest' as NonNullable<PublicHousesUsingGetParams['sort']>,
})
const activeFilterCount = computed(() => [
  Boolean(query.minRent || query.maxRent),
  Boolean(query.minArea || query.maxArea),
  query.bedrooms !== '',
  query.elevator !== null,
  spatialFilter.hasAnyFilter.value,
  Boolean(commute.value),
].filter(Boolean).length)
const hasPublicFilters = computed(() => Boolean(query.keyword.trim() || activeFilterCount.value))
const emptyTitle = computed(() => hasPublicFilters.value ? '没有找到符合条件的房源' : '暂时没有公开房源')
const emptyDescription = computed(() => hasPublicFilters.value ? '试试清空关键词或放宽筛选条件。' : '新房源发布后会显示在这里。')
const locationFilterText = computed(() => commute.value
  ? spatialFilter.hasLocationFilter.value ? `${spatialFilter.locationMode.value === 'metro' ? '地铁' : '区域'} · 通勤` : `通勤 ${commute.value.maxMinutes}分`
  : spatialFilter.hasLocationFilter.value ? spatialFilter.locationLabel.value : '位置')
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
const elevatorFilterText = computed(() => query.elevator === null ? '电梯' : query.elevator ? '有电梯' : '无电梯')
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
    has_elevator_access: query.elevator ?? undefined,
    ...spatialFilter.requestParams.value,
    ...(commute.value && !spatialFilter.hasLocationFilter.value && !nearbyRadiusM.value ? { province: undefined, city: undefined } : {}),
    commute_search_id: commute.value?.searchId,
    sort: query.sort,
    page,
    page_size: pageSize,
  }
}

function currentCommuteFilters(): Record<string, unknown> {
  const params = { ...requestParams(1, 12) }
  delete params.commute_search_id
  delete params.sort
  delete params.page
  delete params.page_size
  return normalizePublicHouseQuery(params)
}

const housePage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize }) => listPublicHouses(requestParams(page, pageSize)),
  pageSize: 12,
  refreshOnShow: false,
  keyOf: item => item.id,
  pullDownRefresh: false,
  reachBottom: false,
})
let initialized = false
let lastLoadedScopeKey = ''

async function refreshHouses(retry = false) {
  if (commute.value && !await ensureCommuteSearch(retry))
    return
  await housePage.refresh()
  if (commute.value && housePage.error.value?.statusCode === 404 && await ensureCommuteSearch(true))
    await housePage.refresh()
  lastLoadedScopeKey = spatialFilter.scopeKey.value
}

async function ensureCommuteSearch(retry = false): Promise<boolean> {
  const selection = commute.value
  if (!selection)
    return true
  const filters = currentCommuteFilters()
  const key = JSON.stringify([selection.destinationId || selection.place.token, selection.mode, selection.maxMinutes, filters])
  if (!retry && selection.searchId && commuteFilterKey === key)
    return true
  if (!retry && creatingCommuteKey === key && creatingCommutePromise)
    return creatingCommutePromise
  const version = ++commuteVersion
  clearTimeout(commuteTimer)
  commuteProgress.value = null
  commuteError.value = ''
  housePage.reset()
  creatingCommuteKey = key
  const promise = (async () => {
    try {
      const result = await createCommuteSearch({
        ...(selection.destinationId ? { destination_id: selection.destinationId } : { place_token: selection.place.token }),
        mode: selection.mode,
        max_minutes: selection.maxMinutes,
        filters,
        retry,
      })
      if (version !== commuteVersion)
        return false
      commute.value = { ...selection, searchId: result.search_id, destinationId: result.destination_id }
      commuteFilterKey = key
      if (pageVisible)
        void pollCommute(version)
      return true
    }
    catch (error) {
      if (version === commuteVersion)
        commuteError.value = error instanceof Error ? error.message : '通勤条件加载失败'
      return false
    }
    finally {
      if (creatingCommuteKey === key) {
        creatingCommuteKey = ''
        creatingCommutePromise = null
      }
    }
  })()
  creatingCommutePromise = promise
  return promise
}

function search() {
  activeTopFilter.value = null
  void refreshHouses()
}

function openKeywordSearch() {
  activeTopFilter.value = null
  uni.navigateTo({
    url: `${APP_ROUTES.publicHouseSearchInput}?from=house-search&keyword=${encodeURIComponent(query.keyword)}&city=${encodeURIComponent(regionStore.selection.city)}`,
    events: {
      applyKeyword: (keyword: string) => {
        query.keyword = keyword
        void refreshHouses()
      },
    },
  })
}

function resetFilters() {
  Object.assign(query, {
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    elevator: null,
    sort: 'latest',
  })
  Object.assign(rentDraft, { min: '', max: '' })
  Object.assign(areaDraft, { min: '', max: '' })
  pendingLocationMode.value = null
  spatialFilter.reset()
  resetCommute(false)
}

function resetCommute(refresh = true) {
  commuteVersion += 1
  clearTimeout(commuteTimer)
  commute.value = null
  commuteProgress.value = null
  commuteError.value = ''
  commuteFilterKey = ''
  housePage.reset()
  if (query.sort === 'commute_asc')
    query.sort = 'latest'
  if (refresh)
    void refreshHouses()
}

function applyCommute(value: AppliedCommute) {
  workPlacePreference.save(value.place, value.mode)
  commuteVersion += 1
  clearTimeout(commuteTimer)
  commute.value = value
  commuteProgress.value = null
  commuteError.value = ''
  commuteFilterKey = ''
  query.sort = 'commute_asc'
  activeTopFilter.value = null
  housePage.reset()
  void refreshHouses()
}

function applyCommuteDraft(value: CommuteDraft) {
  if (!value.place)
    return
  const existing = commute.value
  const samePlace = existing?.place.name === value.place.name && existing.place.city === value.place.city && existing.place.token === value.place.token
  applyCommute({ ...value, place: value.place, destinationId: value.place.destinationId || (samePlace ? existing?.destinationId : undefined) })
}

async function pollCommute(version: number) {
  if (!pageVisible || !commute.value?.searchId || version !== commuteVersion || pollingCommuteVersion === version)
    return
  pollingCommuteVersion = version
  commuteError.value = ''
  try {
    const result = await getCommuteProgress(commute.value.searchId)
    if (version !== commuteVersion)
      return
    const previousProcessed = commuteProgress.value?.processed
    commuteProgress.value = result
    if (result.processed !== previousProcessed || result.status === 'ready')
      await housePage.refresh()
    if (result.status === 'failed') {
      commuteError.value = result.error || '路线计算失败，请重试计算'
    }
    else if (result.status === 'pending' && pageVisible) {
      commuteTimer = setTimeout(() => void pollCommute(version), 1800)
    }
  }
  catch (error) {
    if (version === commuteVersion) {
      if (error instanceof AppError && error.statusCode === 404)
        void refreshHouses(true)
      else
        commuteError.value = error instanceof Error ? error.message : '通勤搜索状态加载失败'
    }
  }
  finally {
    if (pollingCommuteVersion === version)
      pollingCommuteVersion = null
  }
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
    const location = await getCurrentLocationGcj02()
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, radius)
    return true
  }
  catch (error) {
    spatialFilter.exitNearby()
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能筛选附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
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
  if (filter === 'location')
    preferredLocationMode.value = null
  activeTopFilter.value = filter
}

watch(activeTopFilter, async (filter) => {
  if (!filter)
    return
  await nextTick()
  const query = uni.createSelectorQuery()
  query.select('.quick-filter--open').boundingClientRect()
  query.select('.quick-filter-shell').boundingClientRect()
  query.exec((results) => {
    if (activeTopFilter.value !== filter)
      return
    const [trigger, shell] = results as Array<{ left: number, width: number } | null>
    if (!trigger || !shell)
      return
    const popoverWidth = Math.min(shell.width, uni.upx2px(680))
    const triggerCenter = trigger.left + trigger.width / 2 - shell.left
    filterPointerX.value = `${Math.max(20, Math.min(popoverWidth - 20, triggerCenter))}px`
  })
})

function setLocationVisible(visible: boolean) {
  activeTopFilter.value = visible ? 'location' : null
  if (!visible)
    preferredLocationMode.value = null
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

function selectElevatorFilter(value: boolean | null) {
  query.elevator = value
  activeTopFilter.value = null
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

function openHouse(house: PublicHouseListOut) {
  uni.navigateTo({ url: getHouseDetailRoute(house.id, house.commute_route_id ?? undefined) })
}

function openCommuteSearch() {
  preferredLocationMode.value = 'commute'
  activeTopFilter.value = 'location'
}

onLoad(async (options) => {
  const preset = parsePublicHouseSearchPreset((options || {}) as Record<string, string | undefined>)
  query.keyword = preset.keyword || ''
  query.maxRent = preset.max_rent || ''
  query.bedrooms = preset.bedrooms ?? ''
  query.sort = preset.sort || 'latest'
  let initialCommute: AppliedCommute | null = null
  if (options?.commute_destination_id) {
    const candidateMode = String(options.commute_mode || 'metro')
    const mode: CommuteMode = ['metro', 'ebike', 'bicycle', 'walking', 'driving'].includes(candidateMode) ? candidateMode as CommuteMode : 'metro'
    initialCommute = {
      searchId: options.commute_search_id ? String(options.commute_search_id) : undefined,
      destinationId: options.commute_destination_id ? Number(options.commute_destination_id) : undefined,
      place: { name: String(options.commute_place || '通勤目的地'), city: String(options.commute_city || ''), address: '', token: '' },
      mode,
      maxMinutes: Number(options.commute_max_minutes || 45),
    }
  }
  await regionStore.initializeDefaultRegion()
  if (preset.location_mode === 'metro') {
    pendingLocationMode.value = 'metro'
    if (regionStore.selection.city)
      spatialFilter.setLocationFilter({ mode: 'metro', district: '', stationNames: [] })
    else
      spatialFilter.locationMode.value = 'metro'
    activeTopFilter.value = 'location'
  }
  if (initialCommute) {
    workPlacePreference.save({ ...initialCommute.place, destinationId: initialCommute.destinationId }, initialCommute.mode)
    commute.value = initialCommute
    query.sort = 'commute_asc'
  }
  await Promise.all([
    getPublicHouseFilters().then(result => filters.value = result).catch(() => undefined),
    refreshHouses(),
    houseFavorites.refreshFavorites(),
  ])
  initialized = true
})

onShow(() => {
  pageVisible = true
  void houseFavorites.refreshFavorites()
  if (initialized && commute.value?.searchId)
    void pollCommute(commuteVersion)
  if (initialized && lastLoadedScopeKey !== spatialFilter.scopeKey.value)
    void refreshHouses()
})

onHide(() => {
  pageVisible = false
  clearTimeout(commuteTimer)
})

onUnload(() => {
  pageVisible = false
  clearTimeout(commuteTimer)
})

async function refreshResults() {
  if (resultsRefreshing.value)
    return
  resultsRefreshing.value = true
  try {
    await refreshHouses()
    if (commute.value && commuteProgress.value?.status === 'pending')
      await pollCommute(commuteVersion)
  }
  finally {
    resultsRefreshing.value = false
  }
}
</script>

<template>
  <page-meta :page-style="`overflow:${filterOverlayOpen ? 'clip' : 'visible'};`" />
  <AppPage class="public-house-search-page" ai-background :style="{ '--house-search-base-navigation-height': `${baseSearchNavigationHeight}px` }">
    <template #navigation>
      <AppCustomNavigation title="" align="start" back transparent scroll-mode="sticky" :fallback-url="APP_ROUTES.home">
        <template #content>
          <view class="navigation-search-row">
            <button class="navigation-search-bar" aria-label="搜索房源" @click="openKeywordSearch">
              <view class="i-carbon-search navigation-search-icon" />
              <text class="navigation-search-keyword" :class="{ 'navigation-search-keyword--placeholder': !query.keyword }">{{ query.keyword || '搜索小区、区域或房源' }}</text>
            </button>
            <view class="navigation-region">
              <PublicHouseRegionTrigger @change="handleRegionChange" />
            </view>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view class="quick-filter-shell" :class="{ 'quick-filter-shell--open': activeTopFilter }" :style="{ '--filter-pointer-x': filterPointerX }">
      <scroll-view class="quick-filter-scroll" scroll-x enhanced :show-scrollbar="false">
        <view class="quick-filter-row">
          <view class="quick-filter" :class="{ 'quick-filter--active': nearbyRadiusM, 'quick-filter--open': activeTopFilter === 'nearby' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('nearby')">
            <view class="i-carbon-location-current" />
            <text>{{ nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
          <view class="quick-filter" :class="{ 'quick-filter--active': spatialFilter.hasLocationFilter.value || commute, 'quick-filter--open': activeTopFilter === 'location' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('location')">
            <view class="i-carbon-map" />
            <text>{{ locationFilterText }}</text>
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
          <view class="quick-filter" :class="{ 'quick-filter--active': query.elevator !== null, 'quick-filter--open': activeTopFilter === 'elevator' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('elevator')">
            <view class="i-carbon-building" />
            <text>{{ elevatorFilterText }}</text>
            <view class="i-carbon-chevron-down" />
          </view>
        </view>
      </scroll-view>

      <view v-if="activeTopFilter && activeTopFilter !== 'location'" class="top-filter-popover-host">
        <view class="top-filter-mask" @touchmove.stop.prevent @wheel.stop.prevent @click="closeTopFilter" />
        <view class="top-filter-popover" @wheel.stop.prevent>
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

          <template v-else-if="activeTopFilter === 'elevator'">
            <view class="top-filter-popover__heading">
              <view class="top-filter-popover__heading-main">
                <view class="i-carbon-building" />
                <view class="top-filter-popover__heading-copy">
                  <strong>电梯</strong>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid">
              <button class="top-filter-popover__choice" :class="{ 'top-filter-popover__choice--active': query.elevator === null }" @click="selectElevatorFilter(null)">
                不限
              </button>
              <button class="top-filter-popover__choice" :class="{ 'top-filter-popover__choice--active': query.elevator === true }" @click="selectElevatorFilter(true)">
                有电梯
              </button>
              <button class="top-filter-popover__choice" :class="{ 'top-filter-popover__choice--active': query.elevator === false }" @click="selectElevatorFilter(false)">
                无电梯
              </button>
            </view>
          </template>
        </view>
      </view>

      <PublicHouseLocationDropdown
        :visible="activeTopFilter === 'location'"
        :value="spatialFilter.locationFilter.value"
        :commute="commute"
        :preferred-mode="preferredLocationMode"
        @update:visible="setLocationVisible"
        @apply="applyLocationFilter"
        @apply-commute="applyCommuteDraft"
        @clear-commute="resetCommute"
      />
    </view>

    <view class="sort-row">
      <view class="sort-actions">
        <text v-if="commute" :class="{ active: query.sort === 'commute_asc' }" @click="query.sort = 'commute_asc'; search()">通勤</text>
        <text v-if="spatialFilter.hasSpatialCenter.value" :class="{ active: query.sort === 'distance_asc' }" @click="query.sort = 'distance_asc'; search()">距离</text>
        <text :class="{ active: query.sort === 'latest' }" @click="query.sort = 'latest'; search()">最新</text>
        <text :class="{ active: query.sort === 'rent_asc' }" @click="query.sort = 'rent_asc'; search()">租金</text>
      </view>
    </view>

    <scroll-view
      class="house-results-scroll"
      scroll-y
      enhanced
      :show-scrollbar="false"
      :lower-threshold="160"
      refresher-enabled
      :refresher-triggered="resultsRefreshing"
      @refresherrefresh="refreshResults"
      @scrolltolower="housePage.loadMore()"
    >
      <view class="house-results-scroll__content">
        <view v-if="commute" class="commute-entry commute-entry--applied" @click="openCommuteSearch">
          <view class="i-carbon-train commute-entry__icon" />
          <view class="commute-entry__copy">
            <strong>到{{ commute.place.name }} · {{ commuteModeLabel(commute.mode) }} {{ commute.maxMinutes }} 分钟内</strong>
            <text>已应用通勤条件 · 点击修改</text>
          </view>
          <view class="i-carbon-chevron-right" />
        </view>

        <view v-if="commute && (commuteProgress?.status === 'pending' || !commuteProgress || commuteError)" class="commute-status">
          <template v-if="commuteError">
            <strong>{{ commuteError }}</strong>
            <button @click="refreshHouses(true)">
              重试计算
            </button>
          </template>
          <template v-else-if="!commuteProgress">
            <strong>正在准备到 {{ commute.place.name }} 的通勤搜索</strong>
            <text>按当前房源条件查找候选楼栋…</text>
          </template>
          <template v-else>
            <strong>正在计算到 {{ commute.place.name }} 的通勤路线</strong>
            <text>已处理 {{ commuteProgress?.processed ?? 0 }} / {{ commuteProgress?.total ?? 0 }} 栋楼，其他条件仍可调整</text>
            <progress :percent="commuteProgress?.total ? Math.round((commuteProgress.processed / commuteProgress.total) * 100) : 0" active-color="#1677ff" :stroke-width="5" />
          </template>
        </view>

        <AppPagedList
          v-if="!commute || commuteProgress?.status === 'ready' || housePage.items.value.length > 0"
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
              :commute-minutes="item.commute_minutes ?? undefined"
              :commute-mode-label="commute ? commuteModeLabel(commute.mode) : undefined"
              @click="openHouse(item)"
              @favorite="houseFavorites.toggleFavorite(item.id)"
            />
          </template>
        </AppPagedList>
      </view>
    </scroll-view>
  </AppPage>
</template>

<style scoped lang="scss">
.public-house-search-page {
  --house-search-navigation-height: max(var(--house-search-base-navigation-height), calc(64rpx + 8px));

  display: flex;
  height: 100vh;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}
:deep(.public-house-search-page .app-custom-navigation) {
  height: var(--house-search-navigation-height);
  flex: 0 0 auto;
}
:deep(.public-house-search-page .app-page__content) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  padding-top: 0;
  padding-bottom: 0;
}
.commute-status {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 30rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.commute-status strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.commute-status text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.commute-status button {
  margin: 0;
  color: var(--app-color-brand);
  font-size: 23rpx;
}
.commute-entry {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 24rpx;
  border: 1rpx solid rgb(22 119 255 / 20%);
  border-radius: 24rpx;
  color: var(--app-color-brand);
  background: linear-gradient(120deg, #edf5ff, #fff);
}
.commute-entry__icon {
  font-size: 36rpx;
}
.commute-entry__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.commute-entry__copy strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.commute-entry__copy text {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
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
  width: auto;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8rpx;
  margin: 0;
  padding: 0 14rpx;
  border: 1rpx solid rgb(255 255 255 / 76%);
  border-radius: 34rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 78%);
  box-shadow: 0 10rpx 30rpx rgb(31 91 161 / 9%);
  backdrop-filter: blur(20rpx);
}
.navigation-search-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 28rpx;
}
.navigation-search-keyword {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 23rpx;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}
.navigation-search-keyword--placeholder {
  color: var(--app-text-muted);
}
.navigation-region {
  min-width: 0;
  max-width: 192rpx;
  flex: 0 0 auto;
  overflow: hidden;
}
:deep(.navigation-region .public-house-region-trigger) {
  max-width: 192rpx;
  padding-right: 4rpx;
  padding-left: 4rpx;
}
.quick-filter-shell {
  --public-house-filter-popover-width: 680rpx;

  position: relative;
  z-index: 20;
  width: 100%;
  flex: 0 0 auto;
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
.top-filter-popover-host::before {
  position: absolute;
  z-index: 3;
  top: 6rpx;
  left: var(--filter-pointer-x);
  width: 20rpx;
  height: 20rpx;
  margin-left: -10rpx;
  border-top: 1rpx solid rgb(255 255 255 / 80%);
  border-left: 1rpx solid rgb(255 255 255 / 80%);
  background: #fff;
  content: '';
  transform: rotate(45deg);
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
  flex: 0 0 auto;
  align-items: center;
  justify-content: flex-end;
  padding: 20rpx 0 16rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.house-results-scroll {
  height: 0;
  min-height: 0;
  flex: 1;
}
.house-results-scroll__content {
  padding-bottom: calc(var(--app-page-gutter) + env(safe-area-inset-bottom));
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
