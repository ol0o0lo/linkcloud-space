<script setup lang="ts">
import type { FavoriteOut } from '@/features/favorites/service'
import type { LeaseOut } from '@/features/landlord/service'
import type { AnnouncementOut, DailyDashboardOut } from '@/features/organization-work/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationWorkDateTime, getAssignmentStatusTone, getPriorityTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { formatTenantHouseTitle, getTenantLeaseStatusTone } from '@/domain/tenant-rental'
import { listHouseFavorites, unfavoriteHouse } from '@/features/favorites/service'
import { listLandlordLeases } from '@/features/landlord/service'
import { getDailyOrganizationWorkDashboard, listOrganizationAnnouncements } from '@/features/organization-work/service'
import { APP_ROUTES, getHouseDetailRoute, getOrganizationAnnouncementDetailRoute, getOrganizationTaskDetailRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from '@/tabbar/config'
import AppListState from '@/shared/components/AppListState.vue'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import AppPage from '@/shared/components/AppPage.vue'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的找房',
    enablePullDownRefresh: true,
  },
})

const items = ref<FavoriteOut[]>([])
const appContextStore = useAppContextStore()
const currentMode = computed(() => appContextStore.navigationMode)
const tabbarTitle = computed(() => getTabbarItems(currentMode.value).find(item => item.slot === 'activity')?.text || '动态')
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')
const landlordLeases = ref<LeaseOut[]>([])
const landlordLeasePage = ref(1)
const landlordLeaseLoading = ref(false)
const landlordLeaseFinished = ref(false)
const landlordLeaseError = ref('')
const organizationDashboard = ref<DailyDashboardOut | null>(null)
const organizationAnnouncements = ref<AnnouncementOut[]>([])
const organizationLoading = ref(false)
const organizationError = ref('')
let organizationLoadId = 0

async function loadFavorites(reset = false) {
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loadError.value = ''
  loading.value = true
  try {
    const result = await listHouseFavorites(page.value, pageSize)
    items.value = reset ? result.items : [...items.value, ...result.items]
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '收藏加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function retryFavorites() {
  void loadFavorites(items.value.length === 0)
}

function openFavorite(item: FavoriteOut) {
  if (!item.available) {
    uni.showToast({ title: '该房源已下架', icon: 'none' })
    return
  }
  uni.navigateTo({ url: getHouseDetailRoute(Number(item.target_id)) })
}

async function removeFavorite(item: FavoriteOut) {
  try {
    await unfavoriteHouse(Number(item.target_id))
    items.value = items.value.filter(current => current.id !== item.id)
    uni.showToast({ title: '已取消收藏', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '取消失败，请稍后重试', icon: 'none' })
  }
}

function openTenantViewings() {
  uni.navigateTo({ url: APP_ROUTES.tenantViewings })
}

function openTenantLeases() {
  uni.navigateTo({ url: APP_ROUTES.tenantLeases })
}

async function loadLandlordLeases(reset = false) {
  const contactId = appContextStore.currentLandlordRelationship?.contact_id
  if (!contactId || landlordLeaseLoading.value || (!reset && landlordLeaseFinished.value))
    return
  if (reset) {
    landlordLeasePage.value = 1
    landlordLeaseFinished.value = false
  }
  landlordLeaseLoading.value = true
  landlordLeaseError.value = ''
  try {
    const result = await listLandlordLeases(contactId, landlordLeasePage.value, pageSize)
    landlordLeases.value = reset ? result.items : [...landlordLeases.value, ...result.items]
    landlordLeaseFinished.value = landlordLeases.value.length >= result.total || result.items.length < pageSize
    if (!landlordLeaseFinished.value)
      landlordLeasePage.value += 1
  }
  catch {
    landlordLeaseError.value = '房东租约加载失败，请稍后重试'
  }
  finally {
    landlordLeaseLoading.value = false
    uni.stopPullDownRefresh()
  }
}

function openLandlordLease(leaseId: number) {
  uni.navigateTo({ url: `${APP_ROUTES.landlordLeaseDetail}?id=${encodeURIComponent(String(leaseId))}` })
}

function openOrganizationRoute(url: string) {
  uni.navigateTo({ url })
}

async function loadOrganizationTasks() {
  const organizationSlug = appContextStore.organizationSlug
  const currentLoadId = ++organizationLoadId
  if (!organizationSlug) {
    organizationDashboard.value = null
    organizationAnnouncements.value = []
    organizationError.value = '未选择组织，请先切换到中介端'
    uni.stopPullDownRefresh()
    return
  }
  organizationLoading.value = true
  organizationError.value = ''
  try {
    const [dashboard, announcements] = await Promise.all([
      getDailyOrganizationWorkDashboard(organizationSlug),
      listOrganizationAnnouncements(organizationSlug, 1, 3, { status: 'published' }),
    ])
    if (currentLoadId !== organizationLoadId || currentMode.value !== 'organization' || appContextStore.organizationSlug !== organizationSlug)
      return
    organizationDashboard.value = dashboard
    organizationAnnouncements.value = announcements.items
  }
  catch (error) {
    if (currentLoadId === organizationLoadId)
      organizationError.value = error instanceof Error ? error.message : '待办摘要加载失败'
  }
  finally {
    if (currentLoadId === organizationLoadId) {
      organizationLoading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

onShow(() => {
  uni.setNavigationBarTitle({ title: tabbarTitle.value })
  if (currentMode.value === 'personal')
    void loadFavorites(true)
  else if (currentMode.value === 'landlord')
    void loadLandlordLeases(true)
  else if (currentMode.value === 'organization')
    void loadOrganizationTasks()
})
onPullDownRefresh(() => {
  if (currentMode.value === 'personal')
    return loadFavorites(true)
  if (currentMode.value === 'landlord')
    return loadLandlordLeases(true)
  if (currentMode.value === 'organization')
    return loadOrganizationTasks()
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  if (currentMode.value === 'personal')
    void loadFavorites()
  else if (currentMode.value === 'landlord')
    void loadLandlordLeases()
})
</script>

<template>
  <AppPage class="favorites-page" tabbar>
    <template #navigation>
      <AppCustomNavigation :title="tabbarTitle" />
    </template>
    <template v-if="currentMode === 'personal'">
      <view class="page-heading">
        <view class="page-title">
          我的找房
        </view>
        <view class="page-subtitle">
          管理收藏、预约带看进度和本人租约
        </view>
      </view>

      <view class="business-actions">
        <view class="business-action" @click="openTenantViewings">
          <view class="business-icon i-carbon-calendar" />
          <view><strong>我的预约</strong><text>查看带看进度、取消待进行预约</text></view>
          <view class="i-carbon-chevron-right" />
        </view>
        <view class="business-action" @click="openTenantLeases">
          <view class="business-icon i-carbon-document" />
          <view><strong>我的租约</strong><text>查看租期、租金和合同资料</text></view>
          <view class="i-carbon-chevron-right" />
        </view>
      </view>

      <view class="section-title">
        收藏房源
      </view>

      <view v-if="items.length" class="favorite-list">
        <view v-for="item in items" :key="item.id" class="favorite-card" :class="{ unavailable: !item.available }" @click="openFavorite(item)">
          <image v-if="item.display?.cover_url" class="favorite-cover" :src="item.display.cover_url" mode="aspectFill" />
          <view v-else class="favorite-cover favorite-cover--empty">
            暂无图片
          </view>
          <view class="favorite-content">
            <view class="favorite-title">
              {{ item.display?.title || `房源 ${item.target_id}` }}
            </view>
            <view class="favorite-subtitle">
              {{ item.available ? (item.display?.subtitle || '查看房源详情') : '房源已下架' }}
            </view>
            <view v-if="item.display?.facts?.length" class="favorite-facts">
              <text v-for="fact in item.display.facts.slice(0, 2)" :key="fact.label">{{ fact.value }}</text>
            </view>
            <view class="favorite-actions">
              <text>{{ new Date(item.created_at).toLocaleDateString() }} 收藏</text>
              <wd-button size="mini" variant="text" type="danger" @click.stop="removeFavorite(item)">
                取消收藏
              </wd-button>
            </view>
          </view>
        </view>
      </view>
      <AppListState
        :loading="loading"
        :has-items="Boolean(items.length)"
        :finished="finished"
        :error-message="loadError"
        loading-text="正在加载收藏…"
        empty-text="还没有收藏房源，去找房看看吧"
        finished-text="没有更多收藏了"
        @retry="retryFavorites"
      />
    </template>

    <template v-else-if="currentMode === 'landlord'">
      <view class="page-heading">
        <view class="page-title">
          关联租约
        </view>
        <view class="page-subtitle">
          {{ appContextStore.currentLandlordRelationship?.organization_name }} · {{ appContextStore.currentLandlordRelationship?.contact_name }}
        </view>
      </view>
      <view v-if="landlordLeases.length" class="landlord-lease-list">
        <view v-for="item in landlordLeases" :key="item.id" class="landlord-lease-card" @click="openLandlordLease(item.id)">
          <view class="landlord-lease-topline">
            <strong>{{ formatTenantHouseTitle(item.house) }}</strong>
            <wd-tag :type="getTenantLeaseStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag>
          </view>
          <view class="landlord-rent">
            ¥{{ item.monthly_rent }} / 月
          </view>
          <view class="landlord-term">
            {{ item.start_date }} 至 {{ item.end_date }}
          </view>
        </view>
      </view>
      <AppListState
        :loading="landlordLeaseLoading"
        :has-items="Boolean(landlordLeases.length)"
        :finished="landlordLeaseFinished"
        :error-message="landlordLeaseError"
        loading-text="正在加载关联租约…"
        empty-text="当前房东关系下暂无租约"
        finished-text="没有更多租约了"
        @retry="loadLandlordLeases(landlordLeases.length === 0)"
      />
    </template>

    <template v-else-if="currentMode === 'organization'">
      <view class="page-heading">
        <view class="page-title">
          管理待办
        </view>
        <view class="page-subtitle">
          {{ appContextStore.currentOrganization?.name }}
        </view>
      </view>
      <view v-if="organizationDashboard" class="todo-summary-grid">
        <view @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.pending_acceptance }}</strong><text>待接受</text>
        </view>
        <view @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.in_progress }}</strong><text>进行中</text>
        </view>
        <view class="danger" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
          <strong>{{ organizationDashboard.overdue }}</strong><text>已逾期</text>
        </view>
        <view class="warning" @click="openOrganizationRoute(APP_ROUTES.organizationAnnouncements)">
          <strong>{{ organizationDashboard.unacknowledged_announcements }}</strong><text>公告待确认</text>
        </view>
      </view>

      <view v-if="organizationError && !organizationDashboard" class="scope-notice scope-notice--error">
        <text>{{ organizationError }}</text>
        <wd-button size="small" variant="text" @click="loadOrganizationTasks">
          重新加载
        </wd-button>
      </view>
      <view v-else-if="organizationLoading && !organizationDashboard" class="scope-notice">
        正在加载本人任务与公告…
      </view>

      <view class="organization-entry" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
        <view class="mode-icon i-carbon-task" />
        <view><strong>本人任务</strong><text>接受、完成或拒绝当前组织分配给我的任务</text></view>
        <view class="i-carbon-chevron-right" />
      </view>

      <view class="section-heading">
        <strong>优先处理</strong><text @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">查看全部</text>
      </view>
      <view v-if="organizationDashboard?.urgent_items?.length" class="organization-list">
        <view v-for="item in organizationDashboard.urgent_items" :key="item.id" class="organization-record" @click="openOrganizationRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
          <view class="organization-record-topline">
            <strong>{{ item.task_title }}</strong>
            <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
              {{ item.priority__mapping }}
            </wd-tag>
          </view>
          <view class="organization-record-meta">
            <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag>
            <text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="organizationDashboard" class="quiet-card">
        当前没有紧急任务
      </view>

      <view class="section-heading">
        <strong>近期公告</strong><text @click="openOrganizationRoute(APP_ROUTES.organizationAnnouncements)">查看全部</text>
      </view>
      <view v-if="organizationAnnouncements.length" class="organization-list">
        <view v-for="item in organizationAnnouncements" :key="item.id" class="organization-record" @click="openOrganizationRoute(getOrganizationAnnouncementDetailRoute(item.id))">
          <view class="organization-record-topline">
            <strong>{{ item.title }}</strong>
            <wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
              {{ item.is_acknowledged ? '已确认' : '待确认' }}
            </wd-tag>
          </view>
          <text class="organization-record-body">{{ item.body }}</text>
          <view class="organization-record-meta">
            <text>{{ item.team_name || '全组织' }}</text><text>{{ formatOrganizationWorkDateTime(item.published_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="organizationDashboard" class="quiet-card">
        近期没有已发布公告
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.page-heading {
  padding: 8rpx 4rpx 28rpx;
}
.page-title {
  color: var(--app-text-primary);
  font-size: 40rpx;
  font-weight: 700;
}
.page-subtitle {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 25rpx;
}
.business-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.business-action {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  background: var(--app-bg-card);
}
.business-action > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.business-action strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.business-action text {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.business-icon {
  color: var(--app-color-brand);
  font-size: 44rpx;
}
.section-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.favorite-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.favorite-card {
  display: flex;
  gap: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.favorite-card.unavailable {
  opacity: 0.66;
}
.favorite-cover {
  flex: 0 0 210rpx;
  width: 210rpx;
  height: 170rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.favorite-cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.favorite-content {
  min-width: 0;
  flex: 1;
}
.favorite-title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-subtitle {
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.favorite-facts {
  display: flex;
  gap: 18rpx;
  margin-top: 16rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.favorite-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.mode-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 30rpx 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.mode-card > view:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
}
.mode-card strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.mode-card text {
  color: var(--app-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}
.mode-icon {
  flex: 0 0 auto;
  color: var(--app-color-brand);
  font-size: 50rpx;
}
.todo-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}
.todo-summary-grid view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 22rpx 8rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.todo-summary-grid strong {
  color: var(--app-color-primary);
  font-size: 34rpx;
}
.todo-summary-grid text {
  color: var(--app-text-muted);
  font-size: 19rpx;
  text-align: center;
}
.todo-summary-grid .warning strong {
  color: var(--app-color-warning);
}
.todo-summary-grid .danger strong {
  color: var(--app-color-danger);
}
.organization-entry {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: 22rpx;
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.organization-entry > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.organization-entry strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.organization-entry text {
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.5;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 34rpx 6rpx 16rpx;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.section-heading text {
  color: var(--app-color-brand);
  font-size: 23rpx;
}
.organization-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.organization-record {
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.organization-record-topline,
.organization-record-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.organization-record-topline strong {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.organization-record-meta {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.organization-record-body {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.quiet-card {
  padding: 28rpx;
  border-radius: 22rpx;
  color: var(--app-text-muted);
  text-align: center;
  background: var(--app-bg-card);
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
.scope-notice--error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  color: var(--app-color-danger);
}
.landlord-lease-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.landlord-lease-card {
  padding: 28rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.landlord-lease-topline {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.landlord-lease-topline strong {
  min-width: 0;
  flex: 1;
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.landlord-rent {
  margin-top: 24rpx;
  color: var(--app-color-price);
  font-size: 32rpx;
  font-weight: 700;
}
.landlord-term {
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
</style>
