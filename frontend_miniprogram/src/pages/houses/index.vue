<script setup lang="ts">
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { LandlordHouseOut } from '@/features/landlord/service'
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { formatHouseLayout, getHouseAuxiliaryLabels } from '@/domain/house'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import { getPublicHouseSearchRoute, parsePublicHouseSearchPreset } from '@/domain/home-content'
import { formatTenantHouseTitle } from '@/domain/tenant-rental'
import HouseCard from '@/components/house/HouseCard.vue'
import OrganizationWorkbench from '@/features/organization-workbench/OrganizationWorkbench.vue'
import OrganizationWeather from '@/features/organization-workbench/OrganizationWeather.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppRecordListSkeleton from '@/components/app/AppRecordListSkeleton.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { listLandlordHouses } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import PublicHouseLocationDropdown from '@/features/houses/components/PublicHouseLocationDropdown.vue'
import PublicHouseRegionTrigger from '@/features/houses/components/PublicHouseRegionTrigger.vue'
import { usePublicHouseSpatialFilter } from '@/features/houses/usePublicHouseSpatialFilter'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { useAppContextStore } from '@/store/app-context-v2'
import { usePublicHouseRegionStore } from '@/store/public-house-region'
import { getTabbarItems } from '@/tabbar/config'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '找房',
    enablePullDownRefresh: true,
  },
})

const appContextStore = useAppContextStore()
const regionStore = usePublicHouseRegionStore()
const spatialFilter = usePublicHouseSpatialFilter()
const houseFavorites = useHouseCardFavorites()
const currentMode = computed(() => appContextStore.navigationMode)
const { navigationScrolled, navigationProgress, navigationScrollTop: pageScrollTop, handleNavigationScroll } = useNavigationScrollState()
const organizationWorkbench = ref<InstanceType<typeof OrganizationWorkbench> | null>(null)
const organizationWeather = ref<InstanceType<typeof OrganizationWeather> | null>(null)
const isPublicHouseMode = computed(() => currentMode.value === 'visitor' || currentMode.value === 'personal')
const navigationRpxScale = (uni.getWindowInfo?.().windowWidth || 375) / 750
const navigationSearchThreshold = Math.round(144 * navigationRpxScale)
const navigationContentFadeDistance = Math.round(288 * navigationRpxScale)
const navigationSearchVisible = computed(() => isPublicHouseMode.value && pageScrollTop.value >= navigationSearchThreshold)
const navigationContentProgress = computed(() => {
  if (!isPublicHouseMode.value)
    return navigationProgress.value
  return Math.min(1, Math.max(0, pageScrollTop.value / navigationContentFadeDistance))
})

function handlePageScroll(event: { scrollTop: number }) {
  handleNavigationScroll(event)
}

onPageScroll(handlePageScroll)
const tabbarTitle = computed(() => getTabbarItems(currentMode.value).find(item => item.slot === 'business')?.text || '业务')
const filters = ref<PublicHouseFiltersOut | null>(null)
const showFilters = ref(false)
const activeTopFilter = ref<'nearby' | 'location' | null>(null)
const filterOverlayOpen = computed(() => activeTopFilter.value !== null || showFilters.value)
const locatingNearby = ref(false)
const nearbyRadiusM = computed<PublicHouseRadiusM | null>(() => spatialFilter.nearbyRadiusM.value)
const nearbyDraftRadiusM = ref<PublicHouseRadiusM>(spatialFilter.radiusM.value)
const nearbyRadiusOptions = PUBLIC_HOUSE_RADIUS_OPTIONS
const landlordKeyword = ref('')
const landlordStatus = ref('all')
const landlordStatusOptions = [
  { value: 'all', label: '全部' },
  { value: 'listed', label: '招租中' },
  { value: 'rented', label: '已出租' },
  { value: 'paused', label: '暂不出租' },
]
const pageSize = 12
const query = reactive({
  keyword: '',
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  elevatorOnly: false,
  sort: 'latest' as NonNullable<PublicHousesUsingGetParams['sort']>,
})

const activeFilterCount = computed(() => [query.minRent, query.maxRent, query.minArea, query.maxArea, query.bedrooms, query.elevatorOnly, spatialFilter.hasAnyFilter.value].filter(Boolean).length)
const hasPublicFilters = computed(() => Boolean(query.keyword.trim() || activeFilterCount.value))
const publicEmptyTitle = computed(() => hasPublicFilters.value ? '没有找到符合条件的房源' : '暂时没有公开房源')
const publicEmptyDescription = computed(() => hasPublicFilters.value ? '试试清空关键词，或放宽区域、租金和户型条件。' : '新房源发布后会显示在这里。')
const districtFilterText = computed(() => spatialFilter.locationLabel.value)
const rentFilterText = computed(() => {
  if (query.minRent && query.maxRent)
    return `¥${query.minRent}-${query.maxRent}`
  if (query.minRent)
    return `¥${query.minRent}以上`
  if (query.maxRent)
    return `¥${query.maxRent}以下`
  return '租金'
})
const bedroomFilterText = computed(() => query.bedrooms === '' ? '户型' : `${query.bedrooms}室`)
function requestParams(page: number, targetPageSize: number): PublicHousesUsingGetParams {
  return {
    keyword: query.keyword,
    min_rent: query.minRent,
    max_rent: query.maxRent,
    min_area: query.minArea,
    max_area: query.maxArea,
    bedrooms: query.bedrooms === '' ? undefined : Number(query.bedrooms),
    has_elevator_access: query.elevatorOnly ? true : undefined,
    ...spatialFilter.requestParams.value,
    sort: query.sort,
    page,
    page_size: targetPageSize,
  }
}

const publicHousePage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize: targetPageSize }) => listPublicHouses(requestParams(page, targetPageSize)),
  pageSize,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

const landlordHousePage = usePagedPage<LandlordHouseOut>({
  loader: ({ page, pageSize: targetPageSize }) => listLandlordHouses(appContextStore.currentLandlordRelationship!.contact_id, page, targetPageSize),
  pageSize: 500,
  enabled: () => Boolean(appContextStore.currentLandlordRelationship?.contact_id),
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const filteredLandlordHouses = computed(() => landlordHousePage.items.value.filter((house) => {
  const matchesStatus = landlordStatus.value === 'all' || house.status === landlordStatus.value
  const keyword = landlordKeyword.value.trim().toLowerCase()
  const title = `${formatTenantHouseTitle(house)} ${house.landlord?.name || ''}`.toLowerCase()
  return matchesStatus && (!keyword || title.includes(keyword))
}))
const hasLandlordFilters = computed(() => Boolean(landlordKeyword.value.trim() || landlordStatus.value !== 'all'))
const publicPageInitialized = ref(false)
let lastLoadedPublicScopeKey = ''

async function loadHouses(reset = false) {
  await (reset ? publicHousePage.refresh() : publicHousePage.loadMore())
  if (reset)
    lastLoadedPublicScopeKey = spatialFilter.scopeKey.value
}

function retryHouses() {
  void publicHousePage.refresh()
}

function search() {
  showFilters.value = false
  activeTopFilter.value = null
  void loadHouses(true)
}

function resetFilters() {
  Object.assign(query, {
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    elevatorOnly: false,
    sort: 'latest',
  })
  spatialFilter.reset()
}

async function selectNearbyRadius(radius: number | null): Promise<boolean> {
  if (radius == null) {
    spatialFilter.exitNearby()
    return true
  }
  if (spatialFilter.nearbyLocation.value) {
    spatialFilter.setNearbyRadius(radius)
    return true
  }
  if (locatingNearby.value)
    return false
  locatingNearby.value = true
  try {
    const location = await getCurrentLocationGcj02()
    spatialFilter.enterNearby({ latitude: location.latitude, longitude: location.longitude }, radius)
    return true
  }
  catch (error) {
    spatialFilter.exitNearby()
    // #ifdef MP-WEIXIN
    const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后才能筛选附近房源。', confirmText: '去设置' })
    if (modal.confirm)
      await uni.openSetting()
    // #endif
    // #ifndef MP-WEIXIN
    uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
    // #endif
    return false
  }
  finally {
    locatingNearby.value = false
  }
}

function toggleTopFilter(filter: 'nearby' | 'location') {
  showFilters.value = false
  if (filter === 'nearby')
    nearbyDraftRadiusM.value = spatialFilter.radiusM.value
  activeTopFilter.value = activeTopFilter.value === filter ? null : filter
}

function closeTopFilter() {
  activeTopFilter.value = null
}

async function applyNearbyFilter() {
  const applied = await selectNearbyRadius(nearbyDraftRadiusM.value)
  if (!applied)
    return
  query.sort = 'distance_asc'
  activeTopFilter.value = null
  void loadHouses(true)
}

function clearNearbyFilter() {
  spatialFilter.exitNearby()
  if (query.sort === 'distance_asc')
    query.sort = 'latest'
  activeTopFilter.value = null
  void loadHouses(true)
}

function applyLocationFilter(value: PublicHouseLocationFilterValue) {
  spatialFilter.setLocationFilter(value)
  query.sort = spatialFilter.hasSpatialCenter.value ? 'distance_asc' : query.sort === 'distance_asc' ? 'latest' : query.sort
  activeTopFilter.value = null
  void loadHouses(true)
}

function clearPublicFilters() {
  query.keyword = ''
  resetFilters()
  search()
}

function openFilters() {
  activeTopFilter.value = null
  showFilters.value = true
  if (!filters.value)
    void getPublicHouseFilters().then(result => filters.value = result).catch(() => undefined)
}

function openRegionSelector() {
  toggleTopFilter('location')
}

function handleRegionChange() {
  activeTopFilter.value = null
  if (!spatialFilter.hasSpatialCenter.value && query.sort === 'distance_asc')
    query.sort = 'latest'
  void loadHouses(true)
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

async function loadLandlordHouses(reset = false) {
  await (reset ? landlordHousePage.refresh() : landlordHousePage.loadMore())
}

function openLandlordHouse(houseId: number) {
  uni.navigateTo({ url: `${APP_ROUTES.landlordHouseDetail}?id=${encodeURIComponent(String(houseId))}` })
}

function clearLandlordFilters() {
  landlordKeyword.value = ''
  landlordStatus.value = 'all'
}

onLoad((options) => {
  if (currentMode.value === 'visitor' || currentMode.value === 'personal') {
    uni.redirectTo({
      url: getPublicHouseSearchRoute(parsePublicHouseSearchPreset((options || {}) as Record<string, string | undefined>)),
    })
  }
})

onShow(() => {
  uni.setNavigationBarTitle({ title: tabbarTitle.value })
  if (currentMode.value === 'landlord') {
    void loadLandlordHouses(true)
  }
  else if (currentMode.value === 'visitor' || currentMode.value === 'personal') {
    void houseFavorites.refreshFavorites()
    if (publicPageInitialized.value && lastLoadedPublicScopeKey !== spatialFilter.scopeKey.value)
      void loadHouses(true)
  }
  else if (currentMode.value === 'organization') {
    void organizationWorkbench.value?.refresh()
    void organizationWeather.value?.refresh()
  }
})
onPullDownRefresh(async () => {
  if (currentMode.value === 'visitor' || currentMode.value === 'personal')
    return loadHouses(true)
  if (currentMode.value === 'landlord')
    return loadLandlordHouses(true)
  try {
    await Promise.all([organizationWorkbench.value?.refresh(), organizationWeather.value?.refresh()])
  }
  finally {
    uni.stopPullDownRefresh()
  }
})
onReachBottom(() => {
  if (currentMode.value === 'visitor' || currentMode.value === 'personal')
    void loadHouses()
  else if (currentMode.value === 'landlord')
    void loadLandlordHouses()
})
</script>

<template>
  <page-meta :page-style="`overflow:${filterOverlayOpen ? 'hidden' : 'visible'};`" />
  <AppPage class="houses-page" tabbar :ai-background="currentMode !== 'organization'">
    <template #navigation>
      <AppCustomNavigation
        :title="currentMode === 'organization' ? '工作台' : ''"
        align="start"
        scrolled-align="start"
        scroll-mode="fade"
        :scrolled="isPublicHouseMode ? navigationSearchVisible : navigationScrolled"
        :content-opacity-mode="isPublicHouseMode ? 'fade-out' : 'manual'"
        scrolled-content-opacity-mode="fade-in"
        :scroll-progress="navigationContentProgress"
      >
        <template #content>
          <OrganizationWeather v-if="currentMode === 'organization'" ref="organizationWeather" />
          <view v-else-if="isPublicHouseMode" class="navigation-primary-row min-w-0 w-full flex items-center gap-1.5">
            <PublicHouseRegionTrigger @change="handleRegionChange" />
          </view>
        </template>
        <template v-if="isPublicHouseMode" #scrolled-content>
          <view class="navigation-scrolled-row min-w-0 w-full flex items-center gap-1.5">
            <PublicHouseRegionTrigger @change="handleRegionChange" />
            <view class="navigation-search-bar box-border h-8 min-w-0 flex flex-1 items-center gap-1.5 rounded-4 pb-0 pl-2.5 pr-1.5 pt-0">
              <view class="i-carbon-search navigation-search-icon flex-none text-size-sm" />
              <view class="navigation-search-input min-w-0 flex-1 overflow-hidden">
                <wd-input v-model="query.keyword" compact placeholder="小区、区域或房源关键词" clearable confirm-type="search" @confirm="search" />
              </view>
              <text class="navigation-search-action flex-none px-1 py-0 text-size-xs leading-7.5" @click="search">
                搜索
              </text>
            </view>
          </view>
        </template>
      </AppCustomNavigation>
    </template>
    <template v-if="currentMode === 'visitor' || currentMode === 'personal'">
      <view class="search-bar box-border min-h-13 flex items-center gap-1 rounded-4 p-1">
        <view class="search-input min-w-0 flex-1 overflow-hidden rounded-3">
          <wd-input v-model="query.keyword" placeholder="小区、区域或房源关键词" clearable confirm-type="search" @confirm="search" />
        </view>
        <wd-button custom-class="search-button" @click="search">
          搜索
        </wd-button>
      </view>

      <view class="quick-filter-shell relative mt-3" :class="{ 'quick-filter-shell--open': activeTopFilter }">
        <scroll-view class="quick-filter-scroll w-full whitespace-nowrap" scroll-x :show-scrollbar="false">
          <view class="quick-filter-row inline-flex gap-2 pr-3">
            <view class="quick-filter relative box-border h-7.5 min-w-18 inline-flex flex-none items-center gap-1 rounded-3 px-3 py-0 text-size-xs leading-7.5" :class="{ 'quick-filter--active': nearbyRadiusM, 'quick-filter--open': activeTopFilter === 'nearby' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('nearby')">
              <view class="i-carbon-location-current" />
              <text>{{ nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter relative box-border h-7.5 min-w-18 inline-flex flex-none items-center gap-1 rounded-3 px-3 py-0 text-size-xs leading-7.5" :class="{ 'quick-filter--active': spatialFilter.hasLocationFilter.value, 'quick-filter--open': activeTopFilter === 'location' }" hover-class="quick-filter--pressed" @click="openRegionSelector">
              <view class="i-carbon-map" />
              <text>{{ districtFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter relative box-border h-7.5 min-w-18 inline-flex flex-none items-center gap-1 rounded-3 px-3 py-0 text-size-xs leading-7.5" :class="{ 'quick-filter--active': query.minRent || query.maxRent }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-currency-yen" />
              <text>{{ rentFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter relative box-border h-7.5 min-w-18 inline-flex flex-none items-center gap-1 rounded-3 px-3 py-0 text-size-xs leading-7.5" :class="{ 'quick-filter--active': query.bedrooms !== '' }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-hotel" />
              <text>{{ bedroomFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter quick-filter--all relative box-border h-7.5 min-w-18 inline-flex flex-none items-center gap-1 rounded-3 px-3 py-0 text-size-xs leading-7.5" :class="{ 'quick-filter--active': activeFilterCount }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-filter" />
              <text>筛选{{ activeFilterCount ? ` ${activeFilterCount}` : '' }}</text>
            </view>
          </view>
        </scroll-view>

        <view v-if="activeTopFilter === 'nearby'" class="nearby-dropdown-host absolute left-0 top-full">
          <view class="top-filter-mask fixed inset-0" @touchmove.stop.prevent @click="closeTopFilter" />
          <view class="nearby-dropdown relative mt-2 box-border w-full rounded-3.5 p-3.5">
            <view class="nearby-dropdown__heading flex items-center justify-between gap-2.5">
              <view class="nearby-dropdown__heading-main flex items-center gap-2">
                <view class="i-carbon-location-current" />
                <view class="nearby-dropdown__heading-copy flex flex-col gap-1">
                  <strong>附近找房</strong>
                  <text>以当前位置为中心筛选房源</text>
                </view>
              </view>
              <text v-if="locatingNearby" class="nearby-filter-status text-size-2xs">定位中…</text>
            </view>
            <wd-radio-group v-model="nearbyDraftRadiusM" type="button" direction="horizontal" custom-class="nearby-dropdown__options">
              <wd-radio v-for="radius in nearbyRadiusOptions" :key="radius" :value="radius">
                {{ formatPublicHouseRadiusLabel(radius) }}
              </wd-radio>
            </wd-radio-group>
            <view class="nearby-dropdown__footer grid mt-4 gap-2">
              <button class="nearby-dropdown__reset m-0 h-9.5 rounded-2.5 text-size-xs leading-9.5" @click="clearNearbyFilter">
                不限附近
              </button>
              <button class="nearby-dropdown__apply m-0 h-9.5 rounded-2.5 text-size-xs leading-9.5" :disabled="locatingNearby" @click="applyNearbyFilter">
                {{ locatingNearby ? '定位中…' : '查看房源' }}
              </button>
            </view>
          </view>
        </view>

        <PublicHouseLocationDropdown
          :visible="activeTopFilter === 'location'"
          :value="spatialFilter.locationFilter.value"
          @update:visible="activeTopFilter = $event ? 'location' : null"
          @apply="applyLocationFilter"
        />
      </view>

      <view class="sort-row flex items-center justify-between gap-2.5 px-0 pb-3 pt-4 text-size-xs">
        <view class="result-summary min-w-0 flex flex-col gap-1">
          <strong>筛选结果</strong><text>共 {{ publicHousePage.total.value }} 套公开房源</text>
        </view>
        <view class="sort-actions flex gap-3 whitespace-nowrap">
          <text v-if="spatialFilter.hasSpatialCenter.value" :class="{ active: query.sort === 'distance_asc' }" @click="query.sort = 'distance_asc'; search()">距离</text>
          <text :class="{ active: query.sort === 'latest' }" @click="query.sort = 'latest'; search()">最新</text>
          <text :class="{ active: query.sort === 'rent_asc' }" @click="query.sort = 'rent_asc'; search()">租金</text>
        </view>
      </view>

      <AppPagedList
        :items="publicHousePage.items.value"
        item-key="id"
        :loading="publicHousePage.loading.value"
        :refreshing="publicHousePage.refreshing.value"
        :loading-more="publicHousePage.loadingMore.value"
        :finished="publicHousePage.finished.value"
        :error="publicHousePage.error.value"
        loading-text="正在加载房源…"
        :empty-text="publicEmptyTitle"
        :empty-description="publicEmptyDescription"
        empty-icon="no-result"
        :empty-action-text="hasPublicFilters ? '清除筛选' : ''"
        finished-text="已经到底了"
        @retry="retryHouses"
        @empty-action="clearPublicFilters"
      >
        <template #loading>
          <AppHouseCardSkeleton />
        </template>
        <template #item="{ item }">
          <HouseCard
            :house="item"
            favorite-visible
            :favorited="houseFavorites.isFavorited(item.id)"
            :favorite-loading="houseFavorites.isLoading(item.id)"
            @click="openHouse(item.id)"
            @favorite="houseFavorites.toggleFavorite(item.id)"
          />
        </template>
      </AppPagedList>

      <AppBottomSheet v-model:visible="showFilters" title="筛选房源" height="tall" :z-index="1100">
        <view>
          <view class="filter-label mx-0 mb-2 mt-4 flex items-center gap-1.5 text-size-xs">
            <view class="i-carbon-currency-yen" /><text>租金范围（元/月）</text>
          </view>
          <view class="filter-pair grid items-center gap-2">
            <wd-input v-model="query.minRent" type="number" placeholder="最低租金" />
            <text>至</text>
            <wd-input v-model="query.maxRent" type="number" placeholder="最高租金" />
          </view>
          <view class="filter-label mx-0 mb-2 mt-4 flex items-center gap-1.5 text-size-xs">
            <view class="i-carbon-ruler" /><text>面积范围（㎡）</text>
          </view>
          <view class="filter-pair grid items-center gap-2">
            <wd-input v-model="query.minArea" type="digit" placeholder="最小面积" />
            <text>至</text>
            <wd-input v-model="query.maxArea" type="digit" placeholder="最大面积" />
          </view>
          <view class="filter-label mx-0 mb-2 mt-4 flex items-center gap-1.5 text-size-xs">
            <view class="i-carbon-hotel" /><text>卧室数量</text>
          </view>
          <view class="choice-row flex flex-wrap gap-2">
            <wd-tag :type="query.bedrooms === '' ? 'primary' : 'default'" variant="light" @click="query.bedrooms = ''">
              不限
            </wd-tag>
            <wd-tag v-for="item in filters?.bedrooms || []" :key="item" :type="query.bedrooms === item ? 'primary' : 'default'" variant="light" @click="query.bedrooms = item">
              {{ item }} 室
            </wd-tag>
          </view>
          <view class="switch-row mt-4.5 flex items-center justify-between rounded-2.5 p-3">
            <view class="switch-row__label flex items-center gap-1.5">
              <view class="i-carbon-building" /><text>只看有电梯</text>
            </view>
            <wd-switch v-model="query.elevatorOnly" />
          </view>
        </view>
        <template #footer>
          <view class="grid grid-cols-[1fr_1.5fr] w-full gap-2">
            <wd-button block variant="plain" @click="resetFilters">
              重置
            </wd-button>
            <wd-button block @click="search">
              查看房源
            </wd-button>
          </view>
        </template>
      </AppBottomSheet>
    </template>

    <template v-else-if="currentMode === 'landlord'">
      <view class="landlord-search mt-15 box-border min-h-13 flex items-center gap-2.5 rounded-4 px-4 py-0">
        <view class="i-carbon-search" />
        <wd-input v-model="landlordKeyword" placeholder="搜索小区、房号或租客" clearable />
        <text>筛选</text>
      </view>
      <view class="landlord-status-row grid grid-cols-4 mt-5.5 gap-2.5">
        <view v-for="option in landlordStatusOptions" :key="option.value" :class="{ active: landlordStatus === option.value }" @click="landlordStatus = option.value">
          {{ option.label }}
        </view>
      </view>
      <view class="landlord-result mx-0 mb-5 mt-8 text-size-sm">
        共 {{ filteredLandlordHouses.length }} 套房源
      </view>
      <AppPagedList
        :items="filteredLandlordHouses"
        item-key="id"
        :loading="landlordHousePage.loading.value"
        :refreshing="landlordHousePage.refreshing.value"
        :loading-more="landlordHousePage.loadingMore.value"
        :finished="landlordHousePage.finished.value"
        :error="landlordHousePage.error.value"
        loading-text="正在加载名下房源…"
        :empty-text="hasLandlordFilters ? '没有符合条件的关联房源' : '当前房东关系下暂无房源'"
        :empty-description="hasLandlordFilters ? '试试清空关键词或切换到全部状态。' : '经纪人将房源关联到您的房东档案后，会显示在这里。'"
        empty-icon="no-result"
        :empty-action-text="hasLandlordFilters ? '清除筛选' : ''"
        finished-text="没有更多房源了"
        @retry="landlordHousePage.refresh"
        @empty-action="clearLandlordFilters"
      >
        <template #loading>
          <AppRecordListSkeleton :count="4" />
        </template>
        <template #item="{ item }">
          <view class="landlord-property-card box-border min-h-30 app-touchable rounded-4 px-4.5 py-4 shadow-app-card" hover-class="app-touchable--pressed" @click="openLandlordHouse(item.id)">
            <view class="landlord-property-topline flex items-start justify-between gap-3">
              <strong>{{ formatTenantHouseTitle(item) }}</strong>
              <text>{{ item.status__mapping }}</text>
            </view>
            <view v-if="getHouseAuxiliaryLabels(item).length" class="mt-1 text-xs text-content-secondary">
              {{ getHouseAuxiliaryLabels(item).join(' · ') }}
            </view>
            <view class="landlord-property-meta mt-2.5 text-size-xs">
              {{ item.asking_rent ? `¥${item.asking_rent}/月` : '租金面议' }} · {{ formatHouseLayout(item.bedrooms, item.living_rooms) }}
            </view>
            <view class="landlord-property-footer mt-6.5">
              {{ item.effective_tags.slice(0, 2).join(' · ') || `${item.area || '--'}㎡ · ${item.orientation__mapping || '朝向待补充'}` }}
            </view>
          </view>
        </template>
      </AppPagedList>
    </template>

    <template v-else-if="currentMode === 'organization'">
      <OrganizationWorkbench ref="organizationWorkbench" />
    </template>
  </AppPage>
</template>

<style scoped>
.houses-page.app-page--organization {
  @apply bg-surface-page;
}

.navigation-search-bar {
  @apply border-hairline border-solid border-app-border bg-surface-subtle;
}
.navigation-search-icon {
  @apply text-content-muted;
}
:deep(.navigation-search-input .wd-input) {
  @apply p-0 bg-transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 60rpx;
  --wot-input-inner-font-size: 24rpx;
  --wot-input-padding: 0;
}
.navigation-search-action {
  @apply text-app-brand-active font-bold;
}
.search-bar {
  @apply border-hairline border-solid border-app-border bg-surface-card;
}
.search-input {
  @apply bg-transparent;
}
:deep(.search-input .wd-input) {
  @apply bg-transparent;
}
:deep(.search-button) {
  @apply w-23 h-10.5 rounded-3.5 font-bold;
}
.quick-filter-shell {
  --public-house-filter-popover-width: 680rpx;
  @apply z-20;
}
.quick-filter-shell--open {
  @apply z-1100;
}
.quick-filter {
  @apply border-hairline border-solid border-app-border text-content-secondary bg-surface-card;
}
.quick-filter--all {
  @apply border-transparent bg-surface-brand-soft;
}
.quick-filter--active {
  @apply border-app-border-brand-soft text-app-brand font-semibold bg-surface-brand-soft;
}
.quick-filter--open {
  @apply border-app-brand text-app-brand-active;
}
.quick-filter--open::after {
  @apply absolute bottom-0.5 left-1/2 w-0 h-0 border-t-4 border-t-solid border-t-app-brand;
  @apply border-r-4 border-r-solid border-r-transparent;
  @apply border-l-4 border-l-solid border-l-transparent;
  content: '';
  transform: translateX(-50%);
}
.quick-filter > .i-carbon-chevron-down {
  transition: transform 160ms ease;
}
.quick-filter--open > .i-carbon-chevron-down {
  transform: rotate(180deg);
}
.quick-filter--pressed {
  @apply opacity-72;
}
.nearby-dropdown-host {
  @apply z-1;
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width);
}
.top-filter-mask {
  @apply z-1;
  background: rgb(15 23 42 / 42%);
}
.nearby-dropdown {
  @apply z-2;
  border: 1rpx solid rgb(255 255 255 / 80%);
  background: linear-gradient(145deg, rgb(255 255 255 / 99%), #f2f7ff);
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
}
.nearby-dropdown__heading-main > view:first-child {
  @apply flex-none text-app-brand text-size-sm;
}
.nearby-dropdown__heading strong {
  @apply text-content-primary text-size-sm;
}
.nearby-dropdown__heading text {
  @apply text-content-muted text-size-2xs;
}
:deep(.nearby-dropdown__options) {
  @apply grid mt-3.5 grid-cols-4 gap-1.5;
  --wot-radio-button-margin: 0;
  --wot-radio-button-min-width: 0;
}
.nearby-dropdown__footer {
  grid-template-columns: 1fr 2fr;
}
.nearby-dropdown__reset,
.nearby-dropdown__apply {
  @apply border-0;
}
.nearby-dropdown__reset {
  @apply text-content-secondary bg-surface-subtle;
}
.nearby-dropdown__apply {
  @apply text-white font-bold bg-app-brand;
}
.nearby-dropdown__reset::after,
.nearby-dropdown__apply::after {
  @apply border-0;
}
.nearby-dropdown__apply[disabled] {
  @apply opacity-60;
}
.sort-row {
  @apply text-content-secondary;
}
.result-summary strong {
  @apply text-content-primary text-size-base;
}
.result-summary text {
  @apply text-content-muted text-size-2xs;
}
.sort-actions .active {
  @apply text-app-brand font-semibold;
}
.filter-label {
  @apply text-content-primary font-semibold;
}
.filter-label > view,
.switch-row__label > view {
  @apply flex-none text-app-brand text-size-sm;
}
.filter-pair {
  grid-template-columns: 1fr auto 1fr;
}
.nearby-filter-status {
  @apply text-content-muted;
}
.switch-row {
  @apply bg-surface-page;
}
.summary-card {
  @apply grid grid-cols-2 p-4 rounded-3.5 bg-gradient-warm;
}
.summary-card view {
  @apply flex flex-col gap-1 text-center;
}
.summary-card view + view {
  border-left: 1px solid var(--app-border-warm);
}
.summary-card strong {
  @apply text-app-warm text-size-xl;
}
.summary-card text {
  @apply text-content-muted text-size-xs;
}
.landlord-house-list {
  @apply flex flex-col gap-2.5 mt-3;
}
.landlord-house-card {
  @apply flex gap-2.5 p-2.5 rounded-3 bg-surface-card;
}
.landlord-cover {
  @apply w-24 h-19 flex-none basis-24 rounded-2 bg-surface-subtle;
}
.landlord-cover--empty {
  @apply flex items-center justify-center text-content-muted text-size-2xs;
}
.landlord-house-main {
  @apply min-w-0 flex-1;
}
.landlord-house-topline {
  @apply flex items-start justify-between gap-1.5;
}
.landlord-house-topline strong {
  @apply min-w-0 flex-1 text-content-primary text-size-sm;
}
.landlord-house-facts {
  @apply mt-2.5 text-content-muted text-size-xs leading-relaxed;
}
.landlord-search {
  @apply border-hairline border-solid border-app-border text-content-muted bg-surface-card;
}
.landlord-search :deep(.wd-input) {
  @apply min-w-0 flex-1 bg-transparent;
}
.landlord-search > text {
  @apply text-app-brand-active text-size-xs font-bold;
}
.landlord-status-row view {
  @apply flex h-8.5 items-center justify-center border-hairline border-solid border-app-border rounded-3 text-content-secondary text-size-2xs bg-surface-card;
}
.landlord-status-row .active {
  @apply border-app-brand text-white font-bold bg-app-brand;
}
.landlord-result {
  @apply text-content-primary font-bold;
}
.landlord-property-card {
  @apply bg-surface-card;
}
.landlord-property-topline strong {
  @apply min-w-0 flex-1 text-content-primary text-size-sm;
}
.landlord-property-topline text,
.landlord-property-footer {
  @apply text-app-brand-active text-size-2xs font-semibold;
}
.landlord-property-meta {
  @apply text-content-secondary;
}
</style>
