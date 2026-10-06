<script setup lang="ts">
import type { DailyDashboardOut } from '@/features/organization-work/service'
import type { SaaSOnboardingProgress, SaaSOnboardingTask } from '@/features/saas/service'
import { computed, ref, watch } from 'vue'
import { formatOrganizationWorkDateTime, getPriorityTone } from '@/domain/organization-work'
import { getDailyOrganizationWorkDashboard } from '@/features/organization-work/service'
import { getSaaSOnboardingProgress } from '@/features/saas/service'
import { APP_ROUTES, getOrganizationTaskDetailRoute } from '@/modules/routes'
import { getListedHouseCount, getScheduledViewingCount, getVacantHouseCount } from '@/services/manual/organization-workbench'
import { useWorkspaceStore } from '@/store/workspace'

const workspace = useWorkspaceStore()
const organizationName = computed(() => workspace.currentOrganization?.name || '中介工作台')
const today = ref(new Date())
const todayLabel = computed(() => today.value.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))
const counts = ref<{ listed: number | null, vacant: number | null, viewings: number | null }>({ listed: null, vacant: null, viewings: null })
const dashboard = ref<DailyDashboardOut | null>(null)
const activation = ref<SaaSOnboardingProgress | null>(null)
const loading = ref(false)
const loaded = ref(false)
const loadError = ref(false)
let loadId = 0
let pending: Promise<void> | null = null
let pendingSlug = ''

const pendingTaskCount = computed(() => dashboard.value ? dashboard.value.pending_acceptance + dashboard.value.in_progress : null)
const urgentItems = computed(() => (dashboard.value?.urgent_items || []).slice(0, 2))
const nextActivationTask = computed(() => activation.value?.tasks.find(task => !task.completed) || null)
const metrics = computed(() => [
  { label: '招租中', value: counts.value.listed, unit: '套', icon: 'i-carbon-building', route: `${APP_ROUTES.organizationHouses}?status=listed`, tone: 'blue' },
  { label: '空置房源', value: counts.value.vacant, unit: '套', icon: 'i-carbon-home', route: `${APP_ROUTES.organizationHouses}?status=vacant`, tone: 'purple' },
  { label: '待带看', value: counts.value.viewings, unit: '场', icon: 'i-carbon-calendar', route: `${APP_ROUTES.organizationViewings}?status=scheduled`, tone: 'orange' },
  { label: '协作待办', value: pendingTaskCount.value, unit: '项', icon: 'i-carbon-task', route: APP_ROUTES.organizationTasks, tone: 'green' },
])
const quickActions = computed(() => [
  { title: '录入房源', icon: 'i-carbon-add-alt', route: APP_ROUTES.organizationHouseForm, tone: 'blue' },
  { title: '新建带看', icon: 'i-carbon-calendar-add', route: APP_ROUTES.organizationViewingForm, tone: 'orange' },
  { title: '联系人', icon: 'i-carbon-user-follow', route: APP_ROUTES.organizationContacts, tone: 'green' },
  workspace.capabilities.allocation
    ? { title: '登记签约', icon: 'i-carbon-document-signed', route: APP_ROUTES.organizationSigning, tone: 'purple' }
    : { title: '团队待办', icon: 'i-carbon-task', route: APP_ROUTES.organizationTasks, tone: 'purple' },
])
const businessEntries = [
  { title: '房源盘面', description: '房态、楼栋和小区', icon: 'i-carbon-building', route: APP_ROUTES.organizationHouses },
  { title: '联系人管理', description: '房东与租客资料', icon: 'i-carbon-user-multiple', route: APP_ROUTES.organizationContacts },
  { title: '带看管理', description: '预约与跟进排期', icon: 'i-carbon-calendar', route: APP_ROUTES.organizationViewings },
  { title: '租约管理', description: '签约及履约记录', icon: 'i-carbon-document', route: APP_ROUTES.organizationLeases },
  { title: '团队协作', description: '任务和团队公告', icon: 'i-carbon-task', route: APP_ROUTES.organizationWork },
  { title: '组织管理', description: '成员、团队与设置', icon: 'i-carbon-group', route: APP_ROUTES.organizationAdmin },
]
const tools = computed(() => [
  { title: '小区资料', icon: 'i-carbon-location', route: APP_ROUTES.organizationEstates },
  { title: '楼栋资料', icon: 'i-carbon-building-insights-1', route: APP_ROUTES.organizationBuildings },
  { title: '房源地图', icon: 'i-carbon-map', route: APP_ROUTES.organizationMap },
  { title: '房表同步', icon: 'i-carbon-data-base', route: APP_ROUTES.organizationVacancySync },
  ...(workspace.capabilities.analytics ? [{ title: '经营分析', icon: 'i-carbon-chart-line', route: APP_ROUTES.organizationAnalytics }] : []),
  ...(workspace.capabilities.allocation ? [{ title: '收益分配', icon: 'i-carbon-currency-yen', route: APP_ROUTES.organizationAllocation }] : []),
])

function openRoute(route: string) {
  uni.navigateTo({ url: route })
}

function openActivationTask(task: SaaSOnboardingTask) {
  const route = {
    create_house: APP_ROUTES.organizationHouseForm,
    invite_member: APP_ROUTES.organizationAdminInvitations,
    assign_responsibility: APP_ROUTES.organizationAdminResponsibilities,
    create_viewing: APP_ROUTES.organizationViewingForm,
  }[task.action]
  openRoute(route)
}

function refresh(): Promise<void> {
  const slug = workspace.organizationSlug
  if (!slug) {
    loadId += 1
    pending = null
    loading.value = false
    counts.value = { listed: null, vacant: null, viewings: null }
    dashboard.value = null
    activation.value = null
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
    getVacantHouseCount(slug),
    getScheduledViewingCount(slug),
    getDailyOrganizationWorkDashboard(slug),
    getSaaSOnboardingProgress(slug),
  ]).then(([listed, vacant, viewings, work, progress]) => {
    if (currentLoadId !== loadId)
      return
    counts.value = {
      listed: listed.status === 'fulfilled' ? listed.value : null,
      vacant: vacant.status === 'fulfilled' ? vacant.value : null,
      viewings: viewings.status === 'fulfilled' ? viewings.value : null,
    }
    dashboard.value = work.status === 'fulfilled' ? work.value : null
    activation.value = progress.status === 'fulfilled' ? progress.value : null
    loadError.value = [listed, vacant, viewings, work].every(result => result.status === 'rejected')
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
  counts.value = { listed: null, vacant: null, viewings: null }
  dashboard.value = null
  activation.value = null
  loaded.value = false
  loadError.value = false
  void refresh()
}, { immediate: true })
defineExpose({ refresh })
</script>

<template>
  <view class="workbench">
    <view class="workbench-hero">
      <view class="hero-glow" />
      <view class="hero-topline">
        <text>中介工作台</text><view class="hero-dot" /><text>{{ todayLabel }}</text>
      </view>
      <strong class="hero-title">{{ organizationName }}</strong>
      <text class="hero-description">房源、带看与团队事项，都从这里开始处理</text>
      <view class="hero-footer" @click="openRoute(APP_ROUTES.organizationTasks)">
        <view class="i-carbon-notification" />
        <text>{{ pendingTaskCount === null ? '查看我的待办' : pendingTaskCount ? `${pendingTaskCount} 项协作待办等你处理` : '协作任务均已处理' }}</text>
        <view class="i-carbon-arrow-right" />
      </view>
    </view>

    <view class="section-heading">
      <view><strong>经营速览</strong><text>当前组织的业务状态</text></view><text class="section-link" @click="refresh">{{ loading ? '更新中' : '刷新' }}</text>
    </view>
    <view v-if="loadError" class="load-notice" @click="refresh">
      数据暂时无法加载，点击重试
    </view>
    <view class="metric-grid">
      <view v-for="item in metrics" :key="item.label" class="metric-card app-touchable" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="metric-icon" :class="`tone-${item.tone}`">
          <view :class="item.icon" />
        </view>
        <view class="metric-value">
          {{ item.value === null ? '—' : item.value }}<text v-if="item.value !== null">{{ item.unit }}</text>
        </view>
        <view class="metric-label">
          {{ item.label }}
        </view>
      </view>
    </view>

    <view class="section-heading">
      <view><strong>快捷操作</strong><text>常用动作一步直达</text></view>
    </view>
    <view class="action-grid">
      <view v-for="item in quickActions" :key="item.route" class="action-item app-touchable" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="action-icon" :class="`tone-${item.tone}`">
          <view :class="item.icon" />
        </view>
        <text>{{ item.title }}</text>
      </view>
    </view>

    <view v-if="activation && !activation.activated && nextActivationTask" class="activation-card" @click="openActivationTask(nextActivationTask)">
      <view class="activation-top">
        <view><text>开通引导</text><strong>下一步：{{ nextActivationTask.title }}</strong></view><text>{{ activation.completed_count }}/{{ activation.total_count }}</text>
      </view>
      <wd-progress :percentage="activation.completion_percent" hide-text />
      <view class="activation-bottom">
        <text>{{ nextActivationTask.description }}</text><view class="i-carbon-arrow-right" />
      </view>
    </view>

    <view class="section-heading">
      <view><strong>优先处理</strong><text>近期需要关注的团队任务</text></view><text class="section-link" @click="openRoute(APP_ROUTES.organizationTasks)">全部待办 ›</text>
    </view>
    <view v-if="urgentItems.length" class="urgent-list">
      <view v-for="item in urgentItems" :key="item.id" class="urgent-item app-touchable" hover-class="app-touchable--pressed" @click="openRoute(getOrganizationTaskDetailRoute({ assignmentId: item.id }))">
        <view class="urgent-content">
          <strong>{{ item.task_title }}</strong><text>{{ item.is_overdue ? '已逾期' : formatOrganizationWorkDateTime(item.due_at) }}</text>
        </view>
        <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
          {{ item.priority__mapping }}
        </wd-tag>
      </view>
    </view>
    <view v-else class="empty-task" @click="openRoute(APP_ROUTES.organizationTasks)">
      <view class="empty-task-icon">
        <view class="i-carbon-task" />
      </view>
      <view class="empty-task-copy">
        <strong>{{ !loaded || loading && !dashboard ? '正在加载待办' : dashboard ? '暂无紧急任务' : '查看团队待办' }}</strong>
        <text>{{ !loaded || loading && !dashboard ? '马上为你整理需要处理的事项' : dashboard ? '其他协作事项可前往任务中心查看' : '前往任务中心了解当前进度' }}</text>
      </view>
      <view class="i-carbon-arrow-right empty-task-arrow" />
    </view>

    <view class="section-heading">
      <view><strong>业务管理</strong><text>完整的经营与协作入口</text></view>
    </view>
    <view class="business-list">
      <view v-for="item in businessEntries" :key="item.route" class="business-item app-touchable" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="business-icon">
          <view :class="item.icon" />
        </view><view class="business-copy">
          <strong>{{ item.title }}</strong><text>{{ item.description }}</text>
        </view><view class="i-carbon-chevron-right business-arrow" />
      </view>
    </view>
    <view class="section-heading">
      <view><strong>经营工具</strong></view>
    </view>
    <view class="tools-grid">
      <view v-for="item in tools" :key="item.route" class="tool-item app-touchable" hover-class="app-touchable--pressed" @click="openRoute(item.route)">
        <view class="tool-icon">
          <view :class="item.icon" />
        </view><text>{{ item.title }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.workbench {
  padding-bottom: 36rpx;
}
.workbench-hero {
  position: relative;
  overflow: hidden;
  padding: 38rpx 36rpx 0;
  border-radius: 32rpx;
  color: #fff;
  background: linear-gradient(125deg, #12345e 0%, #125498 58%, #0872d1 100%);
  box-shadow: var(--app-shadow-hero-brand);
}
.hero-glow {
  position: absolute;
  top: -148rpx;
  right: -105rpx;
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  background: rgb(255 255 255 / 7%);
  box-shadow: -140rpx 190rpx 0 rgb(255 255 255 / 3%);
  pointer-events: none;
}
.hero-topline,
.hero-footer {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.hero-topline {
  color: rgb(255 255 255 / 82%);
  font-size: 22rpx;
  font-weight: 500;
}
.hero-dot {
  width: 6rpx;
  height: 6rpx;
  border-radius: 50%;
  background: rgb(255 255 255 / 55%);
}
.hero-title {
  position: relative;
  display: block;
  margin-top: 28rpx;
  font-size: 44rpx;
  line-height: 1.25;
}
.hero-description {
  position: relative;
  display: block;
  margin: 12rpx 0 34rpx;
  color: rgb(255 255 255 / 86%);
  font-size: 23rpx;
}
.hero-footer {
  min-height: 84rpx;
  margin: 0 -36rpx;
  padding: 0 36rpx;
  border-top: 1rpx solid rgb(255 255 255 / 18%);
  background: rgb(0 30 70 / 20%);
  font-size: 23rpx;
  font-weight: 600;
}
.hero-footer text {
  flex: 1;
}
.hero-footer view {
  font-size: 28rpx;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin: 44rpx 0 18rpx;
}
.section-heading > view {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 30rpx;
}
.section-heading text {
  color: var(--app-text-secondary);
  font-size: 21rpx;
}
.section-heading .section-link {
  color: var(--app-color-brand);
  font-size: 22rpx;
  font-weight: 600;
}
.load-notice {
  margin-bottom: 16rpx;
  color: var(--app-color-danger);
  font-size: 22rpx;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14rpx;
}
.metric-card {
  min-width: 0;
  padding: 22rpx 6rpx 20rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
  text-align: center;
}
.metric-icon,
.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
}
.metric-icon {
  width: 66rpx;
  height: 66rpx;
  margin: 0 auto 16rpx;
  font-size: 34rpx;
}
.metric-icon > view,
.action-icon > view,
.business-icon > view,
.tool-icon > view {
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
}
.metric-value {
  color: var(--app-text-primary);
  font-size: 38rpx;
  font-weight: 700;
  line-height: 1.15;
}
.metric-value text {
  margin-left: 4rpx;
  color: var(--app-text-secondary);
  font-size: 19rpx;
  font-weight: 500;
}
.metric-label {
  margin-top: 10rpx;
  color: var(--app-text-secondary);
  font-size: 20rpx;
  font-weight: 500;
  white-space: nowrap;
}
.tone-blue {
  color: #096ac4;
  background: #e8f3ff;
}
.tone-purple {
  color: #704bc4;
  background: #f1edff;
}
.tone-orange {
  color: #b9660f;
  background: #fff1de;
}
.tone-green {
  color: #148262;
  background: #e4f6ee;
}
.action-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8rpx;
  padding: 22rpx 12rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 28rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.action-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 13rpx;
  color: var(--app-text-primary);
  font-size: 21rpx;
  font-weight: 600;
  white-space: nowrap;
}
.action-icon {
  width: 80rpx;
  height: 80rpx;
  font-size: 41rpx;
}
.activation-card {
  margin-top: 32rpx;
  padding: 26rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 26rpx;
  background: var(--app-bg-brand-soft);
}
.activation-top,
.activation-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}
.activation-top {
  margin-bottom: 18rpx;
}
.activation-top > view {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.activation-top text {
  color: var(--app-color-brand);
  font-size: 21rpx;
}
.activation-top strong {
  color: var(--app-text-primary);
  font-size: 25rpx;
}
.activation-bottom {
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
}
.activation-bottom text {
  flex: 1;
}
.activation-bottom view {
  color: var(--app-color-brand);
  font-size: 25rpx;
}
.urgent-list,
.business-list {
  overflow: hidden;
  border: 1rpx solid var(--app-border-card);
  border-radius: 26rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.urgent-item,
.business-item {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 24rpx;
}
.urgent-item + .urgent-item,
.business-item + .business-item {
  border-top: 1rpx solid var(--app-border-subtle);
}
.urgent-content,
.business-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}
.urgent-content strong,
.business-copy strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.urgent-content text,
.business-copy text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.empty-task {
  display: flex;
  min-height: 106rpx;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 26rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.empty-task-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: #148262;
  font-size: 32rpx;
  background: #e4f6ee;
}
.empty-task-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.empty-task-copy strong {
  color: var(--app-text-primary);
  font-size: 23rpx;
}
.empty-task-copy text {
  color: var(--app-text-secondary);
  font-size: 20rpx;
}
.empty-task-arrow {
  color: var(--app-color-brand-active);
  font-size: 27rpx;
}
.business-icon {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: 0 0 68rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: var(--app-color-brand-active);
  font-size: 32rpx;
  background: var(--app-bg-brand-soft);
}
.business-arrow {
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}
.tool-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 22rpx;
  color: var(--app-text-primary);
  font-size: 22rpx;
  font-weight: 500;
  background: var(--app-bg-card);
}
.tool-icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: var(--app-color-brand-active);
  font-size: 28rpx;
  background: var(--app-bg-brand-soft);
}
</style>
