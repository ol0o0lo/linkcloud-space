<script setup lang="ts">
import type { GeoCoordinates } from '@/domain/geo-coordinates'
import type { CurrentWeatherOut } from '@/services/manual/weather'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCachedCurrentWeather, getCurrentWeather } from '@/services/manual/weather'
import { getCurrentLocationGcj02 } from '@/utils/location'

const cachedWeather = getCachedCurrentWeather()
const weather = ref<CurrentWeatherOut | null>(cachedWeather?.weather || null)
const loading = ref(false)
const district = computed(() => weather.value?.location.district || '天河区')
const isDefault = computed(() => weather.value?.location.source !== 'device')
const provider = computed(() => weather.value?.provider ?? null)
const weatherKind = computed(() => {
  const condition = weather.value?.current.condition || ''
  if (/雷|雨/.test(condition))
    return 'rain'
  if (/雪|冰雹/.test(condition))
    return 'snow'
  if (/晴/.test(condition))
    return 'sun'
  return 'cloud'
})
let deviceCoordinates: GeoCoordinates | null = cachedWeather?.coordinates || null
let locationAttempted = Boolean(cachedWeather)
let locationVersion = 0
let responseVersion = 0
let pendingWeather: Promise<void> | null = null
let pendingKey = ''

function loadWeather(coordinates?: GeoCoordinates): Promise<void> {
  const key = coordinates ? `${coordinates.longitude}:${coordinates.latitude}` : 'default'
  if (pendingWeather && pendingKey === key)
    return pendingWeather
  const version = ++responseVersion
  pendingKey = key
  loading.value = true
  const request = getCurrentWeather(coordinates).then((result) => {
    if (version === responseVersion)
      weather.value = result
  }).catch(() => {
    if (version === responseVersion)
      weather.value = null
  }).finally(() => {
    if (version === responseVersion)
      pendingWeather = null
    if (version === responseVersion)
      loading.value = false
  })
  pendingWeather = request
  return request
}

function refresh(forceLocation = false): Promise<void> {
  const cache = getCachedCurrentWeather()
  if (cache && !forceLocation && !pendingWeather) {
    weather.value = cache.weather
    deviceCoordinates = cache.coordinates
    locationAttempted = true
    return Promise.resolve()
  }
  if (!locationAttempted) {
    locationAttempted = true
    const version = ++locationVersion
    void getCurrentLocationGcj02().then((coordinates) => {
      if (version !== locationVersion)
        return
      deviceCoordinates = coordinates
      void loadWeather(coordinates)
    }).catch(() => undefined)
  }
  return loadWeather(deviceCoordinates || undefined)
}

function retryLocation() {
  if (loading.value)
    return
  locationAttempted = false
  deviceCoordinates = null
  void refresh(true)
}

onMounted(() => void refresh())
onUnmounted(() => {
  locationVersion += 1
  responseVersion += 1
})
defineExpose({ refresh, provider })
</script>

<template>
  <view class="weather-nav max-w-full min-w-0 flex app-touchable items-center gap-1.5 pb-1 pl-0 pr-1.5 pt-1" hover-class="app-touchable--pressed" @click="retryLocation">
    <view class="weather-icon h-7 w-5 flex flex-none items-center justify-center text-size-base" :class="`weather-icon--${weatherKind}`">
      <view v-if="weatherKind === 'sun'" class="i-carbon-sun" />
      <view v-else-if="weatherKind === 'rain'" class="i-carbon-rain" />
      <view v-else-if="weatherKind === 'snow'" class="i-carbon-snow" />
      <view v-else class="i-carbon-cloud" />
    </view>
    <view class="weather-copy min-w-0 flex flex-col">
      <view class="weather-location min-w-0 flex items-center gap-1 text-size-2xs text-content-primary font-semibold leading-tight">
        <text class="weather-district overflow-hidden text-ellipsis whitespace-nowrap">{{ district }}</text>
        <text v-if="isDefault" class="weather-default flex-none text-size-3xs font-medium">默认位置</text>
      </view>
      <view class="weather-meta min-w-0 flex gap-1 leading-tight">
        <text v-if="weather" class="weather-temperature flex-none text-size-2xs text-content-primary font-bold">{{ Math.round(weather.current.temperature_c) }}℃</text>
        <text class="weather-condition overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">{{ weather ? weather.current.condition : loading ? '天气加载中…' : '天气暂不可用' }}</text>
        <text v-if="weather?.stale" class="weather-stale flex-none text-size-3xs text-content-muted">稍早</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.weather-icon {
  color: #ba7319;
}
.weather-icon--rain {
  color: #2874bc;
}
.weather-icon--snow {
  color: #438bb7;
}
.weather-icon--cloud {
  color: #6a8099;
}
.weather-copy {
  gap: 3rpx;
}
.weather-default {
  color: #5c7b9d;
}
.weather-meta {
  align-items: baseline;
}
</style>
