<script setup lang="ts">
import type { AnnouncementOut, DailyDashboardOut, TaskAssignmentSummaryOut, TeamOperationsCapabilitiesOut, WorkTaskSummaryOut } from '@/features/organization-work/service'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatOrganizationWorkDateTime, getAssignmentStatusTone, getPriorityTone, shouldShowAnnouncementAcknowledgement } from '@/domain/organization-work'
import {
  getDailyOrganizationWorkDashboard,
  getOrganizationTaskAssignmentSummary,
  getOrganizationWorkCapabilities,
  getOrganizationWorkTaskSummary,
  listOrganizationAnnouncements,
} from '@/features/organization-work/service'
import { APP_ROUTES, getOrganizationAnnouncementDetailRoute, getOrganizationTaskDetailRoute } from '@/modules/routes'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppDashboardSkeleton from '@/components/app/AppDashboardSkeleton.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '组织协作', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const dashboard = ref<DailyDashboardOut | null>(null)
const assignmentSummary = ref<TaskAssignmentSummaryOut | null>(null)
const taskSummary = ref<WorkTaskSummaryOut | null>(null)
const capabilities = ref<TeamOperationsCapabilitiesOut | null>(null)
const announcements = ref<AnnouncementOut[]>([])
const loading = ref(true)
const loadError = ref('')
let loadId = 0

const canManageTasks = computed(() => capabilities.value?.task_organization_manage === true || Boolean(capabilities.value?.task_team_ids?.length))
const canManageAnnouncements = computed(() => capabilities.value?.announcement_organization_manage === true || Boolean(capabilities.value?.announcement_team_ids?.length))

async function loadDashboard() {
  const currentLoadId = ++loadId
  loading.value = true
  loadError.value = ''
  try {
    const [nextDashboard, nextAssignmentSummary, nextTaskSummary, nextCapabilities, recentAnnouncements] = await Promise.all([
      getDailyOrganizationWorkDashboard(appContextStore.organizationSlug),
      getOrganizationTaskAssignmentSummary(appContextStore.organizationSlug),
      getOrganizationWorkTaskSummary(appContextStore.organizationSlug),
      getOrganizationWorkCapabilities(appContextStore.organizationSlug),
      listOrganizationAnnouncements(appContextStore.organizationSlug, 1, 3, { status: 'published' }),
    ])
    if (currentLoadId !== loadId)
      return
    dashboard.value = nextDashboard
    assignmentSummary.value = nextAssignmentSummary
    taskSummary.value = nextTaskSummary
    capabilities.value = nextCapabilities
    announcements.value = recentAnnouncements.items
  }
  catch (error) {
    if (currentLoadId === loadId)
      loadError.value = error instanceof Error ? error.message : '协作看板加载失败'
  }
  finally {
    if (currentLoadId === loadId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function openRoute(url: string) {
  uni.navigateTo({ url })
}

onShow(() => void loadDashboard())
onPullDownRefresh(loadDashboard)
</script>

<template>
  <view class="work-page">
    <AppCustomNavigation title="组织协作" back scroll-mode="sticky" />
    <AppDashboardSkeleton v-if="loading && !dashboard" />
    <AppErrorView v-else-if="loadError && !dashboard" title="协作看板加载失败" :message="loadError" @retry="loadDashboard" />
    <template v-else-if="dashboard">
      <view class="hero-card">
        <view class="hero-decoration hero-decoration--large" />
        <view class="hero-decoration hero-decoration--small" />
        <view class="eyebrow">
          今日协作
        </view>
        <view class="hero-title">
          {{ appContextStore.currentOrganization?.name || appContextStore.organizationSlug }}
        </view>
        <view class="hero-summary">
          {{ dashboard.pending_acceptance + dashboard.in_progress }} 项任务待处理，{{ dashboard.unacknowledged_announcements }} 条公告待确认
        </view>
      </view>

      <view class="metrics-grid">
        <view class="metric-card">
          <strong>{{ dashboard.pending_acceptance }}</strong><text>待接受</text>
        </view>
        <view class="metric-card">
          <strong>{{ dashboard.in_progress }}</strong><text>进行中</text>
        </view>
        <view class="metric-card warning">
          <strong>{{ dashboard.due_today }}</strong><text>今日到期</text>
        </view>
        <view class="metric-card danger">
          <strong>{{ dashboard.overdue }}</strong><text>已逾期</text>
        </view>
      </view>

      <view class="entry-grid">
        <view class="entry-card app-touchable" hover-class="app-touchable--pressed" @click="openRoute(APP_ROUTES.organizationTasks)">
          <view class="i-carbon-task entry-icon" />
          <view class="entry-main">
            <strong>任务中心</strong><text>我的任务 {{ assignmentSummary?.pending || 0 }} 待接受 · 团队 {{ taskSummary?.active || 0 }} 进行中</text>
          </view>
          <wd-tag v-if="canManageTasks" type="primary" variant="light" size="small">
            可管理
          </wd-tag>
          <view class="i-carbon-chevron-right" />
        </view>
        <view class="entry-card app-touchable" hover-class="app-touchable--pressed" @click="openRoute(APP_ROUTES.organizationAnnouncements)">
          <view class="i-carbon-volume-up entry-icon" />
          <view class="entry-main">
            <strong>团队公告</strong><text>{{ dashboard.unacknowledged_announcements ? `${dashboard.unacknowledged_announcements} 条需要确认` : '公告均已处理' }}</text>
          </view>
          <wd-tag v-if="canManageAnnouncements" type="primary" variant="light" size="small">
            可管理
          </wd-tag>
          <view class="i-carbon-chevron-right" />
        </view>
      </view>

      <view class="section-heading">
        <strong>紧急事项</strong><text @click="openRoute(APP_ROUTES.organizationTasks)">查看全部</text>
      </view>
      <view v-if="dashboard.urgent_items?.length" class="card-list">
        <view v-for="item in dashboard.urgent_items" :key="item.id" class="record-card app-touchable" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
          <view class="card-topline">
            <strong>{{ item.task_title }}</strong><wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
              {{ item.priority__mapping }}
            </wd-tag>
          </view>
          <view class="record-meta">
            <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag><text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="quiet-card">
        当前没有紧急任务
      </view>

      <view class="section-heading">
        <strong>近期公告</strong><text @click="openRoute(APP_ROUTES.organizationAnnouncements)">查看全部</text>
      </view>
      <view v-if="announcements.length" class="card-list">
        <view v-for="item in announcements" :key="item.id" class="record-card app-touchable" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationAnnouncementDetailRoute(item.id))">
          <view class="card-topline">
            <strong>{{ item.title }}</strong><wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
              {{ item.is_acknowledged ? '已确认' : '待确认' }}
            </wd-tag>
          </view>
          <text class="record-body">{{ item.body }}</text>
          <view class="record-meta">
            <text>{{ item.team_name || '全组织' }}</text><text>{{ formatOrganizationWorkDateTime(item.published_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="quiet-card">
        近期没有已发布公告
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.work-page {
  min-height: 100vh;
  padding: 0 40rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.work-page :deep(.app-custom-navigation) {
  margin: 0 -40rpx 40rpx;
}
.hero-card {
  position: relative;
  overflow: hidden;
  min-height: 368rpx;
  padding: 40rpx 36rpx;
  border-radius: 44rpx;
  box-sizing: border-box;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-organization);
  box-shadow: var(--app-shadow-hero-organization);
}
.hero-decoration {
  position: absolute;
  border: 1rpx solid rgb(255 255 255 / 16%);
  border-radius: 50%;
  background: rgb(255 255 255 / 6%);
  pointer-events: none;
}
.hero-decoration--large {
  top: -100rpx;
  right: -60rpx;
  width: 292rpx;
  height: 292rpx;
}
.hero-decoration--small {
  right: 164rpx;
  bottom: -92rpx;
  width: 188rpx;
  height: 188rpx;
}
.hero-card > view:not(.hero-decoration) {
  position: relative;
  z-index: 1;
}
.eyebrow,
.hero-summary {
  color: rgb(255 255 255 / 75%);
  font-size: 23rpx;
}
.hero-title {
  margin-top: 40rpx;
  font-size: 54rpx;
  font-weight: 700;
}
.hero-summary {
  margin-top: 28rpx;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 48rpx;
}
.metric-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 156rpx;
  align-items: flex-start;
  gap: 10rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.metric-card strong {
  color: var(--app-text-primary);
  font-size: 40rpx;
}
.metric-card text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.metric-card.warning strong {
  color: var(--app-color-warning);
}
.metric-card.danger strong {
  color: var(--app-color-danger);
}
.entry-grid,
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 26rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
}
.entry-icon {
  color: var(--app-color-primary);
  font-size: 42rpx;
}
.entry-main {
  min-width: 0;
  flex: 1;
}
.entry-main strong {
  display: block;
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.entry-main text {
  display: block;
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.section-heading,
.card-topline,
.record-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.section-heading {
  margin: 34rpx 8rpx 0;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 29rpx;
}
.section-heading text {
  color: var(--app-color-primary);
  font-size: 23rpx;
}
.record-card,
.quiet-card {
  padding: 26rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
}
.card-topline strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 28rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.record-body {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 13rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.record-meta {
  justify-content: flex-start;
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.quiet-card {
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
