<script setup lang="ts">
import type { FavoriteOut } from '@/features/favorites/service'
import type { LeaseOut } from '@/features/landlord/service'
import type { AnnouncementOut, DailyDashboardOut } from '@/features/organization-work/service'
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { buildFavoriteHouseCardModel } from '@/domain/house-card'
import { formatOrganizationWorkDateTime, getAssignmentStatusTone, getPriorityTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { formatTenantHouseTitle, getTenantLeaseStatusTone, getTenantViewingStatusTone } from '@/domain/tenant-rental'
import { listHouseFavorites, unfavoriteHouse } from '@/features/favorites/service'
import { listLandlordLeases } from '@/features/landlord/service'
import { getDailyOrganizationWorkDashboard, listOrganizationAnnouncements } from '@/features/organization-work/service'
import { cancelScheduledTenantViewing, listCurrentTenantViewings, listHistoricalTenantViewings } from '@/features/tenant-rental/service'
import { APP_ROUTES, getHouseDetailRoute, getOrganizationAnnouncementDetailRoute, getOrganizationTaskDetailRoute, getTenantViewingDetailRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from '@/tabbar/config'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的找房',
    enablePullDownRefresh: true,
  },
})

const appContextStore = useAppContextStore()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
const currentMode = computed(() => appContextStore.navigationMode)
const tabbarTitle = computed(() => {
  const visibleTitle = getTabbarItems(currentMode.value).find(item => item.slot === 'activity')?.text
  if (visibleTitle)
    return visibleTitle
  if (currentMode.value === 'personal')
    return '我的找房'
  if (currentMode.value === 'landlord')
    return '租约'
  return '动态'
})
const pageSize = 12
const organizationDashboard = ref<DailyDashboardOut | null>(null)
const organizationAnnouncements = ref<AnnouncementOut[]>([])
const organizationLoading = ref(false)
const organizationError = ref('')
const activePersonalTab = ref<'favorites' | 'viewings'>('favorites')
const removingFavoriteIds = ref<Set<number>>(new Set())
const cancelingViewingId = ref<number | null>(null)
const historyExpanded = ref(false)
let organizationLoadId = 0

const favoritePage = usePagedPage<FavoriteOut>({
  loader: ({ page, pageSize: targetPageSize }) => listHouseFavorites(page, targetPageSize),
  pageSize,
  enabled: () => currentMode.value === 'personal',
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

const currentViewingPage = usePagedPage<TenantViewingRecordOut>({
  loader: async () => {
    const items = await listCurrentTenantViewings()
    return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) }
  },
  pageSize,
  enabled: () => currentMode.value === 'personal',
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

const historicalViewingPage = usePagedPage<TenantViewingRecordOut>({
  loader: ({ page, pageSize: targetPageSize }) => listHistoricalTenantViewings(page, targetPageSize),
  pageSize,
  enabled: () => currentMode.value === 'personal' && historyExpanded.value,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

const currentViewings = computed(() => {
  const now = Date.now()
  return [...currentViewingPage.items.value]
    .sort((left, right) => {
      const leftTime = Date.parse(left.scheduled_at)
      const rightTime = Date.parse(right.scheduled_at)
      const leftPast = leftTime < now
      const rightPast = rightTime < now
      if (leftPast !== rightPast)
        return leftPast ? 1 : -1
      return leftPast ? rightTime - leftTime : leftTime - rightTime
    })
})

const historicalViewings = computed(() => [...historicalViewingPage.items.value]
  .sort((left, right) => Date.parse(right.scheduled_at) - Date.parse(left.scheduled_at)))

const landlordLeasePage = usePagedPage<LeaseOut>({
  loader: ({ page, pageSize: targetPageSize }) => listLandlordLeases(appContextStore.currentLandlordRelationship!.contact_id, page, targetPageSize),
  pageSize,
  enabled: () => currentMode.value === 'landlord' && Boolean(appContextStore.currentLandlordRelationship?.contact_id),
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

function retryFavorites() {
  void favoritePage.refresh()
}

const unavailableFavoriteCount = computed(() => favoritePage.items.value.filter(item => !item.available).length)

function goFindHouse() {
  uni.navigateTo({ url: APP_ROUTES.publicHouseSearch })
}

function openFavorite(item: FavoriteOut) {
  if (!item.available) {
    uni.showToast({ title: '该房源已下架', icon: 'none' })
    return
  }
  uni.navigateTo({ url: getHouseDetailRoute(Number(item.target_id)) })
}

function isRemovingFavorite(item: FavoriteOut) {
  return removingFavoriteIds.value.has(Number(item.target_id))
}

async function removeFavorite(item: FavoriteOut) {
  const houseId = Number(item.target_id)
  if (removingFavoriteIds.value.has(houseId))
    return

  removingFavoriteIds.value = new Set(removingFavoriteIds.value).add(houseId)
  try {
    await unfavoriteHouse(houseId)
    favoritePage.remove(item)
    uni.showToast({ title: '已取消收藏', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    const next = new Set(removingFavoriteIds.value)
    next.delete(houseId)
    removingFavoriteIds.value = next
  }
}

function openTenantViewing(viewingRecordId: number) {
  uni.navigateTo({ url: getTenantViewingDetailRoute(viewingRecordId) })
}

function formatViewingDateTime(value: string | null) {
  if (!value)
    return '--'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function isPastScheduledViewing(item: TenantViewingRecordOut) {
  return item.status === 'scheduled' && Date.parse(item.scheduled_at) < Date.now()
}

function toggleHistory() {
  historyExpanded.value = !historyExpanded.value
  if (historyExpanded.value && !historicalViewingPage.loaded.value)
    void historicalViewingPage.refresh()
}

function handlePersonalTabChange({ name }: { name: number | string }) {
  if (name === 'viewings' && !currentViewingPage.loaded.value)
    void currentViewingPage.refresh()
}

async function cancelViewing(item: TenantViewingRecordOut) {
  const confirmation = await uni.showModal({ title: '取消预约', content: '取消后由中介端同步看到该状态，确定继续吗？', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return

  cancelingViewingId.value = item.id
  try {
    const updated = await cancelScheduledTenantViewing(item.id)
    currentViewingPage.remove(item)
    if (historicalViewingPage.loaded.value)
      historicalViewingPage.upsert(updated)
    uni.showToast({ title: '预约已取消', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    cancelingViewingId.value = null
  }
}

async function refreshPersonalPage() {
  if (activePersonalTab.value === 'viewings') {
    await currentViewingPage.refresh()
    if (historyExpanded.value)
      await historicalViewingPage.refresh()
  }
  else {
    await favoritePage.refresh()
  }
}

function loadMorePersonalPage() {
  if (activePersonalTab.value === 'viewings') {
    if (historyExpanded.value)
      return historicalViewingPage.loadMore()
    return currentViewingPage.loadMore()
  }
  return favoritePage.loadMore()
}

async function loadLandlordLeases(reset = false) {
  await (reset ? landlordLeasePage.refresh() : landlordLeasePage.loadMore())
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
    void refreshPersonalPage()
  else if (currentMode.value === 'landlord')
    void loadLandlordLeases(true)
  else if (currentMode.value === 'organization')
    void loadOrganizationTasks()
})
onPullDownRefresh(() => {
  if (currentMode.value === 'personal')
    return refreshPersonalPage()
  if (currentMode.value === 'landlord')
    return loadLandlordLeases(true)
  if (currentMode.value === 'organization')
    return loadOrganizationTasks()
  uni.stopPullDownRefresh()
})
onReachBottom(() => {
  if (currentMode.value === 'personal')
    void loadMorePersonalPage()
  else if (currentMode.value === 'landlord')
    void loadLandlordLeases()
})
</script>

<template>
  <AppPage class="favorites-page" tabbar ai-background>
    <template #navigation>
      <AppCustomNavigation title="" scroll-mode="fade" :scrolled="navigationScrolled" content-opacity-mode="fade-in" :scroll-progress="navigationProgress" />
    </template>
    <template v-if="currentMode === 'personal'">
      <view class="personal-tabs-shell">
        <wd-tabs v-model="activePersonalTab" custom-class="personal-tabs" line-theme="text" :line-height="3" @change="handlePersonalTabChange">
          <wd-tab name="favorites" title="我的收藏" :lazy="false">
            <view class="personal-tab-panel">
              <view class="personal-tab-summary">
                共 {{ favoritePage.total.value }} 套收藏房源
              </view>
              <AppPagedList
                :items="favoritePage.items.value"
                item-key="id"
                :loading="favoritePage.loading.value"
                :refreshing="favoritePage.refreshing.value"
                :loading-more="favoritePage.loadingMore.value"
                :finished="favoritePage.finished.value"
                :error="favoritePage.error.value"
                loading-text="正在加载收藏…"
                empty-text="还没有收藏房源"
                empty-description="看到喜欢的房源时点一下收藏，之后可以从这里快速找到。"
                empty-icon="no-collection"
                empty-action-text="去找房"
                finished-text="没有更多收藏了"
                @retry="retryFavorites"
                @empty-action="goFindHouse"
              >
                <template #loading>
                  <AppHouseCardSkeleton />
                </template>
                <template #item="{ item }">
                  <HouseCard
                    :card="buildFavoriteHouseCardModel(item)"
                    favorite-visible
                    favorited
                    :favorite-loading="isRemovingFavorite(item)"
                    :disabled="!item.available"
                    @click="openFavorite(item)"
                    @favorite="removeFavorite(item)"
                  />
                </template>
              </AppPagedList>
              <AppNotice
                v-if="unavailableFavoriteCount"
                class="favorite-notice"
                tone="warning"
                title="下架房源说明"
                :description="`当前列表有 ${unavailableFavoriteCount} 套房源已下架，收藏记录仍会保留；你可以直接取消收藏。`"
                compact
              />
            </view>
          </wd-tab>

          <wd-tab name="viewings" title="我的预约">
            <view class="personal-tab-panel">
              <AppLoading v-if="currentViewingPage.loading.value && !currentViewingPage.items.value.length" text="正在加载当前预约…" />
              <AppErrorView v-else-if="currentViewingPage.error.value && !currentViewingPage.items.value.length" :error="currentViewingPage.error.value" @retry="currentViewingPage.refresh" />
              <template v-else>
                <view class="viewing-section-heading">
                  <view>
                    <strong>当前预约</strong>
                    <text>优先展示仍在生效的看房安排</text>
                  </view>
                  <view v-if="currentViewings.length" class="viewing-section-count">
                    {{ currentViewings.length }} 条
                  </view>
                </view>

                <view v-if="currentViewings.length" class="app-stack-list">
                  <AppRecordCard v-for="item in currentViewings" :key="item.id" clickable variant="prominent" @click="openTenantViewing(item.id)">
                    <template #title>
                      {{ formatTenantHouseTitle(item.house) }}
                    </template>
                    <template #status>
                      <wd-tag :type="getTenantViewingStatusTone(item.status)" variant="light" size="small">
                        {{ item.status__mapping }}
                      </wd-tag>
                    </template>
                    <template #description>
                      {{ item.organization.name }}
                    </template>
                    <view class="app-row-between text-xs text-content-muted">
                      <text>预约时间</text>
                      <strong class="text-content-secondary font-medium">{{ formatViewingDateTime(item.scheduled_at) }}</strong>
                    </view>
                    <view v-if="isPastScheduledViewing(item)" class="viewing-overdue">
                      <view class="i-carbon-warning-alt" /><text>预约时间已过，等待状态更新</text>
                    </view>
                    <template #footer>
                      <text class="text-xs text-app-brand">查看详情</text>
                    </template>
                    <template #actions>
                      <wd-button
                        size="mini"
                        type="danger"
                        variant="plain"
                        :loading="cancelingViewingId === item.id"
                        @click.stop="cancelViewing(item)"
                      >
                        取消预约
                      </wd-button>
                    </template>
                  </AppRecordCard>
                </view>
                <view v-else class="viewing-current-empty">
                  <view class="viewing-current-empty__icon i-carbon-calendar" />
                  <view class="viewing-current-empty__copy">
                    <strong>暂无生效预约</strong>
                    <text>发现心仪房源后，可以直接预约看房</text>
                  </view>
                  <view class="viewing-current-empty__action app-touchable" hover-class="app-touchable--pressed" @click="goFindHouse">
                    <text>去找房</text>
                    <view class="i-carbon-chevron-right" />
                  </view>
                </view>

                <view class="viewing-history">
                  <view class="viewing-history-toggle app-touchable" hover-class="app-touchable--pressed" @click="toggleHistory">
                    <view class="viewing-history-copy">
                      <view class="viewing-history-icon i-carbon-time" />
                      <text>历史预约</text>
                      <text v-if="historyExpanded && historicalViewingPage.loaded.value" class="viewing-history-count">{{ historicalViewingPage.total.value }} 条</text>
                    </view>
                    <view class="viewing-history-action">
                      <text v-if="!historyExpanded">查看</text>
                      <text v-else-if="historicalViewingPage.loading.value && !historicalViewingPage.loaded.value">加载中</text>
                      <text v-else>收起</text>
                      <view :class="historyExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
                    </view>
                  </view>

                  <AppPagedList
                    v-if="historyExpanded"
                    class="viewing-history-list"
                    :items="historicalViewings"
                    item-key="id"
                    :loading="historicalViewingPage.loading.value"
                    :refreshing="historicalViewingPage.refreshing.value"
                    :loading-more="historicalViewingPage.loadingMore.value"
                    :finished="historicalViewingPage.finished.value"
                    :error="historicalViewingPage.error.value"
                    loading-text="正在加载历史预约…"
                    empty-text="暂无历史预约"
                    empty-description="完成、取消或状态结束的预约会显示在这里。"
                    empty-icon="no-content"
                    empty-compact
                    finished-text="没有更多历史预约了"
                    @retry="historicalViewingPage.refresh"
                  >
                    <template #item="{ item }">
                      <AppRecordCard clickable variant="compact" @click="openTenantViewing(item.id)">
                        <template #title>
                          {{ formatTenantHouseTitle(item.house) }}
                        </template>
                        <template #status>
                          <wd-tag :type="getTenantViewingStatusTone(item.status)" variant="light" size="small">
                            {{ item.status__mapping }}
                          </wd-tag>
                        </template>
                        <template #description>
                          {{ item.organization.name }}
                        </template>
                        <view class="app-row-between text-xs text-content-muted">
                          <text>预约时间</text>
                          <strong class="text-content-secondary font-medium">{{ formatViewingDateTime(item.scheduled_at) }}</strong>
                        </view>
                        <view v-if="item.viewed_at" class="mt-3 app-row-between text-xs text-content-muted">
                          <text>实际带看</text>
                          <strong class="text-content-secondary font-medium">{{ formatViewingDateTime(item.viewed_at) }}</strong>
                        </view>
                        <template #footer>
                          <text class="text-xs text-app-brand">查看详情</text>
                        </template>
                      </AppRecordCard>
                    </template>
                  </AppPagedList>
                </view>
              </template>
            </view>
          </wd-tab>
        </wd-tabs>
      </view>
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
      <AppPagedList
        :items="landlordLeasePage.items.value"
        item-key="id"
        :loading="landlordLeasePage.loading.value"
        :refreshing="landlordLeasePage.refreshing.value"
        :loading-more="landlordLeasePage.loadingMore.value"
        :finished="landlordLeasePage.finished.value"
        :error="landlordLeasePage.error.value"
        loading-text="正在加载关联租约…"
        empty-text="当前房东关系下暂无租约"
        finished-text="没有更多租约了"
        @retry="landlordLeasePage.refresh"
      >
        <template #item="{ item }">
          <view class="landlord-lease-card" @click="openLandlordLease(item.id)">
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
        </template>
      </AppPagedList>
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

      <AppNotice
        v-if="organizationError && !organizationDashboard"
        class="scope-notice"
        tone="danger"
        title="待办摘要加载失败"
        :description="organizationError"
        action-text="重新加载"
        compact
        @action="loadOrganizationTasks"
      />
      <view v-else-if="organizationLoading && !organizationDashboard" class="scope-loading">
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
.personal-tabs-shell {
  --wot-tabs-nav-bg: transparent;
  --wot-tabs-nav-item-font-size: 30rpx;
  --wot-tabs-nav-item-padding: 20rpx 24rpx;
  --wot-tabs-nav-line-bg: var(--app-color-brand);

  background: transparent;
}
.personal-tabs-shell :deep(.personal-tabs),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__nav),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__nav--wrap),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__container),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__body),
.personal-tabs-shell :deep(.personal-tabs .wd-tab),
.personal-tabs-shell :deep(.personal-tabs .wd-tab__body) {
  background: transparent;
}
.personal-tab-panel {
  padding-top: 24rpx;
}
.personal-tab-summary {
  margin: 0 4rpx 18rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.viewing-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  margin: 0 4rpx 20rpx;
}
.viewing-section-heading > view:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.viewing-section-heading strong {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
}
.viewing-section-heading text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.viewing-section-count {
  flex: 0 0 auto;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 21rpx;
  font-weight: 600;
  background: var(--app-bg-brand-soft);
}
.viewing-overdue {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 18rpx;
  padding: 14rpx 16rpx;
  border-radius: 16rpx;
  color: var(--app-color-warning);
  font-size: 21rpx;
  background: var(--app-bg-warm-soft);
}
.viewing-current-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 22rpx 24rpx 20rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 22rpx;
  text-align: center;
  background: linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(234 244 255 / 72%));
  box-shadow: 0 10rpx 30rpx rgb(58 102 163 / 6%);
}
.viewing-current-empty__icon {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  flex: 0 0 52rpx;
  align-items: center;
  justify-content: center;
  margin-bottom: 2rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 16rpx;
  color: var(--app-color-brand) !important;
  font-size: 26rpx;
  background: var(--app-color-brand-soft);
}
.viewing-current-empty__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6rpx;
  align-items: center;
}
.viewing-current-empty strong {
  color: var(--app-text-primary);
  font-size: 24rpx;
}
.viewing-current-empty__copy text {
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.45;
}
.viewing-current-empty__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4rpx;
  margin-top: 4rpx;
  padding: 8rpx 18rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 21rpx;
  font-weight: 600;
  background: rgb(255 255 255 / 72%);
}
.viewing-history {
  margin-top: 24rpx;
  border-top: 1rpx solid var(--app-border-card);
}
.viewing-history-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 4rpx 8rpx;
  color: var(--app-text-muted);
}
.viewing-history-icon {
  flex: 0 0 auto;
  font-size: 24rpx;
}
.viewing-history-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10rpx;
}
.viewing-history-copy > text {
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.viewing-history-copy .viewing-history-count {
  color: var(--app-text-disabled);
  font-size: 20rpx;
}
.viewing-history-action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  color: var(--app-text-disabled);
  font-size: 21rpx;
}
.viewing-history-list {
  margin-top: 14rpx;
}
.favorite-notice {
  margin-top: 32rpx;
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
.scope-notice,
.scope-loading {
  margin-top: 24rpx;
}
.scope-loading {
  padding: 26rpx;
  border-radius: 20rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.7;
  background: var(--app-bg-brand-soft);
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
