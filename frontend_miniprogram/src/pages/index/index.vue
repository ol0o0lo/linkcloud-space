<script lang="ts" setup>
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { HomeBanner, HomeContent, HomeEntryKind, PublicHouseSearchPreset } from '@/domain/home-content'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { EMPTY_HOME_CONTENT, getHomeBannerRoute, getHomeEntryDetailRoute, getHomeEntryListRoute, getPublicHouseSearchRoute } from '@/domain/home-content'
import HouseCard from '@/components/house/HouseCard.vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppWaterfallList from '@/components/app/AppWaterfallList.vue'
import HomeDiscoverySections from '@/features/home/components/HomeDiscoverySections.vue'
import { getHomeContent } from '@/features/home/service'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { APP_ROUTES, getHouseDetailRoute, getLoginRoute } from '@/modules/routes'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { useAppContextStore } from '@/store/app-context-v2'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

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
  pageSize: 10,
  refreshOnShow: false,
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
    const location = await uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, nearbyRadiusM)
    recommendationMode.value = 'nearby'
    void recommendationPage.refresh()
  }
  catch {
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能查看附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: '无法获取当前位置，请检查浏览器定位权限', icon: 'none' })
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

function goMapFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.houseMap })
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

function showReservedContent(title: string) {
  uni.showToast({ title: `${title}正在筹备中`, icon: 'none' })
}

function getImageRatio(house: PublicHouseListOut, index: number) {
  return (house.id + index) % 5 === 0 ? 'tall' : 'standard'
}

function getHouseWeight(house: PublicHouseListOut, index: number) {
  return getImageRatio(house, index) === 'tall' ? 1.25 : 1
}

function retryRecommendations() {
  void (recommendationPage.items.value.length ? recommendationPage.loadMore() : recommendationPage.refresh())
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
  <AppPage class="home-page" tabbar ai-background>
    <template #navigation>
      <AppCustomNavigation title="" align="start" scroll-mode="fade" :scrolled="navigationScrolled" :scroll-progress="navigationProgress">
        <template #content>
          <view class="home-navigation__finder">
            <PublicHouseRegionTrigger @change="handleRegionChange" />
            <button class="home-navigation__search app-touchable" hover-class="app-touchable--pressed" @click="goFindHouse()">
              <view class="i-carbon-search" />
              <text>搜索小区、地铁、商圈</text>
            </button>
          </view>
        </template>
      </AppCustomNavigation>
    </template>

    <HomeDiscoverySections
      :banners="homeContent.banners"
      :topics="homeContent.topics"
      :guides="homeContent.guides"
      :loading="homeContentLoading"
      @banner="openHomeBanner"
      @find="goFindHouse"
      @map="goMapFindHouse"
      @entry="openHomeEntry"
      @list="openHomeEntryList"
      @reserved="showReservedContent"
    />

    <view class="recommendation-feed">
      <view class="section-heading">
        <view>
          <text class="section-heading__title">为你推荐</text>
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
          <AppHouseCardSkeleton :count="6" variant="waterfall" />
        </template>
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
  </AppPage>
</template>

<style scoped lang="scss">
.home-navigation__finder {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 14rpx;
}

.home-navigation__search {
  display: flex;
  min-width: 0;
  height: 72rpx;
  flex: 1;
  margin: 0;
  padding: 0 22rpx;
  align-items: center;
  gap: 14rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 36rpx;
  box-sizing: border-box;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 72rpx;
  text-align: left;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.home-navigation__search view {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 28rpx;
}

.home-navigation__search text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-navigation__search::after {
  border: 0;
}

.finder-hero {
  position: relative;
  overflow: hidden;
  min-height: 402rpx;
  padding: 42rpx 42rpx 38rpx;
  border-radius: 44rpx;
  box-sizing: border-box;
  color: var(--app-text-on-brand);
  background: linear-gradient(145deg, rgb(0 129 255 / 96%), rgb(0 87 190 / 100%)), var(--app-gradient-personal);
  box-shadow: var(--app-shadow-hero-personal);
}
.finder-hero::after {
  position: absolute;
  right: -40rpx;
  bottom: -70rpx;
  width: 330rpx;
  height: 230rpx;
  border: 1rpx solid rgb(255 255 255 / 13%);
  border-radius: 50%;
  content: '';
  pointer-events: none;
  transform: rotate(-18deg);
}
.finder-hero__glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.finder-hero__glow--one {
  top: -160rpx;
  right: -90rpx;
  width: 390rpx;
  height: 390rpx;
  background: radial-gradient(circle, rgb(91 222 255 / 42%), transparent 68%);
}
.finder-hero__glow--two {
  bottom: -210rpx;
  left: -120rpx;
  width: 430rpx;
  height: 430rpx;
  background: radial-gradient(circle, rgb(107 87 232 / 30%), transparent 70%);
}
.finder-hero__eyebrow,
.finder-hero__title,
.finder-hero__copy,
.search-entry {
  position: relative;
  z-index: 1;
}
.finder-hero__eyebrow {
  display: inline-flex;
  min-height: 42rpx;
  align-items: center;
  padding: 0 18rpx;
  border: 1rpx solid rgb(255 255 255 / 24%);
  border-radius: 22rpx;
  font-size: 21rpx;
  font-weight: 700;
  background: rgb(255 255 255 / 12%);
}
.finder-hero__title {
  margin-top: 30rpx;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.28;
  letter-spacing: -1rpx;
}
.finder-hero__copy {
  max-width: 530rpx;
  margin-top: 16rpx;
  font-size: 23rpx;
  line-height: 1.5;
  opacity: 0.82;
}
.search-entry {
  display: flex;
  width: 100%;
  height: 82rpx;
  margin: 30rpx 0 0;
  padding: 0 24rpx;
  align-items: center;
  gap: 16rpx;
  border: 0;
  border-radius: 26rpx;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 82rpx;
  text-align: left;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 12rpx 32rpx rgb(0 51 112 / 18%);
}
.search-entry::after,
.finder-action::after,
.favorites-link::after {
  border: 0;
}
.search-entry__icon {
  color: var(--app-color-brand);
  font-size: 32rpx;
}
.search-entry text {
  min-width: 0;
  flex: 1;
}
.search-entry__arrow {
  color: var(--app-text-muted);
  font-size: 28rpx;
}
.finder-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 22rpx;
}
.finder-action {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 170rpx;
  margin: 0;
  padding: 26rpx;
  align-items: center;
  gap: 18rpx;
  overflow: hidden;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  line-height: 1;
  text-align: left;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.finder-action--map {
  align-items: flex-end;
  border-color: rgb(75 104 225 / 18%);
  background: linear-gradient(145deg, #f0f4ff, #e8efff);
}
.finder-action__icon {
  display: flex;
  width: 70rpx;
  height: 70rpx;
  flex: 0 0 70rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  font-size: 34rpx;
}
.finder-action__icon--list {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.finder-action__content {
  position: relative;
  z-index: 2;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
}
.finder-action__content--map {
  padding-top: 54rpx;
}
.finder-action strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
  line-height: 1.25;
}
.finder-action text {
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.4;
}
.finder-action__arrow {
  position: relative;
  z-index: 2;
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 27rpx;
}
.map-art {
  position: absolute;
  z-index: 0;
  top: 0;
  right: 0;
  left: 0;
  height: 105rpx;
  opacity: 0.95;
}
.map-art__road {
  position: absolute;
  height: 16rpx;
  border: 5rpx solid rgb(255 255 255 / 74%);
  border-right: 0;
  border-left: 0;
  background: rgb(90 117 223 / 12%);
}
.map-art__road--one {
  top: 24rpx;
  right: -30rpx;
  left: 45rpx;
  transform: rotate(-12deg);
}
.map-art__road--two {
  top: 60rpx;
  right: 30rpx;
  left: -28rpx;
  transform: rotate(18deg);
}
.map-art__pin {
  position: absolute;
  display: flex;
  width: 46rpx;
  height: 46rpx;
  align-items: center;
  justify-content: center;
  border: 4rpx solid #fff;
  border-radius: 50% 50% 50% 12rpx;
  color: #fff;
  font-size: 24rpx;
  background: #596fda;
  box-shadow: 0 8rpx 18rpx rgb(55 78 178 / 24%);
  transform: rotate(-45deg);
}
.map-art__pin view {
  transform: rotate(45deg);
}
.map-art__pin--one {
  top: 18rpx;
  right: 36rpx;
}
.map-art__pin--two {
  top: 46rpx;
  left: 38rpx;
  width: 38rpx;
  height: 38rpx;
  opacity: 0.76;
}
.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 52rpx 0 24rpx;
}
.section-heading > view {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.section-heading__title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.section-heading__subtitle {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.favorites-link {
  display: flex;
  width: auto;
  min-width: 0;
  height: 54rpx;
  margin: 0;
  padding: 0 18rpx;
  align-items: center;
  gap: 8rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 28rpx;
  color: var(--app-color-brand);
  font-size: 21rpx;
  line-height: 54rpx;
  background: var(--app-bg-brand-soft);
}
.favorites-link view {
  font-size: 25rpx;
}

.recommendation-feed {
  margin: 48rpx calc(var(--app-page-gutter) * -1) calc(var(--app-page-gutter) * -1);
  padding: 0 var(--app-page-gutter) var(--app-page-gutter);
}

.recommendation-feed .section-heading {
  margin-top: 34rpx;
}

.recommendation-filters {
  width: calc(100% + var(--app-page-gutter));
  margin: -5rpx 0 24rpx;
  white-space: nowrap;
}

.recommendation-filters__row {
  display: inline-flex;
  gap: 12rpx;
  padding-right: var(--app-page-gutter);
}

.recommendation-filter {
  display: inline-flex;
  width: auto;
  height: 58rpx;
  flex: 0 0 auto;
  margin: 0;
  padding: 0 20rpx;
  align-items: center;
  gap: 5rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 29rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
  line-height: 58rpx;
  background: var(--app-bg-card);
}

.recommendation-filter::after,
.favorites-link::after {
  border: 0;
}

.recommendation-filter--active {
  border-color: var(--app-border-brand-soft);
  color: var(--app-color-brand);
  font-weight: 700;
  background: var(--app-bg-brand-soft);
}

.recommendation-filter view {
  font-size: 20rpx;
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
