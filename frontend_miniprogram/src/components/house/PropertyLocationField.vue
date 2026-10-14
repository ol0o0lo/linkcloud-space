<script setup lang="ts">
import type { PropertyLocation } from '@/domain/property-location'
import type { AmapH5Map, AmapH5Marker } from '@/services/manual/amap-h5'
import type { CommutePlace } from '@/services/manual/house-commute'
import { onBeforeUnmount, ref } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import { loadAmapH5 } from '@/services/manual/amap-h5'
import { searchCommutePlaces } from '@/services/manual/house-commute'
import { useRuntimeStore } from '@/store/runtime'

const props = withDefaults(defineProps<{ modelValue?: PropertyLocation | null, disabled?: boolean, city?: string }>(), { disabled: false, city: '' })
const emit = defineEmits<{ 'update:modelValue': [value: PropertyLocation | null] }>()
const runtime = useRuntimeStore()
const visible = ref(false)
const mapReady = ref(false)
const draft = ref<PropertyLocation | null>(null)
const keyword = ref('')
const places = ref<CommutePlace[]>([])
const searching = ref(false)
const error = ref('')
const mapId = `property-location-${Date.now()}-${Math.random().toString(36).slice(2)}`
let map: AmapH5Map | null = null
let marker: AmapH5Marker | null = null
let generation = 0

function close() {
  generation += 1
  visible.value = false
  mapReady.value = false
  map?.destroy()
  map = null
  marker = null
  places.value = []
}
function setPoint(longitude: number, latitude: number) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90)
    return
  draft.value = { longitude, latitude, coordinate_system: 'gcj02' }
  marker?.setPosition([longitude, latitude])
}
async function choose() {
  if (props.disabled)
    return
  // #ifdef MP-WEIXIN
  try {
    const result = await uni.chooseLocation({ ...(props.modelValue ? { latitude: props.modelValue.latitude, longitude: props.modelValue.longitude } : {}) })
    emit('update:modelValue', { longitude: result.longitude, latitude: result.latitude, coordinate_system: 'gcj02' })
  }
  catch (cause) {
    if (!String((cause as { errMsg?: string })?.errMsg || '').includes('cancel'))
      uni.showToast({ title: '位置选择失败，请检查定位权限', icon: 'none' })
  }
  // #endif
  // #ifdef H5
  close()
  visible.value = true
  draft.value = props.modelValue ? { ...props.modelValue } : null
  error.value = ''
  keyword.value = ''
  // #endif
}
async function initializeMap() {
  // #ifdef H5
  const current = ++generation
  try {
    const amap = await loadAmapH5({ key: runtime.publicConfig?.amapJsapiKey || '', securityJsCode: runtime.publicConfig?.amapSecurityJsCode || '' })
    if (current !== generation || !visible.value)
      return
    const center: [number, number] = draft.value ? [draft.value.longitude, draft.value.latitude] : [121.4737, 31.2304]
    map = new amap.Map(mapId, { center, zoom: draft.value ? 16 : 5 })
    marker = new amap.Marker({ position: center })
    map.add(marker)
    mapReady.value = true
    map.on('click', (event) => {
      if (event.lnglat)
        setPoint(event.lnglat.getLng(), event.lnglat.getLat())
    })
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '地图加载失败' }
  // #endif
}
async function search() {
  if (!keyword.value.trim() || searching.value)
    return
  const current = generation
  searching.value = true
  error.value = ''
  try {
    const result = await searchCommutePlaces(keyword.value.trim(), props.city)
    if (current === generation) {
      places.value = result.filter(place => place.longitude != null && place.latitude != null)
      if (!places.value.length)
        uni.showToast({ title: '未找到地点，可直接在地图上选点', icon: 'none' })
    }
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '地点搜索失败' }
  finally { searching.value = false }
}
function selectPlace(place: CommutePlace) {
  if (place.longitude == null || place.latitude == null)
    return
  setPoint(place.longitude, place.latitude)
  map?.setZoomAndCenter(16, [place.longitude, place.latitude])
  places.value = []
}
function confirm() {
  if (!draft.value || !map)
    return
  emit('update:modelValue', { ...draft.value })
  close()
}
async function clear() {
  if (props.disabled)
    return
  const result = await uni.showModal({ title: '清除地图位置', content: '保存资料后生效。', confirmText: '清除' })
  if (result.confirm)
    emit('update:modelValue', null)
}
onBeforeUnmount(close)
</script>

<template>
  <view>
    <wd-cell title="地图位置" :value="modelValue ? `${modelValue.longitude.toFixed(6)}, ${modelValue.latitude.toFixed(6)}` : '选择地图位置'" :is-link="!disabled" @click="choose" />
    <view v-if="modelValue" class="px-3 py-2">
      <wd-button size="small" variant="plain" type="danger" :disabled="disabled" @click="clear">
        清除位置
      </wd-button>
    </view>
    <!-- #ifdef H5 -->
    <AppBottomSheet :visible="visible" title="选择地图位置" height="tall" @update:visible="!$event && close()" @opened="initializeMap">
      <wd-input v-model="keyword" placeholder="搜索小区、地址或地点" clearable @confirm="search" />
      <wd-button size="small" :loading="searching" @click="search">
        搜索地点
      </wd-button>
      <wd-cell v-for="place in places" :key="place.token" :title="place.name" :label="place.address" is-link @click="selectPlace(place)" />
      <view v-if="error" class="py-2 text-app-danger">
        {{ error }}
      </view>
      <view :id="mapId" style="width: 100%; height: 320px; margin-top: 12px;" />
      <view class="py-2 text-xs text-content-muted">
        点击地图选点，或搜索地点后选择；确认后回填，保存资料后生效。
      </view>
      <wd-button block :disabled="!draft || !mapReady" @click="confirm">
        确认位置
      </wd-button>
    </AppBottomSheet>
    <!-- #endif -->
  </view>
</template>
