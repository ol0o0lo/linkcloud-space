<script setup lang="ts">
import type { PublicHouseSuggestion } from '@/features/houses/service'
import type { PublicHouseSearchPreset } from '@/domain/home-content'
import type { CommutePlace } from '@/services/manual/house-commute'
import { onLoad, onReady, onUnload } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { getPublicHouseSuggestions } from '@/features/houses/service'
import { searchCommutePlaces } from '@/services/manual/house-commute'
import { getPublicHouseSearchRoute, parsePublicHouseSearchPreset } from '@/domain/home-content'
import { APP_ROUTES } from '@/modules/routes'

definePage({
  style: { navigationBarTitleText: '搜索房源', navigationStyle: 'custom' },
})

interface OpenerPage {
  getOpenerEventChannel?: () => { emit: (event: string, value: string | CommutePlace) => void }
}

const keyword = ref('')
const city = ref('')
const nearbyLabel = ref('')
const searchPreset = ref<PublicHouseSearchPreset>({})
const nearby = computed(() => searchPreset.value.nearby === 1 && searchPreset.value.latitude !== undefined && searchPreset.value.longitude !== undefined)
const inputFocused = ref(false)
const returnToResults = ref(false)
const suggestions = ref<PublicHouseSuggestion[]>([])
const places = ref<CommutePlace[]>([])
const loading = ref(false)
const error = ref(false)
const placesLoading = ref(false)
const placesError = ref(false)
const term = computed(() => keyword.value.trim())
const showHouseSection = computed(() => (!term.value && nearby.value) || Boolean(term.value && (loading.value || error.value || suggestions.value.length || (!places.value.length && !placesLoading.value))))
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchVersion = 0

function decodeRouteValue(value: unknown): string {
  const text = String(value || '')
  try {
    return decodeURIComponent(text)
  }
  catch {
    return text
  }
}

watch([keyword, searchPreset, city], () => {
  clearTimeout(searchTimer)
  const version = ++searchVersion
  suggestions.value = []
  places.value = []
  error.value = false
  placesError.value = false
  placesLoading.value = false
  const nextTerm = keyword.value.trim()
  if (!nextTerm && !nearby.value) {
    loading.value = false
    return
  }
  loading.value = true
  searchTimer = setTimeout(async () => {
    if (nextTerm.length >= 2) {
      placesLoading.value = true
      void searchCommutePlaces(nextTerm, city.value).then((result) => {
        if (version === searchVersion)
          places.value = result.filter(place => Number.isFinite(place.longitude) && Number.isFinite(place.latitude))
      }).catch(() => {
        if (version === searchVersion)
          placesError.value = true
      }).finally(() => {
        if (version === searchVersion)
          placesLoading.value = false
      })
    }
    try {
      const houseFilters = {
        listing_type: searchPreset.value.listing_type,
        bedrooms: searchPreset.value.bedrooms,
        bedrooms_min: searchPreset.value.bedrooms_min,
      }
      const result = await getPublicHouseSuggestions(nearby.value
        ? {
            keyword: nextTerm,
            longitude: searchPreset.value.longitude,
            latitude: searchPreset.value.latitude,
            radius_m: searchPreset.value.radius_m || 1000,
            coordinate_system: 'gcj02',
            ...houseFilters,
          }
        : { keyword: nextTerm, city: city.value || undefined, ...houseFilters })
      if (version === searchVersion)
        suggestions.value = result
    }
    catch {
      if (version === searchVersion)
        error.value = true
    }
    finally {
      if (version === searchVersion)
        loading.value = false
    }
  }, 250)
})

function submitHouseSearch(value = keyword.value) {
  const selectedKeyword = value.trim()
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
  const channel = currentPage?.getOpenerEventChannel?.()
  uni.hideKeyboard()
  if (returnToResults.value && channel) {
    channel.emit('applyKeyword', selectedKeyword)
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: getPublicHouseSearchRoute({ ...searchPreset.value, keyword: selectedKeyword }) })
}

function choosePlace(place: CommutePlace) {
  if (!Number.isFinite(place.longitude) || !Number.isFinite(place.latitude))
    return
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1] as unknown as OpenerPage | undefined
  const channel = currentPage?.getOpenerEventChannel?.()
  uni.hideKeyboard()
  if (returnToResults.value && channel) {
    channel.emit('applyPlace', place)
    uni.navigateBack()
    return
  }
  uni.redirectTo({
    url: getPublicHouseSearchRoute({
      ...searchPreset.value,
      keyword: undefined,
      nearby: 1,
      longitude: place.longitude,
      latitude: place.latitude,
      radius_m: searchPreset.value.radius_m || 1000,
      place_name: place.name,
      place_city: place.city,
    }),
  })
}

async function submitSearch() {
  const value = keyword.value.trim()
  if (value.length < 2) {
    submitHouseSearch(value)
    return
  }
  try {
    const candidates = await searchCommutePlaces(value, city.value)
    const exact = candidates.filter(place => place.name === value)
    if (exact.length === 1 || candidates.length === 1) {
      choosePlace(exact.length === 1 ? exact[0] : candidates[0])
      return
    }
    if (candidates.length) {
      places.value = candidates
      uni.hideKeyboard()
      uni.showToast({ title: '请选择具体地点', icon: 'none' })
      return
    }
  }
  catch {
    // 地图地点服务不可用时，仍允许按房源字段搜索。
  }
  submitHouseSearch(value)
}

onLoad((options) => {
  returnToResults.value = options?.from === 'house-search'
  city.value = decodeRouteValue(options?.city)
  nearbyLabel.value = decodeRouteValue(options?.location_label)
  keyword.value = decodeRouteValue(options?.keyword)
  searchPreset.value = parsePublicHouseSearchPreset((options || {}) as Record<string, string | undefined>)
})

onReady(() => inputFocused.value = !nearby.value)

onUnload(() => {
  searchVersion += 1
  clearTimeout(searchTimer)
})
</script>

<template>
  <AppPage class="house-keyword-page">
    <template #navigation>
      <AppCustomNavigation title="" align="start" back scroll-mode="sticky" :fallback-url="APP_ROUTES.publicHouseSearch">
        <template #content>
          <view class="keyword-navigation min-w-0 w-full flex items-center gap-1.5">
            <view class="keyword-search-bar box-border h-8 min-w-0 flex flex-1 items-center gap-1.5 border-hairline border-hex-1677ff/10 rounded-4.5 border-solid bg-hex-f3f7fd px-2 py-0">
              <view class="i-carbon-search keyword-search-icon flex-none text-size-base text-content-muted" />
              <view class="keyword-search-input min-w-0 flex-1">
                <wd-input v-model="keyword" compact :focus="inputFocused" placeholder="搜索地点、小区或房源" clearable confirm-type="search" @confirm="submitSearch()" />
              </view>
            </view>
            <button class="keyword-search-submit m-0 flex-none bg-transparent px-0.5 py-0 text-size-xs text-app-brand font-semibold leading-8" @click="submitSearch()">
              搜索
            </button>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view v-if="nearby" class="keyword-search-hint px-0.5 py-3 text-size-xs text-content-muted">
      {{ nearbyLabel || searchPreset.place_name || '当前位置' }}附近 {{ searchPreset.radius_m || 1000 }} 米内的房源
    </view>
    <view v-else-if="!term" class="keyword-search-hint px-0.5 py-3 text-size-xs text-content-muted">
      输入地点、小区、商圈或房号开始搜索
    </view>
    <view v-if="term.length >= 2" class="keyword-suggestions mt-0.5">
      <view class="keyword-suggestions__heading pb-1.5 text-size-xs text-content-secondary font-semibold">
        地点
      </view>
      <view v-if="placesLoading" class="keyword-suggestions__status px-0 py-3.5 text-size-xs text-content-muted">
        正在查找地点…
      </view>
      <view v-else-if="placesError" class="keyword-suggestions__status px-0 py-3.5 text-size-xs text-content-muted">
        地点暂不可用，仍可按房源名称搜索
      </view>
      <button v-for="place in places" :key="place.token" class="keyword-suggestions__item m-0 min-h-14 w-full flex items-center gap-2.5 border-b-hairline border-b-app-border rounded-0 border-b-solid bg-transparent px-0.5 py-2.5 text-left" @click="choosePlace(place)">
        <view class="i-carbon-location keyword-suggestions__icon flex-none text-size-sm text-content-muted" />
        <view class="keyword-suggestions__copy min-w-0 flex gap-1">
          <text class="keyword-suggestions__keyword overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-semibold">{{ place.name }}</text>
          <text class="keyword-suggestions__meta text-size-2xs text-content-muted">{{ place.city }} · {{ place.address || place.name }}</text>
        </view>
        <view class="i-carbon-arrow-up-right keyword-suggestions__arrow flex-none text-size-xs text-content-muted" />
      </button>
    </view>
    <view v-if="showHouseSection" class="keyword-suggestions mt-0.5">
      <view class="keyword-suggestions__heading pb-1.5 text-size-xs text-content-secondary font-semibold">
        {{ term ? '房源关键词' : '附近有房源的地点' }}
      </view>
      <view v-if="loading" class="keyword-suggestions__status px-0 py-3.5 text-size-xs text-content-muted">
        正在查找…
      </view>
      <view v-else-if="error" class="keyword-suggestions__status px-0 py-3.5 text-size-xs text-content-muted">
        联想词加载失败，请继续输入或直接搜索
      </view>
      <view v-else-if="!suggestions.length" class="keyword-suggestions__status px-0 py-3.5 text-size-xs text-content-muted">
        {{ nearby ? (term ? '当前位置附近暂无匹配房源名称' : '附近暂无公开房源，请返回使用其他条件') : '暂无匹配的房源名称' }}
      </view>
      <button v-for="item in suggestions" v-else :key="`${item.category}-${item.keyword}`" class="keyword-suggestions__item m-0 min-h-14 w-full flex items-center gap-2.5 border-b-hairline border-b-app-border rounded-0 border-b-solid bg-transparent px-0.5 py-2.5 text-left" @click="submitHouseSearch(item.keyword)">
        <view class="i-carbon-search keyword-suggestions__icon flex-none text-size-sm text-content-muted" />
        <view class="keyword-suggestions__copy min-w-0 flex gap-1">
          <text class="keyword-suggestions__keyword overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-semibold">{{ item.keyword }}</text>
          <text class="keyword-suggestions__meta text-size-2xs text-content-muted">{{ item.category }}{{ nearby && item.address ? ` · ${item.address}` : '' }} · {{ item.house_count }} 套房源</text>
        </view>
        <view class="i-carbon-arrow-up-right keyword-suggestions__arrow flex-none text-size-xs text-content-muted" />
      </button>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.house-keyword-page {
  @apply min-h-screen;
  @apply bg-hex-fff;
}
:deep(.keyword-search-input .wd-input) {
  @apply p-0;
  @apply bg-transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 60rpx;
  --wot-input-inner-font-size: 24rpx;
  --wot-input-padding: 0;
}
.keyword-search-submit::after,
.keyword-suggestions__item::after {
  @apply border-0;
}
.keyword-suggestions__copy {
  @apply flex-1;
  @apply flex-col;
}
</style>
