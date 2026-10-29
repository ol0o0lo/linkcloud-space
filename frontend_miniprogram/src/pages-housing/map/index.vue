<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMapMarker, PublicHouseMapParams, PublicHouseMapResponse, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { CustomNavigationLayout } from '@/components/utils/navigation'
import type { GeoCoordinates } from '@/domain/geo-coordinates'
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { buildHouseMapRequestKey, createHouseMapMarkerId, resolveMapIncludePoints, shouldClearHouseMapSelection } from '@/domain/house-map'
import { parsePublicHouseSearchPreset } from '@/domain/home-content'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPage from '@/components/app/AppPage.vue'
import { resolveCustomNavigationLayout } from '@/components/utils/navigation'
// #ifdef H5
import HouseH5Map from '@/components/house/HouseH5Map.vue'
// #endif
import HouseMapResultSheet from '@/components/house/HouseMapResultSheet.vue'
import { getPublicHouseMap, listPublicHouses } from '@/features/houses/service'
import { createHouseMapSession } from '@/features/houses/house-map-session'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { getHouseDetailRoute } from '@/modules/routes'
import { usePublicHouseRegionStore } from '@/store/public-house-region'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'
// #ifdef H5
import { useRuntimeStore } from '@/store/runtime'
// #endif

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '地图找房',
    disableScroll: true,
  },
})

interface MarkerTapEvent {
  detail: {
    markerId: number | string
  }
}

interface MapViewport {
  zoom: number
  west: number
  south: number
  east: number
  north: number
}

interface MapRegionChangeEvent {
  type?: string
  detail?: {
    type?: string
    scale?: number
  }
}

const houseFavorites = useHouseCardFavorites()
const regionStore = usePublicHouseRegionStore()
const spatialFilter = usePublicHouseSpatialFilter()
// #ifdef H5
const runtimeStore = useRuntimeStore()
// #endif
const keyword = ref('')
const listingType = ref<PublicHousesUsingGetParams['listing_type']>()
const bedrooms = ref<number>()
const bedroomsMin = ref<number>()
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const locating = ref(false)
const hasLoadedMap = ref(false)
const hasViewport = ref(false)
const currentUserLocation = ref<GeoCoordinates | null>(null)
const mapResult = ref<PublicHouseMapResponse | null>(null)
const mapScale = ref(7)
const mapFitToken = ref(0)
const mapCenter = ref({ latitude: 31.2304, longitude: 121.4737 })
const nearbyLocation = computed(() => spatialFilter.scopeMode.value === 'nearby' ? spatialFilter.nearbyLocation.value : null)
const hasActiveFilters = computed(() => Boolean(keyword.value.trim()) || spatialFilter.hasAnyFilter.value)
const nearbyRadiusM = computed<PublicHouseRadiusM | null>({
  get: () => spatialFilter.nearbyRadiusM.value,
  set: (value) => {
    if (value == null)
      spatialFilter.exitNearby()
    else
      spatialFilter.setNearbyRadius(value)
  },
})
const nearbyRadiusOptions = PUBLIC_HOUSE_RADIUS_OPTIONS
const currentViewport = ref<MapViewport | null>(null)
const selectedMarkerKey = ref('')
const selectedHouses = ref<PublicHouseListOut[]>([])
const selectedHousesLoading = ref(false)
const selectedHousesError = ref('')
let houseRequestId = 0
let lastLoadedScopeKey = ''
let ignoredViewportEvents = 0
let ignoredViewportUntil = 0
let ignoredViewportResetTimer: ReturnType<typeof setTimeout> | null = null
let lastMarkerTapAt = 0
let pendingDrillViewport: { latitude: number, longitude: number, zoom: number } | null = null
let awaitingInitialViewport = false
let initialViewportFallbackTimer: ReturnType<typeof setTimeout> | null = null
let pageActive = true
const fitRequestKeys = new Set<string>()
const PROGRAMMATIC_VIEWPORT_GUARD_MS = 1200
const INITIAL_LOCATION_ZOOM = 14

const markers = computed(() => mapResult.value?.items || [])
const selectedMarker = computed(() => markers.value.find(marker => marker.key === selectedMarkerKey.value) || null)
const selectedMarkerShowsHouses = computed(() => selectedMarker.value?.level === 'building')
const nearbyCircle = computed(() => nearbyLocation.value && nearbyRadiusM.value
  ? { ...nearbyLocation.value, radius: nearbyRadiusM.value }
  : null)
const mapCircles = computed(() => nearbyCircle.value
  ? [{
      ...nearbyCircle.value,
      color: '#0066ccbb',
      fillColor: '#4da3ff22',
      strokeWidth: 2,
    }]
  : [])
const levelLabel = computed(() => ({ city: '城市', district: '区域', estate: '小区', building: '楼栋' })[mapResult.value?.level || 'city'])
const mapViewportStyle = computed(() => {
  let layout: CustomNavigationLayout
  // #ifdef MP-WEIXIN
  const windowInfo = uni.getWindowInfo()
  layout = resolveCustomNavigationLayout({
    windowWidth: windowInfo.windowWidth,
    statusBarHeight: windowInfo.statusBarHeight,
    menuButton: uni.getMenuButtonBoundingClientRect(),
  })
  // #endif
  // #ifndef MP-WEIXIN
  layout = resolveCustomNavigationLayout({
    windowWidth: uni.getWindowInfo?.().windowWidth || 0,
    statusBarHeight: 0,
  })
  // #endif
  return { '--map-navigation-height': `${layout.height}px` }
})
// #ifdef H5
const amapJsapiKey = computed(() => runtimeStore.publicConfig?.amapJsapiKey || '')
const amapSecurityJsCode = computed(() => runtimeStore.publicConfig?.amapSecurityJsCode || '')
// #endif
const mapMarkerById = computed(() => new Map(markers.value.map(marker => [createHouseMapMarkerId(marker.key), marker])))
const mapMarkers = computed(() => markers.value.map((marker) => {
  const active = marker.key === selectedMarkerKey.value
  const isGroup = marker.level !== 'building'
  return {
    id: createHouseMapMarkerId(marker.key),
    latitude: Number(marker.location.latitude),
    longitude: Number(marker.location.longitude),
    iconPath: active ? '/static/tabbar/homeHL.png' : '/static/tabbar/home.png',
    width: active ? 28 : 22,
    height: active ? 28 : 22,
    callout: {
      content: isGroup
        ? `${marker.name} · ${marker.house_count}套`
        : marker.min_rent == null ? `${marker.house_count}套` : `¥${formatAmount(Number(marker.min_rent))}起`,
      display: 'ALWAYS' as const,
      bgColor: active || isGroup ? '#0081ff' : '#ffffff',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: active || isGroup ? '#0081ff' : '#ffffff',
      color: active || isGroup ? '#ffffff' : '#0066cc',
      textAlign: 'center' as const,
      padding: 8,
      fontSize: 12,
    },
  }
}))

function formatAmount(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function overviewZoom() {
  return regionStore.selection.city ? 9 : 7
}

function selectedHouseParams(marker: PublicHouseMapMarker): PublicHousesUsingGetParams {
  return {
    keyword: keyword.value.trim(),
    listing_type: listingType.value,
    bedrooms: bedrooms.value,
    bedrooms_min: bedroomsMin.value,
    ...spatialFilter.requestParams.value,
    estate_id: marker.level === 'estate' ? marker.estate_id : undefined,
    building_id: marker.level === 'building' ? marker.building_id : undefined,
    sort: nearbyLocation.value ? 'distance_asc' : 'rent_asc',
    page: 1,
    page_size: 20,
  }
}

function mapRequestParams(viewport: MapViewport | null): PublicHouseMapParams {
  return {
    zoom: viewport?.zoom ?? mapScale.value,
    west: viewport?.west,
    south: viewport?.south,
    east: viewport?.east,
    north: viewport?.north,
    keyword: keyword.value.trim() || undefined,
    listing_type: listingType.value,
    bedrooms: bedrooms.value,
    bedrooms_min: bedroomsMin.value,
    ...spatialFilter.requestParams.value,
    coordinate_system: 'gcj02' as const,
  }
}

const mapSession = createHouseMapSession<PublicHouseMapParams, PublicHouseMapResponse>({
  buildKey: buildHouseMapRequestKey,
  request: getPublicHouseMap,
  onRefreshingChange(value) {
    if (value && !hasLoadedMap.value)
      loading.value = true
    else
      refreshing.value = value
    if (!value)
      loading.value = false
  },
  onCommit(result, meta) {
    const firstLoad = !hasLoadedMap.value
    const previouslySelectedKey = selectedMarkerKey.value
    mapResult.value = result
    mapScale.value = result.zoom
    loadError.value = ''
    if (firstLoad && !currentUserLocation.value && result.items[0]) {
      ignoreNextViewportChange()
      mapCenter.value = {
        latitude: Number(result.items[0].location.latitude),
        longitude: Number(result.items[0].location.longitude),
      }
    }
    if (fitRequestKeys.delete(meta.key) && result.items.length)
      prepareMapFit(result.items)
    if (previouslySelectedKey && !result.items.some(marker => marker.key === previouslySelectedKey)) {
      clearSelection()
      if (hasLoadedMap.value)
        uni.showToast({ title: '已移出所选房源范围', icon: 'none' })
    }
    hasLoadedMap.value = true
    lastLoadedScopeKey = spatialFilter.scopeKey.value
    if (firstLoad && currentUserLocation.value && currentViewport.value && isInitialLocationViewport(currentViewport.value, currentUserLocation.value)) {
      const viewportKey = buildHouseMapRequestKey(mapRequestParams(currentViewport.value))
      if (meta.key !== viewportKey)
        void loadMapMarkers(currentViewport.value)
    }
  },
  onError() {
    if (!hasLoadedMap.value)
      loadError.value = '地图房源加载失败，请稍后重试'
    else
      uni.showToast({ title: '当前视野房源更新失败', icon: 'none' })
  },
})

async function loadMapMarkers(viewport: MapViewport | null = currentViewport.value, force = false, fit = true) {
  if (!viewport)
    pendingDrillViewport = null
  const params = mapRequestParams(viewport)
  const requestKey = buildHouseMapRequestKey(params)
  if (!viewport && fit)
    fitRequestKeys.add(requestKey)
  try {
    await mapSession.load(params, { force })
  }
  finally {
    fitRequestKeys.delete(requestKey)
  }
}

function prepareMapFit(items: PublicHouseMapMarker[]) {
  ignoreNextViewportChange()
  // #ifdef MP-WEIXIN
  const points = resolveMapIncludePoints(items, false)
  if (!points?.length)
    return
  mapCenter.value = { ...points[0] }
  if (points.length === 1)
    return
  void nextTick(() => {
    const context = uni.createMapContext('public-house-map')
    context.includePoints({
      points,
      padding: [156, 24, 96, 24],
    })
  })
  // #endif
  // #ifdef H5
  ignoredViewportEvents = Math.max(ignoredViewportEvents, 2)
  // #endif
  mapFitToken.value += 1
}

function ignoreNextViewportChange() {
  ignoredViewportEvents += 1
  ignoredViewportUntil = Date.now() + PROGRAMMATIC_VIEWPORT_GUARD_MS
  if (ignoredViewportResetTimer)
    clearTimeout(ignoredViewportResetTimer)
  ignoredViewportResetTimer = setTimeout(() => {
    ignoredViewportEvents = 0
    ignoredViewportUntil = 0
    ignoredViewportResetTimer = null
  }, PROGRAMMATIC_VIEWPORT_GUARD_MS)
}

function cancelPendingDrill() {
  pendingDrillViewport = null
  ignoredViewportEvents = 0
  ignoredViewportUntil = 0
  if (ignoredViewportResetTimer) {
    clearTimeout(ignoredViewportResetTimer)
    ignoredViewportResetTimer = null
  }
}

function search() {
  clearSelection()
  void loadMapMarkers()
}

function resetSearch() {
  keyword.value = ''
  spatialFilter.reset()
  clearSelection()
  ignoreNextViewportChange()
  currentViewport.value = null
  hasViewport.value = false
  mapScale.value = overviewZoom()
  void loadMapMarkers(null, true)
}

function viewFullCity() {
  resetSearch()
}

function handleRegionChange() {
  clearSelection()
  ignoreNextViewportChange()
  currentViewport.value = null
  hasViewport.value = false
  mapScale.value = overviewZoom()
  void loadMapMarkers(null)
}

function selectMarker(event: MarkerTapEvent) {
  const marker = mapMarkerById.value.get(Number(event.detail.markerId))
  if (marker)
    selectMarkerByKey(marker.key)
}

function selectMarkerByKey(key: string) {
  const marker = markers.value.find(item => item.key === key)
  if (!marker)
    return
  mapSession.cancelPending()
  lastMarkerTapAt = Date.now()
  ignoreNextViewportChange()
  if (marker.level !== 'building') {
    clearSelection()
    pendingDrillViewport = {
      latitude: Number(marker.location.latitude),
      longitude: Number(marker.location.longitude),
      zoom: marker.target_zoom,
    }
    currentViewport.value = null
    hasViewport.value = false
    mapCenter.value = { latitude: pendingDrillViewport.latitude, longitude: pendingDrillViewport.longitude }
    mapScale.value = marker.target_zoom
    return
  }
  pendingDrillViewport = null
  mapCenter.value = { latitude: Number(marker.location.latitude), longitude: Number(marker.location.longitude) }
  selectedMarkerKey.value = marker.key
  void loadSelectedHouses(marker)
}

function handleMapTap() {
  if (!shouldClearHouseMapSelection(lastMarkerTapAt))
    return
  cancelPendingDrill()
  clearSelection()
}

async function loadSelectedHouses(marker: PublicHouseMapMarker) {
  const currentRequestId = ++houseRequestId
  selectedHousesLoading.value = true
  selectedHousesError.value = ''
  selectedHouses.value = []
  try {
    const result = await listPublicHouses(selectedHouseParams(marker))
    if (currentRequestId === houseRequestId)
      selectedHouses.value = result.items
  }
  catch {
    if (currentRequestId === houseRequestId) {
      selectedHouses.value = []
      selectedHousesError.value = '请检查网络后重试'
      uni.showToast({ title: '房源详情加载失败', icon: 'none' })
    }
  }
  finally {
    if (currentRequestId === houseRequestId)
      selectedHousesLoading.value = false
  }
}

function retrySelectedHouses() {
  const marker = selectedMarker.value
  if (marker)
    void loadSelectedHouses(marker)
}

function clearSelection() {
  houseRequestId += 1
  selectedMarkerKey.value = ''
  selectedHouses.value = []
  selectedHousesLoading.value = false
  selectedHousesError.value = ''
}

function scheduleViewportLoad(viewport: MapViewport) {
  if (awaitingInitialViewport && currentUserLocation.value) {
    if (!isInitialLocationViewport(viewport, currentUserLocation.value))
      return
    awaitingInitialViewport = false
    if (initialViewportFallbackTimer) {
      clearTimeout(initialViewportFallbackTimer)
      initialViewportFallbackTimer = null
    }
    currentViewport.value = viewport
    hasViewport.value = true
    void loadMapMarkers(viewport)
    return
  }
  if (pendingDrillViewport) {
    const drill = pendingDrillViewport
    const containsDrillCenter = viewport.west <= drill.longitude && drill.longitude <= viewport.east && viewport.south <= drill.latitude && drill.latitude <= viewport.north
    if (viewport.zoom !== drill.zoom || !containsDrillCenter)
      return
    pendingDrillViewport = null
    currentViewport.value = viewport
    hasViewport.value = true
    mapScale.value = viewport.zoom
    void loadMapMarkers(viewport)
    return
  }
  if (Date.now() < ignoredViewportUntil) {
    ignoredViewportEvents = Math.max(0, ignoredViewportEvents - 1)
    return
  }
  if (ignoredViewportEvents > 0) {
    ignoredViewportEvents -= 1
    return
  }
  currentViewport.value = viewport
  hasViewport.value = true
  mapScale.value = viewport.zoom
  if (!hasLoadedMap.value)
    return
  mapSession.schedule(mapRequestParams(viewport))
}

function isInitialLocationViewport(viewport: MapViewport, location: GeoCoordinates) {
  return viewport.zoom === INITIAL_LOCATION_ZOOM
    && viewport.west <= location.longitude && location.longitude <= viewport.east
    && viewport.south <= location.latitude && location.latitude <= viewport.north
}

function handleH5ViewportChange(viewport: MapViewport) {
  scheduleViewportLoad(viewport)
}

function handleMapRegionChange(event: MapRegionChangeEvent) {
  const phase = event.detail?.type || event.type
  if (phase && phase !== 'end')
    return
  if (event.detail?.scale)
    mapScale.value = clampZoom(event.detail.scale)
  // #ifdef MP-WEIXIN
  const context = uni.createMapContext('public-house-map')
  context.getRegion({
    success(region) {
      scheduleViewportLoad({
        zoom: mapScale.value,
        west: region.southwest.longitude,
        south: region.southwest.latitude,
        east: region.northeast.longitude,
        north: region.northeast.latitude,
      })
    },
  })
  // #endif
}

function clampZoom(value: number) {
  return Math.min(20, Math.max(3, Math.round(value)))
}

function zoomIn() {
  mapSession.cancelPending()
  cancelPendingDrill()
  mapScale.value = clampZoom(mapScale.value + 1)
}

function zoomOut() {
  mapSession.cancelPending()
  cancelPendingDrill()
  mapScale.value = clampZoom(mapScale.value - 1)
}

function resetMapView() {
  clearSelection()
  ignoreNextViewportChange()
  currentViewport.value = null
  hasViewport.value = false
  mapScale.value = overviewZoom()
  void loadMapMarkers(null, true)
}

async function locateUser() {
  if (locating.value)
    return
  locating.value = true
  try {
    const location = await getCurrentLocationGcj02()
    currentUserLocation.value = location
    mapSession.cancelPending()
    cancelPendingDrill()
    clearSelection()
    ignoreNextViewportChange()
    mapCenter.value = { latitude: location.latitude, longitude: location.longitude }
    mapScale.value = 15
    if (nearbyRadiusM.value) {
      spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, nearbyRadiusM.value)
      currentViewport.value = null
      hasViewport.value = false
      void loadMapMarkers(null)
    }
  }
  catch (error) {
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({
      title: '需要位置权限',
      content: '开启定位后才能回到当前位置并查看附近房源。',
      confirmText: '去设置',
    })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    // #endif
  }
  finally {
    locating.value = false
  }
}

async function toggleNearby() {
  if (nearbyLocation.value) {
    spatialFilter.exitNearby()
    clearSelection()
    ignoreNextViewportChange()
    currentViewport.value = null
    hasViewport.value = false
    mapScale.value = overviewZoom()
    void loadMapMarkers(null)
    return
  }
  if (locating.value)
    return
  locating.value = true
  try {
    const location = await getCurrentLocationGcj02()
    currentUserLocation.value = location
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, 1000)
    ignoreNextViewportChange()
    mapCenter.value = { latitude: location.latitude, longitude: location.longitude }
    mapScale.value = 14
    currentViewport.value = null
    hasViewport.value = false
    clearSelection()
    await loadMapMarkers(null)
  }
  catch (error) {
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能按距离筛选附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    // #endif
  }
  finally {
    locating.value = false
  }
}

function changeNearbyRadius() {
  if (!nearbyLocation.value || !nearbyRadiusM.value)
    return
  const zoomByRadius = { 500: 16, 1000: 15, 1500: 14, 2000: 14 } as Record<number, number>
  ignoreNextViewportChange()
  mapScale.value = zoomByRadius[nearbyRadiusM.value] || 15
  mapCenter.value = { ...nearbyLocation.value }
  currentViewport.value = null
  hasViewport.value = false
  clearSelection()
  void loadMapMarkers(null)
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

function openSelectedLocation() {
  const marker = selectedMarker.value
  if (!marker)
    return
  uni.openLocation({
    latitude: Number(marker.location.latitude),
    longitude: Number(marker.location.longitude),
    name: marker.name,
    address: marker.address,
  })
}

onLoad(async (options) => {
  const preset = parsePublicHouseSearchPreset((options || {}) as Record<string, string | undefined>)
  listingType.value = preset.listing_type
  bedrooms.value = preset.bedrooms
  bedroomsMin.value = preset.bedrooms_min
  keyword.value = preset.keyword || ''
  const hasNearbyPreset = preset.nearby === 1 && preset.longitude !== undefined && preset.latitude !== undefined
  let location: GeoCoordinates | null = hasNearbyPreset ? { longitude: preset.longitude!, latitude: preset.latitude! } : null
  if (!location) {
    try {
      location = await getCurrentLocationGcj02()
    }
    catch {
      // 定位不可用时沿用已选城市概览。
    }
  }
  if (!pageActive)
    return
  await regionStore.initializeDefaultRegion(location)
  if (!pageActive)
    return
  if (!location) {
    mapScale.value = overviewZoom()
    await loadMapMarkers(null)
    if (pageActive)
      uni.showToast({ title: '定位不可用，已显示城市地图', icon: 'none' })
    return
  }
  currentUserLocation.value = location
  mapCenter.value = { ...location }
  mapScale.value = INITIAL_LOCATION_ZOOM
  if (hasNearbyPreset) {
    spatialFilter.enterNearby(location, preset.radius_m || 1000)
    ignoreNextViewportChange()
    await loadMapMarkers(null, false, false)
    return
  }
  awaitingInitialViewport = true
  initialViewportFallbackTimer = setTimeout(() => {
    awaitingInitialViewport = false
    initialViewportFallbackTimer = null
    void loadMapMarkers(null, false, false)
  }, 1500)
})
onShow(() => {
  void houseFavorites.refreshFavorites()
  if (hasLoadedMap.value && lastLoadedScopeKey !== spatialFilter.scopeKey.value)
    handleRegionChange()
})
onUnload(() => {
  pageActive = false
  awaitingInitialViewport = false
  if (initialViewportFallbackTimer)
    clearTimeout(initialViewportFallbackTimer)
  if (ignoredViewportResetTimer)
    clearTimeout(ignoredViewportResetTimer)
  mapSession.dispose()
})
</script>

<template>
  <AppPage class="house-map-page" gutter="none">
    <template #navigation>
      <view class="map-navigation absolute z-90">
        <AppCustomNavigation title="" align="start" back transparent scroll-mode="flow">
          <template #content>
            <view class="map-navigation__content min-w-0 flex items-center gap-1.5 text-sm text-content-primary font-bold">
              <PublicHouseRegionTrigger variant="surface" @change="handleRegionChange" />
              <text>地图找房</text>
            </view>
          </template>
        </AppCustomNavigation>
      </view>
    </template>

    <view class="map-viewport relative h-screen w-full overflow-hidden bg-surface-page" :style="mapViewportStyle">
      <!-- #ifdef MP-WEIXIN -->
      <map
        id="public-house-map"
        class="house-map"
        :latitude="mapCenter.latitude"
        :longitude="mapCenter.longitude"
        :markers="mapMarkers"
        :circles="mapCircles"
        :scale="mapScale"
        enable-zoom
        enable-scroll
        show-location
        @tap="handleMapTap"
        @regionchange="handleMapRegionChange"
        @markertap="selectMarker"
        @callouttap="selectMarker"
      />
      <!-- #endif -->

      <!-- #ifdef H5 -->
      <HouseH5Map
        class="house-map"
        :class="{ 'house-h5-map--sheet-open': selectedMarkerShowsHouses }"
        :fit-on-initial-markers="!currentUserLocation"
        :user-location="currentUserLocation"
        :api-key="amapJsapiKey"
        :security-js-code="amapSecurityJsCode"
        :markers="markers"
        :fit-token="mapFitToken"
        :selected-key="selectedMarkerKey"
        :zoom="mapScale"
        :center="mapCenter"
        :nearby="nearbyCircle"
        @map-tap="handleMapTap"
        @select="selectMarkerByKey"
        @viewport-change="handleH5ViewportChange"
      />
      <!-- #endif -->

      <view class="map-overlay-top pointer-events-none absolute left-3 right-3 z-60 mx-auto my-0 max-w-90">
        <view class="map-search-panel pointer-events-auto relative border-hairline border-hex-ffffff/90 rounded-6 border-solid bg-hex-ffffff/97 pb-1 pl-2.5 pr-1.5 pt-1 backdrop-blur-8">
          <view class="map-search-row flex items-center gap-1">
            <view class="map-search-box box-border h-9.5 min-w-0 flex flex-1 items-center bg-transparent px-1 py-0">
              <view class="i-carbon-search map-search-icon h-6.5 w-6.5 flex flex-none items-center justify-center rounded-full bg-surface-brand-soft text-size-sm text-app-brand" />
              <wd-input v-model="keyword" compact custom-class="map-search-input" placeholder="搜索小区或区域" clearable confirm-type="search" @confirm="search" />
            </view>
            <wd-button size="small" custom-class="map-search-button" @click="search">
              搜索
            </wd-button>
          </view>
        </view>

        <view class="map-overview-row mt-2 flex items-center">
          <view class="nearby-row pointer-events-auto">
            <button class="nearby-trigger m-0 h-8 min-w-14 w-auto inline-flex items-center justify-center gap-1 border-hairline border-hex-ffffff/90 rounded-4 border-solid bg-hex-ffffff/95 px-3 py-0 text-size-xs text-content-primary font-semibold leading-8" :class="{ 'nearby-trigger--active': nearbyLocation }" @click="toggleNearby">
              <view class="i-carbon-location-current" />
              <text>{{ nearbyLocation && nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
            </button>
          </view>
        </view>

        <view v-if="nearbyLocation" class="nearby-radius-panel pointer-events-auto mt-1.5 max-w-full inline-flex border-hairline border-app-card rounded-3 border-solid bg-surface-translucent px-1.5 py-1 shadow-app-card">
          <wd-radio-group
            v-model="nearbyRadiusM"
            type="button"
            direction="horizontal"
            custom-class="nearby-radius-group"
            @change="changeNearbyRadius"
          >
            <wd-radio v-for="radius in nearbyRadiusOptions" :key="radius" :value="radius">
              {{ formatPublicHouseRadiusLabel(radius) }}
            </wd-radio>
          </wd-radio-group>
        </view>
        <text v-if="refreshing" class="map-status-hint mt-1.5 inline-block max-w-full rounded-2 bg-surface-translucent px-2 py-1 text-size-2xs text-content-secondary">当前视野更新中…</text>
        <text v-else-if="mapResult?.truncated" class="map-status-hint mt-1.5 inline-block max-w-full rounded-2 bg-surface-translucent px-2 py-1 text-size-2xs text-content-secondary">放大地图，查看更多房源</text>
        <text v-else-if="mapResult?.unlocated_house_count" class="map-status-hint mt-1.5 inline-block max-w-full rounded-2 bg-surface-translucent px-2 py-1 text-size-2xs text-content-secondary">另有 {{ mapResult.unlocated_house_count }} 套房源待定位</text>
      </view>

      <view v-if="mapResult && !loadError && !selectedMarkerShowsHouses" class="map-result-summary absolute left-3 z-65 box-border h-9 flex items-center gap-1 whitespace-nowrap rounded-4.5 bg-app-brand px-3 py-0 text-size-2xs text-hex-ffffff/88 backdrop-blur-6">
        <view class="map-result-summary__pulse mr-0.5 h-1.5 w-1.5 shrink-0 grow-0 basis-1.5 rounded-full bg-content-on-brand" />
        <text>当前视野</text>
        <strong>{{ mapResult.visible_house_count }}</strong>
        <text>套房源</text>
        <text class="map-result-summary__detail ml-1 overflow-hidden text-ellipsis border-l-hairline border-l-hex-ffffff/24 border-l-solid pl-2 text-hex-ffffff/78">{{ mapResult.marker_count }} 个{{ levelLabel }}</text>
      </view>

      <view v-if="!selectedMarkerShowsHouses" class="map-controls absolute right-3 z-65 flex flex-col gap-2">
        <view class="map-controls__zoom overflow-hidden border-hairline border-hex-ffffff/92 rounded-3.5 border-solid bg-hex-ffffff/96">
          <button class="map-control-button m-0 h-11 w-11 flex items-center justify-center border-0 rounded-0 bg-transparent p-0 text-size-base text-content-primary leading-none" aria-label="放大地图" @click.stop="zoomIn">
            <view class="i-carbon-add" />
          </button>
          <button class="map-control-button m-0 h-11 w-11 flex items-center justify-center border-0 rounded-0 bg-transparent p-0 text-size-base text-content-primary leading-none" aria-label="缩小地图" @click.stop="zoomOut">
            <view class="i-carbon-subtract" />
          </button>
        </view>
        <view class="map-controls__quick gap-2">
          <button class="map-control-button map-control-button--location m-0 h-11 w-11 flex items-center justify-center border-0 rounded-0 bg-transparent p-0 text-size-base text-content-primary leading-none" :class="{ 'map-control-button--loading': locating }" aria-label="定位到当前位置" @click.stop="locateUser">
            <view class="i-carbon-location-current" />
          </button>
          <button class="map-control-button map-control-button--overview m-0 h-11 w-11 flex items-center justify-center border-0 rounded-0 bg-transparent p-0 text-size-base text-content-primary leading-none" aria-label="恢复地图全览" @click.stop="resetMapView">
            <view class="i-carbon-center-circle" />
          </button>
        </view>
      </view>

      <view v-if="loading" class="map-state-layer absolute inset-0 z-20 box-border flex items-center justify-center">
        <view class="map-state-card max-w-83 w-full overflow-hidden border-hairline border-hex-ffffff/72 rounded-4 border-solid bg-hex-ffffff/94">
          <AppLoading text="正在铺开房源地图…" />
        </view>
      </view>
      <view v-else-if="loadError && !hasLoadedMap" class="map-state-layer absolute inset-0 z-20 box-border flex items-center justify-center">
        <view class="map-state-card max-w-83 w-full overflow-hidden border-hairline border-hex-ffffff/72 rounded-4 border-solid bg-hex-ffffff/94">
          <AppErrorView :message="loadError" @retry="loadMapMarkers" />
        </view>
      </view>
      <view v-else-if="hasLoadedMap && !markers.length" class="map-empty-view absolute left-2.5 right-2.5 z-35 mx-auto my-0 box-border max-w-95 flex items-center gap-2.5 border-hairline border-hex-ffffff/76 rounded-3.5 border-solid bg-hex-ffffff/94 px-3 py-2.5 backdrop-blur-9">
        <view class="i-carbon-map map-empty-view__icon flex-none text-size-xl text-app-brand" />
        <view class="map-empty-view__copy min-w-0 flex gap-0.5">
          <text class="map-empty-view__title text-size-xs text-content-primary font-bold">当前视野暂无房源</text>
          <text>{{ hasActiveFilters ? '可以查看全城结果，或清除当前筛选' : '缩小地图或移动到其他区域' }}</text>
        </view>
        <view class="map-empty-view__actions flex gap-1">
          <button class="map-empty-view__action m-0 h-6.5 w-auto flex-none border-0 rounded-2.5 px-2.5 py-0 text-size-2xs leading-6.5" @click="hasActiveFilters ? viewFullCity() : resetMapView()">
            查看全城
          </button>
          <button v-if="hasActiveFilters" class="map-empty-view__action map-empty-view__action--secondary m-0 h-6.5 w-auto flex-none border-0 rounded-2.5 px-2.5 py-0 text-size-2xs leading-6.5" @click="resetSearch">
            清除筛选
          </button>
        </view>
      </view>

      <HouseMapResultSheet
        v-if="selectedMarker && selectedMarkerShowsHouses"
        :marker="selectedMarker"
        :houses="selectedHouses"
        :loading="selectedHousesLoading"
        :error="selectedHousesError"
        :is-favorited="houseFavorites.isFavorited"
        :is-favorite-loading="houseFavorites.isLoading"
        @close="clearSelection"
        @navigate="openSelectedLocation"
        @retry="retrySelectedHouses"
        @open-house="openHouse"
        @toggle-favorite="houseFavorites.toggleFavorite"
      />
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.house-map-page {
  @apply relative;
  @apply h-screen;
  @apply min-h-screen;
  @apply overflow-hidden;
  @apply bg-surface-page;
}
:deep(.app-page__content) {
  @apply h-screen;
  @apply min-h-0;
  @apply overflow-hidden;
}
.map-navigation {
  @apply top-0 inset-x-0 bottom-auto;
}
:deep(.app-custom-navigation__back) {
  @apply bg-surface-translucent;
  @apply shadow-app-card;
  @apply backdrop-blur-6;
}
:deep(.app-custom-navigation__title) {
  text-shadow: 0 2rpx 12rpx rgb(255 255 255 / 92%);
}
.map-navigation__content {
  text-shadow: 0 2rpx 12rpx rgb(255 255 255 / 92%);
}
.map-overlay-top {
  top: calc(var(--map-navigation-height) + 18rpx);
}
.map-search-panel {
  box-shadow: 0 14rpx 42rpx rgb(23 35 61 / 12%);
}
:deep(.map-search-input) {
  @apply min-w-0;
  @apply flex-1;
  @apply pt-0 pr-0 pb-0 pl-2;
  @apply bg-transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 72rpx;
  --wot-input-inner-font-size: 26rpx;
  --wot-input-padding: 0;
}
:deep(.map-search-button) {
  @apply w-14;
  @apply h-9.5;
  @apply grow-0 shrink-0 basis-14;
  @apply rounded-5;
  @apply font-bold;
  --wot-button-primary-bg: var(--app-color-brand);
}
.nearby-trigger {
  box-shadow: 0 10rpx 30rpx rgb(23 35 61 / 10%);
}
.nearby-trigger > view {
  @apply text-app-brand;
  @apply text-size-sm;
}
.nearby-trigger::after {
  @apply border-0;
}
.nearby-trigger--active {
  @apply border-hex-0066cc/25;
  @apply text-app-brand-active;
  @apply bg-surface-brand-soft;
}
:deep(.nearby-radius-group) {
  @apply flex;
  @apply min-w-0;
  @apply flex-nowrap;
  @apply overflow-x-auto;
  --wot-radio-button-margin: 0 8rpx 0 0;
  --wot-radio-button-min-width: 80rpx;
  --wot-radio-button-padding: 6rpx 14rpx;
}
.map-result-summary {
  bottom: calc(112rpx + env(safe-area-inset-bottom));
  max-width: calc(100% - 136rpx);
  box-shadow: 0 12rpx 34rpx rgb(0 129 255 / 26%);
}
.map-result-summary strong {
  @apply text-content-on-brand;
  @apply text-size-sm;
}
.map-result-summary__pulse {
  box-shadow: 0 0 0 5rpx rgb(255 255 255 / 18%);
}
.map-controls {
  bottom: calc(112rpx + env(safe-area-inset-bottom));
}
.map-controls__zoom,
.map-controls__quick {
  @apply flex;
  @apply flex-col;
}
.map-controls__zoom {
  box-shadow: 0 10rpx 30rpx rgb(23 35 61 / 12%);
}
.map-controls__zoom .map-control-button:first-child {
  @apply border-b-hairline border-b-solid border-b-app-divider;
}
.map-controls__quick .map-control-button {
  @apply border-hairline border-solid border-hex-ffffff/92;
  @apply rounded-3.5;
  @apply bg-hex-ffffff/96;
  box-shadow: 0 10rpx 30rpx rgb(23 35 61 / 12%);
}
.map-controls__quick .map-control-button--location {
  @apply border-app-brand;
  @apply text-content-on-brand;
  @apply bg-app-brand;
  box-shadow: 0 12rpx 30rpx rgb(0 129 255 / 26%);
}
.map-control-button::after,
.map-empty-view__action::after {
  @apply border-0;
}
.map-control-button:active {
  @apply text-app-brand-active;
  @apply bg-surface-brand-soft;
}
.map-control-button--location:active {
  @apply text-content-on-brand;
  @apply bg-app-brand;
}
.map-control-button--loading {
  @apply text-app-brand;
  animation: map-control-pulse 0.8s ease-in-out infinite alternate;
}
.house-map {
  @apply absolute;
  @apply z-1;
  @apply inset-0;
  @apply block;
  @apply w-full;
  @apply h-full;
  @apply overflow-hidden;
  @apply bg-surface-page;
}
.map-empty-view {
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  box-shadow: 0 14rpx 40rpx rgb(30 55 82 / 16%);
}
.map-empty-view__copy {
  @apply flex-1;
  @apply flex-col;
}
.map-empty-view__copy text {
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply leading-normal;
}
.map-empty-view__actions {
  @apply flex-none;
  @apply flex-col;
}
.map-empty-view__action {
  @apply text-app-brand-active;
  @apply bg-surface-brand-soft;
}
.map-empty-view__action--secondary {
  @apply text-content-secondary;
  @apply bg-surface-subtle;
}
.map-state-layer {
  padding: calc(var(--map-navigation-height) + 210rpx) 30rpx calc(80rpx + env(safe-area-inset-bottom));
  background: linear-gradient(145deg, #e8f0ec, #dbe7e2);
}
.map-state-card {
  box-shadow: 0 16rpx 44rpx rgb(30 55 82 / 14%);
}
.map-empty {
  @apply flex;
  @apply w-full;
  @apply max-w-78;
  @apply items-center;
  @apply justify-center;
  @apply flex-col;
  @apply py-6 px-4.5;
  @apply border-hairline border-solid border-hex-ffffff/72;
  @apply rounded-4;
  @apply box-border;
  @apply bg-hex-ffffff/94;
  box-shadow: 0 16rpx 44rpx rgb(30 55 82 / 14%);
  @apply text-center;
}
.map-empty__illustration {
  @apply flex;
  @apply w-15;
  @apply h-15;
  @apply items-center;
  @apply justify-center;
  @apply rounded-full;
  @apply text-app-brand;
  @apply text-size-2xl;
  @apply bg-surface-brand-soft;
}
.map-empty strong {
  @apply mt-3;
  @apply text-content-primary;
  @apply text-size-sm;
}
.map-empty > text {
  @apply mt-1.5 mx-0 mb-3;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply leading-relaxed;
}

@keyframes map-control-pulse {
  to {
    opacity: 0.45;
  }
}
</style>
