<script setup lang="ts">
import type { PublicHouseMapMarker } from '@/features/houses/service'
import type { AmapH5Circle, AmapH5Map, AmapH5Marker, AmapH5Namespace } from '@/services/manual/amap-h5'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { diffHouseMapMarkerKeys } from '@/domain/house-map'
import { buildAmapH5MarkerContent, loadAmapH5 } from '@/services/manual/amap-h5'

interface HouseH5MapViewport {
  zoom: number
  west: number
  south: number
  east: number
  north: number
}

const props = withDefaults(defineProps<{
  apiKey: string
  center?: { latitude: number, longitude: number }
  fitToken?: number
  fitOnInitialMarkers?: boolean
  markers: PublicHouseMapMarker[]
  nearby?: { latitude: number, longitude: number, radius: number } | null
  securityJsCode?: string
  selectedKey: string
  userLocation?: { latitude: number, longitude: number } | null
  zoom: number
}>(), {
  center: () => ({ latitude: 31.2304, longitude: 121.4737 }),
  fitToken: 0,
  fitOnInitialMarkers: true,
  nearby: null,
  securityJsCode: '',
  userLocation: null,
})

const emit = defineEmits<{
  'map-tap': []
  'select': [key: string]
  'viewport-change': [viewport: HouseH5MapViewport]
}>()

const DEFAULT_CENTER: [number, number] = [121.4737, 31.2304]
const mapContainerId = `house-h5-map-${Date.now()}-${Math.random().toString(36).slice(2)}`
const loading = ref(true)
const loadError = ref('')

let amap: AmapH5Namespace | null = null
let map: AmapH5Map | null = null
const markers = new Map<string, AmapH5Marker>()
let nearbyCircle: AmapH5Circle | null = null
let userLocationMarker: AmapH5Marker | null = null
let resizeObserver: ResizeObserver | null = null
let mounted = false
let initializationId = 0
let hasFitInitialMarkers = false
let cameraSyncTimer: ReturnType<typeof setTimeout> | null = null

function markerContent(marker: PublicHouseMapMarker) {
  return buildAmapH5MarkerContent({
    active: marker.key === props.selectedKey,
    childCount: marker.child_count,
    houseCount: marker.house_count,
    level: marker.level,
    minRent: marker.min_rent == null ? null : Number(marker.min_rent),
    name: marker.name,
  })
}

function clearMarkers() {
  if (map && markers.size)
    map.remove(Array.from(markers.values()))
  markers.clear()
}

function renderMarkers(fitView: boolean) {
  if (!amap || !map)
    return

  const sourceByKey = new Map(props.markers.map(item => [item.key, item]))
  const changes = diffHouseMapMarkerKeys(markers.keys(), sourceByKey.keys())
  const removedMarkers = changes.removed.flatMap((key) => {
    const marker = markers.get(key)
    markers.delete(key)
    return marker ? [marker] : []
  })
  if (removedMarkers.length)
    map.remove(removedMarkers)

  for (const key of changes.retained) {
    const source = sourceByKey.get(key)!
    const marker = markers.get(key)!
    marker.setPosition([Number(source.location.longitude), Number(source.location.latitude)])
    marker.setContent(markerContent(source))
    marker.setTop(source.key === props.selectedKey)
  }

  const addedMarkers = changes.added.map((key) => {
    const item = sourceByKey.get(key)!
    const marker = new amap!.Marker({
      position: [Number(item.location.longitude), Number(item.location.latitude)],
      anchor: 'bottom-center',
      content: markerContent(item),
      title: item.name,
      zIndex: item.key === props.selectedKey ? 130 : 120,
    })
    marker.on('click', () => emit('select', item.key))
    markers.set(item.key, marker)
    return marker
  })
  if (addedMarkers.length)
    map.add(addedMarkers)

  if (!markers.size)
    return
  if (fitView) {
    hasFitInitialMarkers = true
    map.setFitView(Array.from(markers.values()), true, [150, 32, 110, 32], props.zoom)
  }
}

function renderNearbyCircle() {
  if (!amap || !map)
    return
  if (nearbyCircle)
    map.remove(nearbyCircle)
  nearbyCircle = null
  if (!props.nearby)
    return
  nearbyCircle = new amap.Circle({
    center: [props.nearby.longitude, props.nearby.latitude],
    radius: props.nearby.radius,
    strokeColor: '#0066cc',
    strokeOpacity: 0.75,
    strokeWeight: 2,
    fillColor: '#4da3ff',
    fillOpacity: 0.12,
    zIndex: 20,
  })
  map.add(nearbyCircle)
}

function renderUserLocation() {
  if (!amap || !map)
    return
  if (!props.userLocation) {
    if (userLocationMarker)
      map.remove(userLocationMarker)
    userLocationMarker = null
    return
  }
  const position: [number, number] = [props.userLocation.longitude, props.userLocation.latitude]
  if (userLocationMarker) {
    userLocationMarker.setPosition(position)
    return
  }
  userLocationMarker = new amap.Marker({
    position,
    anchor: 'center',
    content: '<div class="house-h5-map-user-location"></div>',
    title: '当前位置',
    zIndex: 110,
  })
  map.add(userLocationMarker)
}

function updateSelectedMarker() {
  if (!map)
    return
  markers.forEach((marker, key) => {
    const source = props.markers.find(candidate => candidate.key === key)
    if (!source)
      return
    const active = source.key === props.selectedKey
    marker.setContent(markerContent(source))
    marker.setTop(active)
  })
}

function emitViewportChange() {
  if (!map)
    return
  const bounds = map.getBounds()
  const southWest = bounds.getSouthWest()
  const northEast = bounds.getNorthEast()
  emit('viewport-change', {
    zoom: Math.round(map.getZoom()),
    west: southWest.getLng(),
    south: southWest.getLat(),
    east: northEast.getLng(),
    north: northEast.getLat(),
  })
}

function updateCamera() {
  if (!map)
    return
  const center: [number, number] = [props.center.longitude, props.center.latitude]
  map.setZoomAndCenter(props.zoom, center, true)
  if (cameraSyncTimer)
    clearTimeout(cameraSyncTimer)
  cameraSyncTimer = setTimeout(() => {
    cameraSyncTimer = null
    emitViewportChange()
  }, 80)
}

function destroyMap() {
  if (cameraSyncTimer) {
    clearTimeout(cameraSyncTimer)
    cameraSyncTimer = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  clearMarkers()
  if (map && nearbyCircle)
    map.remove(nearbyCircle)
  nearbyCircle = null
  if (map && userLocationMarker)
    map.remove(userLocationMarker)
  userLocationMarker = null
  map?.destroy()
  map = null
  amap = null
  hasFitInitialMarkers = false
}

async function initializeMap() {
  const currentInitializationId = ++initializationId
  loading.value = true
  loadError.value = ''
  destroyMap()

  if (!props.apiKey) {
    loading.value = false
    loadError.value = '高德地图尚未配置，请联系管理员完善地图密钥'
    return
  }

  try {
    await nextTick()
    const loadedAmap = await loadAmapH5({
      key: props.apiKey,
      securityJsCode: props.securityJsCode,
      plugins: ['AMap.Scale', 'AMap.ToolBar'],
    })
    if (!mounted || currentInitializationId !== initializationId)
      return

    amap = loadedAmap
    map = new amap.Map(mapContainerId, {
      zoom: props.zoom,
      center: props.center ? [props.center.longitude, props.center.latitude] : DEFAULT_CENTER,
      viewMode: '2D',
      mapStyle: 'amap://styles/whitesmoke',
      showLabel: true,
    })
    map.addControl(new amap.Scale())
    map.on('zoomend', emitViewportChange)
    map.on('moveend', emitViewportChange)
    map.on('click', () => emit('map-tap'))
    renderMarkers(Boolean(props.markers.length && props.fitOnInitialMarkers))
    renderNearbyCircle()
    renderUserLocation()
    emitViewportChange()

    const container = document.getElementById(mapContainerId)
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => map?.resize())
      resizeObserver.observe(container)
    }
  }
  catch (error) {
    if (currentInitializationId !== initializationId)
      return
    loadError.value = error instanceof Error ? error.message : '高德地图加载失败'
  }
  finally {
    if (currentInitializationId === initializationId)
      loading.value = false
  }
}

function retry() {
  void initializeMap()
}

watch(() => props.markers, () => renderMarkers(props.fitOnInitialMarkers && !hasFitInitialMarkers))
watch(() => props.nearby, renderNearbyCircle, { deep: true })
watch(() => props.userLocation, renderUserLocation, { deep: true })
watch(() => props.fitToken, () => renderMarkers(true))
watch(() => props.selectedKey, updateSelectedMarker)
watch([() => props.zoom, () => props.center.latitude, () => props.center.longitude], updateCamera)
watch([() => props.apiKey, () => props.securityJsCode], () => {
  if (mounted)
    void initializeMap()
})

onMounted(() => {
  mounted = true
  void initializeMap()
})

onBeforeUnmount(() => {
  mounted = false
  initializationId += 1
  destroyMap()
})
</script>

<template>
  <view class="house-h5-map">
    <view :id="mapContainerId" class="house-h5-map__canvas" />

    <view v-if="loading" class="house-h5-map__state">
      <view class="house-h5-map__spinner" />
      <text>正在加载高德地图…</text>
    </view>
    <view v-else-if="loadError" class="house-h5-map__state house-h5-map__state--error">
      <view class="i-carbon-map-center house-h5-map__error-icon" />
      <strong>地图加载失败</strong>
      <text>{{ loadError }}</text>
      <wd-button size="small" variant="plain" @click="retry">
        重新加载
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-h5-map {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--app-bg-page);
}
.house-h5-map__canvas {
  width: 100%;
  height: 100%;
}
.house-h5-map__state {
  position: absolute;
  z-index: 8;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 18rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  background: linear-gradient(145deg, #e8f0ec, #dbe7e2);
}
.house-h5-map__state--error {
  padding: 48rpx;
  box-sizing: border-box;
  text-align: center;
  background: rgb(245 248 250 / 96%);
}
.house-h5-map__state--error strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.house-h5-map__state--error text {
  max-width: 540rpx;
  color: var(--app-text-muted);
  line-height: 1.6;
}
.house-h5-map__error-icon {
  color: var(--app-color-brand);
  font-size: 58rpx;
}
.house-h5-map__spinner {
  width: 44rpx;
  height: 44rpx;
  border: 5rpx solid rgb(0 102 204 / 16%);
  border-top-color: var(--app-color-brand);
  border-radius: 50%;
  animation: house-h5-map-spin 0.8s linear infinite;
}
:deep(.amap-logo),
:deep(.amap-copyright) {
  bottom: 18rpx !important;
}
.house-h5-map--sheet-open :deep(.amap-logo),
.house-h5-map--sheet-open :deep(.amap-copyright) {
  top: calc(var(--map-navigation-height) + 330rpx) !important;
  bottom: auto !important;
}
:deep(.house-h5-map-marker) {
  position: relative;
  display: flex;
  min-width: 94rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  padding: 0 20rpx;
  border: 2rpx solid rgb(255 255 255 / 92%);
  border-radius: 32rpx;
  box-sizing: border-box;
  color: var(--app-color-brand-active);
  font-size: 23rpx;
  font-weight: 750;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  background: var(--app-bg-card);
  box-shadow: 0 6rpx 22rpx rgb(23 35 61 / 18%);
  transition:
    transform var(--app-motion-duration-base) var(--app-motion-ease-out),
    background-color var(--app-motion-duration-base) ease;
}
:deep(.house-h5-map-user-location) {
  width: 30rpx;
  height: 30rpx;
  border: 5rpx solid var(--app-bg-card);
  border-radius: 50%;
  box-sizing: border-box;
  background: var(--app-color-brand);
  box-shadow:
    0 0 0 10rpx rgb(0 129 255 / 18%),
    0 3rpx 12rpx rgb(23 35 61 / 20%);
}
:deep(.house-h5-map-marker--active) {
  border-color: var(--app-color-brand);
  color: var(--app-text-on-brand);
  background: var(--app-color-brand);
  box-shadow: 0 9rpx 26rpx rgb(0 129 255 / 30%);
  transform: translateY(-3rpx);
}
:deep(.house-h5-map-marker--group) {
  min-width: 0;
  height: auto;
  flex-direction: column;
  gap: 5rpx;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
:deep(.house-h5-map-marker--group.house-h5-map-marker--active) {
  background: transparent;
  box-shadow: none;
}
:deep(.house-h5-map-marker__cluster-count) {
  display: flex;
  width: 82rpx;
  height: 82rpx;
  align-items: center;
  justify-content: center;
  gap: 2rpx;
  border: 5rpx solid var(--app-bg-card);
  border-radius: 50%;
  box-sizing: border-box;
  color: var(--app-text-on-brand);
  font-size: 28rpx;
  font-weight: 750;
  background: var(--app-color-brand);
  box-shadow: 0 7rpx 25rpx rgb(0 129 255 / 26%);
}
:deep(.house-h5-map-marker__cluster-count small) {
  padding-top: 7rpx;
  font-size: 15rpx;
  font-weight: 600;
}
:deep(.house-h5-map-marker__name) {
  overflow: hidden;
  max-width: 150rpx;
  padding: 5rpx 11rpx;
  border-radius: 14rpx;
  color: var(--app-text-primary);
  font-size: 19rpx;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 3rpx 12rpx rgb(23 35 61 / 11%);
}
:deep(.house-h5-map-marker__price) {
  font-size: inherit;
  font-weight: inherit;
}
:deep(.house-h5-map-marker__arrow) {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0;
  height: 0;
  border-top: 9rpx solid var(--app-bg-card);
  border-right: 8rpx solid transparent;
  border-left: 8rpx solid transparent;
  transform: translateX(-50%);
  transition: border-color 160ms ease;
}
:deep(.house-h5-map-marker--active .house-h5-map-marker__arrow) {
  border-top-color: var(--app-color-brand);
}

@keyframes house-h5-map-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
