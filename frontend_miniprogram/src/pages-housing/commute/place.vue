<script setup lang="ts">
import type { CommutePlace } from '@/features/houses/commute'
import type { GeoCoordinates } from '@/domain/geo-coordinates'
import { onLoad } from '@dcloudio/uni-app'
import { onBeforeUnmount, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPage from '@/components/app/AppPage.vue'
import { getNearbyCommutePlaces, saveCommuteDestination, searchCommutePlaces } from '@/features/houses/commute'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { platformStorage } from '@/platform'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

definePage({
  style: { navigationBarTitleText: '选择通勤目的地', navigationStyle: 'custom' },
})

interface OpenerPage {
  getOpenerEventChannel?: () => { emit: (event: string, value: CommutePlace) => void }
}

const keyword = ref('')
const places = ref<CommutePlace[]>([])
const nearbyPlaces = ref<CommutePlace[]>([])
const history = ref<CommutePlace[]>([])
const location = ref<GeoCoordinates | null>(null)
const locating = ref(false)
const locationError = ref(false)
const selecting = ref(false)
const selectedId = ref(0)
const searching = ref(false)
const searched = ref(false)
const error = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchGeneration = 0
let locationGeneration = 0
const HISTORY_KEY = 'house-commute-place-history-v1'
const workPlacePreference = useWorkPlacePreferenceStore()

function loadHistory() {
  try {
    const saved: unknown = JSON.parse(platformStorage.persistent.getItem(HISTORY_KEY) || 'null')
    history.value = Array.isArray(saved)
      ? saved.filter((item): item is CommutePlace => typeof item?.destinationId === 'number' && item.destinationId > 0 && typeof item.name === 'string' && typeof item.city === 'string').slice(0, 8)
      : []
  }
  catch {
    history.value = []
  }
}

function rememberPlace(place: CommutePlace) {
  const saved = { name: place.name, address: place.address, city: place.city, token: '', destinationId: place.destinationId }
  history.value = [saved, ...history.value.filter(item => item.destinationId !== place.destinationId)].slice(0, 8)
  try {
    platformStorage.persistent.setItem(HISTORY_KEY, JSON.stringify(history.value))
  }
  catch {
    // 本地存储不可用时，本次选择仍然有效。
  }
}

function distanceLabel(distance: number | null | undefined) {
  if (distance == null)
    return ''
  return distance < 1000 ? `${distance}米` : `${(distance / 1000).toFixed(1)}公里`
}

function placeAddress(place: CommutePlace) {
  const rawAddress = place.address?.trim()
  if (!rawAddress)
    return place.name
  const city = place.city.trim()
  const cityPrefix = /(?:[市盟]|自治州|地区|特别行政区)$/.test(city) ? city : `${city}市`
  const cityIndex = city ? rawAddress.indexOf(cityPrefix) : -1
  const hasCityPrefix = cityIndex === 0 || (cityIndex > 0 && /(?:省|自治区|特别行政区)$/.test(rawAddress.slice(0, cityIndex)))
  const address = hasCityPrefix ? rawAddress.slice(cityIndex + cityPrefix.length).trim() || place.name : rawAddress
  const nearbyCity = nearbyPlaces.value[0]?.city.trim()
  if (city && nearbyCity && city.replace(/市$/, '') !== nearbyCity.replace(/市$/, '') && !address.startsWith(city))
    return `${city} · ${address}`
  return address
}

async function loadNearby(showError = false) {
  if (locating.value)
    return
  const generation = ++locationGeneration
  locating.value = true
  locationError.value = false
  try {
    const current = await getCurrentLocationGcj02()
    if (generation !== locationGeneration)
      return
    location.value = current
    const result = await getNearbyCommutePlaces(current)
    if (generation !== locationGeneration)
      return
    nearbyPlaces.value = result
    if (keyword.value.trim().length >= 2)
      search(keyword.value)
  }
  catch (cause) {
    if (generation === locationGeneration) {
      locationError.value = true
      if (showError)
        uni.showToast({ title: getLocationErrorMessage(cause), icon: 'none' })
    }
  }
  finally {
    if (generation === locationGeneration)
      locating.value = false
  }
}

function search(value: string) {
  clearTimeout(searchTimer)
  const generation = ++searchGeneration
  const term = value.trim()
  places.value = []
  searched.value = false
  error.value = ''
  searching.value = term.length >= 2
  if (term.length < 2)
    return
  searchTimer = setTimeout(async () => {
    try {
      const result = await searchCommutePlaces(term, '', location.value || undefined)
      if (generation === searchGeneration) {
        places.value = result
        searched.value = true
      }
    }
    catch (cause) {
      if (generation === searchGeneration)
        error.value = cause instanceof Error ? cause.message : '地点搜索失败，请重试'
    }
    finally {
      if (generation === searchGeneration)
        searching.value = false
    }
  }, 300)
}

async function choosePlace(place: CommutePlace) {
  if (selecting.value)
    return
  selecting.value = true
  try {
    const destinationId = place.destinationId || (await saveCommuteDestination(place.token)).destination_id
    const selected = { ...place, destinationId }
    rememberPlace(selected)
    workPlacePreference.save(selected)
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
    currentPage?.getOpenerEventChannel?.().emit('selectCommutePlace', selected)
    uni.navigateBack()
  }
  catch (cause) {
    uni.showToast({ title: cause instanceof Error ? cause.message : '地点选择失败，请重试', icon: 'none' })
  }
  finally {
    selecting.value = false
  }
}

watch(keyword, search)
onLoad((options) => {
  loadHistory()
  selectedId.value = Number(options?.selected_id || 0)
  keyword.value = String(options?.keyword || '')
  void loadNearby()
})
onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchGeneration += 1
  locationGeneration += 1
})
</script>

<template>
  <AppPage variant="form" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="选择通勤目的地" back scroll-mode="sticky" />
    </template>

    <view class="place-search__field min-h-11 flex items-center gap-2 border-hairline border-app-card rounded-2.5 border-solid bg-surface-card px-3 py-0">
      <view class="i-carbon-search place-search__search-icon text-size-sm text-content-muted" />
      <wd-input v-model="keyword" focus clearable compact :maxlength="80" confirm-type="search" placeholder="请输入上班地点" />
    </view>
    <template v-if="keyword.trim()">
      <view v-if="searching" class="place-search__state min-h-23 flex items-center justify-center gap-2 text-size-xs text-content-muted">
        <AppLoading text="正在搜索地点…" />
      </view>
      <view v-else-if="error" class="place-search__state min-h-23 flex items-center justify-center gap-2 text-size-xs text-content-muted">
        <text>{{ error }}</text>
        <button @click="search(keyword)">
          重新搜索
        </button>
      </view>
      <view v-else-if="places.length" class="place-search__section mt-3.5">
        <text class="place-search__result-heading mx-0.5 mb-1 mt-0 block text-size-2xs text-content-muted">搜索结果</text>
        <button v-for="place in places" :key="place.token" class="place-search__result box-border min-h-13 w-full flex items-center gap-2 px-1 py-1.5 text-left" @click="choosePlace(place)">
          <view class="i-carbon-location place-search__result-icon text-size-base text-app-brand" />
          <view class="place-search__result-copy min-w-0 flex gap-0.5 leading-snug">
            <strong>{{ place.name }}</strong>
            <text>{{ placeAddress(place) }}</text>
          </view>
          <text v-if="place.distance_m != null" class="place-search__distance">{{ distanceLabel(place.distance_m) }}</text>
        </button>
      </view>
      <view v-else-if="searched" class="place-search__state min-h-23 flex items-center justify-center gap-2 text-size-xs text-content-muted">
        <text>没有找到地点，试试更完整的名称</text>
      </view>
      <text v-else class="place-search__tip mx-0.5 mb-3.5 mt-2.5 block text-size-2xs text-content-muted">输入至少 2 个字，选择准确的地点</text>
    </template>
    <template v-else>
      <view v-if="history.length" class="place-search__section mt-3.5">
        <text class="place-search__result-heading mx-0.5 mb-1 mt-0 block text-size-2xs text-content-muted">历史上班地点</text>
        <button v-for="place in history.slice(0, 1)" :key="place.destinationId" class="place-search__result box-border min-h-13 w-full flex items-center gap-2 px-1 py-1.5 text-left" @click="choosePlace(place)">
          <view class="i-carbon-recently-viewed place-search__result-icon text-size-base text-app-brand" />
          <view class="place-search__result-copy min-w-0 flex gap-0.5 leading-snug">
            <strong>{{ place.name }}</strong>
            <text>{{ placeAddress(place) }}</text>
          </view>
          <view v-if="place.destinationId === selectedId" class="i-carbon-checkmark place-search__selected text-size-sm text-app-brand" />
        </button>
      </view>
      <view class="place-search__section mt-3.5">
        <text class="place-search__result-heading mx-0.5 mb-1 mt-0 block text-size-2xs text-content-muted">你可能在这里上班</text>
        <view v-if="nearbyPlaces.length" class="place-search__result place-search__result--current box-border min-h-13 w-full flex items-center gap-2 px-1 py-1.5 text-left">
          <button class="place-search__current-main m-0 min-w-0 flex flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left" @click="choosePlace(nearbyPlaces[0])">
            <view class="i-carbon-location-current place-search__result-icon text-size-base text-app-brand" />
            <view class="place-search__result-copy min-w-0 flex gap-0.5 leading-snug">
              <strong>{{ nearbyPlaces[0].name }}</strong>
              <text>{{ placeAddress(nearbyPlaces[0]) }}</text>
            </view>
          </button>
          <view class="place-search__current-actions flex shrink-0 items-center">
            <wd-button variant="text" size="mini" icon="i-carbon-center-circle" css-icon :loading="locating" :disabled="locating || selecting" :aria-label="locating ? '正在定位' : '重新定位'" @click="loadNearby(true)" />
          </view>
        </view>
        <button v-for="place in nearbyPlaces.slice(1)" :key="place.token" class="place-search__result box-border min-h-13 w-full flex items-center gap-2 px-1 py-1.5 text-left" @click="choosePlace(place)">
          <view class="i-carbon-location place-search__result-icon text-size-base text-app-brand" />
          <view class="place-search__result-copy min-w-0 flex gap-0.5 leading-snug">
            <strong>{{ place.name }}</strong>
            <text>{{ placeAddress(place) }}</text>
          </view>
          <text class="place-search__distance">{{ distanceLabel(place.distance_m) }}</text>
        </button>
        <view v-if="locating" class="place-search__state min-h-23 flex items-center justify-center gap-2 text-size-xs text-content-muted">
          <AppLoading text="正在查找附近地点…" />
        </view>
        <button v-else-if="locationError" class="place-search__location-retry" @click="loadNearby(true)">
          定位不可用，点击重试
        </button>
        <view v-else-if="!nearbyPlaces.length" class="place-search__empty">
          <text>附近暂无推荐地点，可在上方搜索</text>
          <wd-button variant="text" size="mini" :disabled="selecting" @click="loadNearby(true)">
            重新定位
          </wd-button>
        </view>
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.place-search__field :deep(.wd-input) {
  @apply min-w-0;
  @apply flex-1;
}
.place-search__result {
  @apply m-0;
  @apply border-0;
  @apply border-b-hairline border-b-solid border-b-app-divider;
  @apply rounded-0;
  @apply bg-transparent;
}
.place-search__result--current {
  @apply mb-0.5;
  @apply border-0;
  @apply rounded-2;
  @apply bg-surface-page;
}
.place-search__current-actions {
  --wot-button-size-icon-mini: 40rpx;
  --wot-icon-font-size: 40rpx;
  --wot-button-padding-mini: 0;
  --wot-button-primary-color: var(--app-color-brand);
}
.place-search__result::after,
.place-search__current-main::after,
.place-search__state button::after {
  @apply border-0;
}
.place-search__result-copy {
  @apply flex-1;
  @apply flex-col;
}
.place-search__result-copy strong {
  @apply overflow-hidden;
  @apply text-content-primary;
  @apply text-size-xs;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}
.place-search__result-copy text {
  @apply overflow-hidden;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}
.place-search__distance,
.place-search__selected {
  @apply shrink-0;
  @apply text-content-muted;
  @apply text-size-2xs;
}
.place-search__empty,
.place-search__location-retry {
  @apply block;
  @apply m-0;
  @apply py-3 px-0.5;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply text-left;
  @apply bg-transparent;
}
.place-search__location-retry::after {
  @apply border-0;
}
.place-search__state button {
  @apply m-0;
  @apply text-app-brand;
  @apply text-size-xs;
  @apply bg-transparent;
}
</style>
