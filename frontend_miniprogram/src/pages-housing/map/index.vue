<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMapMarker, PublicHouseMapParams, PublicHouseMapResponse, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { CustomNavigationLayout } from '@/components/utils/navigation'
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { buildHouseMapRequestKey, createHouseMapMarkerId, resolveMapIncludePoints, shouldClearHouseMapSelection } from '@/domain/house-map'
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
const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const locating = ref(false)
const hasLoadedMap = ref(false)
const hasViewport = ref(false)
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
const fitRequestKeys = new Set<string>()
const PROGRAMMATIC_VIEWPORT_GUARD_MS = 1200

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
  const groupLabels = { city: '区域', district: '小区', estate: '楼栋', building: '房源' }
  return {
    id: createHouseMapMarkerId(marker.key),
    latitude: Number(marker.location.latitude),
    longitude: Number(marker.location.longitude),
    iconPath: active ? '/static/tabbar/homeHL.png' : '/static/tabbar/home.png',
    width: active ? 34 : 28,
    height: active ? 34 : 28,
    callout: {
      content: isGroup
        ? `${marker.name}\n${marker.child_count}${groupLabels[marker.level]} · ${marker.house_count}套`
        : `${marker.name} · ${marker.house_count}套${marker.min_rent == null ? '' : ` · ¥${formatAmount(Number(marker.min_rent))}起`}`,
      display: 'ALWAYS' as const,
      color: '#ffffff',
      bgColor: active ? '#0066cc' : '#52657f',
      borderRadius: 8,
      borderWidth: 0,
      borderColor: active ? '#0066cc' : '#52657f',
      textAlign: 'center' as const,
      padding: 8,
      fontSize: active ? 12 : 11,
    },
  }
}))

function formatAmount(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

function selectedHouseParams(marker: PublicHouseMapMarker): PublicHousesUsingGetParams {
  return {
    keyword: keyword.value.trim(),
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
    const previouslySelectedKey = selectedMarkerKey.value
    mapResult.value = result
    mapScale.value = result.zoom
    loadError.value = ''
    if (!hasLoadedMap.value && result.items[0]) {
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
  },
  onError() {
    if (!hasLoadedMap.value)
      loadError.value = '地图房源加载失败，请稍后重试'
    else
      uni.showToast({ title: '当前视野房源更新失败', icon: 'none' })
  },
})

async function loadMapMarkers(viewport: MapViewport | null = currentViewport.value, force = false) {
  const params = mapRequestParams(viewport)
  const requestKey = buildHouseMapRequestKey(params)
  if (!viewport)
    fitRequestKeys.add(requestKey)
  await mapSession.load(params, { force })
}

function prepareMapFit(items: PublicHouseMapMarker[]) {
  // #ifdef MP-WEIXIN
  const points = resolveMapIncludePoints(items, false)
  if (!points?.length)
    return
  ignoreNextViewportChange()
  mapCenter.value = { ...points[0] }
  void nextTick(() => {
    const context = uni.createMapContext('public-house-map')
    context.includePoints({
      points,
      padding: [120, 32, 96, 32],
    })
  })
  // #endif
  // #ifdef H5
  ignoredViewportEvents = 2
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
  mapScale.value = 7
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
  mapScale.value = 7
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
  lastMarkerTapAt = Date.now()
  ignoreNextViewportChange()
  mapCenter.value = { latitude: Number(marker.location.latitude), longitude: Number(marker.location.longitude) }
  if (marker.level !== 'building') {
    clearSelection()
    currentViewport.value = null
    hasViewport.value = false
    mapScale.value = marker.target_zoom
    void loadMapMarkers(null)
    return
  }
  selectedMarkerKey.value = marker.key
  void loadSelectedHouses(marker)
}

function handleMapTap() {
  if (!shouldClearHouseMapSelection(lastMarkerTapAt))
    return
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
  if (Date.now() < ignoredViewportUntil) {
    ignoredViewportEvents = Math.max(0, ignoredViewportEvents - 1)
    return
  }
  if (ignoredViewportEvents > 0) {
    ignoredViewportEvents = 0
    return
  }
  currentViewport.value = viewport
  hasViewport.value = true
  mapScale.value = viewport.zoom
  if (!hasLoadedMap.value)
    return
  mapSession.schedule(mapRequestParams(viewport))
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
  mapScale.value = clampZoom(mapScale.value + 1)
}

function zoomOut() {
  mapScale.value = clampZoom(mapScale.value - 1)
}

function resetMapView() {
  clearSelection()
  ignoreNextViewportChange()
  currentViewport.value = null
  hasViewport.value = false
  mapScale.value = 7
  void loadMapMarkers(null)
}

async function locateUser() {
  if (locating.value)
    return
  locating.value = true
  try {
    const location = await getCurrentLocation()
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
  catch {
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
    uni.showToast({ title: '无法获取当前位置，请检查浏览器定位权限', icon: 'none' })
    // #endif
  }
  finally {
    locating.value = false
  }
}

async function getCurrentLocation() {
  return uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
}

async function toggleNearby() {
  if (nearbyLocation.value) {
    spatialFilter.exitNearby()
    clearSelection()
    ignoreNextViewportChange()
    currentViewport.value = null
    hasViewport.value = false
    mapScale.value = 7
    void loadMapMarkers(null)
    return
  }
  if (locating.value)
    return
  locating.value = true
  try {
    const location = await getCurrentLocation()
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, 1000)
    ignoreNextViewportChange()
    mapCenter.value = { latitude: location.latitude, longitude: location.longitude }
    mapScale.value = 14
    currentViewport.value = null
    hasViewport.value = false
    clearSelection()
    await loadMapMarkers(null)
  }
  catch {
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能按距离筛选附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: '无法获取当前位置，请检查浏览器定位权限', icon: 'none' })
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

onLoad(async () => {
  await regionStore.initializeDefaultRegion()
  await loadMapMarkers(null)
})
onShow(() => {
  void houseFavorites.refreshFavorites()
  if (hasLoadedMap.value && lastLoadedScopeKey !== spatialFilter.scopeKey.value)
    handleRegionChange()
})
onUnload(() => {
  if (ignoredViewportResetTimer)
    clearTimeout(ignoredViewportResetTimer)
  mapSession.dispose()
})
</script>

<template>
  <AppPage class="house-map-page" gutter="none">
    <template #navigation>
      <view class="map-navigation">
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

    <view class="map-viewport" :style="mapViewportStyle">
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

      <view class="map-overlay-top">
        <view class="map-search-panel">
          <view class="map-search-row">
            <view class="map-search-box">
              <view class="i-carbon-search map-search-icon" />
              <wd-input v-model="keyword" compact custom-class="map-search-input" placeholder="搜索小区或区域" clearable confirm-type="search" @confirm="search" />
            </view>
            <wd-button size="small" custom-class="map-search-button" @click="search">
              搜索
            </wd-button>
          </view>

          <view class="nearby-row">
            <button class="nearby-trigger" :class="{ 'nearby-trigger--active': nearbyLocation }" @click="toggleNearby">
              <view class="i-carbon-location-current" />
              <text>{{ nearbyLocation && nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
            </button>
            <wd-radio-group
              v-if="nearbyLocation"
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
            <text v-else class="nearby-hint">按直线距离筛选并优先展示最近房源</text>
          </view>
        </view>

        <view v-if="mapResult && !loadError" class="map-result-summary">
          <strong>{{ mapResult.visible_house_count }}</strong>
          <text>套房源</text>
          <view class="map-result-summary__divider" />
          <strong>{{ mapResult.marker_count }}</strong>
          <text>个{{ levelLabel }}</text>
          <text v-if="refreshing" class="map-result-summary__hint">
            更新中…
          </text>
          <text v-else-if="mapResult.truncated" class="map-result-summary__hint">
            放大查看全部
          </text>
          <text v-else-if="mapResult.unlocated_house_count" class="map-result-summary__hint">
            +{{ mapResult.unlocated_house_count }} 待定位
          </text>
        </view>
      </view>

      <view class="map-controls">
        <button class="map-control-button" aria-label="放大地图" @click.stop="zoomIn">
          <view class="i-carbon-add" />
        </button>
        <button class="map-control-button" aria-label="缩小地图" @click.stop="zoomOut">
          <view class="i-carbon-subtract" />
        </button>
        <button class="map-control-button" :class="{ 'map-control-button--loading': locating }" aria-label="定位到当前位置" @click.stop="locateUser">
          <view class="i-carbon-location-current" />
        </button>
        <button class="map-control-button" aria-label="恢复地图全览" @click.stop="resetMapView">
          <view class="i-carbon-center-circle" />
        </button>
      </view>

      <view v-if="loading" class="map-state-layer">
        <view class="map-state-card">
          <AppLoading text="正在铺开房源地图…" />
        </view>
      </view>
      <view v-else-if="loadError && !hasLoadedMap" class="map-state-layer">
        <view class="map-state-card">
          <AppErrorView :message="loadError" @retry="loadMapMarkers" />
        </view>
      </view>
      <view v-else-if="hasLoadedMap && !markers.length" class="map-empty-view">
        <view class="i-carbon-map map-empty-view__icon" />
        <view class="map-empty-view__copy">
          <text class="map-empty-view__title">当前视野暂无房源</text>
          <text>{{ hasActiveFilters ? '可以查看全城结果，或清除当前筛选' : '缩小地图或移动到其他区域' }}</text>
        </view>
        <view class="map-empty-view__actions">
          <button class="map-empty-view__action" @click="hasActiveFilters ? viewFullCity() : resetMapView()">
            查看全城
          </button>
          <button v-if="hasActiveFilters" class="map-empty-view__action map-empty-view__action--secondary" @click="resetSearch">
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
  position: relative;
  height: 100vh;
  min-height: 100vh;
  overflow: hidden;
  background: #dce8e1;
}
:deep(.app-page__content) {
  height: 100vh;
  min-height: 0;
  overflow: hidden;
}
.map-navigation {
  position: absolute;
  z-index: 90;
  inset: 0 0 auto;
}
:deep(.app-custom-navigation__back) {
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 8rpx 24rpx rgb(30 55 82 / 16%);
  backdrop-filter: blur(12rpx);
}
:deep(.app-custom-navigation__title) {
  text-shadow: 0 2rpx 12rpx rgb(255 255 255 / 92%);
}
.map-navigation__content {
  text-shadow: 0 2rpx 12rpx rgb(255 255 255 / 92%);
}
.map-viewport {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: #dce8e1;
}
.map-overlay-top {
  position: absolute;
  z-index: 60;
  top: calc(var(--map-navigation-height) + 10rpx);
  right: 20rpx;
  left: 20rpx;
  max-width: 760rpx;
  margin: 0 auto;
  pointer-events: none;
}
.map-search-panel {
  position: relative;
  padding: 14rpx;
  border: 1rpx solid rgb(255 255 255 / 78%);
  border-radius: 28rpx;
  pointer-events: auto;
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 12rpx 36rpx rgb(30 55 82 / 16%);
  backdrop-filter: blur(18rpx);
}
.map-search-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.map-search-box {
  display: flex;
  min-width: 0;
  height: 68rpx;
  flex: 1;
  align-items: center;
  padding: 0 18rpx;
  border: 1rpx solid rgb(205 217 232 / 72%);
  border-radius: 22rpx;
  box-sizing: border-box;
  background: rgb(244 248 252 / 94%);
}
.map-search-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 30rpx;
}
:deep(.map-search-input) {
  min-width: 0;
  flex: 1;
  padding: 0 0 0 12rpx;
  background: transparent;
}
:deep(.map-search-button) {
  width: 102rpx;
  height: 68rpx;
  flex: 0 0 102rpx;
  border-radius: 22rpx;
}
.nearby-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}
.nearby-trigger {
  display: inline-flex;
  width: auto;
  min-width: 112rpx;
  height: 50rpx;
  margin: 0;
  padding: 0 18rpx;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  border: 1rpx solid rgb(205 217 232 / 72%);
  border-radius: 25rpx;
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 50rpx;
  background: rgb(255 255 255 / 82%);
}
.nearby-trigger::after {
  border: 0;
}
.nearby-trigger--active {
  border-color: var(--app-color-brand);
  color: var(--app-color-brand-active);
  font-weight: 650;
  background: var(--app-bg-brand-soft);
}
.nearby-hint {
  overflow: hidden;
  min-width: 0;
  color: var(--app-text-muted);
  font-size: 18rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
:deep(.nearby-radius-group) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: nowrap;
  overflow-x: auto;
  --wot-radio-button-margin: 0 8rpx 0 0;
  --wot-radio-button-min-width: 80rpx;
  --wot-radio-button-padding: 6rpx 14rpx;
}
.map-result-summary {
  display: inline-flex;
  max-width: calc(100% - 40rpx);
  align-items: center;
  gap: 7rpx;
  margin-top: 12rpx;
  padding: 12rpx 18rpx;
  border: 1rpx solid rgb(255 255 255 / 72%);
  border-radius: 22rpx;
  color: var(--app-text-muted);
  font-size: 19rpx;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 8rpx 24rpx rgb(30 55 82 / 12%);
  backdrop-filter: blur(14rpx);
}
.map-result-summary strong {
  color: var(--app-text-primary);
  font-size: 25rpx;
}
.map-result-summary__divider {
  width: 1rpx;
  height: 22rpx;
  margin: 0 5rpx;
  background: var(--app-divider-color);
}
.map-result-summary__hint {
  overflow: hidden;
  min-width: 0;
  margin-left: 4rpx;
  color: var(--app-text-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-controls {
  position: absolute;
  z-index: 65;
  top: calc(var(--map-navigation-height) + 324rpx);
  right: 20rpx;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  border: 1rpx solid rgb(255 255 255 / 78%);
  border-radius: 24rpx;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 12rpx 34rpx rgb(30 55 82 / 18%);
  backdrop-filter: blur(16rpx);
}
.map-control-button {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-bottom: 1rpx solid var(--app-divider-color);
  border-radius: 0;
  color: var(--app-text-primary);
  font-size: 34rpx;
  line-height: 1;
  background: transparent;
}
.map-control-button:last-child {
  border-bottom: 0;
}
.map-control-button::after,
.map-empty-view__action::after {
  border: 0;
}
.map-control-button:active {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.map-control-button--loading {
  color: var(--app-color-brand);
  animation: map-control-pulse 0.8s ease-in-out infinite alternate;
}
.house-map {
  position: absolute;
  z-index: 1;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #dce8e1;
}
.map-empty-view {
  position: absolute;
  z-index: 35;
  right: 20rpx;
  bottom: calc(24rpx + env(safe-area-inset-bottom));
  left: 20rpx;
  display: flex;
  max-width: 760rpx;
  align-items: center;
  gap: 18rpx;
  margin: 0 auto;
  padding: 20rpx 22rpx;
  border: 1rpx solid rgb(255 255 255 / 76%);
  border-radius: 26rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 14rpx 40rpx rgb(30 55 82 / 16%);
  backdrop-filter: blur(18rpx);
}
.map-empty-view__icon {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 42rpx;
}
.map-empty-view__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}
.map-empty-view__title {
  color: var(--app-text-primary);
  font-size: 23rpx;
  font-weight: 700;
}
.map-empty-view__copy text {
  color: var(--app-text-muted);
  font-size: 19rpx;
  line-height: 1.45;
}
.map-empty-view__actions {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 8rpx;
}
.map-empty-view__action {
  width: auto;
  height: 52rpx;
  margin: 0;
  padding: 0 18rpx;
  flex: 0 0 auto;
  border: 0;
  border-radius: 18rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  line-height: 52rpx;
  background: var(--app-bg-brand-soft);
}
.map-empty-view__action--secondary {
  color: var(--app-text-secondary);
  background: var(--app-bg-subtle);
}
.map-state-layer {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(var(--map-navigation-height) + 210rpx) 30rpx calc(80rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  background: linear-gradient(145deg, #e8f0ec, #dbe7e2);
}
.map-state-card {
  width: 100%;
  max-width: 660rpx;
  overflow: hidden;
  border: 1rpx solid rgb(255 255 255 / 72%);
  border-radius: 30rpx;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 16rpx 44rpx rgb(30 55 82 / 14%);
}
.map-empty {
  display: flex;
  width: 100%;
  max-width: 620rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  padding: 46rpx 34rpx;
  border: 1rpx solid rgb(255 255 255 / 72%);
  border-radius: 32rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 16rpx 44rpx rgb(30 55 82 / 14%);
  text-align: center;
}
.map-empty__illustration {
  display: flex;
  width: 116rpx;
  height: 116rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--app-color-brand);
  font-size: 54rpx;
  background: var(--app-bg-brand-soft);
}
.map-empty strong {
  margin-top: 24rpx;
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.map-empty > text {
  margin: 12rpx 0 24rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
}

@keyframes map-control-pulse {
  to {
    opacity: 0.45;
  }
}
</style>
