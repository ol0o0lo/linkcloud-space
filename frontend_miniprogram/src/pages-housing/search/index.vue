<script setup lang="ts">
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import type { AppliedCommute, CommuteDraft, CommuteProgress } from '@/features/houses/commute'
import type { CommuteMode, CommutePlace } from '@/services/manual/house-commute'
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

type TopFilter = 'location' | 'rent' | 'bedroom' | 'more'
type HouseSort = NonNullable<PublicHousesUsingGetParams['sort']>
type HouseListingType = NonNullable<PublicHousesUsingGetParams['listing_type']>

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

const LISTING_TYPE_OPTIONS = [
  { label: '不限', value: '' },
  { label: '整租', value: 'whole' },
  { label: '合租', value: 'shared' },
  { label: '公寓', value: 'apartment' },
  { label: '短租', value: 'short_term' },
] as const

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
const selectedPlaceName = ref('')
const selectedPlaceCity = ref('')
const resultsRefreshing = ref(false)
const nearbyRadiusM = computed<PublicHouseRadiusM | null>(() => spatialFilter.nearbyRadiusM.value)
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
const listingTypeDraft = ref<HouseListingType | ''>('')
const elevatorDraft = ref<boolean | null>(null)
const query = reactive({
  keyword: '',
  listingType: '' as HouseListingType | '',
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  bedroomsMin: '' as string | number,
  elevator: null as boolean | null,
  sort: 'latest' as HouseSort,
})
// 当前版本的 wd-sort-button 用 -1 高亮上箭头、1 高亮下箭头。
const rentSortDirection = computed<-1 | 0 | 1>(() => query.sort === 'rent_asc' ? -1 : query.sort === 'rent_desc' ? 1 : 0)
const areaSortDirection = computed<-1 | 0 | 1>(() => query.sort === 'area_asc' ? -1 : query.sort === 'area_desc' ? 1 : 0)
const activeFilterCount = computed(() => [
  Boolean(query.listingType),
  Boolean(query.minRent || query.maxRent),
  Boolean(query.minArea || query.maxArea),
  query.bedrooms !== '' || query.bedroomsMin !== '',
  query.elevator !== null,
  spatialFilter.hasAnyFilter.value,
  Boolean(commute.value),
].filter(Boolean).length)
const hasPublicFilters = computed(() => Boolean(query.keyword.trim() || activeFilterCount.value))
const emptyTitle = computed(() => hasPublicFilters.value ? '没有找到符合条件的房源' : '暂时没有公开房源')
const emptyDescription = computed(() => hasPublicFilters.value ? '试试清空关键词或放宽筛选条件。' : '新房源发布后会显示在这里。')
const locationFilterText = computed(() => {
  if (nearbyRadiusM.value)
    return '附近'
  if (spatialFilter.hasLocationFilter.value)
    return spatialFilter.locationMode.value === 'metro' ? '地铁' : '区域'
  if (commute.value)
    return '通勤'
  return '位置'
})
const rentFilterText = computed(() => {
  if (query.minRent && query.maxRent)
    return `${Number(query.minRent) / 1000}-${Number(query.maxRent) / 1000}k`
  if (query.minRent)
    return `${Number(query.minRent) / 1000}k以上`
  if (query.maxRent)
    return `${Number(query.maxRent) / 1000}k以下`
  return '租金'
})
const bedroomFilterText = computed(() => query.bedrooms !== '' ? `${query.bedrooms}室` : query.bedroomsMin !== '' ? `${query.bedroomsMin}室+` : '户型')
const hasMoreFilters = computed(() => Boolean(query.listingType || query.minArea || query.maxArea || query.elevator !== null))
const bedroomOptions = computed(() => filters.value?.bedrooms.length ? filters.value.bedrooms : [1, 2, 3, 4])

function requestParams(page: number, pageSize: number): PublicHousesUsingGetParams {
  return {
    keyword: query.keyword,
    listing_type: query.listingType || undefined,
    min_rent: query.minRent,
    max_rent: query.maxRent,
    min_area: query.minArea,
    max_area: query.maxArea,
    bedrooms: query.bedrooms === '' ? undefined : Number(query.bedrooms),
    bedrooms_min: query.bedroomsMin === '' ? undefined : Number(query.bedroomsMin),
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
  const nearbyParams = spatialFilter.nearbyLocation.value && nearbyRadiusM.value
    ? `&nearby=1&longitude=${spatialFilter.nearbyLocation.value.longitude}&latitude=${spatialFilter.nearbyLocation.value.latitude}&radius_m=${nearbyRadiusM.value}`
    : ''
  const houseParams = `&listing_type=${query.listingType}&bedrooms=${query.bedrooms}&bedrooms_min=${query.bedroomsMin}`
  const placeParams = selectedPlaceName.value && nearbyParams
    ? `&place_name=${encodeURIComponent(selectedPlaceName.value)}&place_city=${encodeURIComponent(selectedPlaceCity.value)}`
    : ''
  uni.navigateTo({
    url: `${APP_ROUTES.publicHouseSearchInput}?from=house-search&keyword=${encodeURIComponent(query.keyword)}&city=${encodeURIComponent(nearbyParams ? selectedPlaceCity.value : regionStore.selection.city)}${nearbyParams}${houseParams}${placeParams}`,
    events: {
      applyKeyword: (keyword: string) => {
        query.keyword = keyword
        void refreshHouses()
      },
      applyPlace: (place: CommutePlace) => {
        if (!Number.isFinite(place.longitude) || !Number.isFinite(place.latitude))
          return
        spatialFilter.enterNearby({ longitude: place.longitude!, latitude: place.latitude! }, nearbyRadiusM.value || 1000)
        selectedPlaceName.value = place.name
        selectedPlaceCity.value = place.city
        resetCommute(false)
        query.keyword = ''
        query.sort = 'distance_asc'
        void refreshHouses()
      },
    },
  })
}

function resetFilters() {
  Object.assign(query, {
    listingType: '',
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    bedroomsMin: '',
    elevator: null,
    sort: 'latest',
  })
  Object.assign(rentDraft, { min: '', max: '' })
  Object.assign(areaDraft, { min: '', max: '' })
  listingTypeDraft.value = ''
  elevatorDraft.value = null
  pendingLocationMode.value = null
  spatialFilter.reset()
  selectedPlaceName.value = ''
  selectedPlaceCity.value = ''
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
  if (filter === 'rent')
    Object.assign(rentDraft, { min: query.minRent, max: query.maxRent })
  if (filter === 'more') {
    Object.assign(areaDraft, { min: query.minArea, max: query.maxArea })
    listingTypeDraft.value = query.listingType
    elevatorDraft.value = query.elevator
  }
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

function selectSort(sort: HouseSort) {
  if (query.sort === sort)
    return
  query.sort = sort
  search()
}

function selectRentSort({ value }: { value: number }) {
  selectSort(value === 0 ? 'latest' : value === -1 ? 'rent_asc' : 'rent_desc')
}

function selectAreaSort({ value }: { value: number }) {
  selectSort(value === 0 ? 'latest' : value === -1 ? 'area_asc' : 'area_desc')
}

async function applyNearbyFilter(radiusM: PublicHouseRadiusM) {
  const applied = await selectNearbyRadius(radiusM)
  if (!applied)
    return
  query.sort = 'distance_asc'
  activeTopFilter.value = null
  void refreshHouses()
}

function clearNearbyFilter() {
  const hadNearbyFilter = Boolean(nearbyRadiusM.value)
  spatialFilter.exitNearby()
  selectedPlaceName.value = ''
  selectedPlaceCity.value = ''
  if (query.sort === 'distance_asc' && !spatialFilter.hasSpatialCenter.value)
    query.sort = 'latest'
  activeTopFilter.value = null
  if (hadNearbyFilter)
    void refreshHouses()
}

function applyLocationFilter(value: PublicHouseLocationFilterValue) {
  spatialFilter.setLocationFilter(value)
  selectedPlaceName.value = ''
  selectedPlaceCity.value = ''
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

function applyMoreFilters() {
  if (!isValidRange(areaDraft.min, areaDraft.max, '面积'))
    return
  query.listingType = listingTypeDraft.value
  query.minArea = areaDraft.min
  query.maxArea = areaDraft.max
  query.elevator = elevatorDraft.value
  activeTopFilter.value = null
  void refreshHouses()
}

function clearMoreFilters() {
  Object.assign(areaDraft, { min: '', max: '' })
  listingTypeDraft.value = ''
  elevatorDraft.value = null
  query.listingType = ''
  query.minArea = ''
  query.maxArea = ''
  query.elevator = null
  activeTopFilter.value = null
  void refreshHouses()
}

function selectBedroomFilter(value: string | number) {
  query.bedrooms = value
  query.bedroomsMin = ''
  activeTopFilter.value = null
  void refreshHouses()
}

function handleRegionChange() {
  selectedPlaceName.value = ''
  selectedPlaceCity.value = ''
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
  query.listingType = preset.listing_type || ''
  query.maxRent = preset.max_rent || ''
  query.bedrooms = preset.bedrooms ?? ''
  query.bedroomsMin = preset.bedrooms_min ?? ''
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
  if (preset.nearby) {
    let applied: boolean
    if (preset.latitude !== undefined && preset.longitude !== undefined) {
      spatialFilter.enterNearby({ latitude: preset.latitude, longitude: preset.longitude }, preset.radius_m || 1000)
      applied = true
    }
    else {
      applied = await selectNearbyRadius(1000)
    }
    if (applied)
      query.sort = 'distance_asc'
    if (applied && preset.latitude !== undefined && preset.longitude !== undefined) {
      selectedPlaceName.value = preset.place_name || ''
      selectedPlaceCity.value = preset.place_city || ''
    }
  }
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
          <view class="navigation-search-row min-w-0 w-full flex items-center gap-1">
            <button class="navigation-search-bar m-0 box-border h-8 min-w-0 w-auto flex flex-1 items-center gap-1 border-hairline border-hex-ffffff/76 rounded-4.5 border-solid bg-hex-ffffff/78 px-2 py-0 backdrop-blur-10" aria-label="搜索房源" @click="openKeywordSearch">
              <view class="i-carbon-search navigation-search-icon flex-none text-size-sm text-content-muted" />
              <text class="navigation-search-keyword min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left text-size-xs text-content-primary leading-snug" :class="{ 'navigation-search-keyword--placeholder': !query.keyword && !selectedPlaceName }">{{ query.keyword || (nearbyRadiusM && selectedPlaceName ? `${selectedPlaceName}附近` : '搜索地点、小区或房源') }}</text>
            </button>
            <view class="navigation-region max-w-24 min-w-0 flex-none overflow-hidden">
              <PublicHouseRegionTrigger @change="handleRegionChange" />
            </view>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view class="quick-filter-shell relative z-20 mt-0 w-full flex-none" :class="{ 'quick-filter-shell--open': activeTopFilter }" :style="{ '--filter-pointer-x': filterPointerX }">
      <view class="quick-filter-row grid grid-cols-4 gap-1.5">
        <view class="quick-filter relative box-border h-7.5 min-w-0 flex items-center justify-center gap-0.5 overflow-hidden border-hairline border-app-border rounded-3 border-solid bg-surface-card px-1 py-0 text-size-xs text-content-secondary leading-7.5" :class="{ 'quick-filter--active': nearbyRadiusM || spatialFilter.hasLocationFilter.value || commute, 'quick-filter--open': activeTopFilter === 'location' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('location')">
          <text class="quick-filter__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ locationFilterText }}</text>
          <view class="i-carbon-chevron-down" />
        </view>
        <view class="quick-filter relative box-border h-7.5 min-w-0 flex items-center justify-center gap-0.5 overflow-hidden border-hairline border-app-border rounded-3 border-solid bg-surface-card px-1 py-0 text-size-xs text-content-secondary leading-7.5" :class="{ 'quick-filter--active': query.minRent || query.maxRent, 'quick-filter--open': activeTopFilter === 'rent' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('rent')">
          <text class="quick-filter__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ rentFilterText }}</text>
          <view class="i-carbon-chevron-down" />
        </view>
        <view class="quick-filter relative box-border h-7.5 min-w-0 flex items-center justify-center gap-0.5 overflow-hidden border-hairline border-app-border rounded-3 border-solid bg-surface-card px-1 py-0 text-size-xs text-content-secondary leading-7.5" :class="{ 'quick-filter--active': query.bedrooms !== '', 'quick-filter--open': activeTopFilter === 'bedroom' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('bedroom')">
          <text class="quick-filter__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{{ bedroomFilterText }}</text>
          <view class="i-carbon-chevron-down" />
        </view>
        <wd-badge is-dot :hidden="!hasMoreFilters" type="primary" top="6rpx" right="8rpx" border custom-style="display: block;">
          <view class="quick-filter relative box-border h-7.5 min-w-0 flex items-center justify-center gap-0.5 overflow-hidden border-hairline border-app-border rounded-3 border-solid bg-surface-card px-1 py-0 text-size-xs text-content-secondary leading-7.5" :class="{ 'quick-filter--active': hasMoreFilters, 'quick-filter--open': activeTopFilter === 'more' }" hover-class="quick-filter--pressed" :aria-label="hasMoreFilters ? '筛选条件，已有条件生效' : '筛选条件'" @click="toggleTopFilter('more')">
            <text class="quick-filter__label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">筛选</text>
            <view class="i-carbon-chevron-down" />
          </view>
        </wd-badge>
      </view>

      <view v-if="activeTopFilter && activeTopFilter !== 'location'" class="top-filter-popover-host absolute left-0 top-full z-1">
        <view class="top-filter-mask fixed inset-0 z-1 bg-hex-0f172a/28 backdrop-blur-1.5" @touchmove.stop.prevent @wheel.stop.prevent @click="closeTopFilter" />
        <view class="top-filter-popover relative z-2 mt-2 box-border overflow-y-auto border-hairline border-hex-ffffff/80 rounded-3.5 border-solid p-3.5" :class="{ 'top-filter-popover--more': activeTopFilter === 'more' }" @wheel.stop>
          <template v-if="activeTopFilter === 'rent'">
            <view class="top-filter-popover__heading flex items-center justify-between gap-2.5">
              <view class="top-filter-popover__heading-main flex items-center gap-2">
                <view class="i-carbon-currency-yen" />
                <view class="top-filter-popover__heading-copy flex flex-col gap-1">
                  <strong>租金</strong>
                  <text>元 / 月</text>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid grid gap-1.5">
              <button
                v-for="option in rentRangeOptions"
                :key="option.label"
                class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5"
                :class="{ 'top-filter-popover__choice--active': isRangeSelected(option, rentDraft) }"
                @click="selectRangeOption(rentDraft, option)"
              >
                {{ option.label }}
              </button>
            </view>
            <view class="top-filter-popover__range grid mt-2.5 items-center gap-1.5 text-center text-size-2xs text-content-muted">
              <view class="top-filter-popover__field min-w-0 border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-2 py-1.5">
                <wd-input v-model="rentDraft.min" type="number" placeholder="最低租金" />
              </view>
              <text>—</text>
              <view class="top-filter-popover__field min-w-0 border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-2 py-1.5">
                <wd-input v-model="rentDraft.max" type="number" placeholder="最高租金" />
              </view>
            </view>
            <view class="top-filter-popover__footer grid mt-3 gap-2">
              <button class="top-filter-popover__reset border-hairline border-hex-1677ff/24 border-solid bg-hex-fff text-$filter-popover-primary" @click="clearRentFilter">
                不限租金
              </button>
              <button class="top-filter-popover__apply text-hex-fff font-bold" @click="applyRentFilter">
                确定
              </button>
            </view>
          </template>

          <template v-else-if="activeTopFilter === 'bedroom'">
            <view class="top-filter-popover__heading flex items-center justify-between gap-2.5">
              <view class="top-filter-popover__heading-main flex items-center gap-2">
                <view class="i-carbon-hotel" />
                <view class="top-filter-popover__heading-copy flex flex-col gap-1">
                  <strong>户型</strong>
                  <text>选择卧室数量</text>
                </view>
              </view>
            </view>
            <view class="top-filter-popover__choice-grid top-filter-popover__choice-grid--compact grid gap-1.5">
              <button class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5" :class="{ 'top-filter-popover__choice--active': query.bedrooms === '' }" @click="selectBedroomFilter('')">
                不限
              </button>
              <button
                v-for="item in bedroomOptions"
                :key="item"
                class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5"
                :class="{ 'top-filter-popover__choice--active': query.bedrooms === item }"
                @click="selectBedroomFilter(item)"
              >
                {{ item }} 室
              </button>
            </view>
          </template>

          <template v-else-if="activeTopFilter === 'more'">
            <scroll-view class="top-filter-popover__body" scroll-y :show-scrollbar="false">
              <view class="top-filter-popover__content box-border pb-3">
                <view class="top-filter-popover__heading flex items-center justify-between gap-2.5">
                  <view class="top-filter-popover__heading-main flex items-center gap-2">
                    <view class="i-carbon-filter" />
                    <view class="top-filter-popover__heading-copy flex flex-col gap-1">
                      <strong>筛选</strong>
                      <text>出租类型 · 面积 · 电梯</text>
                    </view>
                  </view>
                </view>
                <view class="top-filter-popover__section-title mt-3 flex items-center gap-1.5 text-size-xs text-content-primary">
                  <view class="i-carbon-home" />
                  <strong>出租类型</strong>
                </view>
                <view class="top-filter-popover__choice-grid grid gap-1.5">
                  <button
                    v-for="option in LISTING_TYPE_OPTIONS"
                    :key="option.value"
                    class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5"
                    :class="{ 'top-filter-popover__choice--active': listingTypeDraft === option.value }"
                    @click="listingTypeDraft = option.value"
                  >
                    {{ option.label }}
                  </button>
                </view>
                <view class="top-filter-popover__section-title mt-3 flex items-center gap-1.5 text-size-xs text-content-primary">
                  <view class="i-carbon-ruler" />
                  <strong>建筑面积 · ㎡</strong>
                </view>
                <view class="top-filter-popover__choice-grid grid gap-1.5">
                  <button
                    v-for="option in areaRangeOptions"
                    :key="option.label"
                    class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5"
                    :class="{ 'top-filter-popover__choice--active': isRangeSelected(option, areaDraft) }"
                    @click="selectRangeOption(areaDraft, option)"
                  >
                    {{ option.label }}
                  </button>
                </view>
                <view class="top-filter-popover__range grid mt-2.5 items-center gap-1.5 text-center text-size-2xs text-content-muted">
                  <view class="top-filter-popover__field min-w-0 border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-2 py-1.5">
                    <wd-input v-model="areaDraft.min" type="digit" placeholder="最小面积" />
                  </view>
                  <text>—</text>
                  <view class="top-filter-popover__field min-w-0 border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-2 py-1.5">
                    <wd-input v-model="areaDraft.max" type="digit" placeholder="最大面积" />
                  </view>
                </view>
                <view class="top-filter-popover__section-title mt-3 flex items-center gap-1.5 text-size-xs text-content-primary">
                  <view class="i-carbon-building" />
                  <strong>电梯</strong>
                </view>
                <view class="top-filter-popover__choice-grid top-filter-popover__choice-grid--elevator grid gap-1.5">
                  <button class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5" :class="{ 'top-filter-popover__choice--active': elevatorDraft === null }" @click="elevatorDraft = null">
                    不限
                  </button>
                  <button class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5" :class="{ 'top-filter-popover__choice--active': elevatorDraft === true }" @click="elevatorDraft = true">
                    有电梯
                  </button>
                  <button class="top-filter-popover__choice m-0 h-8.5 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap border-hairline border-transparent rounded-2.5 border-solid bg-hex-f5f8fc px-1.5 py-0 text-size-2xs text-content-secondary leading-8.5" :class="{ 'top-filter-popover__choice--active': elevatorDraft === false }" @click="elevatorDraft = false">
                    无电梯
                  </button>
                </view>
              </view>
            </scroll-view>
            <view class="top-filter-popover__footer grid mt-3 gap-2">
              <button class="top-filter-popover__reset border-hairline border-hex-1677ff/24 border-solid bg-hex-fff text-$filter-popover-primary" @click="clearMoreFilters">
                重置
              </button>
              <button class="top-filter-popover__apply text-hex-fff font-bold" @click="applyMoreFilters">
                确定
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
        show-nearby
        :nearby-radius-m="spatialFilter.radiusM.value"
        :nearby-active="Boolean(nearbyRadiusM)"
        :locating-nearby="locatingNearby"
        @update:visible="setLocationVisible"
        @apply-nearby="applyNearbyFilter"
        @clear-nearby="clearNearbyFilter"
        @apply="applyLocationFilter"
        @apply-commute="applyCommuteDraft"
        @clear-commute="resetCommute"
      />
    </view>

    <view class="sort-row flex flex-none items-center justify-end gap-4 whitespace-nowrap px-0 py-1.5 text-content-secondary">
      <button v-if="commute" class="sort-row__single m-0 h-8 border-0 bg-transparent p-0 text-size-sm text-content-secondary leading-8" :class="{ 'sort-row__single--active': query.sort === 'commute_asc' }" @click="selectSort('commute_asc')">
        通勤
      </button>
      <button v-if="spatialFilter.hasSpatialCenter.value" class="sort-row__single m-0 h-8 border-0 bg-transparent p-0 text-size-sm text-content-secondary leading-8" :class="{ 'sort-row__single--active': query.sort === 'distance_asc' }" @click="selectSort('distance_asc')">
        距离
      </button>
      <button class="sort-row__single m-0 h-8 border-0 bg-transparent p-0 text-size-sm text-content-secondary leading-8" :class="{ 'sort-row__single--active': query.sort === 'latest' }" @click="selectSort('latest')">
        最新
      </button>
      <wd-sort-button :model-value="rentSortDirection" title="租金" desc-first allow-reset @change="selectRentSort" />
      <wd-sort-button :model-value="areaSortDirection" title="面积" desc-first allow-reset @change="selectAreaSort" />
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
        <view v-if="commute" class="commute-entry commute-entry--applied mt-3 flex items-center gap-2.5 border-hairline border-hex-1677ff/20 rounded-3 border-solid p-3 text-app-brand" @click="openCommuteSearch">
          <view class="i-carbon-train commute-entry__icon text-size-lg" />
          <view class="commute-entry__copy min-w-0 flex gap-0.5">
            <strong>到{{ commute.place.name }} · {{ commuteModeLabel(commute.mode) }} {{ commute.maxMinutes }} 分钟内</strong>
            <text>已应用通勤条件 · 点击修改</text>
          </view>
          <view class="i-carbon-chevron-right" />
        </view>

        <view v-if="commute && (commuteProgress?.status === 'pending' || !commuteProgress || commuteError)" class="commute-status flex flex-col gap-2 border-hairline border-app-card rounded-3 border-solid bg-surface-card p-4">
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

  @apply flex;
  @apply h-screen;
  @apply min-h-0;
  @apply flex-col;
  @apply overflow-hidden;
}
:deep(.public-house-search-page .app-custom-navigation) {
  height: var(--house-search-navigation-height);
  @apply flex-none;
}
:deep(.public-house-search-page .app-page__content) {
  @apply flex;
  @apply min-h-0;
  @apply flex-1;
  @apply flex-col;
  @apply overflow-hidden;
  @apply pt-0;
  @apply pb-0;
}
.commute-status strong {
  @apply text-content-primary;
  @apply text-size-sm;
}
.commute-status text {
  @apply text-content-muted;
  @apply text-size-2xs;
}
.commute-status button {
  @apply m-0;
  @apply text-app-brand;
  @apply text-size-xs;
}
.commute-entry {
  background: linear-gradient(120deg, #edf5ff, #fff);
}
.commute-entry__copy {
  @apply flex-1;
  @apply flex-col;
}
.commute-entry__copy strong {
  @apply text-content-primary;
  @apply text-size-sm;
}
.commute-entry__copy text {
  @apply overflow-hidden;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}
button::after {
  @apply border-0;
}
.navigation-search-bar {
  box-shadow: 0 10rpx 30rpx rgb(31 91 161 / 9%);
}
.navigation-search-keyword--placeholder {
  @apply text-content-muted;
}
:deep(.navigation-region .public-house-region-trigger) {
  @apply max-w-24;
  @apply pr-0.5;
  @apply pl-0.5;
}
.quick-filter-shell {
  --public-house-filter-popover-width: 680rpx;
}
.quick-filter-shell--open {
  @apply z-1100;
}
.quick-filter > .i-carbon-chevron-down {
  @apply flex-none;
  @apply text-size-2xs;
}
.quick-filter--active {
  @apply border-hex-1677ff/24;
  @apply text-hex-1677ff;
  @apply font-semibold;
  @apply bg-hex-eef5ff;
}
.quick-filter--open {
  @apply border-hex-1677ff;
  @apply text-hex-0f63d8;
  box-shadow: 0 8rpx 22rpx rgb(22 119 255 / 12%);
}
.quick-filter > .i-carbon-chevron-down {
  transition: transform 160ms ease;
}
.quick-filter--open > .i-carbon-chevron-down {
  transform: rotate(180deg);
}
.quick-filter--pressed {
  @apply opacity-70;
}
.top-filter-popover-host {
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width);
}
.top-filter-popover-host::before {
  @apply absolute;
  @apply z-3;
  @apply top-1;
  left: var(--filter-pointer-x);
  @apply w-2.5;
  @apply h-2.5;
  @apply -ml-1;
  @apply border-t-hairline border-t-solid border-t-hex-ffffff/80;
  @apply border-l-hairline border-l-solid border-l-hex-ffffff/80;
  @apply bg-hex-fff;
  content: '';
  transform: rotate(45deg);
}
.top-filter-popover {
  --filter-popover-primary: #1677ff;
  --filter-popover-primary-active: #0f63d8;
  --filter-popover-primary-soft: #eef5ff;
  --filter-popover-max-height: min(
    72vh,
    calc(100vh - var(--house-search-navigation-height) - 174rpx - env(safe-area-inset-bottom))
  );
  max-height: var(--filter-popover-max-height);
  background: linear-gradient(145deg, rgb(255 255 255 / 99%), #f2f7ff);
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
}
.top-filter-popover--more {
  @apply flex;
  @apply flex-col;
  @apply overflow-hidden;
}
.top-filter-popover__body {
  @apply min-h-0;
  max-height: calc(var(--filter-popover-max-height) - 168rpx);
  @apply flex-1;
}
.top-filter-popover__heading-main > view:first-child {
  @apply flex-none;
  @apply text-$filter-popover-primary;
  @apply text-size-sm;
}
.top-filter-popover__heading strong {
  @apply text-content-primary;
  @apply text-size-sm;
}
.top-filter-popover__heading text {
  @apply text-content-muted;
  @apply text-size-2xs;
}
.top-filter-popover__section-title > view {
  @apply text-$filter-popover-primary;
  @apply text-size-sm;
}
.top-filter-popover__choice-grid {
  @apply mt-3;
  @apply grid-cols-3;
}
.top-filter-popover__choice-grid--compact {
  @apply grid-cols-4;
}
.top-filter-popover__choice-grid--elevator {
  @apply mt-2;
}
.top-filter-popover__choice--active {
  @apply border-hex-1677ff/25;
  @apply text-$filter-popover-primary-active;
  @apply font-bold;
  @apply bg-$filter-popover-primary-soft;
}
.top-filter-popover__range {
  grid-template-columns: minmax(0, 1fr) 28rpx minmax(0, 1fr);
}
:deep(.top-filter-popover__field .wd-input) {
  @apply p-0;
  @apply bg-transparent;
  --wot-input-bg: transparent;
  --wot-input-padding: 0;
  --wot-input-inner-height: 44rpx;
  --wot-input-inner-font-size: 23rpx;
}
.top-filter-popover__footer {
  grid-template-columns: 1fr 2fr;
}
.top-filter-popover--more .top-filter-popover__footer {
  @apply flex-none;
  @apply mt-0;
  @apply pt-2.5;
  @apply pb-1;
  @apply border-t-hairline border-t-solid border-t-hex-e3ebf6;
}
.top-filter-popover__reset,
.top-filter-popover__apply {
  @apply h-9.5;
  @apply m-0;
  @apply border-0;
  @apply rounded-2.5;
  @apply text-size-xs;
  @apply leading-9.5;
}
.top-filter-popover__apply {
  background: linear-gradient(135deg, var(--filter-popover-primary), #3b8fff);
  box-shadow: 0 12rpx 24rpx rgb(22 119 255 / 20%);
}
.top-filter-popover__apply[disabled] {
  @apply opacity-60;
}
.sort-row {
  --wot-sort-button-height: 64rpx;
  --wot-sort-button-text-font-size: 28rpx;
  --wot-sort-button-arrow-icon-size: 36rpx;
  --wot-sort-button-right-size: 24rpx;
  --wot-sort-button-color: var(--app-text-secondary);
  --wot-sort-button-color-active: var(--app-color-brand);
  --wot-sort-button-icon-color-active: var(--app-color-brand);
  --wot-sort-button-font-weight-active: 600;
}
.sort-row__single--active {
  @apply text-app-brand;
  @apply font-bold;
}
.house-results-scroll {
  @apply h-0;
  @apply min-h-0;
  @apply flex-1;
}
.house-results-scroll__content {
  padding-bottom: calc(var(--app-page-gutter) + env(safe-area-inset-bottom));
}
</style>
