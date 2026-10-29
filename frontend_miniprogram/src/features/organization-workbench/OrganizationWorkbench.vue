<script setup lang="ts">
import type { DailyDashboardOut } from '@/features/organization-work/service'
import type { SaaSOnboardingProgress, SaaSOnboardingTask } from '@/features/saas/service'
import type { OrganizationCustomerWorkbench } from '@/services/manual/organization-customers'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { formatOrganizationWorkDateTime, getPriorityTone } from '@/domain/organization-work'
import { formatPhoneDisplay } from '@/domain/phone'
import { getDailyOrganizationWorkDashboard } from '@/features/organization-work/service'
import { getSaaSOnboardingProgress } from '@/features/saas/service'
import { APP_ROUTES, getOrganizationTaskDetailRoute } from '@/modules/routes'
import { getOrganizationCustomerCapabilities, getOrganizationCustomerWorkbench } from '@/services/manual/organization-customers'
import { getListedHouseCount, getPausedHouseCount, getScheduledViewingCount } from '@/services/manual/organization-workbench'
import { useWorkspaceStore } from '@/store/workspace'

const workspace = useWorkspaceStore()
const organizationName = computed(() => workspace.currentOrganization?.name || '经纪工作台')
const today = ref(new Date())
const todayLabel = computed(() => today.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))
const counts = ref<{ listed: number | null, paused: number | null, viewings: number | null }>({ listed: null, paused: null, viewings: null })
const dashboard = ref<DailyDashboardOut | null>(null)
const activation = ref<SaaSOnboardingProgress | null>(null)
const customerWorkbench = ref<OrganizationCustomerWorkbench | null>(null)
const canManageCustomers = ref(false)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref(false)
const overviewExpanded = ref(false)
const activationExpanded = ref(false)
let activationExpiryTimer: ReturnType<typeof setTimeout> | undefined
let loadId = 0
let pending: Promise<void> | null = null
let pendingSlug = ''

const pendingTaskCount = computed(() => dashboard.value ? dashboard.value.pending_acceptance + dashboard.value.in_progress : null)
const urgentItems = computed(() => (dashboard.value?.urgent_items || []).slice(0, 2))
const nextActivationTask = computed(() => activation.value?.tasks.find(task => !task.completed) || null)
const activationActionLabels: Record<SaaSOnboardingTask['action'], string> = {
  create_house: '录入房源',
  invite_member: '邀请成员',
  assign_responsibility: '分配职责',
  create_viewing: '预约带看',
  complete_viewing: '处理已预约带看',
}
const pendingInquiries = computed(() => (customerWorkbench.value?.items || []).slice(0, 3))
const inquiryStatusLabels: Record<string, string> = { new: '待处理', processing: '处理中', signed: '已签约', closed: '已关闭' }
const dailyMetrics = computed(() => [
  { label: '待联系新客', value: customerWorkbench.value?.new_customers, route: `${APP_ROUTES.organizationCustomers}?stage=new`, icon: 'i-carbon-user-follow', tone: 'blue' },
  { label: '待处理咨询', value: customerWorkbench.value?.new_inquiries, route: `${APP_ROUTES.organizationCustomers}?status=new`, icon: 'i-carbon-task', tone: 'orange' },
  { label: '今日带看', value: customerWorkbench.value?.today_viewings, route: `${APP_ROUTES.organizationViewings}?status=scheduled&today=true&scope=${canManageCustomers.value ? 'all' : 'mine'}`, icon: 'i-carbon-calendar', tone: 'green' },
  ...(workspace.capabilities.allocation ? [{ label: '待审核收益', value: customerWorkbench.value?.pending_allocations, route: `${APP_ROUTES.organizationAllocation}?status=pending`, icon: 'i-carbon-currency-yen', tone: 'purple' }] : []),
])
const metrics = computed(() => [
  { label: '招租中', value: counts.value.listed, unit: '套', icon: 'i-carbon-building', route: `${APP_ROUTES.organizationHouses}?status=listed&is_active=true`, tone: 'blue' },
  { label: '暂不出租', value: counts.value.paused, unit: '套', icon: 'i-carbon-home', route: `${APP_ROUTES.organizationHouses}?status=paused&is_active=true`, tone: 'purple' },
  { label: '待带看', value: counts.value.viewings, unit: '场', icon: 'i-carbon-calendar', route: `${APP_ROUTES.organizationViewings}?status=scheduled`, tone: 'orange' },
  { label: '协作待办', value: pendingTaskCount.value, unit: '项', icon: 'i-carbon-task', route: APP_ROUTES.organizationTasks, tone: 'green' },
])
const quickActions = computed(() => [
  { title: '房表同步', icon: 'i-carbon-data-base', route: APP_ROUTES.organizationVacancySync, tone: 'blue' },
  { title: '录入房源', icon: 'i-carbon-add-alt', route: APP_ROUTES.organizationHouseForm, tone: 'orange' },
  { title: '客户与咨询', icon: 'i-carbon-user-follow', route: APP_ROUTES.organizationCustomers, tone: 'green' },
  { title: '登记签约', icon: 'i-carbon-document-signed', route: APP_ROUTES.organizationSigning, tone: 'purple' },
])
const businessEntries = [
  { title: '房源管理', description: '维护与配房', icon: 'i-carbon-building', route: APP_ROUTES.organizationHouses },
  { title: '客户与咨询', description: '咨询与跟进', icon: 'i-carbon-user-follow', route: APP_ROUTES.organizationCustomers },
  { title: '带看管理', description: '预约与反馈', icon: 'i-carbon-calendar', route: APP_ROUTES.organizationViewings },
  { title: '租约管理', description: '签约与履约', icon: 'i-carbon-document', route: APP_ROUTES.organizationLeases },
]
const tools = computed(() => [
  { title: '联系人', icon: 'i-carbon-user-multiple', route: APP_ROUTES.organizationContacts },
  { title: '团队协作', icon: 'i-carbon-task', route: APP_ROUTES.organizationWork },
  { title: '空间管理', icon: 'i-carbon-group', route: APP_ROUTES.organizationAdmin },
  { title: '小区资料', icon: 'i-carbon-location', route: APP_ROUTES.organizationEstates },
  { title: '楼栋资料', icon: 'i-carbon-building-insights-1', route: APP_ROUTES.organizationBuildings },
  { title: '房源地图', icon: 'i-carbon-map', route: APP_ROUTES.organizationMap },
  { title: '房表同步', icon: 'i-carbon-data-base', route: APP_ROUTES.organizationVacancySync },
  { title: '配房分享', icon: 'i-carbon-share', route: APP_ROUTES.organizationMatches },
  ...(workspace.capabilities.analytics ? [{ title: '经营分析', icon: 'i-carbon-chart-line', route: APP_ROUTES.organizationAnalytics }] : []),
  ...(workspace.capabilities.allocation ? [{ title: '收益分配', icon: 'i-carbon-currency-yen', route: APP_ROUTES.organizationAllocation }] : []),
])

function openRoute(route: string) {
  uni.navigateTo({ url: route })
}

function openInquiry(id: number) {
  openRoute(`${APP_ROUTES.organizationInquiryDetail}?id=${id}`)
}

function openActivationTask(task: SaaSOnboardingTask) {
  const route = {
    create_house: APP_ROUTES.organizationHouseForm,
    invite_member: APP_ROUTES.organizationAdminInvitations,
    assign_responsibility: APP_ROUTES.organizationAdminResponsibilities,
    create_viewing: APP_ROUTES.organizationViewingForm,
    complete_viewing: `${APP_ROUTES.organizationViewings}?status=scheduled`,
  }[task.action]
  openRoute(route)
}

function refresh(): Promise<void> {
  const slug = workspace.organizationSlug
  if (!slug) {
    loadId += 1
    pending = null
    loading.value = false
    counts.value = { listed: null, paused: null, viewings: null }
    dashboard.value = null
    activation.value = null
    customerWorkbench.value = null
    canManageCustomers.value = false
    loaded.value = false
    return Promise.resolve()
  }
  if (pending && pendingSlug === slug)
    return pending

  const currentLoadId = ++loadId
  today.value = new Date()
  pendingSlug = slug
  loading.value = true
  const request = Promise.allSettled([
    getListedHouseCount(slug),
    getPausedHouseCount(slug),
    getScheduledViewingCount(slug),
    getDailyOrganizationWorkDashboard(slug),
    getSaaSOnboardingProgress(slug),
    getOrganizationCustomerWorkbench(slug),
    getOrganizationCustomerCapabilities(slug),
  ]).then(([listed, paused, viewings, work, progress, customers, customerCapabilities]) => {
    if (currentLoadId !== loadId)
      return
    counts.value = {
      listed: listed.status === 'fulfilled' ? listed.value : null,
      paused: paused.status === 'fulfilled' ? paused.value : null,
      viewings: viewings.status === 'fulfilled' ? viewings.value : null,
    }
    dashboard.value = work.status === 'fulfilled' ? work.value : null
    if (activation.value?.show_guide && progress.status === 'fulfilled' && progress.value.activated)
      uni.showToast({ title: '开通引导已完成', icon: 'success' })
    activation.value = progress.status === 'fulfilled' ? progress.value : null
    customerWorkbench.value = customers.status === 'fulfilled' ? customers.value : null
    canManageCustomers.value = customerCapabilities.status === 'fulfilled' && customerCapabilities.value.can_manage
    loadError.value = [listed, paused, viewings, work].every(result => result.status === 'rejected')
    loaded.value = true
  }).finally(() => {
    if (currentLoadId === loadId) {
      loading.value = false
      pending = null
    }
  })
  pending = request
  return request
}

watch(() => workspace.organizationSlug, () => {
  counts.value = { listed: null, paused: null, viewings: null }
  dashboard.value = null
  activation.value = null
  customerWorkbench.value = null
  canManageCustomers.value = false
  loaded.value = false
  loadError.value = false
  overviewExpanded.value = false
  activationExpanded.value = false
  void refresh()
}, { immediate: true })
watch(activation, (progress) => {
  clearTimeout(activationExpiryTimer)
  if (progress?.show_guide) {
    activationExpiryTimer = setTimeout(() => {
      progress.show_guide = false
    }, Math.max(0, new Date(progress.guide_expires_at).getTime() - Date.now() + 1))
  }
})
onBeforeUnmount(() => clearTimeout(activationExpiryTimer))
defineExpose({ refresh })
</script>

<template>
  <view class="workbench pb-2">
    <view class="workbench-header mb-2.5 min-w-0 flex items-end justify-between gap-3">
      <view class="header-copy min-w-0">
        <text class="header-eyebrow mb-1 block text-size-xs leading-snug">经纪工作台 · {{ todayLabel }}</text>
        <strong class="header-title">{{ organizationName }}</strong>
      </view>
      <view class="header-stock flex items-center gap-1 whitespace-nowrap rounded-2 bg-surface-brand-soft px-2 py-1.5 text-size-2xs" role="button" aria-label="查看招租中房源" @click="openRoute(`${APP_ROUTES.organizationHouses}?status=listed&is_active=true`)">
        <view class="i-carbon-building" /><text>招租中 <strong>{{ counts.listed ?? '—' }}</strong> 套</text><view class="i-carbon-chevron-right" />
      </view>
    </view>

    <view class="daily-panel mt-0 rounded-3 bg-surface-card px-0 py-3">
      <view class="panel-heading flex items-center justify-between gap-2 px-3 py-0">
        <strong>今日工作</strong>
        <view class="section-link inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-size-xs leading-normal" role="button" @click="openRoute(APP_ROUTES.organizationCustomers)">
          <text>全部客户</text><view class="i-carbon-chevron-right" />
        </view>
      </view>
      <view class="daily-grid grid mt-3">
        <view v-for="item in dailyMetrics" :key="item.label" class="daily-item min-w-0 flex flex-col app-touchable items-center gap-1 px-1 py-0" :class="{ 'daily-item--active': (item.value ?? 0) > 0 }" role="button" :aria-label="item.label" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
          <strong>{{ item.value ?? '—' }}</strong>
          <text>{{ item.label }}</text>
        </view>
      </view>
    </view>

    <view class="action-grid grid grid-cols-4 mt-2.5 gap-1 rounded-3 bg-surface-card px-1.5 py-3">
      <view v-for="item in quickActions" :key="item.route" class="action-item min-w-0 flex flex-col app-touchable items-center gap-1.5 whitespace-nowrap text-size-xs font-semibold leading-normal" role="button" :aria-label="item.title" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="action-icon h-9 w-9 flex items-center justify-center rounded-3 text-size-lg" :class="`tone-${item.tone}`">
          <view :class="item.icon" />
        </view>
        <text>{{ item.title }}</text>
      </view>
    </view>

    <view class="section-heading mx-0 mb-2 mt-4 flex items-center justify-between gap-2">
      <strong>业务管理</strong><text class="section-caption text-size-2xs">房源到签约，一处管理</text>
    </view>
    <view class="business-grid grid grid-cols-2 overflow-hidden rounded-3 bg-surface-card">
      <view v-for="item in businessEntries" :key="item.route" class="business-item min-w-0 flex app-touchable items-center gap-2 px-3 py-3.5" role="button" :aria-label="item.title" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="business-icon h-8 w-8 flex flex-none basis-8 items-center justify-center rounded-2.5 bg-surface-brand-soft text-size-base">
          <view :class="item.icon" />
        </view>
        <view class="business-copy min-w-0 flex flex-1 flex-col gap-1">
          <strong>{{ item.title }}</strong><text>{{ item.description }}</text>
        </view>
      </view>
    </view>
    <view class="section-heading mx-0 mb-2 mt-4 flex items-center justify-between gap-2">
      <strong>待处理事项</strong>
      <view class="section-link inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-size-xs leading-normal" role="button" @click="openRoute(`${APP_ROUTES.organizationCustomers}?status=new`)">
        <text>全部咨询</text><view class="i-carbon-chevron-right" />
      </view>
    </view>
    <view class="pending-panel overflow-hidden rounded-3 bg-surface-card">
      <view v-if="loading && !customerWorkbench" class="inquiry-feedback flex items-center gap-1.5 px-3 py-3.5 text-size-xs leading-normal">
        正在加载待处理咨询…
      </view>
      <view v-else-if="!customerWorkbench" class="inquiry-feedback inquiry-error flex items-center justify-between gap-1.5 px-3 py-3.5 text-size-xs leading-normal">
        <text>咨询暂时无法加载</text>
        <wd-button size="small" variant="plain" @click="refresh">
          重新加载
        </wd-button>
      </view>
      <view v-else-if="pendingInquiries.length" class="inquiry-list">
        <view v-for="item in pendingInquiries" :key="item.inquiry_id" class="inquiry-item flex app-touchable items-center gap-2 p-3" role="button" :aria-label="`查看${item.customer_name || '咨询客户'}的咨询`" hover-class="app-touchable--pressed" @click="openInquiry(item.inquiry_id)">
          <view class="inquiry-avatar h-8.5 w-8.5 flex flex-none basis-8.5 items-center justify-center rounded-full bg-surface-brand-soft text-size-base">
            <view class="i-carbon-user" />
          </view>
          <view class="inquiry-copy min-w-0 flex flex-1 flex-col gap-1">
            <view class="inquiry-title min-w-0 flex items-center gap-1.5">
              <strong>{{ item.customer_name || '咨询客户' }}</strong>
              <text class="inquiry-status shrink-0 text-size-2xs leading-snug">{{ inquiryStatusLabels[item.status] || item.status }}</text>
            </view>
            <text class="inquiry-phone overflow-hidden text-ellipsis whitespace-nowrap text-size-xs leading-snug">{{ formatPhoneDisplay(item.phone) || '尚未提供手机号' }}</text>
          </view>
          <wd-button size="small" variant="soft" @click.stop="openInquiry(item.inquiry_id)">
            处理咨询
          </wd-button>
        </view>
      </view>
      <view v-else class="inquiry-feedback flex items-center gap-1.5 px-3 py-3.5 text-size-xs leading-normal">
        <view class="i-carbon-checkmark-outline" />
        <text>暂无待处理咨询</text>
      </view>
      <view v-if="customerWorkbench?.unassigned_viewings" class="viewing-notice flex app-touchable items-center gap-1.5 border-t-hairline border-t-app-divider border-t-solid px-3 py-3 text-size-xs leading-normal" role="button" hover-class="app-touchable--pressed" @click="openRoute(`${APP_ROUTES.organizationViewings}?status=scheduled&unassigned=true`)">
        <view class="i-carbon-calendar viewing-notice-icon shrink-0 text-size-sm" />
        <text>{{ customerWorkbench.unassigned_viewings }} 场预约待分派负责人</text>
        <text class="viewing-notice-action shrink-0 text-size-xs">去安排</text>
        <view class="i-carbon-chevron-right" />
      </view>
    </view>

    <view v-if="urgentItems.length || !loaded || !dashboard" class="collaboration-panel mt-2.5 rounded-3 bg-surface-card pt-3">
      <view class="panel-heading flex items-center justify-between gap-2 px-3 py-0">
        <strong>协作待办</strong>
        <view class="section-link inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-size-xs leading-normal" role="button" @click="openRoute(APP_ROUTES.organizationTasks)">
          <text>全部待办</text><view class="i-carbon-chevron-right" />
        </view>
      </view>
      <view v-if="urgentItems.length" class="urgent-list">
        <view v-for="item in urgentItems" :key="item.id" class="urgent-item flex app-touchable items-center gap-2 px-3 py-3" role="button" :aria-label="item.task_title" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
          <view class="urgent-content min-w-0 flex flex-1 flex-col gap-1">
            <strong>{{ item.task_title }}</strong>
            <text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
          </view>
          <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
            {{ item.priority__mapping }}
          </wd-tag>
        </view>
      </view>
      <view v-else class="empty-task flex app-touchable items-center gap-1.5 px-3 pb-3 pt-2.5 text-size-xs leading-normal" role="button" hover-class="app-touchable--pressed" @click="openRoute(APP_ROUTES.organizationTasks)">
        <view class="i-carbon-checkmark-outline" />
        <text>{{ !loaded || loading && !dashboard ? '正在整理待办事项…' : dashboard ? '暂无紧急任务' : '前往任务中心查看待办' }}</text>
      </view>
    </view>

    <view class="overview-panel mt-2.5 overflow-hidden rounded-3 bg-surface-card">
      <view class="overview-heading flex app-touchable items-center justify-between gap-2 p-3" role="button" :aria-expanded="overviewExpanded" hover-class="app-touchable--pressed" @click="overviewExpanded = !overviewExpanded">
        <view class="overview-title flex items-center">
          <view class="i-carbon-chart-line" /><strong>经营速览</strong>
        </view>
        <view class="overview-toggle flex shrink-0 items-center text-size-xs">
          <text>{{ overviewExpanded ? '收起' : '展开' }}</text><view :class="overviewExpanded ? 'i-carbon-chevron-up' : 'i-carbon-chevron-down'" />
        </view>
      </view>
      <view v-if="overviewExpanded" class="overview-content border-t-hairline border-t-app-divider border-t-solid px-0 pb-3.5 pt-0">
        <view class="overview-update flex items-center justify-end px-3 pb-0 pt-2.5 text-size-xs" role="button" @click="refresh">
          <view class="i-carbon-renew" />{{ loading ? '更新中…' : '刷新数据' }}
        </view>
        <view v-if="loadError" class="load-notice px-3 pb-0 pt-2.5 text-size-xs" role="button" @click="refresh">
          数据暂时无法加载，点击重试
        </view>
        <view class="metric-grid grid mt-3">
          <view v-for="item in metrics" :key="item.label" class="metric-item min-w-0 flex flex-col app-touchable items-center gap-1 px-1 py-0" role="button" :aria-label="item.label" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
            <view class="metric-value text-size-base font-bold leading-tight">
              {{ item.value === null ? '—' : item.value }}<text v-if="item.value !== null">{{ item.unit }}</text>
            </view>
            <text class="metric-label">{{ item.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <view v-if="activation?.show_guide && nextActivationTask" class="activation-card mt-2.5 border-hairline border-app-border-brand-soft rounded-3 border-solid bg-surface-brand-soft p-3">
      <view class="activation-top mb-2.5 flex items-center justify-between gap-1.5">
        <view><text>开通引导</text><strong>下一步：{{ nextActivationTask.title }}</strong></view><text>{{ activation.completed_count }}/{{ activation.total_count }}</text>
      </view>
      <wd-progress :percentage="activation.completion_percent" hide-text />
      <view class="activation-bottom mt-2 flex items-center justify-between gap-1.5 text-size-xs">
        <text>{{ nextActivationTask.description }}</text>
      </view>
      <view class="mt-3 flex flex-wrap gap-2">
        <wd-button size="small" @click="openActivationTask(nextActivationTask)">
          {{ activationActionLabels[nextActivationTask.action] }}
        </wd-button>
        <wd-button v-if="nextActivationTask.key === 'business_completed'" size="small" variant="plain" @click="openRoute(APP_ROUTES.organizationSigning)">
          直接登记签约
        </wd-button>
      </view>
      <view class="mt-2 flex items-center justify-between">
        <wd-button size="small" variant="text" :aria-expanded="activationExpanded" @click="activationExpanded = !activationExpanded">
          {{ activationExpanded ? '收起步骤' : '查看全部步骤' }}
        </wd-button>
        <wd-button size="small" variant="text" :loading="loading" :disabled="loading" @click="refresh">
          刷新进度
        </wd-button>
      </view>
      <view v-if="activationExpanded" class="mt-2 flex flex-col gap-3">
        <view v-for="(task, index) in activation.tasks" :key="task.key">
          <view class="flex items-start justify-between gap-2 text-xs text-content-primary">
            <strong>{{ index + 1 }}. {{ task.title }}</strong>
            <text class="shrink-0" :class="task.completed ? 'text-app-success' : 'text-content-muted'">{{ task.completed ? '已完成' : '待完成' }}</text>
          </view>
          <view class="mt-1 text-xs text-content-secondary">
            {{ task.description }}
          </view>
        </view>
      </view>
      <view class="mt-3 text-xs text-content-muted">
        仅统计当前空间；全部完成或创建超过 3 天后自动收起。
      </view>
    </view>

    <view class="section-heading mx-0 mb-2 mt-4 flex items-center justify-between gap-2">
      <strong>经营工具</strong>
    </view>
    <view class="tools-grid grid grid-cols-4 rounded-3 bg-surface-card px-1 py-3.5">
      <view v-for="item in tools" :key="item.route" class="tool-item min-w-0 flex flex-col app-touchable items-center gap-1.5 whitespace-nowrap text-size-xs leading-normal" role="button" :aria-label="item.title" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="tool-icon h-7 w-7 flex items-center justify-center text-size-lg">
          <view :class="item.icon" />
        </view>
        <text>{{ item.title }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.header-stock {
  @apply text-app-brand-active;
}
.header-stock strong {
  @apply text-size-sm;
}
.section-caption {
  @apply text-content-muted;
}
.header-eyebrow {
  @apply text-content-secondary;
}
.header-title {
  display: -webkit-box;
  @apply overflow-hidden text-content-primary text-size-xl leading-tight;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.action-item {
  @apply text-content-primary;
}
.action-icon > view,
.business-icon > view,
.tool-icon > view {
  width: 1em;
  height: 1em;
  @apply flex-none;
}
.tone-blue {
  @apply text-content-on-brand bg-app-brand;
}
.tone-orange {
  color: #b9660f;
  background: #fff3e2;
}
.tone-green {
  color: #148262;
  background: #eaf6f0;
}
.tone-purple {
  color: #7254b7;
  background: #f1edfb;
}
.section-heading strong,
.panel-heading strong,
.overview-heading strong {
  @apply text-content-primary text-size-sm font-bold leading-normal;
}
.section-link {
  @apply text-content-muted;
}
.section-link > view {
  @apply text-size-2xs;
}
.daily-grid,
.metric-grid {
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
}
.daily-item + .daily-item,
.metric-item + .metric-item {
  @apply border-l-hairline border-l-solid border-l-app-divider;
}
.daily-item strong {
  @apply text-content-primary text-size-xl font-bold leading-tight;
  font-variant-numeric: tabular-nums;
}
.daily-item--active strong {
  @apply text-app-brand-active;
}
.daily-item > text,
.metric-label {
  @apply text-content-secondary text-size-2xs leading-normal whitespace-nowrap;
}
.inquiry-item + .inquiry-item,
.urgent-item + .urgent-item {
  @apply border-t-hairline border-t-solid border-t-app-divider;
}
.inquiry-avatar {
  @apply text-app-brand-active;
}
.inquiry-title strong {
  @apply overflow-hidden text-content-primary text-size-sm leading-snug text-ellipsis whitespace-nowrap;
}
.inquiry-status {
  @apply text-app-brand-active;
}
.inquiry-phone {
  @apply text-content-secondary;
}
.inquiry-feedback {
  @apply text-content-secondary;
}
.inquiry-feedback > view {
  @apply text-app-success text-size-sm;
}
.viewing-notice {
  @apply text-content-secondary;
}
.viewing-notice > text:first-of-type {
  @apply min-w-0 flex-1;
}
.viewing-notice-icon {
  @apply text-content-muted;
}
.viewing-notice-action {
  @apply text-app-brand-active;
}
.viewing-notice > .i-carbon-chevron-right {
  @apply text-app-brand-active text-size-2xs;
}
.empty-task {
  @apply text-content-secondary;
}
.empty-task > view {
  @apply text-app-success text-size-sm;
}
.urgent-content strong {
  @apply overflow-hidden text-content-primary text-size-xs leading-snug text-ellipsis whitespace-nowrap;
}
.urgent-content text {
  @apply text-content-muted text-size-xs leading-snug;
}
.overview-title,
.overview-toggle,
.overview-update {
  @apply gap-1.5;
}
.overview-title > view {
  @apply text-app-brand-active text-size-sm;
}
.overview-toggle {
  @apply gap-1 text-content-muted;
}
.overview-update {
  @apply text-app-brand-active;
}
.load-notice {
  @apply text-app-danger;
}
.metric-value {
  @apply text-content-primary;
  font-variant-numeric: tabular-nums;
}
.metric-value text {
  @apply ml-0.5 text-content-secondary text-size-2xs font-normal;
}
.activation-top > view {
  @apply flex flex-col gap-1;
}
.activation-top text {
  @apply text-app-brand-active text-size-xs;
}
.activation-top strong {
  @apply text-content-primary text-size-xs;
}
.activation-bottom {
  @apply text-content-secondary;
}
.activation-bottom text {
  @apply flex-1;
}
.activation-bottom view {
  @apply text-app-brand-active text-size-xs;
}
.business-item:nth-child(even) {
  @apply border-l-hairline border-l-solid border-l-app-divider;
}
.business-item:nth-child(n + 3) {
  @apply border-t-hairline border-t-solid border-t-app-divider;
}
.business-item:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}
.business-icon {
  @apply text-app-brand-active;
}
.business-copy strong,
.business-copy text {
  @apply overflow-hidden text-ellipsis whitespace-nowrap;
}
.business-copy strong {
  @apply text-content-primary text-size-sm font-semibold leading-normal;
}
.business-copy text {
  @apply text-content-muted text-size-2xs leading-normal;
}

.tools-grid {
  gap: 24rpx 8rpx;
}
.tool-item {
  @apply text-content-secondary;
}
.tool-icon {
  @apply text-app-brand-active;
}
</style>
