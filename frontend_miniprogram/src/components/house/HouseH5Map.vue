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
  <view class="house-h5-map relative block h-full w-full overflow-hidden bg-surface-page">
    <view :id="mapContainerId" class="house-h5-map__canvas h-full w-full" />

    <view v-if="loading" class="house-h5-map__state absolute inset-0 z-8 flex flex-col items-center justify-center gap-2.5 text-size-2xs text-content-secondary">
      <view class="house-h5-map__spinner h-5.5 w-5.5 rounded-full" />
      <text>正在加载高德地图…</text>
    </view>
    <view v-else-if="loadError" class="house-h5-map__state house-h5-map__state--error absolute inset-0 z-8 flex flex-col items-center justify-center gap-2.5 text-size-2xs text-content-secondary">
      <view class="i-carbon-map-center house-h5-map__error-icon text-size-3xl text-app-brand" />
      <strong>地图加载失败</strong>
      <text>{{ loadError }}</text>
      <wd-button size="small" variant="plain" @click="retry">
        重新加载
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-h5-map__state {
  background: linear-gradient(145deg, #e8f0ec, #dbe7e2);
}
.house-h5-map__state--error {
  @apply p-6;
  @apply box-border;
  @apply text-center;
  @apply bg-none;
  @apply bg-hex-f5f8fa/96;
}
.house-h5-map__state--error strong {
  @apply text-content-primary;
  @apply text-size-sm;
}
.house-h5-map__state--error text {
  @apply max-w-68;
  @apply text-content-muted;
  @apply leading-relaxed;
}
.house-h5-map__spinner {
  @apply border-2.5 border-solid border-hex-0066cc/16;
  @apply border-t-app-brand;
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
  @apply relative;
  @apply flex;
  @apply min-w-12;
  @apply h-7.5;
  @apply items-center;
  @apply justify-center;
  @apply py-0 px-2.5;
  @apply border-1 border-solid border-hex-ffffff/92;
  @apply rounded-4;
  @apply box-border;
  @apply text-app-brand-active;
  @apply text-size-xs;
  @apply font-extrabold;
  @apply leading-none;
  @apply whitespace-nowrap;
  @apply cursor-pointer;
  @apply bg-surface-card;
  box-shadow: 0 6rpx 22rpx rgb(23 35 61 / 18%);
  transition:
    transform var(--app-motion-duration-base) var(--app-motion-ease-out),
    background-color var(--app-motion-duration-base) ease;
}
:deep(.house-h5-map-user-location) {
  @apply w-4;
  @apply h-4;
  @apply border-2.5 border-solid border-surface-card;
  @apply rounded-full;
  @apply box-border;
  @apply bg-app-brand;
  box-shadow:
    0 0 0 10rpx rgb(0 129 255 / 18%),
    0 3rpx 12rpx rgb(23 35 61 / 20%);
}
:deep(.house-h5-map-marker--active) {
  @apply border-app-brand;
  @apply text-content-on-brand;
  @apply bg-app-brand;
  box-shadow: 0 9rpx 26rpx rgb(0 129 255 / 30%);
  transform: translateY(-3rpx);
}
:deep(.house-h5-map-marker--group) {
  @apply min-w-0;
  @apply h-auto;
  @apply flex-col;
  @apply gap-0.5;
  @apply p-0;
  @apply border-0;
  @apply rounded-0;
  @apply bg-transparent;
  @apply shadow-none;
}
:deep(.house-h5-map-marker--group.house-h5-map-marker--active) {
  @apply bg-transparent;
  @apply shadow-none;
}
:deep(.house-h5-map-marker__cluster-count) {
  @apply flex;
  @apply w-10.5;
  @apply h-10.5;
  @apply items-center;
  @apply justify-center;
  @apply gap-0.5;
  @apply border-2.5 border-solid border-surface-card;
  @apply rounded-full;
  @apply box-border;
  @apply text-content-on-brand;
  @apply text-size-sm;
  @apply font-extrabold;
  @apply bg-app-brand;
  box-shadow: 0 7rpx 25rpx rgb(0 129 255 / 26%);
}
:deep(.house-h5-map-marker__cluster-count small) {
  @apply pt-1;
  @apply text-size-3xs;
  @apply font-semibold;
}
:deep(.house-h5-map-marker__name) {
  @apply overflow-hidden;
  @apply max-w-19;
  @apply py-0.5 px-1.5;
  @apply rounded-2;
  @apply text-content-primary;
  @apply text-size-2xs;
  @apply font-bold;
  @apply leading-tight;
  @apply text-center;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
  @apply bg-hex-ffffff/96;
  box-shadow: 0 3rpx 12rpx rgb(23 35 61 / 11%);
}
:deep(.house-h5-map-marker__price) {
  @apply text-size-inherit;
  @apply font-inherit;
}
:deep(.house-h5-map-marker__arrow) {
  @apply absolute;
  @apply top-full;
  @apply left-1/2;
  @apply w-0;
  @apply h-0;
  @apply border-t-4.5 border-t-solid border-t-surface-card;
  @apply border-r-4 border-r-solid border-r-transparent;
  @apply border-l-4 border-l-solid border-l-transparent;
  transform: translateX(-50%);
  transition: border-color 160ms ease;
}
:deep(.house-h5-map-marker--active .house-h5-map-marker__arrow) {
  @apply border-t-app-brand;
}

@keyframes house-h5-map-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
