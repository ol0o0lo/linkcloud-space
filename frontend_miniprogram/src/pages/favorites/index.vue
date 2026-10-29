<script setup lang="ts">
import type { FavoriteOut } from '@/features/favorites/service'
import type { LeaseOut } from '@/features/landlord/service'
import type { AnnouncementOut, DailyDashboardOut } from '@/features/organization-work/service'
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { buildFavoriteHouseCardModel } from '@/domain/house-card'
import { formatOrganizationWorkDateTime, getAssignmentStatusTone, getPriorityTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import { formatTenantHouseTitle, getTenantLeaseStatusTone, getTenantViewingStatusTone, sortCurrentTenantViewings } from '@/domain/tenant-rental'
import { listHouseFavorites, unfavoriteHouse } from '@/features/favorites/service'
import { listLandlordLeases } from '@/features/landlord/service'
import { getDailyOrganizationWorkDashboard, getOrganizationWorkCapabilities, listOrganizationAnnouncements } from '@/features/organization-work/service'
import { cancelScheduledTenantViewing, listCurrentTenantViewings, listHistoricalTenantViewings } from '@/features/tenant-rental/service'
import { APP_ROUTES, getHouseDetailRoute, getOrganizationAnnouncementDetailRoute, getOrganizationTaskDetailRoute, getOrganizationTasksRoute, getTenantViewingDetailRoute } from '@/modules/routes'
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
import TenantViewingCard from '@/components/house/TenantViewingCard.vue'
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
const organizationCanManageTasks = ref(false)
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

const currentViewings = computed(() => sortCurrentTenantViewings(currentViewingPage.items.value))

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
  if (cancelingViewingId.value !== null)
    return
  const confirmation = await uni.showModal({ title: '取消预约', content: '取消后，经纪人将看到预约已取消，确定继续吗？', confirmText: '确认取消' })
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
  organizationCanManageTasks.value = false
  if (!organizationSlug) {
    organizationDashboard.value = null
    organizationAnnouncements.value = []
    organizationError.value = '未选择工作空间，请先切换到经纪人身份'
    uni.stopPullDownRefresh()
    return
  }
  organizationLoading.value = true
  organizationError.value = ''
  try {
    const [dashboard, announcements, taskCapabilities] = await Promise.all([
      getDailyOrganizationWorkDashboard(organizationSlug),
      listOrganizationAnnouncements(organizationSlug, 1, 3, { status: 'published' }),
      getOrganizationWorkCapabilities(organizationSlug).catch(() => null),
    ])
    if (currentLoadId !== organizationLoadId || currentMode.value !== 'organization' || appContextStore.organizationSlug !== organizationSlug)
      return
    organizationDashboard.value = dashboard
    organizationAnnouncements.value = announcements.items
    organizationCanManageTasks.value = taskCapabilities?.task_organization_manage === true || Boolean(taskCapabilities?.task_team_ids?.length)
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
      <view class="personal-tabs-shell bg-transparent">
        <wd-tabs v-model="activePersonalTab" custom-class="personal-tabs" line-theme="text" :line-height="3" @change="handlePersonalTabChange">
          <wd-tab name="favorites" title="我的收藏" :lazy="false">
            <view class="personal-tab-panel pt-3">
              <view class="personal-tab-summary mx-0.5 mb-2.5 mt-0 text-size-2xs text-content-muted">
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

          <wd-tab name="viewings" title="我的看房">
            <view class="personal-tab-panel pt-3">
              <AppLoading v-if="currentViewingPage.loading.value && !currentViewingPage.items.value.length" text="正在加载当前预约…" />
              <AppErrorView v-else-if="currentViewingPage.error.value && !currentViewingPage.items.value.length" :error="currentViewingPage.error.value" @retry="currentViewingPage.refresh" />
              <template v-else>
                <view class="viewing-section-heading mx-0.5 mb-2.5 mt-0 flex items-center justify-between gap-3">
                  <view>
                    <strong>待看房</strong>
                    <text>工作人员确认时间后的看房安排</text>
                  </view>
                  <view v-if="currentViewings.length" class="viewing-section-count flex-none rounded-full bg-surface-brand-soft px-2 py-1 text-size-2xs text-app-brand-active font-semibold">
                    {{ currentViewings.length }} 条
                  </view>
                </view>

                <view v-if="currentViewings.length" class="app-stack-list">
                  <TenantViewingCard v-for="item in currentViewings" :key="item.id" :record="item" :canceling="cancelingViewingId === item.id" @open="openTenantViewing(item.id)" @cancel="cancelViewing(item)" />
                </view>
                <view v-else class="viewing-current-empty flex flex-col items-center gap-1 border-hairline border-app-border-brand-soft rounded-3 border-solid px-3 pb-2.5 pt-3 text-center">
                  <view class="viewing-current-empty__icon i-carbon-calendar h-6.5 w-6.5 flex flex-none basis-6.5 items-center justify-center border-hairline border-app-border-brand-soft rounded-2 border-solid text-size-xs" />
                  <view class="viewing-current-empty__copy min-w-0 flex flex-col items-center gap-1">
                    <strong>暂无待看房安排</strong>
                    <text>提交联系需求后，工作人员会与你确认时间</text>
                  </view>
                  <view class="viewing-current-empty__action mt-0.5 flex flex-none app-touchable items-center gap-0.5 border-hairline border-app-border-brand-soft rounded-full border-solid px-2.5 py-1 text-size-2xs text-app-brand-active font-semibold" hover-class="app-touchable--pressed" @click="goFindHouse">
                    <text>去找房</text>
                    <view class="i-carbon-chevron-right" />
                  </view>
                </view>

                <view class="viewing-history mt-3 border-t-hairline border-t-app-card border-t-solid">
                  <view class="viewing-history-toggle flex app-touchable items-center justify-between gap-2 px-0.5 pb-1 pt-3 text-content-muted" hover-class="app-touchable--pressed" @click="toggleHistory">
                    <view class="viewing-history-copy min-w-0 flex flex-1 items-center gap-1.5">
                      <view class="viewing-history-icon i-carbon-time flex-none text-size-xs" />
                      <text>历史预约</text>
                      <text v-if="historyExpanded && historicalViewingPage.loaded.value" class="viewing-history-count">{{ historicalViewingPage.total.value }} 条</text>
                    </view>
                    <view class="viewing-history-action flex flex-none items-center gap-1 text-size-2xs text-content-disabled">
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
      <view class="page-heading px-0.5 pb-3.5 pt-1">
        <view class="page-title text-size-xl text-content-primary font-bold">
          关联租约
        </view>
        <view class="page-subtitle mt-1.5 text-size-xs text-content-muted">
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
          <view class="landlord-lease-card rounded-3 bg-surface-card p-3.5" @click="openLandlordLease(item.id)">
            <view class="landlord-lease-topline flex items-start justify-between gap-2">
              <strong>{{ formatTenantHouseTitle(item.house) }}</strong>
              <wd-tag :type="getTenantLeaseStatusTone(item.status)" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </view>
            <view class="landlord-rent mt-3 text-size-base text-app-price font-bold">
              ¥{{ item.monthly_rent }} / 月
            </view>
            <view class="landlord-term mt-1.5 text-size-xs text-content-muted">
              {{ item.start_date }} 至 {{ item.end_date }}
            </view>
          </view>
        </template>
      </AppPagedList>
    </template>

    <template v-else-if="currentMode === 'organization'">
      <view class="page-heading px-0.5 pb-3.5 pt-1">
        <view class="page-title text-size-xl text-content-primary font-bold">
          我的协作
        </view>
        <view class="page-subtitle mt-1.5 text-size-xs text-content-muted">
          {{ appContextStore.currentOrganization?.name }}
        </view>
      </view>
      <view v-if="organizationDashboard" class="todo-summary-grid grid grid-cols-4 gap-1.5">
        <view @click="openOrganizationRoute(getOrganizationTasksRoute('mine', 'pending'))">
          <strong>{{ organizationDashboard.pending_acceptance }}</strong><text>待接受</text>
        </view>
        <view @click="openOrganizationRoute(getOrganizationTasksRoute('mine', 'in_progress'))">
          <strong>{{ organizationDashboard.in_progress }}</strong><text>进行中</text>
        </view>
        <view class="danger" @click="openOrganizationRoute(getOrganizationTasksRoute('mine', 'overdue'))">
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
      <view v-else-if="organizationLoading && !organizationDashboard" class="scope-loading rounded-2.5 bg-surface-brand-soft p-3.5 text-size-xs text-content-secondary leading-relaxed">
        正在加载本人任务与公告…
      </view>

      <view class="organization-entry mt-3 flex items-center gap-2.5 rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(`${APP_ROUTES.organizationViewings}?status=scheduled`)">
        <view class="mode-icon i-carbon-calendar flex-none text-size-2xl text-app-brand" />
        <view><strong>待带看</strong><text>查看当前工作空间的预约与带看记录</text></view>
        <view class="i-carbon-chevron-right" />
      </view>
      <view class="organization-entry mt-3 flex items-center gap-2.5 rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(`${APP_ROUTES.organizationLeases}?status=pending`)">
        <view class="mode-icon i-carbon-document flex-none text-size-2xl text-app-brand" />
        <view><strong>待生效租约</strong><text>查看需要继续跟进的签约记录</text></view>
        <view class="i-carbon-chevron-right" />
      </view>
      <view class="organization-entry mt-3 flex items-center gap-2.5 rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">
        <view class="mode-icon i-carbon-task flex-none text-size-2xl text-app-brand" />
        <view><strong>本人任务</strong><text>接受、完成或拒绝当前工作空间分配给我的任务</text></view>
        <view class="i-carbon-chevron-right" />
      </view>
      <view v-if="organizationCanManageTasks" class="organization-entry mt-3 flex items-center gap-2.5 rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(getOrganizationTasksRoute('team'))">
        <view class="mode-icon i-carbon-group flex-none text-size-2xl text-app-brand" />
        <view><strong>团队任务</strong><text>查看团队执行进度与分配情况</text></view>
        <view class="i-carbon-chevron-right" />
      </view>

      <view class="section-heading mx-1 mb-2 mt-4.5 flex items-center justify-between">
        <strong>优先处理</strong><text @click="openOrganizationRoute(APP_ROUTES.organizationTasks)">查看全部</text>
      </view>
      <view v-if="organizationDashboard?.urgent_items?.length" class="organization-list flex flex-col gap-2">
        <view v-for="item in organizationDashboard.urgent_items" :key="item.id" class="organization-record rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
          <view class="organization-record-topline flex items-center justify-between gap-2">
            <strong>{{ item.task_title }}</strong>
            <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
              {{ item.priority__mapping }}
            </wd-tag>
          </view>
          <view class="organization-record-meta mt-2 flex items-center justify-between gap-2 text-size-2xs text-content-muted">
            <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag>
            <text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="organizationDashboard" class="quiet-card rounded-3 bg-surface-card p-3.5 text-center text-content-muted">
        当前没有紧急任务
      </view>

      <view class="section-heading mx-1 mb-2 mt-4.5 flex items-center justify-between">
        <strong>近期公告</strong><text @click="openOrganizationRoute(APP_ROUTES.organizationAnnouncements)">查看全部</text>
      </view>
      <view v-if="organizationAnnouncements.length" class="organization-list flex flex-col gap-2">
        <view v-for="item in organizationAnnouncements" :key="item.id" class="organization-record rounded-3 bg-surface-card p-3.5" @click="openOrganizationRoute(getOrganizationAnnouncementDetailRoute(item.id))">
          <view class="organization-record-topline flex items-center justify-between gap-2">
            <strong>{{ item.title }}</strong>
            <wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
              {{ item.is_acknowledged ? '已确认' : '待确认' }}
            </wd-tag>
          </view>
          <text class="organization-record-body mt-2 overflow-hidden text-size-xs text-content-secondary leading-relaxed">{{ item.body }}</text>
          <view class="organization-record-meta mt-2 flex items-center justify-between gap-2 text-size-2xs text-content-muted">
            <text>{{ item.team_name || '整个工作空间' }}</text><text>{{ formatOrganizationWorkDateTime(item.published_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else-if="organizationDashboard" class="quiet-card rounded-3 bg-surface-card p-3.5 text-center text-content-muted">
        近期没有已发布公告
      </view>
    </template>
  </AppPage>
</template>

<style scoped>
.personal-tabs-shell {
  --wot-tabs-nav-bg: transparent;
  --wot-tabs-nav-item-font-size: 30rpx;
  --wot-tabs-nav-item-padding: 20rpx 24rpx;
  --wot-tabs-nav-line-bg: var(--app-color-brand);
}
.personal-tabs-shell :deep(.personal-tabs),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__nav),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__nav--wrap),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__container),
.personal-tabs-shell :deep(.personal-tabs .wd-tabs__body),
.personal-tabs-shell :deep(.personal-tabs .wd-tab),
.personal-tabs-shell :deep(.personal-tabs .wd-tab__body) {
  @apply bg-transparent;
}
.viewing-section-heading > view:first-child {
  @apply flex min-w-0 flex-col gap-1;
}
.viewing-section-heading strong {
  @apply text-content-primary text-size-sm font-bold;
}
.viewing-section-heading text {
  @apply text-content-muted text-size-2xs;
}
.viewing-overdue {
  @apply flex items-center gap-1 mt-2.5 py-2 px-2 rounded-2 text-app-warning text-size-2xs bg-surface-warm-soft;
}
.viewing-current-empty {
  background: linear-gradient(145deg, rgb(255 255 255 / 82%), rgb(234 244 255 / 72%));
  box-shadow: 0 10rpx 30rpx rgb(58 102 163 / 6%);
}
.viewing-current-empty__icon {
  @apply mb-0;
  @apply text-app-brand !important;
  @apply bg-surface-brand-soft;
}
.viewing-current-empty strong {
  @apply text-content-primary text-size-xs;
}
.viewing-current-empty__copy text {
  @apply text-content-muted text-size-2xs leading-normal;
}
.viewing-current-empty__action {
  background: rgb(255 255 255 / 72%);
}
.viewing-history-copy > text {
  @apply text-content-muted text-size-xs;
}
.viewing-history-copy .viewing-history-count {
  @apply text-content-disabled text-size-2xs;
}
.viewing-history-list {
  @apply mt-2;
}
.favorite-notice {
  @apply mt-4;
}
.mode-card {
  @apply flex items-center gap-3 py-4 px-3.5 rounded-3 bg-surface-card;
}
.mode-card > view:last-child {
  @apply flex min-w-0 flex-col gap-1.5;
}
.mode-card strong {
  @apply text-content-primary text-size-sm;
}
.mode-card text {
  @apply text-content-muted text-size-xs leading-relaxed;
}
.todo-summary-grid view {
  @apply flex flex-col items-center gap-1 py-3 px-1 rounded-2.5 bg-surface-card;
}
.todo-summary-grid strong {
  @apply text-app-brand text-size-base;
}
.todo-summary-grid text {
  @apply text-content-muted text-size-2xs text-center;
}
.todo-summary-grid .warning strong {
  @apply text-app-warning;
}
.todo-summary-grid .danger strong {
  @apply text-app-danger;
}
.organization-entry > view:nth-child(2) {
  @apply flex min-w-0 flex-1 flex-col gap-1;
}
.organization-entry strong {
  @apply text-content-primary text-size-sm;
}
.organization-entry text {
  @apply text-content-muted text-size-xs leading-normal;
}
.section-heading strong {
  @apply text-content-primary text-size-sm;
}
.section-heading text {
  @apply text-app-brand text-size-xs;
}
.organization-record-topline strong {
  @apply min-w-0 flex-1 text-content-primary text-size-sm;
}
.organization-record-body {
  @apply line-clamp-2;
}
.scope-notice,
.scope-loading {
  @apply mt-3;
}
.landlord-lease-list {
  @apply flex flex-col gap-2.5;
}
.landlord-lease-topline strong {
  @apply min-w-0 flex-1 text-content-primary text-size-sm;
}
</style>
