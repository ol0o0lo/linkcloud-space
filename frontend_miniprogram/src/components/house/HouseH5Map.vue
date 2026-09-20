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
  markers: PublicHouseMapMarker[]
  nearby?: { latitude: number, longitude: number, radius: number } | null
  securityJsCode?: string
  selectedKey: string
  zoom: number
}>(), {
  center: () => ({ latitude: 31.2304, longitude: 121.4737 }),
  fitToken: 0,
  nearby: null,
  securityJsCode: '',
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
let resizeObserver: ResizeObserver | null = null
let mounted = false
let initializationId = 0
let hasFitInitialMarkers = false

function selectedMarker() {
  return props.markers.find(marker => marker.key === props.selectedKey) || null
}

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
    map.setFitView(Array.from(markers.values()), false, [190, 44, 240, 44], 15)
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

  const source = selectedMarker()
  if (source)
    map.panTo([Number(source.location.longitude), Number(source.location.latitude)])
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
  if (Math.abs(map.getZoom() - props.zoom) > 0.01)
    map.setZoomAndCenter(props.zoom, center)
  else
    map.panTo(center)
}

function destroyMap() {
  resizeObserver?.disconnect()
  resizeObserver = null
  clearMarkers()
  if (map && nearbyCircle)
    map.remove(nearbyCircle)
  nearbyCircle = null
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
    renderMarkers(Boolean(props.markers.length))
    renderNearbyCircle()
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

watch(() => props.markers, () => renderMarkers(!hasFitInitialMarkers))
watch(() => props.nearby, renderNearbyCircle, { deep: true })
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
    <view v-else class="house-h5-map__caption">
      高德地图 · 点击标记查看房源
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
  background: #dce8e1;
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
.house-h5-map__caption {
  position: absolute;
  z-index: 4;
  right: 18rpx;
  bottom: 370rpx;
  padding: 10rpx 16rpx;
  border: 1rpx solid rgb(255 255 255 / 72%);
  border-radius: 18rpx;
  color: #fff;
  font-size: 19rpx;
  pointer-events: none;
  background: rgb(24 42 63 / 64%);
  backdrop-filter: blur(10rpx);
}
:deep(.amap-logo),
:deep(.amap-copyright) {
  bottom: 370rpx !important;
}
:deep(.house-h5-map-marker) {
  position: relative;
  display: flex;
  min-width: 104rpx;
  min-height: 52rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 17rpx;
  border: 4rpx solid #fff;
  border-radius: 28rpx;
  box-sizing: border-box;
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 44rpx;
  white-space: nowrap;
  cursor: pointer;
  background: #52657f;
  box-shadow: 0 8rpx 20rpx rgb(37 57 77 / 24%);
  transition:
    transform 160ms ease,
    background-color 160ms ease;
}
:deep(.house-h5-map-marker--active) {
  background: var(--app-color-brand-active);
  box-shadow: 0 10rpx 26rpx rgb(0 102 204 / 30%);
  transform: scale(1.08);
}
:deep(.house-h5-map-marker--group) {
  min-width: 148rpx;
  min-height: 76rpx;
  align-items: stretch;
  flex-direction: column;
  gap: 0;
  padding: 9rpx 18rpx 8rpx;
  line-height: 1.25;
}
:deep(.house-h5-map-marker__name) {
  overflow: hidden;
  max-width: 240rpx;
  font-size: 22rpx;
  text-align: center;
  text-overflow: ellipsis;
}
:deep(.house-h5-map-marker__meta) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin-top: 5rpx;
  font-size: 17rpx;
  font-weight: 600;
}
:deep(.house-h5-map-marker__child) {
  opacity: 0.82;
}
:deep(.house-h5-map-marker__price) {
  padding-left: 8rpx;
  border-left: 1rpx solid rgb(255 255 255 / 38%);
  font-size: 18rpx;
  font-weight: 600;
}
:deep(.house-h5-map-marker__arrow) {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0;
  height: 0;
  border-top: 10rpx solid #52657f;
  border-right: 9rpx solid transparent;
  border-left: 9rpx solid transparent;
  transform: translateX(-50%);
  transition: border-color 160ms ease;
}
:deep(.house-h5-map-marker--active .house-h5-map-marker__arrow) {
  border-top-color: var(--app-color-brand-active);
}

@keyframes house-h5-map-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
