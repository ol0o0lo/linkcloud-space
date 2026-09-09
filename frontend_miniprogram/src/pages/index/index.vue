<script lang="ts" setup>
import type { PublicHouseListOut } from '@/features/houses/service'
import type { DailyDashboardOut } from '@/features/organization-work/service'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import HouseCard from '@/features/houses/components/HouseCard.vue'
import { listPublicHouses } from '@/features/houses/service'
import { getDailyOrganizationWorkDashboard } from '@/features/organization-work/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import AppPage from '@/shared/components/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

defineOptions({ name: 'Home' })
definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页',
  },
})

const appContextStore = useAppContextStore()
const recommendations = ref<PublicHouseListOut[]>([])
const loading = ref(false)
const organizationDashboard = ref<DailyDashboardOut | null>(null)
const organizationDashboardLoading = ref(false)
const organizationDashboardError = ref('')
let organizationDashboardLoadId = 0
const currentMode = computed(() => appContextStore.navigationMode)
const greeting = computed(() => appContextStore.authenticated ? `欢迎回来，${appContextStore.user?.first_name || appContextStore.user?.username}` : '先看看全城公开好房')
const organizationPendingTaskCount = computed(() => (organizationDashboard.value?.pending_acceptance || 0) + (organizationDashboard.value?.in_progress || 0))

async function loadRecommendations() {
  if (loading.value)
    return
  loading.value = true
  try {
    recommendations.value = (await listPublicHouses({ page: 1, page_size: 3, sort: 'latest' })).items
  }
  catch {
    recommendations.value = []
  }
  finally {
    loading.value = false
  }
}

function goFindHouse() {
  uni.switchTab({ url: '/pages/houses/index' })
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

function goFavorites() {
  if (appContextStore.authenticated)
    uni.switchTab({ url: '/pages/favorites/index' })
  else
    uni.navigateTo({ url: '/pages/auth/login?redirect=%2Fpages%2Ffavorites%2Findex' })
}

function switchTab(url: string) {
  uni.switchTab({ url })
}

function openLandlordStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
}

function openOrganizationRoute(url: string) {
  uni.navigateTo({ url })
}

async function loadOrganizationDashboard() {
  const organizationSlug = appContextStore.organizationSlug
  const currentLoadId = ++organizationDashboardLoadId
  if (!organizationSlug) {
    organizationDashboard.value = null
    organizationDashboardError.value = '未选择组织，请先切换到中介端'
    return
  }
  organizationDashboardLoading.value = true
  organizationDashboardError.value = ''
  try {
    const result = await getDailyOrganizationWorkDashboard(organizationSlug)
    if (currentLoadId === organizationDashboardLoadId && currentMode.value === 'organization' && appContextStore.organizationSlug === organizationSlug)
      organizationDashboard.value = result
  }
  catch (error) {
    if (currentLoadId === organizationDashboardLoadId)
      organizationDashboardError.value = error instanceof Error ? error.message : '工作台摘要加载失败'
  }
  finally {
    if (currentLoadId === organizationDashboardLoadId)
      organizationDashboardLoading.value = false
  }
}

onShow(() => {
  if (currentMode.value === 'visitor' || currentMode.value === 'personal')
    void loadRecommendations()
  else if (currentMode.value === 'organization')
    void loadOrganizationDashboard()
  else
    organizationDashboardLoadId += 1
})
</script>

<template>
  <AppPage class="home-page" tabbar>
    <template #navigation>
      <AppCustomNavigation title="链云空间" subtitle="公开房源" />
    </template>

    <template v-if="currentMode === 'visitor' || currentMode === 'personal'">
      <view class="hero">
        <view class="brand">
          链云空间
        </view>
        <view class="hero-title">
          {{ greeting }}
        </view>
        <view class="hero-copy">
          无需加入组织即可查看公开房源，登录后可随时收藏并继续找房。
        </view>
        <wd-button size="large" @click="goFindHouse">
          开始找房
        </wd-button>
      </view>

      <view class="quick-grid">
        <view class="quick-card" @click="goFindHouse">
          <view class="quick-icon i-carbon-search" />
          <view><strong>全城找房</strong><text>按租金、区域和户型筛选</text></view>
        </view>
        <view class="quick-card" @click="goFavorites">
          <view class="quick-icon i-carbon-favorite" />
          <view><strong>我的找房</strong><text>保存关注的公开房源</text></view>
        </view>
      </view>

      <view class="section-heading">
        <view><strong>最新房源</strong><text>刚刚更新的公开房源</text></view>
        <text class="more" @click="goFindHouse">查看全部</text>
      </view>
      <view v-if="recommendations.length" class="house-list">
        <HouseCard v-for="house in recommendations" :key="house.id" :house="house" @click="openHouse(house.id)" />
      </view>
      <wd-empty v-else-if="!loading" tip="暂时没有公开房源" />
      <view v-else class="loading">
        正在加载最新房源…
      </view>
    </template>

    <template v-else-if="currentMode === 'landlord'">
      <view class="hero hero--landlord">
        <view class="brand">
          房东概览
        </view>
        <view class="hero-title">
          {{ appContextStore.currentLandlordRelationship?.contact_name }}
        </view>
        <view class="hero-copy">
          当前合作方：{{ appContextStore.currentLandlordRelationship?.organization_name }}
        </view>
      </view>
      <view class="metric-grid">
        <view class="metric-card" @click="switchTab('/pages/houses/index')">
          <strong>{{ appContextStore.currentLandlordRelationship?.house_count || 0 }}</strong>
          <text>关联房源</text>
        </view>
        <view class="metric-card" @click="switchTab('/pages/houses/index')">
          <strong>{{ appContextStore.currentLandlordRelationship?.public_house_count || 0 }}</strong>
          <text>公开展示</text>
        </view>
      </view>
      <view class="quick-grid">
        <view class="quick-card" @click="switchTab('/pages/favorites/index')">
          <view class="quick-icon i-carbon-document" />
          <view><strong>关联租约</strong><text>查看租期和租客信息</text></view>
        </view>
        <view class="quick-card" @click="openLandlordStore">
          <view class="quick-icon i-carbon-store" />
          <view><strong>公开店铺</strong><text>查看并分享公开房源</text></view>
        </view>
      </view>
      <view class="notice-card">
        当前仅展示与你绑定的房东信息，中介管理功能需切换到中介端使用。
      </view>
    </template>

    <template v-else-if="currentMode === 'organization'">
      <view class="hero hero--organization">
        <view class="brand">
          组织工作台
        </view>
        <view class="hero-title">
          {{ appContextStore.currentOrganization?.name }}
        </view>
        <view class="hero-copy">
          <template v-if="organizationDashboard">
            {{ organizationPendingTaskCount }} 项任务待处理，{{ organizationDashboard.unacknowledged_announcements }} 条公告待确认。
          </template>
          <template v-else>
            当前组织和权限已更新，下面仅展示与你有关的事项。
          </template>
        </view>
        <wd-button size="large" @click="openOrganizationRoute(APP_ROUTES.organizationWork)">
          进入协作工作台
        </wd-button>
      </view>

      <view v-if="organizationDashboard" class="organization-metrics">
        <view @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.pending_acceptance }}</strong><text>待接受</text>
        </view>
        <view @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.in_progress }}</strong><text>进行中</text>
        </view>
        <view class="warning" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.due_today }}</strong><text>今日到期</text>
        </view>
        <view class="danger" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.overdue }}</strong><text>已逾期</text>
        </view>
      </view>
      <view v-else-if="organizationDashboardLoading" class="notice-card">
        正在加载今日工作摘要…
      </view>
      <view v-else-if="organizationDashboardError" class="notice-card notice-card--error">
        <text>{{ organizationDashboardError }}</text>
        <wd-button size="small" variant="text" @click="loadOrganizationDashboard">
          重新加载
        </wd-button>
      </view>

      <view class="section-heading">
        <view><strong>常用功能</strong><text>快速进入日常工作</text></view>
      </view>
      <view class="quick-grid">
        <view class="quick-card" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <view class="quick-icon i-carbon-task" />
          <view><strong>我的任务</strong><text>{{ organizationPendingTaskCount ? `${organizationPendingTaskCount} 项待处理` : '查看分配给我的任务' }}</text></view>
        </view>
        <view class="quick-card" @click="openOrganizationRoute(APP_ROUTES.organizationAnnouncements)">
          <view class="quick-icon i-carbon-volume-up" />
          <view><strong>组织公告</strong><text>{{ organizationDashboard?.unacknowledged_announcements ? `${organizationDashboard.unacknowledged_announcements} 条待确认` : '查看近期公告' }}</text></view>
        </view>
        <view class="quick-card" @click="openOrganizationRoute(APP_ROUTES.organizationRental)">
          <view class="quick-icon i-carbon-building" />
          <view><strong>租赁经营</strong><text>房源、客户、带看与租约</text></view>
        </view>
        <view class="quick-card" @click="switchTab('/pages/messages/index')">
          <view class="quick-icon i-carbon-notification" />
          <view><strong>组织消息</strong><text>查看当前组织通知</text></view>
        </view>
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.home-page {
}
.hero {
  padding: 46rpx 34rpx;
  border-radius: 32rpx;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-personal);
  box-shadow: var(--app-shadow-hero-personal);
}
.hero--landlord {
  background: var(--app-gradient-landlord);
  box-shadow: var(--app-shadow-hero-landlord);
}
.hero--organization {
  background: var(--app-gradient-organization);
  box-shadow: var(--app-shadow-hero-organization);
}
.brand {
  font-size: 25rpx;
  letter-spacing: 4rpx;
  opacity: 0.8;
}
.hero-title {
  max-width: 560rpx;
  margin-top: 34rpx;
  font-size: 48rpx;
  font-weight: 700;
  line-height: 1.3;
}
.hero-copy {
  margin: 20rpx 0 34rpx;
  font-size: 26rpx;
  line-height: 1.7;
  opacity: 0.84;
}
.quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 22rpx;
}
.quick-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-width: 0;
  padding: 26rpx 22rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.quick-card view:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.quick-card strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.quick-card text {
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.4;
}
.quick-icon {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 44rpx;
}
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 22rpx;
}
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 30rpx 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.metric-card strong {
  color: var(--app-color-warm);
  font-size: 42rpx;
}
.metric-card text {
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.organization-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}
.organization-metrics view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 22rpx 8rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.organization-metrics strong {
  color: var(--app-color-primary);
  font-size: 34rpx;
}
.organization-metrics text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.organization-metrics .warning strong {
  color: var(--app-color-warning);
}
.organization-metrics .danger strong {
  color: var(--app-color-danger);
}
.notice-card {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 22rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  line-height: 1.7;
  background: var(--app-bg-card);
}
.notice-card--error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  color: var(--app-color-danger);
}
.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 42rpx 4rpx 22rpx;
}
.section-heading view {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.section-heading text {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.section-heading .more {
  color: var(--app-color-brand);
  font-size: 24rpx;
}
.house-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.loading {
  padding: 80rpx 0;
  color: var(--app-text-muted);
  text-align: center;
}
</style>
