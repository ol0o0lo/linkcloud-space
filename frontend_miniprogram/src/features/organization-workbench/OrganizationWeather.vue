<script setup lang="ts">
import type { GeoCoordinates } from '@/domain/geo-coordinates'
import type { CurrentWeatherOut } from '@/services/manual/weather'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentWeather } from '@/services/manual/weather'
import { getCurrentLocationGcj02 } from '@/utils/location'

const weather = ref<CurrentWeatherOut | null>(null)
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
let deviceCoordinates: GeoCoordinates | null = null
let locationAttempted = false
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

function refresh(): Promise<void> {
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
  void refresh()
}

onMounted(() => void refresh())
onUnmounted(() => {
  locationVersion += 1
  responseVersion += 1
})
defineExpose({ refresh, provider })
</script>

<template>
  <view class="weather-nav app-touchable" hover-class="app-touchable--pressed" @click="retryLocation">
    <view class="weather-icon" :class="`weather-icon--${weatherKind}`">
      <view v-if="weatherKind === 'sun'" class="i-carbon-sun" />
      <view v-else-if="weatherKind === 'rain'" class="i-carbon-rain" />
      <view v-else-if="weatherKind === 'snow'" class="i-carbon-snow" />
      <view v-else class="i-carbon-cloud" />
    </view>
    <view class="weather-copy">
      <view class="weather-location">
        <text class="weather-district">{{ district }}</text>
        <text v-if="isDefault" class="weather-default">默认位置</text>
      </view>
      <view class="weather-meta">
        <text v-if="weather" class="weather-temperature">{{ Math.round(weather.current.temperature_c) }}℃</text>
        <text class="weather-condition">{{ weather ? weather.current.condition : loading ? '天气加载中…' : '天气暂不可用' }}</text>
        <text v-if="weather?.stale" class="weather-stale">稍早</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.weather-nav {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  gap: 12rpx;
  padding: 7rpx 12rpx 7rpx 0;
}
.weather-icon {
  display: flex;
  width: 40rpx;
  height: 54rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: #ba7319;
  font-size: 34rpx;
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
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3rpx;
}
.weather-location {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
  color: var(--app-text-primary);
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.2;
}
.weather-district {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weather-default {
  flex: 0 0 auto;
  color: #5c7b9d;
  font-size: 17rpx;
  font-weight: 500;
}
.weather-meta {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 7rpx;
  line-height: 1.15;
}
.weather-temperature {
  flex: 0 0 auto;
  color: var(--app-text-primary);
  font-size: 22rpx;
  font-weight: 700;
}
.weather-condition {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.weather-stale {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 17rpx;
}
</style>
