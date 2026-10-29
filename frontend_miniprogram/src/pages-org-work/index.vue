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

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '空间协作', enablePullDownRefresh: true } })

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
  <view class="work-page box-border min-h-screen bg-surface-page px-5 pb-7 pt-0">
    <AppCustomNavigation title="空间协作" back scroll-mode="sticky" />
    <AppDashboardSkeleton v-if="loading && !dashboard" />
    <AppErrorView v-else-if="loadError && !dashboard" title="协作看板加载失败" :message="loadError" @retry="loadDashboard" />
    <template v-else-if="dashboard">
      <view class="hero-card relative box-border min-h-46 overflow-hidden rounded-5.5 px-4.5 py-5 text-content-on-brand shadow-app-hero bg-gradient-brand">
        <view class="hero-decoration hero-decoration--large pointer-events-none absolute h-37 w-37 rounded-full -right-7.5 -top-12.5" />
        <view class="hero-decoration hero-decoration--small pointer-events-none absolute right-21 h-24 w-24 rounded-full -bottom-11.5" />
        <view class="eyebrow text-size-xs">
          今日协作
        </view>
        <view class="hero-title mt-5 text-size-2xl font-bold">
          {{ appContextStore.currentOrganization?.name || appContextStore.organizationSlug }}
        </view>
        <view class="hero-summary mt-3.5 text-size-xs">
          {{ dashboard.pending_acceptance + dashboard.in_progress }} 项任务待处理，{{ dashboard.unacknowledged_announcements }} 条公告待确认
        </view>
      </view>

      <view class="metrics-grid grid grid-cols-2 mt-6 gap-3">
        <view class="metric-card box-border min-h-20 flex flex-col gap-1.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3">
          <strong>{{ dashboard.pending_acceptance }}</strong><text>待接受</text>
        </view>
        <view class="metric-card box-border min-h-20 flex flex-col gap-1.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3">
          <strong>{{ dashboard.in_progress }}</strong><text>进行中</text>
        </view>
        <view class="metric-card warning box-border min-h-20 flex flex-col gap-1.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3">
          <strong>{{ dashboard.due_today }}</strong><text>今日到期</text>
        </view>
        <view class="metric-card danger box-border min-h-20 flex flex-col gap-1.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3">
          <strong>{{ dashboard.overdue }}</strong><text>已逾期</text>
        </view>
      </view>

      <view class="entry-grid mt-3 flex flex-col gap-2">
        <view class="entry-card flex app-touchable items-center gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5" hover-class="app-touchable--pressed" @click="openRoute(APP_ROUTES.organizationTasks)">
          <view class="i-carbon-task entry-icon text-size-xl text-app-brand" />
          <view class="entry-main min-w-0 flex-1">
            <strong>任务中心</strong><text>我的任务 {{ assignmentSummary?.pending || 0 }} 待接受 · 团队 {{ taskSummary?.active || 0 }} 进行中</text>
          </view>
          <wd-tag v-if="canManageTasks" type="primary" variant="light" size="small">
            可管理
          </wd-tag>
          <view class="i-carbon-chevron-right" />
        </view>
        <view class="entry-card flex app-touchable items-center gap-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5" hover-class="app-touchable--pressed" @click="openRoute(APP_ROUTES.organizationAnnouncements)">
          <view class="i-carbon-volume-up entry-icon text-size-xl text-app-brand" />
          <view class="entry-main min-w-0 flex-1">
            <strong>团队公告</strong><text>{{ dashboard.unacknowledged_announcements ? `${dashboard.unacknowledged_announcements} 条需要确认` : '公告均已处理' }}</text>
          </view>
          <wd-tag v-if="canManageAnnouncements" type="primary" variant="light" size="small">
            可管理
          </wd-tag>
          <view class="i-carbon-chevron-right" />
        </view>
      </view>

      <view class="section-heading mx-1 mb-0 mt-4.5 flex items-center gap-2.5">
        <strong>紧急事项</strong><text @click="openRoute(APP_ROUTES.organizationTasks)">查看全部</text>
      </view>
      <view v-if="dashboard.urgent_items?.length" class="card-list mt-3 flex flex-col gap-2">
        <view v-for="item in dashboard.urgent_items" :key="item.id" class="record-card app-touchable border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
          <view class="card-topline flex items-center gap-2.5">
            <strong>{{ item.task_title }}</strong><wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
              {{ item.priority__mapping }}
            </wd-tag>
          </view>
          <view class="record-meta mt-2 flex items-center gap-2.5 text-size-2xs text-content-muted">
            <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
              {{ item.status__mapping }}
            </wd-tag><text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="quiet-card mt-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5 text-center text-size-xs text-content-muted">
        当前没有紧急任务
      </view>

      <view class="section-heading mx-1 mb-0 mt-4.5 flex items-center gap-2.5">
        <strong>近期公告</strong><text @click="openRoute(APP_ROUTES.organizationAnnouncements)">查看全部</text>
      </view>
      <view v-if="announcements.length" class="card-list mt-3 flex flex-col gap-2">
        <view v-for="item in announcements" :key="item.id" class="record-card app-touchable border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationAnnouncementDetailRoute(item.id))">
          <view class="card-topline flex items-center gap-2.5">
            <strong>{{ item.title }}</strong><wd-tag v-if="shouldShowAnnouncementAcknowledgement(item)" :type="item.is_acknowledged ? 'success' : 'warning'" variant="light" size="small">
              {{ item.is_acknowledged ? '已确认' : '待确认' }}
            </wd-tag>
          </view>
          <text class="record-body mt-1.5 overflow-hidden text-size-xs text-content-secondary leading-relaxed">{{ item.body }}</text>
          <view class="record-meta mt-2 flex items-center gap-2.5 text-size-2xs text-content-muted">
            <text>{{ item.team_name || '整个工作空间' }}</text><text>{{ formatOrganizationWorkDateTime(item.published_at) }}</text>
          </view>
        </view>
      </view>
      <view v-else class="quiet-card mt-2.5 border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-3.5 text-center text-size-xs text-content-muted">
        近期没有已发布公告
      </view>
    </template>
  </view>
</template>

<style scoped>
.work-page :deep(.app-custom-navigation) {
  @apply mt-0 -mx-5 mb-5;
}
.hero-decoration {
  border: 1rpx solid rgb(255 255 255 / 16%);
  background: rgb(255 255 255 / 6%);
}
.hero-card > view:not(.hero-decoration) {
  @apply relative z-1;
}
.eyebrow,
.hero-summary {
  color: rgb(255 255 255 / 75%);
}
.metric-card {
  @apply items-center;
  @apply items-start;
}
.metric-card strong {
  @apply text-content-primary text-size-xl;
}
.metric-card text {
  @apply text-content-muted text-size-2xs;
}
.metric-card.warning strong {
  @apply text-app-warning;
}
.metric-card.danger strong {
  @apply text-app-danger;
}
.entry-main strong {
  @apply block text-content-primary text-size-sm;
}
.entry-main text {
  @apply block mt-1 text-content-muted text-size-2xs;
}
.section-heading,
.card-topline,
.record-meta {
  @apply justify-between;
}
.section-heading strong {
  @apply text-content-primary text-size-sm;
}
.section-heading text {
  @apply text-app-brand text-size-xs;
}
.card-topline strong {
  @apply min-w-0 overflow-hidden text-content-primary text-size-sm text-ellipsis whitespace-nowrap;
}
.record-body {
  @apply line-clamp-2;
}
.record-meta {
  @apply justify-start;
}
</style>
