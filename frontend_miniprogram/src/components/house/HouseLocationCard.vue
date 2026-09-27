<script setup lang="ts">
import type { NearbyPoiCategory, NearbyPois } from '@/services/manual/nearby-pois'
import { computed, ref, watch } from 'vue'
import { getNearbyPois } from '@/services/manual/nearby-pois'

const props = defineProps<{
  name: string
  address: string
  latitude?: string | number | null
  longitude?: string | number | null
  previewCount?: number
  hideNearbyHint?: boolean
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
  <view class="detail-card">
    <view class="detail-heading">
      <text>位置与周边</text><button v-if="hasCoordinates" class="detail-text-button" @click="openLocation">
        打开地图 <text class="i-carbon-chevron-right" />
      </button>
    </view>
    <view class="address">
      <text class="i-carbon-location address-icon" /><text>{{ address || '暂未登记详细地址' }}</text>
    </view>
    <!-- #ifdef MP-WEIXIN -->
    <map v-if="hasCoordinates" class="map" :latitude="Number(latitude)" :longitude="Number(longitude)" :markers="markers" :scale="15" @markertap="openLocation" @callouttap="openLocation" />
    <view v-else class="map map--empty">
      位置待完善
    </view>
    <!-- #endif -->
    <!-- #ifndef MP-WEIXIN -->
    <button class="map map--schematic" :disabled="!hasCoordinates" @click="openLocation">
      <image class="map-background" src="/static/images/house-map-schematic.png" mode="scaleToFill" />
      <text class="map-marker">{{ name }}</text>
      <text class="map-caption">{{ hasCoordinates ? '位置示意 · 点击查看地图' : '位置待完善' }}</text>
    </button>
    <!-- #endif -->
    <view class="poi-tabs" role="tablist" aria-label="周边类型">
      <button v-for="item in categories" :key="item.key" class="poi-tab" :class="{ 'poi-tab--active': category === item.key }" role="tab" :aria-selected="category === item.key" @click="category = item.key">
        {{ item.label }}
      </button>
    </view>
    <view v-if="poiLoading" class="poi-empty">
      正在获取周边设施
    </view>
    <view v-else-if="poiError" class="poi-empty">
      {{ poiError }}
    </view>
    <view v-else-if="pois.length" class="poi-list">
      <view v-for="poi in visiblePois" :key="poi.id" class="poi-item">
        <view class="poi-main">
          <text class="poi-name">{{ poi.name }}</text>
          <text class="poi-address">{{ poi.address }}</text>
        </view>
        <text class="poi-distance">{{ distanceText(poi.distance) }}</text>
      </view>
    </view>
    <view v-else class="poi-empty">
      2 公里内暂无{{ activeCategory.label }}地点信息
    </view>
    <view v-if="!hideNearbyHint" class="poi-hint">
      {{ hasCoordinates ? '2 公里内周边配套' : '房源位置以工作人员确认为准' }}
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.address {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  color: #526177;
  font-size: 12px;
  line-height: 18px;
}
.address-icon {
  flex: none;
  margin-top: 2px;
  font-size: 13px;
}
.map {
  position: relative;
  display: block;
  width: 100%;
  height: 152px;
  margin: 9px 0 12px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 10px;
  background: #edf2ef;
}
.map::after {
  border: 0;
}
.map-background {
  width: 100%;
  height: 100%;
}
.map-marker {
  position: absolute;
  top: 49px;
  left: 50%;
  max-width: 80%;
  padding: 7px 10px;
  border-radius: 7px;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 17px;
  background: #0081ff;
  transform: translateX(-50%);
}
.map-caption {
  position: absolute;
  bottom: 8px;
  left: 8px;
  padding: 2px 5px;
  border-radius: 4px;
  color: #526177;
  font-size: 10px;
  line-height: 16px;
  background: #ffffffdf;
}
.map--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #78869a;
  font-size: 12px;
}
.poi-tabs {
  display: flex;
  gap: 5px;
  padding-bottom: 9px;
  border-bottom: 1px solid #e7ecf2;
}
.poi-tab {
  flex: 1;
  min-height: 36px;
  margin: 0;
  padding: 6px 3px;
  border: 0;
  border-radius: 7px;
  color: #182538;
  font-size: 11px;
  line-height: 24px;
  background: transparent;
}
.poi-tab::after {
  border: 0;
}
.poi-tab--active {
  color: #006bcc;
  background: #edf6ff;
}
.poi-empty {
  padding: 24px 0;
  color: #78869a;
  font-size: 12px;
  text-align: center;
}
.poi-list {
  display: flex;
  flex-direction: column;
}
.poi-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #eff2f6;
}
.poi-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3px;
}
.poi-name {
  color: #182538;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}
.poi-address {
  overflow: hidden;
  color: #78869a;
  font-size: 10px;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-distance {
  flex: none;
  color: #526177;
  font-size: 10px;
  line-height: 18px;
}
.poi-hint {
  padding-top: 9px;
  border-top: 1px solid #eff2f6;
  color: #78869a;
  font-size: 10px;
  line-height: 18px;
}
</style>
