<script lang="ts" setup>
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { HomeBanner, HomeContent, HomeEntryKind, PublicHouseSearchPreset } from '@/domain/home-content'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref, watch } from 'vue'
import { EMPTY_HOME_CONTENT, getHomeBannerRoute, getHomeEntryDetailRoute, getHomeEntryListRoute, getPublicHouseMapRoute, getPublicHouseSearchRoute } from '@/domain/home-content'
import HouseCard from '@/components/house/HouseCard.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppWaterfallList from '@/components/app/AppWaterfallList.vue'
import HomeDiscoverySections from '@/features/home/components/HomeDiscoverySections.vue'
import HomeSearchPanel from '@/features/home/components/HomeSearchPanel.vue'
import { getHomeContent } from '@/features/home/service'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { getLocatedPublicHouseRegion, getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { APP_ROUTES, getHouseDetailRoute, getLoginRoute } from '@/modules/routes'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { useAppContextStore } from '@/store/app-context-v2'
import { usePublicHouseRegionStore } from '@/store/public-house-region'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

defineOptions({ name: 'Home' })
definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页',
    enablePullDownRefresh: true,
  },
})

const appContextStore = useAppContextStore()
const regionStore = usePublicHouseRegionStore()
const homeSearchPreset = ref<PublicHouseSearchPreset>({ listing_type: 'whole' })
const homeNearbyPreset = ref<PublicHouseSearchPreset>({})
watch(() => regionStore.scopeKey, () => homeNearbyPreset.value = {}, { flush: 'sync' })
const spatialFilter = usePublicHouseSpatialFilter(1000)
const houseFavorites = useHouseCardFavorites()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
type RecommendationMode = 'recommended' | 'nearby' | 'latest' | 'low-price'
const recommendationMode = ref<RecommendationMode>('recommended')
const recommendationFilters = ref<PublicHouseFiltersOut | null>(null)
const showRecommendationFilters = ref(false)
const locatingNearby = ref(false)
const homeContent = ref<HomeContent>({
  banners: [...EMPTY_HOME_CONTENT.banners],
  topics: [...EMPTY_HOME_CONTENT.topics],
  guides: [...EMPTY_HOME_CONTENT.guides],
})
const homeContentLoading = ref(true)
const nearbyRadiusM = 1000
const recommendationQuery = reactive({
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  elevatorOnly: false,
})
const recommendationFilterDraft = reactive({ ...recommendationQuery })
const activeFilterCount = computed(() => [recommendationQuery.minRent, recommendationQuery.maxRent, recommendationQuery.minArea, recommendationQuery.maxArea, recommendationQuery.bedrooms, recommendationQuery.elevatorOnly].filter(Boolean).length)

function recommendationRequestParams(page: number, pageSize: number): PublicHousesUsingGetParams {
  return {
    min_rent: recommendationQuery.minRent,
    max_rent: recommendationQuery.maxRent,
    min_area: recommendationQuery.minArea,
    max_area: recommendationQuery.maxArea,
    bedrooms: recommendationQuery.bedrooms === '' ? undefined : Number(recommendationQuery.bedrooms),
    has_elevator_access: recommendationQuery.elevatorOnly ? true : undefined,
    ...spatialFilter.requestParams.value,
    sort: recommendationMode.value === 'nearby' ? 'distance_asc' : recommendationMode.value === 'low-price' ? 'rent_asc' : 'latest',
    page,
    page_size: pageSize,
  }
}

const recommendationPage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize }) => listPublicHouses(recommendationRequestParams(page, pageSize)),
  pageSize: 4,
  refreshOnShow: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const recommendationSummary = computed(() => {
  if (!recommendationPage.total.value)
    return '向下浏览更多公开房源'
  const prefix = ({
    'recommended': '持续更新',
    'nearby': `附近 ${Number(spatialFilter.nearbyRadiusM.value || nearbyRadiusM) / 1000} 公里`,
    'latest': '最新发布',
    'low-price': '租金由低到高',
  } as const)[recommendationMode.value]
  return `${prefix} · ${recommendationPage.total.value} 套公开房源`
})

async function selectRecommendationMode(mode: RecommendationMode) {
  if (mode !== 'nearby') {
    spatialFilter.exitNearby()
    recommendationMode.value = mode
    void recommendationPage.refresh()
    return
  }
  if (locatingNearby.value)
    return
  if (spatialFilter.nearbyLocation.value) {
    spatialFilter.enterNearby(spatialFilter.nearbyLocation.value, nearbyRadiusM)
    recommendationMode.value = 'nearby'
    void recommendationPage.refresh()
    return
  }

  locatingNearby.value = true
  try {
    const location = await getCurrentLocationGcj02()
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, nearbyRadiusM)
    recommendationMode.value = 'nearby'
    void recommendationPage.refresh()
  }
  catch (error) {
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能查看附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    // #endif
  }
  finally {
    locatingNearby.value = false
  }
}

function openRecommendationFilters() {
  Object.assign(recommendationFilterDraft, recommendationQuery)
  showRecommendationFilters.value = true
  if (!recommendationFilters.value)
    void getPublicHouseFilters().then(result => recommendationFilters.value = result).catch(() => undefined)
}

function applyRecommendationFilters() {
  Object.assign(recommendationQuery, recommendationFilterDraft)
  showRecommendationFilters.value = false
  void recommendationPage.refresh()
}

function resetRecommendationFilters() {
  Object.assign(recommendationFilterDraft, {
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    elevatorOnly: false,
  })
}

function handleRegionChange() {
  if (recommendationMode.value === 'nearby')
    recommendationMode.value = 'recommended'
  void recommendationPage.refresh()
}

function goFindHouse(preset: PublicHouseSearchPreset = {}) {
  uni.navigateTo({ url: getPublicHouseSearchRoute(preset) })
}

function openKeywordSearch(preset: PublicHouseSearchPreset = homeSearchPreset.value) {
  const values = [
    ['city', preset.nearby ? preset.place_city : regionStore.selection.city],
    ['listing_type', preset.listing_type],
    ['bedrooms', preset.bedrooms],
    ['bedrooms_min', preset.bedrooms_min],
    ['nearby', preset.nearby],
    ['longitude', preset.longitude],
    ['latitude', preset.latitude],
    ['radius_m', preset.radius_m],
    ['location_label', preset.place_name],
    ['place_name', preset.place_name],
    ['place_city', preset.place_city],
  ]
  const params = values.filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`).join('&')
  uni.navigateTo({ url: `${APP_ROUTES.publicHouseSearchInput}?${params}` })
}

async function locateHomeNearby() {
  if (locatingNearby.value)
    return
  locatingNearby.value = true
  const scopeKey = regionStore.scopeKey
  let retryAfterSettings = false
  try {
    const location = await getCurrentLocationGcj02()
    if (scopeKey !== regionStore.scopeKey)
      return
    homeNearbyPreset.value = { nearby: 1, ...location, radius_m: nearbyRadiusM, place_name: '当前位置' }
    const locatedPreset = homeNearbyPreset.value
    void getLocatedPublicHouseRegion({ ...location, coordinate_system: 'gcj02' }).then((located) => {
      if (homeNearbyPreset.value !== locatedPreset)
        return
      homeNearbyPreset.value = {
        ...locatedPreset,
        place_name: [located.city, located.district].filter(Boolean).join(' · ') || '当前位置',
        place_city: located.city,
      }
    }).catch(() => undefined)
  }
  catch (error) {
    // #ifdef MP-WEIXIN
    const settings = await uni.getSetting().catch(() => null)
    if (settings?.authSetting['scope.userLocation'] === false) {
      const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能搜索附近房源。', confirmText: '去设置' })
      if (modal.confirm) {
        const updatedSettings = await uni.openSetting()
        retryAfterSettings = updatedSettings.authSetting['scope.userLocation'] === true
      }
    }
    else {
      uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    }
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    // #endif
  }
  finally {
    locatingNearby.value = false
    if (retryAfterSettings)
      void locateHomeNearby()
  }
}

function goNearbyFindHouse(preset: PublicHouseSearchPreset = {}) {
  goFindHouse({ ...preset, nearby: 1 })
}

function goCommuteFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.houseCommute })
}

function openAllRecommendations() {
  if (recommendationMode.value === 'nearby') {
    goNearbyFindHouse()
    return
  }
  goFindHouse({ sort: recommendationMode.value === 'low-price' ? 'rent_asc' : 'latest' })
}

function updateHomeSearchPreset(preset: PublicHouseSearchPreset) {
  homeSearchPreset.value = preset
}

function goMapFindHouse(preset: PublicHouseSearchPreset = {}) {
  uni.navigateTo({ url: getPublicHouseMapRoute(preset) })
}

function openHomeBanner(banner: HomeBanner) {
  const url = getHomeBannerRoute(banner)
  if (url)
    uni.navigateTo({ url })
  else
    uni.showToast({ title: '该内容暂不可用', icon: 'none' })
}

function openHomeEntry(slug: string) {
  uni.navigateTo({ url: getHomeEntryDetailRoute(slug) })
}

function openHomeEntryList(kind: HomeEntryKind) {
  uni.navigateTo({ url: getHomeEntryListRoute(kind) })
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

function goFavorites() {
  if (appContextStore.authenticated)
    uni.switchTab({ url: '/pages/favorites/index' })
  else
    uni.navigateTo({ url: getLoginRoute(APP_ROUTES.favorites) })
}

function getImageRatio(house: PublicHouseListOut, index: number) {
  return (house.id + index) % 5 === 0 ? 'tall' : 'standard'
}

function getHouseWeight(house: PublicHouseListOut, index: number) {
  return getImageRatio(house, index) === 'tall' ? 1.25 : 1
}

function retryRecommendations() {
  void recommendationPage.refresh()
}

async function refreshHomeContent() {
  try {
    homeContent.value = await getHomeContent()
  }
  catch {
    homeContent.value = {
      banners: [],
      topics: [],
      guides: [],
    }
  }
  finally {
    homeContentLoading.value = false
  }
}

onShow(async () => {
  if (spatialFilter.scopeMode.value === 'nearby')
    recommendationMode.value = 'nearby'
  else if (recommendationMode.value === 'nearby')
    recommendationMode.value = 'recommended'
  await regionStore.initializeDefaultRegion()
  await Promise.all([refreshHomeContent(), recommendationPage.refresh(), houseFavorites.refreshFavorites()])
})
</script>

<template>
  <AppPage class="home-page" tabbar>
    <template #navigation>
      <AppCustomNavigation title="" align="start" scroll-mode="fade" immersive :scrolled="navigationScrolled" :scroll-progress="navigationProgress">
        <template #content>
          <view class="home-navigation__finder">
            <PublicHouseRegionTrigger variant="surface" @change="handleRegionChange" />
            <button
              class="home-navigation__search app-touchable"
              :class="{ 'home-navigation__search--visible': navigationScrolled }"
              :aria-hidden="!navigationScrolled"
              hover-class="app-touchable--pressed"
              @click="openKeywordSearch()"
            >
              <view class="i-carbon-search" />
              <text>搜索小区、区域或房源</text>
            </button>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <view class="home-featured">
      <HomeDiscoverySections
        section="intro"
        :banners="homeContent.banners"
        :topics="homeContent.topics"
        :loading="homeContentLoading"
        @banner="openHomeBanner"
        @entry="openHomeEntry"
      />
      <view class="home-featured__search">
        <HomeSearchPanel
          :locating-nearby="locatingNearby"
          :nearby-preset="homeNearbyPreset"
          @change="updateHomeSearchPreset"
          @keyword="openKeywordSearch"
          @search="goFindHouse"
          @nearby="locateHomeNearby"
          @clear-nearby="homeNearbyPreset = {}"
          @map="goMapFindHouse"
        />
      </view>
    </view>

    <view class="home-shortcuts">
      <button class="home-shortcut app-touchable" hover-class="app-touchable--pressed" @click="goMapFindHouse(homeSearchPreset)">
        <view class="home-shortcut__icon home-shortcut__icon--map">
          <view class="i-carbon-map" />
        </view>
        <text>地图找房</text>
      </button>
      <button class="home-shortcut app-touchable" hover-class="app-touchable--pressed" @click="goFindHouse({ location_mode: 'metro' })">
        <view class="home-shortcut__icon home-shortcut__icon--metro">
          <view class="i-carbon-train" />
        </view>
        <text>地铁找房</text>
      </button>
      <button class="home-shortcut app-touchable" hover-class="app-touchable--pressed" @click="goCommuteFindHouse">
        <view class="home-shortcut__icon home-shortcut__icon--commute">
          <view class="i-carbon-direction-straight-right" />
        </view>
        <text>通勤找房</text>
      </button>
      <button class="home-shortcut app-touchable" hover-class="app-touchable--pressed" @click="goNearbyFindHouse(homeSearchPreset)">
        <view class="home-shortcut__icon home-shortcut__icon--nearby">
          <view class="i-carbon-location-current" />
        </view>
        <text>附近房源</text>
      </button>
    </view>

    <view class="recommendation-feed">
      <view class="section-heading">
        <view>
          <text class="section-heading__eyebrow">DISCOVER HOMES</text>
          <text class="section-heading__title">发现好房</text>
          <text class="section-heading__subtitle">{{ recommendationSummary }}</text>
        </view>
        <button class="favorites-link" @click="goFavorites">
          <view class="i-carbon-bookmark" /><text>我的收藏</text>
        </button>
      </view>

      <scroll-view class="recommendation-filters" scroll-x :show-scrollbar="false">
        <view class="recommendation-filters__row">
          <button class="recommendation-filter" :class="{ 'recommendation-filter--active': recommendationMode === 'recommended' }" @click="selectRecommendationMode('recommended')">
            <view class="i-carbon-favorite" /><text>猜你喜欢</text>
          </button>
          <button class="recommendation-filter" :class="{ 'recommendation-filter--active': recommendationMode === 'nearby' }" @click="selectRecommendationMode('nearby')">
            <view class="i-carbon-location-current" /><text>{{ locatingNearby ? '定位中…' : '附近' }}</text>
          </button>
          <button class="recommendation-filter" :class="{ 'recommendation-filter--active': recommendationMode === 'latest' }" @click="selectRecommendationMode('latest')">
            <view class="i-carbon-recently-viewed" /><text>最新</text>
          </button>
          <button class="recommendation-filter" :class="{ 'recommendation-filter--active': recommendationMode === 'low-price' }" @click="selectRecommendationMode('low-price')">
            <view class="i-carbon-currency-yen" /><text>低价</text>
          </button>
          <button class="recommendation-filter" :class="{ 'recommendation-filter--active': activeFilterCount }" @click="openRecommendationFilters">
            <view class="i-carbon-filter" /><text>筛选{{ activeFilterCount ? ` ${activeFilterCount}` : '' }}</text><view class="i-carbon-chevron-down" />
          </button>
        </view>
      </scroll-view>

      <AppWaterfallList
        :items="recommendationPage.items.value"
        item-key="id"
        :item-weight="getHouseWeight"
        :loading="recommendationPage.loading.value"
        :loading-more="recommendationPage.loadingMore.value"
        :finished="recommendationPage.finished.value"
        :error="recommendationPage.error.value"
        loading-text="正在发现更多好房…"
        empty-text="暂时没有新上架房源"
        empty-description="可以使用条件找房或地图找房，查看更适合你的房源。"
        empty-icon="no-content"
        empty-action-text="条件找房"
        finished-text="今天的好房已经看完了"
        @retry="retryRecommendations"
        @empty-action="goFindHouse()"
      >
        <template #loading>
          <AppHouseCardSkeleton :count="4" variant="waterfall" />
        </template>
        <template #loadmore />
        <template #item="{ item, index }">
          <HouseCard
            :house="item"
            variant="waterfall"
            :image-ratio="getImageRatio(item, index)"
            favorite-visible
            :favorited="houseFavorites.isFavorited(item.id)"
            :favorite-loading="houseFavorites.isLoading(item.id)"
            @click="openHouse(item.id)"
            @favorite="houseFavorites.toggleFavorite(item.id)"
          />
        </template>
      </AppWaterfallList>

      <button class="recommendation-more app-touchable" hover-class="app-touchable--pressed" @click="openAllRecommendations">
        查看全部房源 <view class="i-carbon-arrow-right" />
      </button>

      <AppBottomSheet v-model:visible="showRecommendationFilters" title="筛选推荐房源" height="tall" :z-index="1100">
        <view>
          <view class="filter-label">
            <view class="i-carbon-currency-yen" /><text>租金范围（元/月）</text>
          </view>
          <view class="filter-pair">
            <wd-input v-model="recommendationFilterDraft.minRent" type="number" placeholder="最低租金" />
            <text>至</text>
            <wd-input v-model="recommendationFilterDraft.maxRent" type="number" placeholder="最高租金" />
          </view>
          <view class="filter-label">
            <view class="i-carbon-ruler" /><text>面积范围（㎡）</text>
          </view>
          <view class="filter-pair">
            <wd-input v-model="recommendationFilterDraft.minArea" type="digit" placeholder="最小面积" />
            <text>至</text>
            <wd-input v-model="recommendationFilterDraft.maxArea" type="digit" placeholder="最大面积" />
          </view>
          <view class="filter-label">
            <view class="i-carbon-hotel" /><text>卧室数量</text>
          </view>
          <view class="choice-row">
            <wd-tag :type="recommendationFilterDraft.bedrooms === '' ? 'primary' : 'default'" variant="light" @click="recommendationFilterDraft.bedrooms = ''">
              不限
            </wd-tag>
            <wd-tag v-for="item in recommendationFilters?.bedrooms || []" :key="item" :type="recommendationFilterDraft.bedrooms === item ? 'primary' : 'default'" variant="light" @click="recommendationFilterDraft.bedrooms = item">
              {{ item }} 室
            </wd-tag>
          </view>
          <view class="switch-row">
            <view class="switch-row__label">
              <view class="i-carbon-building" /><text>只看有电梯</text>
            </view>
            <wd-switch v-model="recommendationFilterDraft.elevatorOnly" />
          </view>
        </view>
        <template #footer>
          <view class="grid grid-cols-[1fr_1.5fr] w-full gap-2">
            <wd-button block variant="plain" @click="resetRecommendationFilters">
              重置
            </wd-button>
            <wd-button block @click="applyRecommendationFilters">
              更新当前瀑布流
            </wd-button>
          </view>
        </template>
      </AppBottomSheet>
    </view>

    <HomeDiscoverySections
      section="content"
      :guides="homeContent.guides"
      :loading="homeContentLoading"
      @entry="openHomeEntry"
      @list="openHomeEntryList"
    />
  </AppPage>
</template>

<style scoped lang="scss">
.home-page {
  background: linear-gradient(180deg, #edf5fb 0, #f6f8fa 480rpx, #f6f8fa 100%);
}

:deep(.home-page .app-page__content) {
  padding-top: 0;
}

.home-navigation__finder {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
}

:deep(.home-navigation__finder .public-house-region-trigger) {
  min-height: 58rpx;
  padding: 0 17rpx;
  border: 1rpx solid rgb(255 255 255 / 65%);
  background: rgb(255 255 255 / 92%);
  color: #24445e;
  box-shadow: 0 8rpx 22rpx rgb(3 48 90 / 16%);
}

.home-navigation__search {
  display: flex;
  min-width: 0;
  height: 68rpx;
  flex: 1;
  align-items: center;
  gap: 12rpx;
  margin: 0;
  padding: 0 20rpx;
  border: 1rpx solid #e5edf4;
  border-radius: 34rpx;
  box-sizing: border-box;
  background: #fff;
  color: #93a1af;
  font-size: 21rpx;
  line-height: 68rpx;
  text-align: left;
  box-shadow: 0 5rpx 20rpx rgb(29 62 93 / 7%);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--app-motion-duration-fast) linear;
}

.home-navigation__search--visible {
  opacity: 1;
  pointer-events: auto;
}

.home-navigation__search::after,
.home-shortcut::after,
.favorites-link::after,
.recommendation-filter::after,
.recommendation-more::after {
  border: 0;
}
.home-navigation__search view {
  flex: none;
  color: #1678cf;
  font-size: 28rpx;
}
.home-navigation__search text {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-featured {
  margin-top: 0;
}
.home-featured__search {
  position: relative;
  z-index: 2;
  margin-top: -112rpx;
}

.home-shortcuts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4rpx;
  margin-top: 16rpx;
  padding: 10rpx 6rpx;
  border: 1rpx solid #e7edf2;
  border-radius: 22rpx;
  background: #fff;
}
.home-shortcut {
  display: flex;
  min-width: 0;
  min-height: 112rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #4e6376;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 1.3;
}
.home-shortcut text {
  white-space: nowrap;
}
.home-shortcut__icon {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  background: #e9f3fb;
  color: #267ac0;
}
.home-shortcut__icon view {
  font-size: 32rpx;
}

.recommendation-feed {
  margin: 38rpx calc(var(--app-page-gutter) * -1) 0;
  padding: 0 var(--app-page-gutter);
}
.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 0 0 22rpx;
}
.section-heading > view {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
}
.section-heading__title {
  color: #20384c;
  font-size: 34rpx;
  font-weight: 750;
  line-height: 1.3;
}
.section-heading__subtitle {
  color: #8a9aaa;
  font-size: 21rpx;
}
.favorites-link {
  display: flex;
  width: auto;
  flex: 0 0 auto;
  height: 50rpx;
  align-items: center;
  gap: 6rpx;
  margin: 0 0 2rpx;
  padding: 0 4rpx;
  background: transparent;
  color: #527c9e;
  font-size: 20rpx;
  font-weight: 600;
  line-height: 50rpx;
}
.favorites-link view {
  font-size: 22rpx;
}

.recommendation-filters {
  width: calc(100% + var(--app-page-gutter));
  margin: 0 0 20rpx;
  white-space: nowrap;
}
.recommendation-filters__row {
  display: inline-flex;
  gap: 10rpx;
  padding-right: var(--app-page-gutter);
}
.recommendation-filter {
  display: inline-flex;
  width: auto;
  height: 58rpx;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  margin: 0;
  padding: 0 19rpx;
  border: 1rpx solid #e5ebf0;
  border-radius: 29rpx;
  background: #fff;
  color: #617487;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 58rpx;
}
.recommendation-filter--active {
  border-color: #b8d9f1;
  background: #eaf4fb;
  color: #176eb7;
  font-weight: 700;
}
.recommendation-filter view {
  font-size: 20rpx;
}

.recommendation-more {
  display: flex;
  width: 100%;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  margin: 22rpx 0 0;
  border: 1rpx solid #dce8f1;
  border-radius: 18rpx;
  background: #fff;
  color: #176eb7;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 72rpx;
}
.recommendation-more view {
  font-size: 23rpx;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin: 32rpx 0 16rpx;
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 600;
}
.filter-label > view,
.switch-row__label > view {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 28rpx;
}
.filter-pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 16rpx;
}
.choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 34rpx;
  padding: 24rpx;
  border-radius: 18rpx;
  background: var(--app-bg-page);
}
.switch-row__label {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
</style>
