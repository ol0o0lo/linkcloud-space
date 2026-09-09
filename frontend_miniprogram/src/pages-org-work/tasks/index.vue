<script setup lang="ts">
import type { OrganizationTaskScope } from '@/domain/organization-work'
import type { TaskAssignmentOut, TeamOperationsCapabilitiesOut, TeamOut, WorkTaskOut } from '@/features/organization-work/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
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
import AppListState from '@/shared/components/AppListState.vue'
import { createLatestRequestGuard, useAsyncTask } from '@/shared/composables/useAsyncTask'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '团队任务', enablePullDownRefresh: true } })

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
  ? [{ label: '全部', value: '' }, { label: '待接受', value: 'pending' }, { label: '进行中', value: 'in_progress' }, { label: '已完成', value: 'completed' }]
  : [{ label: '全部', value: '' }, { label: '进行中', value: 'active' }, { label: '已完成', value: 'completed' }, { label: '已取消', value: 'cancelled' }])
const assignmentQuery = usePagedQuery<TaskAssignmentOut>(({ page, pageSize }) => listOrganizationTaskAssignments(appContextStore.organizationSlug, page, pageSize, {
  status: status.value || undefined,
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })
const teamTaskQuery = usePagedQuery<WorkTaskOut>(({ page, pageSize }) => listOrganizationWorkTasks(appContextStore.organizationSlug, page, pageSize, {
  status: status.value || undefined,
  keyword: keyword.value.trim() || undefined,
}), { pageSize: 15 })

const activeQuery = computed(() => scope.value === 'mine' ? assignmentQuery : teamTaskQuery)

async function refreshList() {
  try {
    await activeQuery.value.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await activeQuery.value.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

async function loadCapabilities() {
  capabilities.value = await getOrganizationWorkCapabilities(appContextStore.organizationSlug)
  organizationTeams.value = canManageTasks.value ? await listOrganizationWorkTeams(appContextStore.organizationSlug) : []
  if (!canManageTasks.value && scope.value === 'team')
    scope.value = 'mine'
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
  <view class="tasks-page">
    <wd-toast />
    <view class="toolbar-card">
      <view class="toolbar-line">
        <wd-segmented :value="scope" :options="scopeOptions" @change="changeScope">
          <template #label="{ option }">
            {{ option.label }}
          </template>
        </wd-segmented>
        <wd-button v-if="canManageTasks" size="small" @click="openCreate">
          创建任务
        </wd-button>
      </view>
      <wd-search v-model="keyword" placeholder="搜索任务标题或描述" hide-cancel @search="refreshList" @clear="refreshList" />
      <wd-segmented :value="status" :options="statusOptions" theme="outline" @change="changeStatus">
        <template #label="{ option }">
          {{ option.label }}
        </template>
      </wd-segmented>
    </view>

    <view v-if="scope === 'mine' && assignmentQuery.items.value.length" class="card-list">
      <view v-for="item in assignmentQuery.items.value" :key="item.id" class="record-card" @click="openAssignment(item)">
        <view class="card-topline">
          <strong>{{ item.task_title }}</strong><wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <text class="description">{{ item.task_description || '任务未填写补充说明' }}</text>
        <view class="tag-row">
          <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
            {{ item.priority__mapping }}
          </wd-tag><wd-tag v-if="item.is_overdue" type="danger" variant="light" size="small">
            已逾期
          </wd-tag>
        </view>
        <view class="record-meta">
          <text>{{ item.team_name || '全组织' }}</text><text>截止 {{ formatOrganizationWorkDateTime(item.due_at) }}</text>
        </view>
      </view>
    </view>
    <view v-else-if="scope === 'team' && teamTaskQuery.items.value.length" class="card-list">
      <view v-for="item in teamTaskQuery.items.value" :key="item.id" class="record-card" @click="openTask(item)">
        <view class="card-topline">
          <strong>{{ item.title }}</strong><wd-tag :type="getTaskStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
        <text class="description">{{ item.description || '任务未填写补充说明' }}</text>
        <view class="tag-row">
          <wd-tag :type="getPriorityTone(item.priority)" variant="light" size="small">
            {{ item.priority__mapping }}
          </wd-tag><text>{{ item.assignments?.length || 0 }} 位执行人</text>
        </view>
        <view class="record-meta">
          <text>{{ item.team_name || '全组织' }}</text><text>截止 {{ formatOrganizationWorkDateTime(item.due_at) }}</text>
        </view>
        <view v-if="getTaskActions(item).includes('cancel')" class="card-action">
          <wd-button size="small" type="danger" variant="plain" :disabled="cancellingTaskId !== null" :loading="cancellingTaskId === item.id" @click.stop="cancelTask(item)">
            取消任务
          </wd-button>
        </view>
      </view>
    </view>
    <AppListState
      :loading="activeQuery.loading.value"
      :has-items="Boolean(activeQuery.items.value.length)"
      :finished="activeQuery.finished.value"
      :error-message="activeQuery.error.value?.message || ''"
      loading-text="正在加载任务…"
      empty-text="当前筛选下没有任务"
      finished-text="没有更多任务了"
      @retry="refreshList"
    />

    <wd-popup v-model="createVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 34rpx 28rpx 28rpx; max-height: 84vh; overflow: auto;">
      <view class="popup-title">
        创建团队任务
      </view>
      <wd-cell title="任务范围" :value="selectedCreateScopeLabel" is-link @click="createScopePickerVisible = true" />
      <wd-picker v-model="selectedCreateScope" v-model:visible="createScopePickerVisible" :columns="createScopeOptions" title="选择任务范围" @confirm="changeCreateScope" />
      <wd-input v-model="taskTitle" label="任务标题" placeholder="请输入任务标题" :maxlength="120" clearable />
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
      <view class="field-label">
        执行人{{ selectedAssigneeIds.length ? `（已选 ${selectedAssigneeIds.length} 人）` : '' }}
      </view>
      <view class="assignee-list">
        <wd-checkbox-group v-model="selectedAssigneeIds" shape="square">
          <wd-checkbox v-for="candidate in candidates" :key="candidate.id" :name="candidate.id" :disabled="candidatesLoading">
            {{ formatOrganizationWorkUser(candidate) }}
          </wd-checkbox>
        </wd-checkbox-group>
      </view>
      <view v-if="selectedCreateScopeOption && !candidatesLoading && !candidates.length" class="scope-tip">
        所选任务范围没有可选执行人
      </view>
      <wd-button block :loading="creating" :disabled="candidatesLoading" @click="submitTask">
        创建任务
      </wd-button>
    </wd-popup>
    <wd-datetime-picker v-model="taskDueAtPickerValue" v-model:visible="taskDueAtPickerVisible" type="datetime" title="选择截止时间" @confirm="changeTaskDueAt" />
  </view>
</template>

<style scoped lang="scss">
.tasks-page {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.toolbar-card {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.toolbar-line,
.card-topline,
.record-meta,
.tag-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.toolbar-line :deep(.wd-segmented) {
  flex: 1;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 22rpx;
}
.record-card {
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.card-topline strong {
  min-width: 0;
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 29rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.description {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.tag-row {
  justify-content: flex-start;
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.record-meta {
  margin-top: 18rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.card-action {
  display: flex;
  justify-content: flex-end;
  margin-top: 20rpx;
}
.popup-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.scope-tip {
  margin: 10rpx 0 20rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.field-label {
  margin-top: 22rpx;
  color: var(--app-text-primary);
  font-size: 25rpx;
  font-weight: 650;
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
