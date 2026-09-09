<script setup lang="ts">
import type { PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/features/houses/service'
import type { LandlordHouseOut } from '@/features/landlord/service'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { getLandlordHouseStatusTone } from '@/domain/landlord'
import { formatTenantHouseTitle } from '@/domain/tenant-rental'
import HouseCard from '@/features/houses/components/HouseCard.vue'
import { getPublicHouseFilters, listPublicHouses } from '@/features/houses/service'
import { listLandlordHouses } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import AppPage from '@/shared/components/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from '@/tabbar/config'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '找房',
    enablePullDownRefresh: true,
  },
})

const houses = ref<PublicHouseListOut[]>([])
const appContextStore = useAppContextStore()
const currentMode = computed(() => appContextStore.navigationMode)
const tabbarTitle = computed(() => getTabbarItems(currentMode.value).find(item => item.slot === 'business')?.text || '业务')
const filters = ref<PublicHouseFiltersOut | null>(null)
const loading = ref(false)
const loadError = ref('')
const finished = ref(false)
const showFilters = ref(false)
const page = ref(1)
const pageSize = 12
const total = ref(0)
const landlordHouses = ref<LandlordHouseOut[]>([])
const landlordPage = ref(1)
const landlordLoading = ref(false)
const landlordFinished = ref(false)
const landlordError = ref('')
const query = reactive({
  keyword: '',
  minRent: '',
  maxRent: '',
  minArea: '',
  maxArea: '',
  bedrooms: '' as string | number,
  district: '',
  elevatorOnly: false,
  sort: 'latest' as NonNullable<PublicHousesUsingGetParams['sort']>,
})

const activeFilterCount = computed(() => [query.minRent, query.maxRent, query.minArea, query.maxArea, query.bedrooms, query.district, query.elevatorOnly].filter(Boolean).length)
const organizationBusinessEntries = computed(() => [
  { title: '经营总览', subtitle: '打开全部组织经营功能', icon: 'i-carbon-apps', route: APP_ROUTES.organizationRental, featured: true },
  { title: '房源资产', subtitle: '房源、小区、楼栋与地图', icon: 'i-carbon-building', route: APP_ROUTES.organizationHouses },
  { title: '客户与带看', subtitle: '联系人和带看状态处理', icon: 'i-carbon-user-multiple', route: APP_ROUTES.organizationViewings },
  { title: '租约管理', subtitle: '租约详情与登记签约', icon: 'i-carbon-document', route: APP_ROUTES.organizationLeases },
  { title: '收益分配', subtitle: '申请与月度收益记录', icon: 'i-carbon-money', route: APP_ROUTES.organizationAllocation, capability: appContextStore.capabilities.allocation },
  { title: '经营分析', subtitle: '组织经营事件与趋势', icon: 'i-carbon-chart-line', route: APP_ROUTES.organizationAnalytics, capability: appContextStore.capabilities.analytics },
].filter(item => item.capability !== false))

function requestParams(): PublicHousesUsingGetParams {
  return {
    keyword: query.keyword,
    min_rent: query.minRent,
    max_rent: query.maxRent,
    min_area: query.minArea,
    max_area: query.maxArea,
    bedrooms: query.bedrooms === '' ? undefined : Number(query.bedrooms),
    district: query.district,
    has_elevator_access: query.elevatorOnly ? true : undefined,
    sort: query.sort,
    page: page.value,
    page_size: pageSize,
  }
}

async function loadHouses(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loadError.value = ''
  loading.value = true
  try {
    const result = await listPublicHouses(requestParams())
    houses.value = reset ? result.items : [...houses.value, ...result.items]
    total.value = result.total
    finished.value = houses.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '房源加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function retryHouses() {
  void loadHouses(houses.value.length === 0)
}

function search() {
  showFilters.value = false
  void loadHouses(true)
}

function resetFilters() {
  Object.assign(query, {
    minRent: '',
    maxRent: '',
    minArea: '',
    maxArea: '',
    bedrooms: '',
    district: '',
    elevatorOnly: false,
    sort: 'latest',
  })
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

function landlordCover(house: LandlordHouseOut) {
  const image = house.images[0] as { thumbnail?: string, url?: string } | undefined
  return image?.thumbnail || image?.url || ''
}

async function loadLandlordHouses(reset = false) {
  const contactId = appContextStore.currentLandlordRelationship?.contact_id
  if (!contactId || landlordLoading.value || (!reset && landlordFinished.value))
    return
  if (reset) {
    landlordPage.value = 1
    landlordFinished.value = false
  }
  landlordLoading.value = true
  landlordError.value = ''
  try {
    const result = await listLandlordHouses(contactId, landlordPage.value, pageSize)
    landlordHouses.value = reset ? result.items : [...landlordHouses.value, ...result.items]
    landlordFinished.value = landlordHouses.value.length >= result.total || result.items.length < pageSize
    if (!landlordFinished.value)
      landlordPage.value += 1
  }
  catch {
    landlordError.value = '房东房源加载失败，请稍后重试'
  }
  finally {
    landlordLoading.value = false
    uni.stopPullDownRefresh()
  }
}

function openLandlordHouse(houseId: number) {
  uni.navigateTo({ url: `${APP_ROUTES.landlordHouseDetail}?id=${encodeURIComponent(String(houseId))}` })
}

function openOrganizationRoute(url: string) {
  uni.navigateTo({ url })
}

onLoad((options) => {
  if (currentMode.value !== 'visitor' && currentMode.value !== 'personal')
    return
  if (options?.keyword)
    query.keyword = String(options.keyword)
  void Promise.all([
    getPublicHouseFilters().then(result => filters.value = result).catch(() => undefined),
    loadHouses(true),
  ])
})

onShow(() => {
  uni.setNavigationBarTitle({ title: tabbarTitle.value })
  if (currentMode.value === 'landlord')
    void loadLandlordHouses(true)
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
  <AppPage class="houses-page" tabbar>
    <template #navigation>
      <AppCustomNavigation :title="tabbarTitle" />
    </template>
    <template v-if="currentMode === 'visitor' || currentMode === 'personal'">
      <view class="search-bar">
        <view class="search-input">
          <wd-input v-model="query.keyword" placeholder="小区、区域或房源关键词" clearable @confirm="search" />
        </view>
        <wd-button size="small" @click="search">
          搜索
        </wd-button>
        <wd-button size="small" variant="plain" @click="showFilters = true">
          筛选{{ activeFilterCount ? ` ${activeFilterCount}` : '' }}
        </wd-button>
      </view>

      <view class="sort-row">
        <text class="result-count">{{ total }} 套公开房源</text>
        <view class="sort-actions">
          <text :class="{ active: query.sort === 'latest' }" @click="query.sort = 'latest'; search()">最新</text>
          <text :class="{ active: query.sort === 'rent_asc' }" @click="query.sort = 'rent_asc'; search()">租金从低到高</text>
        </view>
      </view>

      <view v-if="houses.length" class="house-list">
        <HouseCard v-for="house in houses" :key="house.id" :house="house" @click="openHouse(house.id)" />
      </view>
      <AppListState
        :loading="loading"
        :has-items="Boolean(houses.length)"
        :finished="finished"
        :error-message="loadError"
        loading-text="正在加载房源…"
        empty-text="暂时没有符合条件的公开房源"
        finished-text="已经到底了"
        @retry="retryHouses"
      />

      <wd-popup v-model="showFilters" position="bottom" :z-index="1100" custom-style="border-radius: 24rpx 24rpx 0 0; max-height: 82vh; overflow: auto;">
        <view class="filter-panel">
          <view class="filter-title">
            筛选房源
          </view>
          <view class="filter-label">
            租金范围（元/月）
          </view>
          <view class="filter-pair">
            <wd-input v-model="query.minRent" type="number" placeholder="最低租金" />
            <text>至</text>
            <wd-input v-model="query.maxRent" type="number" placeholder="最高租金" />
          </view>
          <view class="filter-label">
            面积范围（㎡）
          </view>
          <view class="filter-pair">
            <wd-input v-model="query.minArea" type="digit" placeholder="最小面积" />
            <text>至</text>
            <wd-input v-model="query.maxArea" type="digit" placeholder="最大面积" />
          </view>
          <view class="filter-label">
            卧室数量
          </view>
          <view class="choice-row">
            <wd-tag :type="query.bedrooms === '' ? 'primary' : 'default'" variant="light" @click="query.bedrooms = ''">
              不限
            </wd-tag>
            <wd-tag v-for="item in filters?.bedrooms || []" :key="item" :type="query.bedrooms === item ? 'primary' : 'default'" variant="light" @click="query.bedrooms = item">
              {{ item }} 室
            </wd-tag>
          </view>
          <view v-if="filters?.districts.length" class="filter-label">
            区域
          </view>
          <view v-if="filters?.districts.length" class="choice-row">
            <wd-tag :type="query.district === '' ? 'primary' : 'default'" variant="light" @click="query.district = ''">
              不限
            </wd-tag>
            <wd-tag v-for="item in filters.districts" :key="item" :type="query.district === item ? 'primary' : 'default'" variant="light" @click="query.district = item">
              {{ item }}
            </wd-tag>
          </view>
          <view class="switch-row">
            <text>只看有电梯</text>
            <wd-switch v-model="query.elevatorOnly" />
          </view>
          <view class="filter-actions">
            <wd-button block variant="plain" @click="resetFilters">
              重置
            </wd-button>
            <wd-button block @click="search">
              查看房源
            </wd-button>
          </view>
        </view>
      </wd-popup>
    </template>

    <template v-else-if="currentMode === 'landlord'">
      <view class="mode-heading">
        <view class="mode-title">
          名下房源
        </view>
        <view class="mode-subtitle">
          {{ appContextStore.currentLandlordRelationship?.organization_name }} · {{ appContextStore.currentLandlordRelationship?.contact_name }}
        </view>
      </view>
      <view class="summary-card">
        <view><strong>{{ appContextStore.currentLandlordRelationship?.house_count || 0 }}</strong><text>关联房源</text></view>
        <view><strong>{{ appContextStore.currentLandlordRelationship?.public_house_count || 0 }}</strong><text>公开展示</text></view>
      </view>
      <view v-if="landlordHouses.length" class="landlord-house-list">
        <view v-for="item in landlordHouses" :key="item.id" class="landlord-house-card" @click="openLandlordHouse(item.id)">
          <image v-if="landlordCover(item)" class="landlord-cover" :src="landlordCover(item)" mode="aspectFill" />
          <view v-else class="landlord-cover landlord-cover--empty">
            暂无图片
          </view>
          <view class="landlord-house-main">
            <view class="landlord-house-topline">
              <strong>{{ formatTenantHouseTitle(item) }}</strong>
              <wd-tag :type="getLandlordHouseStatusTone(item.status)" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </view>
            <view class="landlord-house-facts">
              {{ formatHouseLayout(item.bedrooms, item.living_rooms) }} · {{ item.area || '--' }}㎡ · {{ item.asking_rent || '面议' }}元/月
            </view>
          </view>
        </view>
      </view>
      <AppListState
        :loading="landlordLoading"
        :has-items="Boolean(landlordHouses.length)"
        :finished="landlordFinished"
        :error-message="landlordError"
        loading-text="正在加载名下房源…"
        empty-text="当前房东关系下暂无房源"
        finished-text="没有更多房源了"
        @retry="loadLandlordHouses(landlordHouses.length === 0)"
      />
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
      <view class="scope-notice">
        收益分配和经营分析继续按当前组织权限显示；具体数据仍由后端执行成员与 RBAC 校验。
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.search-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.search-input {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  border-radius: 16rpx;
  background: var(--app-bg-card);
}
.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 28rpx 4rpx 20rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
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
.house-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.filter-panel {
  padding: 34rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
}
.filter-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.filter-label {
  margin: 32rpx 0 16rpx;
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 600;
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
.filter-actions {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 18rpx;
  margin-top: 36rpx;
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
  padding: 26rpx;
  border-radius: 20rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
  background: var(--app-bg-brand-soft);
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
</style>
