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
import { getCurrentLocationGcj02 } from '@/utils/location'

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

async function loadNearby() {
  const generation = ++locationGeneration
  locating.value = true
  locationError.value = false
  try {
    const current = await getCurrentLocationGcj02()
    if (generation !== locationGeneration)
      return
    location.value = current
    nearbyPlaces.value = await getNearbyCommutePlaces(current)
    if (generation === locationGeneration && keyword.value.trim().length >= 2)
      search(keyword.value)
  }
  catch {
    if (generation === locationGeneration)
      locationError.value = true
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

    <view class="place-search__field">
      <view class="i-carbon-search place-search__search-icon" />
      <wd-input v-model="keyword" focus clearable compact :maxlength="80" confirm-type="search" placeholder="请输入上班地点" />
    </view>
    <template v-if="keyword.trim()">
      <view v-if="searching" class="place-search__state">
        <AppLoading text="正在搜索地点…" />
      </view>
      <view v-else-if="error" class="place-search__state">
        <text>{{ error }}</text>
        <button @click="search(keyword)">
          重新搜索
        </button>
      </view>
      <view v-else-if="places.length" class="place-search__section">
        <text class="place-search__result-heading">搜索结果</text>
        <button v-for="place in places" :key="place.token" class="place-search__result" @click="choosePlace(place)">
          <view class="i-carbon-location place-search__result-icon" />
          <view class="place-search__result-copy">
            <strong>{{ place.name }}</strong>
            <text>{{ place.city }} · {{ place.address || place.name }}</text>
          </view>
          <text v-if="place.distance_m != null" class="place-search__distance">{{ distanceLabel(place.distance_m) }}</text>
        </button>
      </view>
      <view v-else-if="searched" class="place-search__state">
        <text>没有找到地点，试试更完整的名称</text>
      </view>
      <text v-else class="place-search__tip">输入至少 2 个字，选择准确的地点</text>
    </template>
    <template v-else>
      <view v-if="history.length" class="place-search__section">
        <text class="place-search__result-heading">历史上班地点</text>
        <button v-for="place in history" :key="place.destinationId" class="place-search__result" @click="choosePlace(place)">
          <view class="i-carbon-recently-viewed place-search__result-icon" />
          <view class="place-search__result-copy">
            <strong>{{ place.name }}</strong>
            <text>{{ place.city }} · {{ place.address || place.name }}</text>
          </view>
          <view v-if="place.destinationId === selectedId" class="i-carbon-checkmark place-search__selected" />
        </button>
      </view>
      <view class="place-search__section">
        <text class="place-search__result-heading">你可能在这里上班</text>
        <button v-if="nearbyPlaces.length" class="place-search__result place-search__result--current" @click="choosePlace(nearbyPlaces[0])">
          <view class="i-carbon-location-current place-search__result-icon" />
          <view class="place-search__result-copy">
            <strong>{{ nearbyPlaces[0].name }}</strong>
            <text>{{ nearbyPlaces[0].city }} · {{ nearbyPlaces[0].address || nearbyPlaces[0].name }}</text>
          </view>
          <text class="place-search__distance">当前位置附近</text>
        </button>
        <button v-for="place in nearbyPlaces.slice(1)" :key="place.token" class="place-search__result" @click="choosePlace(place)">
          <view class="i-carbon-location place-search__result-icon" />
          <view class="place-search__result-copy">
            <strong>{{ place.name }}</strong>
            <text>{{ place.city }} · {{ place.address || place.name }}</text>
          </view>
          <text class="place-search__distance">{{ distanceLabel(place.distance_m) }}</text>
        </button>
        <view v-if="locating" class="place-search__state">
          <AppLoading text="正在查找附近地点…" />
        </view>
        <button v-else-if="locationError" class="place-search__location-retry" @click="loadNearby">
          定位不可用，点击重试
        </button>
        <text v-else-if="!nearbyPlaces.length" class="place-search__empty">附近暂无推荐地点，可在上方搜索</text>
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.place-search__field {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  gap: 16rpx;
  padding: 0 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.place-search__section {
  margin-top: 40rpx;
}
.place-search__search-icon {
  color: var(--app-text-muted);
  font-size: 30rpx;
}
.place-search__field :deep(.wd-input) {
  min-width: 0;
  flex: 1;
}
.place-search__tip {
  display: block;
  margin: 18rpx 4rpx 28rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.place-search__result-heading {
  display: block;
  margin: 0 4rpx 12rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.place-search__result {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  gap: 18rpx;
  margin: 0;
  padding: 18rpx 8rpx;
  border: 0;
  border-bottom: 1rpx solid var(--app-divider-color);
  border-radius: 0;
  text-align: left;
  background: transparent;
}
.place-search__result--current {
  margin-bottom: 12rpx;
  padding: 18rpx 14rpx;
  border: 0;
  border-radius: 14rpx;
  background: var(--app-bg-page);
}
.place-search__result::after,
.place-search__state button::after {
  border: 0;
}
.place-search__result-icon {
  color: var(--app-color-brand);
  font-size: 32rpx;
}
.place-search__result-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.place-search__result-copy strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 26rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.place-search__result-copy text {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.place-search__distance,
.place-search__selected {
  flex-shrink: 0;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.place-search__selected {
  color: var(--app-color-brand);
  font-size: 28rpx;
}
.place-search__empty,
.place-search__location-retry {
  display: block;
  margin: 0;
  padding: 24rpx 4rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: left;
  background: transparent;
}
.place-search__location-retry::after {
  border: 0;
}
.place-search__state {
  display: flex;
  min-height: 180rpx;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.place-search__state button {
  margin: 0;
  color: var(--app-color-brand);
  font-size: 23rpx;
  background: transparent;
}
</style>
