<script setup lang="ts">
import type { NearbyPoiCategory, NearbyPois } from '@/services/manual/nearby-pois'
import { computed, ref, watch } from 'vue'
import { getNearbyPois } from '@/services/manual/nearby-pois'
// #ifndef MP-WEIXIN
import houseMapSchematic from '@/static/images/house-map-schematic.png'
// #endif

const props = defineProps<{
  name: string
  address: string
  latitude?: string | number | null
  longitude?: string | number | null
  previewCount?: number
  hideNearbyHint?: boolean
  compact?: boolean
}>()
const categories = [
  { key: 'bus', label: '公交' },
  { key: 'subway', label: '地铁' },
  { key: 'education', label: '教育' },
  { key: 'medical', label: '医疗' },
] as const
const category = ref<NearbyPoiCategory>('bus')
const poiGroups = ref<NearbyPois>({ bus: [], subway: [], education: [], medical: [] })
const poiLoading = ref(false)
const poiError = ref('')
let poiRequestId = 0
const hasCoordinates = computed(() => props.latitude != null && props.longitude != null && Number.isFinite(Number(props.latitude)) && Number.isFinite(Number(props.longitude)))
const activeCategory = computed(() => categories.find(item => item.key === category.value) || categories[0])
const pois = computed(() => poiGroups.value[category.value])
const visiblePois = computed(() => props.previewCount ? pois.value.slice(0, props.previewCount) : pois.value)
const markers = computed(() => hasCoordinates.value
  ? [{
      id: 1,
      iconPath: '/static/tabbar/home.png',
      width: 24,
      height: 24,
      latitude: Number(props.latitude),
      longitude: Number(props.longitude),
      callout: { content: props.name, display: 'ALWAYS' as const, color: '#ffffff', bgColor: '#0081ff', borderRadius: 7, borderWidth: 0, borderColor: '#0081ff', textAlign: 'center' as const, padding: 8, fontSize: 11 },
    }]
  : [])

watch(
  () => [props.latitude, props.longitude],
  async () => {
    const requestId = ++poiRequestId
    poiGroups.value = { bus: [], subway: [], education: [], medical: [] }
    poiError.value = ''
    poiLoading.value = false
    if (!hasCoordinates.value)
      return
    poiLoading.value = true
    try {
      const result = await getNearbyPois(Number(props.latitude), Number(props.longitude))
      if (requestId === poiRequestId)
        poiGroups.value = result
    }
    catch {
      if (requestId === poiRequestId)
        poiError.value = '暂时无法获取周边设施'
    }
    finally {
      if (requestId === poiRequestId)
        poiLoading.value = false
    }
  },
  { immediate: true },
)

function distanceText(distance: number) {
  return distance < 1000 ? `${distance} 米` : `${(distance / 1000).toFixed(1)} 公里`
}

function openLocation() {
  if (!hasCoordinates.value)
    return
  uni.openLocation({ latitude: Number(props.latitude), longitude: Number(props.longitude), name: props.name, address: props.address })
}
</script>

<template>
  <view class="detail-card location-card" :class="{ 'location-card--compact': compact }">
    <view class="detail-heading" :class="{ 'location-card__header': compact }">
      <text :class="{ 'location-card__label': compact }">位置与周边</text>
      <button v-if="hasCoordinates" class="detail-text-button" @click="openLocation">
        打开地图 <text class="i-carbon-chevron-right" />
      </button>
    </view>
    <view v-if="!compact" class="address flex items-start gap-1 text-size-xs text-hex-526177 leading-4.5">
      <text class="i-carbon-location address-icon mt-0.5 flex-none text-size-xs" /><text>{{ address || '暂未登记详细地址' }}</text>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <map v-if="hasCoordinates" class="map relative mx-0 mb-3 mt-2.5 h-38 w-full overflow-hidden border-0 rounded-2.5 bg-hex-edf2ef p-0" :latitude="Number(latitude)" :longitude="Number(longitude)" :markers="markers" :scale="15" @markertap="openLocation" @callouttap="openLocation" />
    <view v-else class="map map--empty relative mx-0 mb-3 mt-2.5 h-38 w-full overflow-hidden border-0 rounded-2.5 bg-hex-edf2ef p-0">
      位置待完善
    </view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <button class="map map--schematic relative mx-0 mb-3 mt-2.5 h-38 w-full overflow-hidden border-0 rounded-2.5 bg-hex-edf2ef p-0" :style="{ backgroundImage: `url(${houseMapSchematic})` }" :disabled="!hasCoordinates" @click="openLocation">
      <text class="map-marker absolute left-1/2 top-1/2 rounded-2 bg-hex-0081ff px-2.5 py-2 text-size-2xs text-hex-fff font-semibold leading-4.5">{{ name }}</text>
      <text class="map-caption absolute bottom-2 left-2 rounded-1 bg-hex-ffffffdf px-1.5 py-0.5 text-size-2xs text-hex-526177 leading-4">{{ hasCoordinates ? '位置示意 · 点击查看地图' : '位置待完善' }}</text>
    </button>
    <!-- #endif -->
    <view class="poi-tabs flex gap-1.5 border-b-1 border-b-hex-e7ecf2 border-b-solid pb-2.5" role="tablist" aria-label="周边类型">
      <button v-for="item in categories" :key="item.key" class="poi-tab m-0 min-h-9 flex-1 border-0 rounded-2 bg-transparent px-1 py-1.5 text-size-2xs text-hex-182538 leading-6" :class="{ 'poi-tab--active': category === item.key }" role="tab" :aria-selected="category === item.key" @click="category = item.key">
        {{ item.label }}
      </button>
    </view>
    <view v-if="poiLoading" class="poi-empty px-0 py-6 text-center text-size-xs text-hex-78869a">
      正在获取周边设施
    </view>
    <view v-else-if="poiError" class="poi-empty px-0 py-6 text-center text-size-xs text-hex-78869a">
      {{ poiError }}
    </view>
    <view v-else-if="pois.length" class="poi-list flex flex-col">
      <view v-for="poi in visiblePois" :key="poi.id" class="poi-item flex items-start justify-between gap-2.5 border-b-1 border-b-hex-eff2f6 border-b-solid px-0 py-2.5">
        <view class="poi-main min-w-0 flex gap-1">
          <text class="poi-name text-size-xs text-hex-182538 font-semibold leading-4.5">{{ poi.name }}</text>
          <text v-if="!compact || category !== 'bus'" class="poi-address overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-hex-78869a leading-4">{{ poi.address }}</text>
        </view>
        <text class="poi-distance flex-none text-size-2xs text-hex-526177 leading-4.5">{{ distanceText(poi.distance) }}</text>
      </view>
    </view>
    <view v-else class="poi-empty px-0 py-6 text-center text-size-xs text-hex-78869a">
      2 公里内暂无{{ activeCategory.label }}地点信息
    </view>
    <view v-if="!hideNearbyHint" class="poi-hint border-t-1 border-t-hex-eff2f6 border-t-solid pt-2.5 text-size-2xs text-hex-78869a leading-4.5">
      {{ hasCoordinates ? '2 公里内周边配套' : '房源位置以工作人员确认为准' }}
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.location-card__header > .detail-text-button {
  @apply flex-none;
}
.location-card__label {
  @apply block;
  @apply text-hex-66788d;
  @apply text-size-xs;
  @apply font-medium;
  @apply leading-4.5;
}
.map {
  @apply block;
}
.map::after {
  @apply border-0;
}
.location-card--compact .map {
  height: calc(50vw - 30px);
  @apply mt-1.5 mx-0 mb-2;
  @apply rounded-3;
}
.map--schematic {
  @apply bg-center;
  @apply bg-cover;
}
.map-marker {
  max-width: 80%;
  transform: translate(-50%, -50%);
}
.map--empty {
  @apply flex;
  @apply items-center;
  @apply justify-center;
  @apply text-hex-78869a;
  @apply text-size-xs;
}
.location-card--compact .poi-tabs {
  @apply gap-0;
  @apply p-0;
  @apply border-b-1 border-b-solid border-b-hex-e7ecf2;
  @apply rounded-0;
  @apply bg-transparent;
}
.poi-tab::after {
  @apply border-0;
}
.location-card--compact .poi-tab {
  @apply relative;
  @apply min-h-10;
  @apply py-2 px-1;
  @apply rounded-0;
  @apply text-hex-526177;
  @apply text-size-xs;
}
.poi-tab--active {
  @apply text-hex-006bcc;
  @apply bg-hex-edf6ff;
}
.location-card--compact .poi-tab--active {
  @apply text-hex-1269db;
  @apply bg-transparent;
}
.location-card--compact .poi-tab--active::before {
  @apply absolute;
  @apply bottom-0;
  @apply left-1/2;
  @apply w-5;
  @apply h-0.5;
  @apply rounded-0.5;
  @apply bg-current;
  content: '';
  transform: translateX(-50%);
}
.location-card--compact .poi-list {
  @apply mt-1;
}
.location-card--compact .poi-item {
  @apply gap-3;
  @apply py-3 px-0;
}
.location-card--compact .poi-item:last-child {
  @apply border-b-0;
}
.poi-main {
  @apply flex-1;
  @apply flex-col;
}
.location-card--compact .poi-name {
  @apply text-size-xs;
  @apply font-medium;
  @apply leading-5;
}
.location-card--compact .poi-distance {
  @apply text-size-2xs;
  @apply leading-5;
  @apply tabular-nums;
  @apply whitespace-nowrap;
}
</style>
