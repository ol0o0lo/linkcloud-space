<script setup lang="ts">
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { LandlordHouseOut } from '@/features/landlord/service'
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import { getPublicHouseSearchRoute, parsePublicHouseSearchPreset } from '@/domain/home-content'
import { formatTenantHouseTitle } from '@/domain/tenant-rental'
import HouseCard from '@/components/house/HouseCard.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppRecordListSkeleton from '@/components/app/AppRecordListSkeleton.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { listLandlordHouses } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppNotice from '@/components/app/AppNotice.vue'
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
const isPublicHouseMode = computed(() => currentMode.value === 'visitor' || currentMode.value === 'personal')
const pageScrollTop = ref(0)
const navigationRpxScale = (uni.getWindowInfo?.().windowWidth || 375) / 750
const navigationSearchThreshold = Math.round(144 * navigationRpxScale)
const navigationContentFadeDistance = Math.round(288 * navigationRpxScale)
const navigationSearchVisible = computed(() => isPublicHouseMode.value && pageScrollTop.value >= navigationSearchThreshold)
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
const navigationContentProgress = computed(() => {
  if (!isPublicHouseMode.value)
    return navigationProgress.value
  return Math.min(1, Math.max(0, pageScrollTop.value / navigationContentFadeDistance))
})

function handlePageScroll(event: { scrollTop: number }) {
  handleNavigationScroll(event)
  pageScrollTop.value = event.scrollTop
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
  { value: 'vacant', label: '空置' },
  { value: 'listed', label: '待发布' },
  { value: 'renovating', label: '维护中' },
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
const organizationBusinessEntries = computed(() => [
  { title: '经营总览', subtitle: '打开全部组织经营功能', icon: 'i-carbon-apps', route: APP_ROUTES.organizationRental, featured: true },
  { title: '房源资产', subtitle: '房源、小区、楼栋与地图', icon: 'i-carbon-building', route: APP_ROUTES.organizationHouses },
  { title: '客户与带看', subtitle: '联系人和带看状态处理', icon: 'i-carbon-user-multiple', route: APP_ROUTES.organizationViewings },
  { title: '租约管理', subtitle: '租约详情与登记签约', icon: 'i-carbon-document', route: APP_ROUTES.organizationLeases },
  { title: '收益分配', subtitle: '申请与月度收益记录', icon: 'i-carbon-money', route: APP_ROUTES.organizationAllocation, capability: appContextStore.capabilities.allocation },
  { title: '经营分析', subtitle: '组织经营事件与趋势', icon: 'i-carbon-chart-line', route: APP_ROUTES.organizationAnalytics, capability: appContextStore.capabilities.analytics },
].filter(item => item.capability !== false))

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

function openOrganizationRoute(url: string) {
  uni.navigateTo({ url })
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
})
onPullDownRefresh(() => {
  if (currentMode.value === 'visitor' || currentMode.value === 'personal')
    return loadHouses(true)
  if (currentMode.value === 'landlord')
    return loadLandlordHouses(true)
  uni.stopPullDownRefresh()
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
  <AppPage class="houses-page" tabbar ai-background>
    <template #navigation>
      <AppCustomNavigation
        title=""
        align="start"
        scrolled-align="start"
        scroll-mode="fade"
        :scrolled="isPublicHouseMode ? navigationSearchVisible : navigationScrolled"
        :content-opacity-mode="isPublicHouseMode ? 'fade-out' : 'fade-in'"
        scrolled-content-opacity-mode="fade-in"
        :scroll-progress="navigationContentProgress"
      >
        <template v-if="isPublicHouseMode" #content>
          <view class="navigation-primary-row min-w-0 w-full flex items-center gap-1.5">
            <PublicHouseRegionTrigger @change="handleRegionChange" />
          </view>
        </template>
        <template v-if="isPublicHouseMode" #scrolled-content>
          <view class="navigation-scrolled-row min-w-0 w-full flex items-center gap-1.5">
            <PublicHouseRegionTrigger @change="handleRegionChange" />
            <view class="navigation-search-bar flex-1">
              <view class="i-carbon-search navigation-search-icon" />
              <view class="navigation-search-input">
                <wd-input v-model="query.keyword" compact placeholder="小区、区域或房源关键词" clearable confirm-type="search" @confirm="search" />
              </view>
              <text class="navigation-search-action" @click="search">
                搜索
              </text>
            </view>
          </view>
        </template>
      </AppCustomNavigation>
    </template>
    <template v-if="currentMode === 'visitor' || currentMode === 'personal'">
      <view class="search-bar">
        <view class="search-input">
          <wd-input v-model="query.keyword" placeholder="小区、区域或房源关键词" clearable confirm-type="search" @confirm="search" />
        </view>
        <wd-button custom-class="search-button" @click="search">
          搜索
        </wd-button>
      </view>

      <view class="quick-filter-shell" :class="{ 'quick-filter-shell--open': activeTopFilter }">
        <scroll-view class="quick-filter-scroll" scroll-x :show-scrollbar="false">
          <view class="quick-filter-row">
            <view class="quick-filter" :class="{ 'quick-filter--active': nearbyRadiusM, 'quick-filter--open': activeTopFilter === 'nearby' }" hover-class="quick-filter--pressed" @click="toggleTopFilter('nearby')">
              <view class="i-carbon-location-current" />
              <text>{{ nearbyRadiusM ? `附近 ${formatPublicHouseRadiusLabel(nearbyRadiusM)}` : '附近' }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter" :class="{ 'quick-filter--active': spatialFilter.hasLocationFilter.value, 'quick-filter--open': activeTopFilter === 'location' }" hover-class="quick-filter--pressed" @click="openRegionSelector">
              <view class="i-carbon-map" />
              <text>{{ districtFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter" :class="{ 'quick-filter--active': query.minRent || query.maxRent }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-currency-yen" />
              <text>{{ rentFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter" :class="{ 'quick-filter--active': query.bedrooms !== '' }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-hotel" />
              <text>{{ bedroomFilterText }}</text>
              <view class="i-carbon-chevron-down" />
            </view>
            <view class="quick-filter quick-filter--all" :class="{ 'quick-filter--active': activeFilterCount }" hover-class="quick-filter--pressed" @click="openFilters">
              <view class="i-carbon-filter" />
              <text>筛选{{ activeFilterCount ? ` ${activeFilterCount}` : '' }}</text>
            </view>
          </view>
        </scroll-view>

        <view v-if="activeTopFilter === 'nearby'" class="nearby-dropdown-host">
          <view class="top-filter-mask" @touchmove.stop.prevent @click="closeTopFilter" />
          <view class="nearby-dropdown">
            <view class="nearby-dropdown__heading">
              <view class="nearby-dropdown__heading-main">
                <view class="i-carbon-location-current" />
                <view class="nearby-dropdown__heading-copy">
                  <strong>附近找房</strong>
                  <text>以当前位置为中心筛选房源</text>
                </view>
              </view>
              <text v-if="locatingNearby" class="nearby-filter-status">定位中…</text>
            </view>
            <wd-radio-group v-model="nearbyDraftRadiusM" type="button" direction="horizontal" custom-class="nearby-dropdown__options">
              <wd-radio v-for="radius in nearbyRadiusOptions" :key="radius" :value="radius">
                {{ formatPublicHouseRadiusLabel(radius) }}
              </wd-radio>
            </wd-radio-group>
            <view class="nearby-dropdown__footer">
              <button class="nearby-dropdown__reset" @click="clearNearbyFilter">
                不限附近
              </button>
              <button class="nearby-dropdown__apply" :disabled="locatingNearby" @click="applyNearbyFilter">
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

      <view class="sort-row">
        <view class="result-summary">
          <strong>筛选结果</strong><text>共 {{ publicHousePage.total.value }} 套公开房源</text>
        </view>
        <view class="sort-actions">
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
          <view class="filter-label">
            <view class="i-carbon-currency-yen" /><text>租金范围（元/月）</text>
          </view>
          <view class="filter-pair">
            <wd-input v-model="query.minRent" type="number" placeholder="最低租金" />
            <text>至</text>
            <wd-input v-model="query.maxRent" type="number" placeholder="最高租金" />
          </view>
          <view class="filter-label">
            <view class="i-carbon-ruler" /><text>面积范围（㎡）</text>
          </view>
          <view class="filter-pair">
            <wd-input v-model="query.minArea" type="digit" placeholder="最小面积" />
            <text>至</text>
            <wd-input v-model="query.maxArea" type="digit" placeholder="最大面积" />
          </view>
          <view class="filter-label">
            <view class="i-carbon-hotel" /><text>卧室数量</text>
          </view>
          <view class="choice-row">
            <wd-tag :type="query.bedrooms === '' ? 'primary' : 'default'" variant="light" @click="query.bedrooms = ''">
              不限
            </wd-tag>
            <wd-tag v-for="item in filters?.bedrooms || []" :key="item" :type="query.bedrooms === item ? 'primary' : 'default'" variant="light" @click="query.bedrooms = item">
              {{ item }} 室
            </wd-tag>
          </view>
          <view class="switch-row">
            <view class="switch-row__label">
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
      <view class="landlord-search">
        <view class="i-carbon-search" />
        <wd-input v-model="landlordKeyword" placeholder="搜索小区、房号或租客" clearable />
        <text>筛选</text>
      </view>
      <view class="landlord-status-row">
        <view v-for="option in landlordStatusOptions" :key="option.value" :class="{ active: landlordStatus === option.value }" @click="landlordStatus = option.value">
          {{ option.label }}
        </view>
      </view>
      <view class="landlord-result">
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
        :empty-description="hasLandlordFilters ? '试试清空关键词或切换到全部状态。' : '中介将房源关联到当前房东后会显示在这里。'"
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
          <view class="landlord-property-card app-touchable" hover-class="app-touchable--pressed" @click="openLandlordHouse(item.id)">
            <view class="landlord-property-topline">
              <strong>{{ formatTenantHouseTitle(item) }}</strong>
              <text>{{ item.status__mapping }}</text>
            </view>
            <view class="landlord-property-meta">
              {{ item.asking_rent ? `¥${item.asking_rent}/月` : '租金面议' }} · {{ formatHouseLayout(item.bedrooms, item.living_rooms) }}
            </view>
            <view class="landlord-property-footer">
              {{ item.effective_tags.slice(0, 2).join(' · ') || `${item.area || '--'}㎡ · ${item.orientation__mapping || '朝向待补充'}` }}
            </view>
          </view>
        </template>
      </AppPagedList>
    </template>

    <template v-else-if="currentMode === 'organization'">
      <view class="mode-heading">
        <view class="mode-title">
          业务中心
        </view>
        <view class="mode-subtitle">
          {{ appContextStore.currentOrganization?.name }}
        </view>
      </view>
      <view class="business-grid">
        <view
          v-for="item in organizationBusinessEntries"
          :key="item.route"
          class="business-card"
          :class="{ 'business-card--featured': item.featured }"
          @click="openOrganizationRoute(item.route)"
        >
          <view :class="item.icon" /><strong>{{ item.title }}</strong><text>{{ item.subtitle }}</text>
          <view class="i-carbon-arrow-up-right business-arrow" />
        </view>
      </view>
      <AppNotice
        class="scope-notice"
        title="功能按当前权限展示"
        description="收益分配和经营分析会根据当前组织权限显示，具体数据仍由后端执行成员与角色校验。"
        compact
      />
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.navigation-search-bar {
  display: flex;
  height: 64rpx;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
  padding: 0 12rpx 0 20rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-subtle);
}
.navigation-search-icon {
  flex: 0 0 auto;
  color: var(--app-text-muted);
  font-size: 28rpx;
}
.navigation-search-input {
  min-width: 0;
  flex: 1;
  overflow: hidden;
}
:deep(.navigation-search-input .wd-input) {
  padding: 0;
  background: transparent;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 60rpx;
  --wot-input-inner-font-size: 24rpx;
  --wot-input-padding: 0;
}
.navigation-search-action {
  flex: 0 0 auto;
  padding: 0 8rpx;
  color: var(--app-color-brand-active);
  font-size: 24rpx;
  font-weight: 700;
  line-height: 60rpx;
}
.search-bar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  min-height: 104rpx;
  padding: 8rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.search-input {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  border-radius: 24rpx;
  background: transparent;
}
:deep(.search-input .wd-input) {
  background: transparent;
}
:deep(.search-button) {
  width: 184rpx;
  height: 84rpx;
  border-radius: 26rpx;
  font-weight: 700;
}
.quick-filter-shell {
  --public-house-filter-popover-width: 680rpx;

  position: relative;
  z-index: 20;
  margin-top: 24rpx;
}
.quick-filter-shell--open {
  z-index: 1100;
}
.quick-filter-scroll {
  width: 100%;
  white-space: nowrap;
}
.quick-filter-row {
  display: inline-flex;
  gap: 16rpx;
  padding-right: 24rpx;
}
.quick-filter {
  position: relative;
  display: inline-flex;
  min-width: 140rpx;
  height: 58rpx;
  flex: 0 0 auto;
  box-sizing: border-box;
  align-items: center;
  gap: 8rpx;
  padding: 0 22rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 24rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 58rpx;
  background: var(--app-bg-card);
}
.quick-filter--all {
  border-color: transparent;
  background: var(--app-bg-brand-soft);
}
.quick-filter--active {
  border-color: var(--app-border-brand-soft);
  color: var(--app-color-brand);
  font-weight: 600;
  background: var(--app-bg-brand-soft);
}
.quick-filter--open {
  border-color: var(--app-color-brand);
  color: var(--app-color-brand-active);
}
.quick-filter--open::after {
  position: absolute;
  bottom: 4rpx;
  left: 50%;
  width: 0;
  height: 0;
  border-top: 8rpx solid var(--app-color-brand);
  border-right: 8rpx solid transparent;
  border-left: 8rpx solid transparent;
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
  opacity: 0.72;
}
.nearby-dropdown-host {
  position: absolute;
  z-index: 1;
  top: 100%;
  left: 0;
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width);
}
.top-filter-mask {
  position: fixed;
  z-index: 1;
  inset: 0;
  background: rgb(15 23 42 / 42%);
}
.nearby-dropdown {
  position: relative;
  z-index: 2;
  width: 100%;
  margin-top: 14rpx;
  padding: 28rpx;
  border: 1rpx solid rgb(255 255 255 / 80%);
  border-radius: 28rpx;
  box-sizing: border-box;
  background: linear-gradient(145deg, rgb(255 255 255 / 99%), #f2f7ff);
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
  animation: top-filter-dropdown-in 180ms ease-out;
}
.nearby-dropdown__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.nearby-dropdown__heading-main {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.nearby-dropdown__heading-main > view:first-child {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 30rpx;
}
.nearby-dropdown__heading-copy {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.nearby-dropdown__heading strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.nearby-dropdown__heading text {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
:deep(.nearby-dropdown__options) {
  display: grid;
  margin-top: 28rpx;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  --wot-radio-button-margin: 0;
  --wot-radio-button-min-width: 0;
}
.nearby-dropdown__footer {
  display: grid;
  margin-top: 30rpx;
  grid-template-columns: 1fr 2fr;
  gap: 16rpx;
}
.nearby-dropdown__reset,
.nearby-dropdown__apply {
  height: 76rpx;
  margin: 0;
  border: 0;
  border-radius: 18rpx;
  font-size: 25rpx;
  line-height: 76rpx;
}
.nearby-dropdown__reset {
  color: var(--app-text-secondary);
  background: var(--app-bg-subtle);
}
.nearby-dropdown__apply {
  color: #fff;
  font-weight: 700;
  background: var(--app-color-brand);
}
.nearby-dropdown__reset::after,
.nearby-dropdown__apply::after {
  border: 0;
}
.nearby-dropdown__apply[disabled] {
  opacity: 0.6;
}
.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 32rpx 0 24rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.result-summary {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.result-summary strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.result-summary text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.sort-actions {
  display: flex;
  gap: 24rpx;
  white-space: nowrap;
}
.sort-actions .active {
  color: var(--app-color-brand);
  font-weight: 600;
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
.nearby-filter-status {
  color: var(--app-text-muted);
  font-size: 22rpx;
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
@keyframes top-filter-dropdown-in {
  from {
    opacity: 0;
    transform: translateY(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .nearby-dropdown {
    animation: none;
  }
}
.mode-heading {
  padding: 12rpx 6rpx 28rpx;
}
.mode-title {
  color: var(--app-text-primary);
  font-size: 40rpx;
  font-weight: 700;
}
.mode-subtitle {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 25rpx;
}
.summary-card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 30rpx;
  border-radius: 26rpx;
  background: var(--app-gradient-warm);
}
.summary-card view {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  text-align: center;
}
.summary-card view + view {
  border-left: 1px solid var(--app-border-warm);
}
.summary-card strong {
  color: var(--app-color-warm);
  font-size: 42rpx;
}
.summary-card text {
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.business-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}
.business-card {
  position: relative;
  display: flex;
  min-height: 190rpx;
  flex-direction: column;
  justify-content: center;
  gap: 10rpx;
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.business-card--featured {
  grid-column: 1 / -1;
  min-height: 150rpx;
  background: var(--app-bg-brand-soft);
}
.business-card > view {
  color: var(--app-color-brand);
  font-size: 38rpx;
}
.business-card strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.business-card text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.business-arrow {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  color: var(--app-text-muted) !important;
  font-size: 28rpx !important;
}
.scope-notice {
  margin-top: 24rpx;
}
.landlord-house-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}
.landlord-house-card {
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.landlord-cover {
  width: 190rpx;
  height: 150rpx;
  flex: 0 0 190rpx;
  border-radius: 16rpx;
  background: var(--app-bg-subtle);
}
.landlord-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.landlord-house-main {
  min-width: 0;
  flex: 1;
}
.landlord-house-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}
.landlord-house-topline strong {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.landlord-house-facts {
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.6;
}
.landlord-search {
  display: flex;
  min-height: 104rpx;
  align-items: center;
  gap: 18rpx;
  padding: 0 32rpx;
  margin-top: 120rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 32rpx;
  box-sizing: border-box;
  color: var(--app-text-muted);
  background: var(--app-bg-card);
}
.landlord-search :deep(.wd-input) {
  min-width: 0;
  flex: 1;
  background: transparent;
}
.landlord-search > text {
  color: var(--app-color-brand-active);
  font-size: 24rpx;
  font-weight: 700;
}
.landlord-status-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20rpx;
  margin-top: 44rpx;
}
.landlord-status-row view {
  display: flex;
  height: 68rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--app-border-color);
  border-radius: 24rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
  background: var(--app-bg-card);
}
.landlord-status-row .active {
  border-color: var(--app-color-brand);
  color: #fff;
  font-weight: 700;
  background: var(--app-color-brand);
}
.landlord-result {
  margin: 64rpx 0 40rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.landlord-property-card {
  min-height: 236rpx;
  padding: 32rpx 36rpx;
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.landlord-property-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
}
.landlord-property-topline strong {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.landlord-property-topline text,
.landlord-property-footer {
  color: var(--app-color-brand-active);
  font-size: 21rpx;
  font-weight: 600;
}
.landlord-property-meta {
  margin-top: 18rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
}
.landlord-property-footer {
  margin-top: 52rpx;
}
</style>
