<script setup lang="ts">
import type { OrganizationTaskScope } from '@/domain/organization-work'
import type { TaskAssignmentOut, TeamOperationsCapabilitiesOut, TeamOut, WorkTaskOut } from '@/features/organization-work/service'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { buildOrganizationWorkDueAtIso, buildOrganizationWorkManageScopeOptions, buildTaskScopeOptions, formatOrganizationWorkDateTime, formatOrganizationWorkUser, getAssignmentStatusTone, getPriorityTone, getTaskActions, getTaskStatusTone } from '@/domain/organization-work'
import {
  cancelOrganizationWorkTask,
  createOrganizationWorkTask,
  getOrganizationWorkCapabilities,
  listAllOrganizationTaskAssignees,
  listOrganizationTaskAssignments,
  listOrganizationWorkTasks,
  listOrganizationWorkTeams,
} from '@/features/organization-work/service'
import { getOrganizationTaskDetailRoute } from '@/modules/routes'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppListToolbar from '@/components/app/AppListToolbar.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import { createLatestRequestGuard, useAsyncTask } from '@/hooks/useAsyncTask'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '团队任务', enablePullDownRefresh: true } })

interface SegmentedOption { value: string | number }
interface PickerConfirmEvent { value: Array<string | number> }
interface DatetimePickerConfirmEvent { value: string | number | Array<string | number> }

const toast = useToast()
const appContextStore = useAppContextStore()
const capabilities = ref<TeamOperationsCapabilitiesOut | null>(null)
const organizationTeams = ref<TeamOut[]>([])
const scope = ref<OrganizationTaskScope>('mine')
const status = ref('')
const keyword = ref('')
const createVisible = ref(false)
const createScopePickerVisible = ref(false)
const creating = ref(false)
const cancellingTaskId = ref<number | null>(null)
const selectedAssigneeIds = ref<number[]>([])
const taskTitle = ref('')
const taskDescription = ref('')
const taskPriority = ref('normal')
const taskDueAt = ref<number | null>(null)
const taskDueAtPickerValue = ref(Date.now() + 24 * 60 * 60 * 1000)
const taskDueAtPickerVisible = ref(false)
const selectedCreateScope = ref<Array<string | number>>([])
const candidateQuery = useAsyncTask((teamId: number | undefined) => listAllOrganizationTaskAssignees(appContextStore.organizationSlug, { team_id: teamId }))
const candidateRequestGuard = createLatestRequestGuard()
const candidates = computed(() => candidateQuery.data.value || [])
const candidatesLoading = candidateQuery.loading

const canManageTasks = computed(() => capabilities.value?.task_organization_manage === true || Boolean(capabilities.value?.task_team_ids?.length))
const scopeOptions = computed(() => buildTaskScopeOptions(canManageTasks.value))
const createScopeOptions = computed(() => buildOrganizationWorkManageScopeOptions({
  organizationManage: capabilities.value?.task_organization_manage === true,
  teamIds: capabilities.value?.task_team_ids,
  teams: organizationTeams.value,
}))
const selectedCreateScopeOption = computed(() => createScopeOptions.value.find(item => item.value === selectedCreateScope.value[0]))
const selectedCreateTeamId = computed(() => selectedCreateScopeOption.value?.teamId)
const selectedCreateScopeLabel = computed(() => selectedCreateScopeOption.value?.label || '请选择任务范围')
const taskDueAtLabel = computed(() => taskDueAt.value === null ? '不设置' : new Date(taskDueAt.value).toLocaleString('zh-CN', { hour12: false }))
const statusOptions = computed(() => scope.value === 'mine'
  ? [{ label: '全部', value: '' }, { label: '待接受', value: 'pending' }, { label: '进行中', value: 'in_progress' }, { label: '已逾期', value: 'overdue' }, { label: '已完成', value: 'completed' }]
  : [{ label: '全部', value: '' }, { label: '进行中', value: 'active' }, { label: '已完成', value: 'completed' }, { label: '已取消', value: 'cancelled' }])
const assignmentPage = usePagedPage<TaskAssignmentOut>({
  loader: ({ page, pageSize }) => listOrganizationTaskAssignments(appContextStore.organizationSlug, page, pageSize, {
    status: status.value === 'overdue' ? undefined : status.value || undefined,
    overdue: status.value === 'overdue' ? true : undefined,
    keyword: keyword.value.trim() || undefined,
  }),
  pageSize: 15,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const teamTaskPage = usePagedPage<WorkTaskOut>({
  loader: ({ page, pageSize }) => listOrganizationWorkTasks(appContextStore.organizationSlug, page, pageSize, {
    status: status.value || undefined,
    keyword: keyword.value.trim() || undefined,
  }),
  pageSize: 15,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

const activePage = computed(() => scope.value === 'mine' ? assignmentPage : teamTaskPage)
const hasTaskFilters = computed(() => Boolean(status.value || keyword.value.trim()))
const mineEmptyTitle = computed(() => hasTaskFilters.value ? '当前筛选下没有我的任务' : '暂无待处理任务')
const mineEmptyDescription = computed(() => hasTaskFilters.value
  ? '可以清除搜索和状态筛选，查看其他任务。'
  : '新任务分配给你后会显示在这里。')
const teamEmptyTitle = computed(() => hasTaskFilters.value ? '当前筛选下没有团队任务' : '还没有团队任务')
const teamEmptyDescription = computed(() => hasTaskFilters.value
  ? '可以清除搜索和状态筛选，查看全部团队任务。'
  : canManageTasks.value
    ? '创建任务并分配执行人，方便团队持续跟进。'
    : '团队创建任务后会显示在这里。')

async function refreshList() {
  await activePage.value.refresh()
}

async function clearTaskFilters() {
  keyword.value = ''
  status.value = ''
  await refreshList()
}

async function handleTeamEmptyAction() {
  if (hasTaskFilters.value) {
    await clearTaskFilters()
    return
  }
  await openCreate()
}

async function loadMore() {
  await activePage.value.loadMore()
}

async function loadCapabilities() {
  capabilities.value = await getOrganizationWorkCapabilities(appContextStore.organizationSlug)
  organizationTeams.value = canManageTasks.value ? await listOrganizationWorkTeams(appContextStore.organizationSlug) : []
  if (!canManageTasks.value && scope.value === 'team') {
    scope.value = 'mine'
    status.value = ''
  }
}

async function changeScope(option: SegmentedOption) {
  scope.value = String(option.value) as OrganizationTaskScope
  status.value = ''
  await refreshList()
}

async function changeStatus(option: SegmentedOption) {
  status.value = String(option.value)
  await refreshList()
}

function openAssignment(item: TaskAssignmentOut) {
  uni.navigateTo({ url: getOrganizationTaskDetailRoute({ assignmentId: item.id }) })
}

function openTask(item: WorkTaskOut) {
  uni.navigateTo({ url: getOrganizationTaskDetailRoute({ taskId: item.id }) })
}

async function openCreate() {
  if (!canManageTasks.value)
    return
  createVisible.value = true
  createScopePickerVisible.value = false
  selectedCreateScope.value = []
  selectedAssigneeIds.value = []
  candidateRequestGuard.invalidate()
  candidateQuery.cancel()
  candidateQuery.data.value = []
}

async function loadCandidates() {
  const generation = candidateRequestGuard.begin()
  candidateQuery.data.value = []
  try {
    await candidateQuery.run(selectedCreateTeamId.value)
  }
  catch (error) {
    if (candidateRequestGuard.isCurrent(generation))
      toast.error(error instanceof Error ? error.message : '执行人加载失败')
  }
}

async function changeCreateScope(event: PickerConfirmEvent) {
  selectedCreateScope.value = event.value
  selectedAssigneeIds.value = []
  candidateQuery.data.value = []
  await loadCandidates()
}

function openTaskDueAtPicker() {
  taskDueAtPickerValue.value = taskDueAt.value ?? Date.now() + 24 * 60 * 60 * 1000
  taskDueAtPickerVisible.value = true
}

function changeTaskDueAt(event: DatetimePickerConfirmEvent) {
  const value = Array.isArray(event.value) ? Number.NaN : Number(event.value)
  if (!Number.isFinite(value)) {
    toast.warning('截止时间无效')
    return
  }
  taskDueAt.value = value
}

async function submitTask() {
  if (creating.value)
    return
  if (!selectedCreateScopeOption.value || !taskTitle.value.trim() || !selectedAssigneeIds.value.length) {
    toast.warning('请选择任务范围、填写标题并选择执行人')
    return
  }
  let dueAt: string | undefined
  if (taskDueAt.value !== null) {
    const selectedDate = new Date(taskDueAt.value)
    try {
      dueAt = buildOrganizationWorkDueAtIso({
        year: selectedDate.getFullYear(),
        month: selectedDate.getMonth() + 1,
        day: selectedDate.getDate(),
        hour: selectedDate.getHours(),
        minute: selectedDate.getMinutes(),
      })
    }
    catch {
      toast.warning('截止时间格式不正确')
      return
    }
  }
  creating.value = true
  try {
    await createOrganizationWorkTask(appContextStore.organizationSlug, {
      team_id: selectedCreateTeamId.value,
      title: taskTitle.value.trim(),
      description: taskDescription.value.trim(),
      priority: taskPriority.value,
      due_at: dueAt,
      assignee_ids: selectedAssigneeIds.value,
    })
    createVisible.value = false
    taskTitle.value = ''
    taskDescription.value = ''
    taskDueAt.value = null
    selectedAssigneeIds.value = []
    scope.value = 'team'
    status.value = ''
    toast.success('团队任务已创建')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '任务创建失败') }
  finally { creating.value = false }
}

async function cancelTask(item: WorkTaskOut) {
  if (cancellingTaskId.value)
    return
  if (!getTaskActions(item).includes('cancel'))
    return
  cancellingTaskId.value = item.id
  try {
    const confirmation = await uni.showModal({ title: '取消任务', content: '任务取消后，未完成的分配会同步取消。', confirmText: '确认取消' })
    if (!confirmation.confirm)
      return
    await cancelOrganizationWorkTask(appContextStore.organizationSlug, item.id)
    toast.success('任务已取消')
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '任务取消失败') }
  finally { cancellingTaskId.value = null }
}

onLoad((options) => {
  scope.value = options?.scope === 'team' ? 'team' : 'mine'
  const requestedStatus = options?.status || ''
  if (statusOptions.value.some(option => option.value === requestedStatus))
    status.value = requestedStatus
})
onShow(async () => {
  try {
    await loadCapabilities()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '任务权限加载失败') }
  await refreshList()
})
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <AppPage variant="list">
    <template #navigation>
      <AppCustomNavigation :title="scope === 'mine' ? '我的任务' : '团队任务'" back scroll-mode="sticky" />
    </template>
    <wd-toast />
    <AppListToolbar v-model:keyword="keyword" card search-placeholder="搜索任务标题或描述" @search="refreshList" @clear="refreshList">
      <template #before>
        <view class="flex items-center gap-2">
          <wd-segmented v-if="capabilities" class="min-w-0 flex-1" :value="scope" :options="scopeOptions" @change="changeScope">
            <template #label="{ option }">
              {{ option.label }}
            </template>
          </wd-segmented>
          <text v-else class="flex-1 text-xs text-content-muted">正在加载任务范围…</text>
          <wd-button v-if="canManageTasks" size="small" @click="openCreate">
            创建任务
          </wd-button>
        </view>
      </template>
      <template #filters>
        <view class="task-status-filters">
          <button v-for="option in statusOptions" :key="option.value" class="task-status-filter" :class="{ 'task-status-filter--active': status === option.value }" @click="changeStatus(option)">
            {{ option.label }}
          </button>
        </view>
      </template>
    </AppListToolbar>

    <view class="mt-2.5">
      <AppPagedList
        v-if="scope === 'mine'"
        :items="assignmentPage.items.value"
        item-key="id"
        :loading="assignmentPage.loading.value"
        :refreshing="assignmentPage.refreshing.value"
        :loading-more="assignmentPage.loadingMore.value"
        :finished="assignmentPage.finished.value"
        :error="assignmentPage.error.value"
        loading-text="正在加载任务…"
        :empty-text="mineEmptyTitle"
        :empty-description="mineEmptyDescription"
        empty-icon="no-content"
        :empty-action-text="hasTaskFilters ? '清除筛选' : ''"
        finished-text="没有更多任务了"
        @empty-action="clearTaskFilters"
        @retry="refreshList"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openAssignment(item)">
            <template #title>
              {{ item.task_title }}
            </template>
            <template #status>
              <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </template>
            <text class="description text-xs text-content-secondary">{{ item.task_description || '任务未填写补充说明' }}</text>
            <view class="mt-2 flex items-center gap-2 text-xs text-content-muted">
              <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
                {{ item.priority__mapping }}
              </wd-tag><wd-tag v-if="item.is_overdue" type="danger" variant="light" size="small">
                已逾期
              </wd-tag>
            </view>
            <template #meta>
              <view class="app-row-between text-2xs">
                <text>{{ item.team_name || '全组织' }}</text><text>截止 {{ formatOrganizationWorkDateTime(item.due_at) }}</text>
              </view>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
      <AppPagedList
        v-else
        :items="teamTaskPage.items.value"
        item-key="id"
        :loading="teamTaskPage.loading.value"
        :refreshing="teamTaskPage.refreshing.value"
        :loading-more="teamTaskPage.loadingMore.value"
        :finished="teamTaskPage.finished.value"
        :error="teamTaskPage.error.value"
        loading-text="正在加载任务…"
        :empty-text="teamEmptyTitle"
        :empty-description="teamEmptyDescription"
        empty-icon="no-content"
        :empty-action-text="hasTaskFilters ? '清除筛选' : canManageTasks ? '创建任务' : ''"
        finished-text="没有更多任务了"
        @empty-action="handleTeamEmptyAction"
        @retry="refreshList"
      >
        <template #item="{ item }">
          <AppRecordCard clickable @click="openTask(item)">
            <template #title>
              {{ item.title }}
            </template>
            <template #status>
              <wd-tag :type="getTaskStatusTone(item.status)" variant="light" size="small">
                {{ item.status__mapping }}
              </wd-tag>
            </template>
            <text class="description text-xs text-content-secondary">{{ item.description || '任务未填写补充说明' }}</text>
            <view class="mt-2 flex items-center gap-2 text-xs text-content-muted">
              <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
                {{ item.priority__mapping }}
              </wd-tag><text>{{ item.assignments?.length || 0 }} 位执行人</text>
            </view>
            <template #meta>
              <view class="app-row-between text-2xs">
                <text>{{ item.team_name || '全组织' }}</text><text>截止 {{ formatOrganizationWorkDateTime(item.due_at) }}</text>
              </view>
            </template>
            <template v-if="getTaskActions(item).includes('cancel')" #actions>
              <wd-button size="small" type="danger" variant="plain" :disabled="cancellingTaskId !== null" :loading="cancellingTaskId === item.id" @click.stop="cancelTask(item)">
                取消任务
              </wd-button>
            </template>
          </AppRecordCard>
        </template>
      </AppPagedList>
    </view>

    <AppBottomSheet v-model:visible="createVisible" title="创建团队任务" height="tall">
      <view class="flex flex-col gap-2">
        <wd-cell title="任务范围" :value="selectedCreateScopeLabel" is-link @click="createScopePickerVisible = true" />
        <wd-picker v-model="selectedCreateScope" v-model:visible="createScopePickerVisible" root-portal :z-index="1200" :columns="createScopeOptions" title="选择任务范围" @confirm="changeCreateScope" />
        <wd-cell title="任务标题" center>
          <wd-input v-model="taskTitle" placeholder="请输入任务标题" :maxlength="120" clearable compact align-right />
        </wd-cell>
        <wd-textarea v-model="taskDescription" placeholder="补充任务目标与交付要求" :maxlength="1000" show-word-limit />
        <wd-cell title="截止时间" :value="taskDueAtLabel" is-link @click="openTaskDueAtPicker" />
        <wd-button v-if="taskDueAt !== null" size="small" variant="plain" @click="taskDueAt = null">
          清除截止时间
        </wd-button>
        <wd-radio-group v-model="taskPriority" type="button" custom-class="priority-picker">
          <wd-radio value="normal">
            普通
          </wd-radio><wd-radio value="high">
            重要
          </wd-radio><wd-radio value="urgent">
            紧急
          </wd-radio>
        </wd-radio-group>
        <view class="mt-2.5 text-xs text-content-primary font-semibold">
          执行人{{ selectedAssigneeIds.length ? `（已选 ${selectedAssigneeIds.length} 人）` : '' }}
        </view>
        <view class="assignee-list">
          <wd-checkbox-group v-model="selectedAssigneeIds" shape="square">
            <wd-checkbox v-for="candidate in candidates" :key="candidate.id" :name="candidate.id" :disabled="candidatesLoading">
              {{ formatOrganizationWorkUser(candidate) }}
            </wd-checkbox>
          </wd-checkbox-group>
        </view>
        <view v-if="selectedCreateScopeOption && !candidatesLoading && !candidates.length" class="mb-2.5 mt-1.5 text-xs text-content-muted">
          所选任务范围没有可选执行人
        </view>
      </view>
      <template #footer>
        <wd-button block :loading="creating" :disabled="candidatesLoading" @click="submitTask">
          创建任务
        </wd-button>
      </template>
    </AppBottomSheet>
    <wd-datetime-picker v-model="taskDueAtPickerValue" v-model:visible="taskDueAtPickerVisible" root-portal :z-index="1200" type="datetime" title="选择截止时间" @confirm="changeTaskDueAt" />
  </AppPage>
</template>

<style scoped lang="scss">
.task-status-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.task-status-filter {
  width: auto;
  margin: 0;
  padding: 12rpx 20rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 14rpx;
  background: var(--app-bg-card);
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.4;
  white-space: nowrap;
}
.task-status-filter::after {
  border: 0;
}
.task-status-filter--active {
  border-color: var(--app-color-brand);
  background: var(--app-color-brand);
  color: #fff;
}
.description {
  display: -webkit-box;
  overflow: hidden;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.priority-picker {
  margin: 22rpx 0;
}
.assignee-list {
  max-height: 300rpx;
  overflow: auto;
  margin: 12rpx 0 26rpx;
}
.assignee-list :deep(.wd-checkbox) {
  display: flex;
  margin: 14rpx 0;
}
</style>
