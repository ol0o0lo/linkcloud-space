<script setup lang="ts">
import type { OrganizationAssignmentAction, OrganizationTaskAction } from '@/domain/organization-work'
import type { TaskAssignmentOut, WorkTaskOut } from '@/features/organization-work/service'
import { onLoad } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { formatOrganizationWorkDateTime, formatOrganizationWorkUser, getAssignmentActions, getAssignmentStatusTone, getPriorityTone, getTaskActions, getTaskStatusTone } from '@/domain/organization-work'
import {
  acceptOrganizationTaskAssignment,
  cancelOrganizationWorkTask,
  completeOrganizationTaskAssignment,
  getOrganizationTaskAssignment,
  getOrganizationWorkTask,
  rejectOrganizationTaskAssignment,
} from '@/features/organization-work/service'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '任务详情' } })

const actionLabels: Record<OrganizationAssignmentAction | OrganizationTaskAction, string> = { accept: '接受任务', complete: '完成任务', reject: '拒绝任务', cancel: '取消任务' }
const toast = useToast()
const appContextStore = useAppContextStore()
const assignmentId = ref(0)
const taskId = ref(0)
const assignment = ref<TaskAssignmentOut | null>(null)
const task = ref<WorkTaskOut | null>(null)
const result = ref('')
const loading = ref(true)
const loadError = ref('')
const submitting = ref<OrganizationAssignmentAction | OrganizationTaskAction | null>(null)
const assignmentActions = computed(() => assignment.value ? getAssignmentActions(assignment.value.status) : [])
const taskActions = computed(() => task.value ? getTaskActions(task.value) : [])

async function loadDetail() {
  loading.value = true
  loadError.value = ''
  try {
    if (assignmentId.value) {
      assignment.value = await getOrganizationTaskAssignment(appContextStore.organizationSlug, assignmentId.value)
      result.value = assignment.value.result || ''
    }
    else if (taskId.value) {
      task.value = await getOrganizationWorkTask(appContextStore.organizationSlug, taskId.value)
    }
    else {
      throw new Error('任务参数不正确')
    }
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '任务详情加载失败' }
  finally { loading.value = false }
}

async function runAssignmentAction(action: OrganizationAssignmentAction) {
  if (submitting.value || !assignment.value || !assignmentActions.value.includes(action))
    return
  submitting.value = action
  try {
    if (action === 'accept')
      assignment.value = await acceptOrganizationTaskAssignment(appContextStore.organizationSlug, assignment.value.id)
    else if (action === 'complete')
      assignment.value = await completeOrganizationTaskAssignment(appContextStore.organizationSlug, assignment.value.id, { result: result.value.trim() })
    else
      assignment.value = await rejectOrganizationTaskAssignment(appContextStore.organizationSlug, assignment.value.id, { result: result.value.trim() })
    toast.success(`${actionLabels[action]}成功`)
  }
  catch (error) { toast.error(error instanceof Error ? error.message : `${actionLabels[action]}失败`) }
  finally { submitting.value = null }
}

async function cancelTask() {
  if (submitting.value || !task.value || !taskActions.value.includes('cancel'))
    return
  const confirmation = await uni.showModal({ title: '取消任务', content: '任务取消后，未完成的分配会同步取消。', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  submitting.value = 'cancel'
  try {
    task.value = await cancelOrganizationWorkTask(appContextStore.organizationSlug, task.value.id)
    toast.success('任务已取消')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '任务取消失败') }
  finally { submitting.value = null }
}

onLoad((options) => {
  assignmentId.value = Number(options?.assignmentId || 0)
  taskId.value = Number(options?.taskId || 0)
  void loadDetail()
})
</script>

<template>
  <view class="detail-page">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载任务详情…" />
    <AppErrorView v-else-if="loadError" title="任务详情加载失败" :message="loadError" @retry="loadDetail" />
    <template v-else-if="assignment">
      <view class="hero-card">
        <view class="tag-row">
          <wd-tag :type="getAssignmentStatusTone(assignment.status)" variant="light">
            {{ assignment.status__mapping }}
          </wd-tag><wd-tag :type="getPriorityTone(assignment.priority)" variant="light">
            {{ assignment.priority__mapping }}
          </wd-tag>
        </view>
        <view class="detail-title">
          {{ assignment.task_title }}
        </view>
        <text class="description">{{ assignment.task_description || '任务未填写补充说明' }}</text>
      </view>
      <wd-cell-group title="任务信息" insert>
        <wd-cell title="任务范围" :value="assignment.team_name || '全组织'" />
        <wd-cell title="创建人" :value="formatOrganizationWorkUser(assignment.creator)" />
        <wd-cell title="执行人" :value="formatOrganizationWorkUser(assignment.assignee)" />
        <wd-cell title="截止时间" :value="formatOrganizationWorkDateTime(assignment.due_at)" :label="assignment.is_overdue ? '当前任务已逾期' : ''" />
        <wd-cell title="处理结果" :label="assignment.result || '尚未填写处理结果'" />
      </wd-cell-group>
      <view v-if="assignmentActions.includes('complete') || assignmentActions.includes('reject')" class="result-card">
        <view class="field-label">
          处理结果
        </view>
        <wd-textarea v-model="result" placeholder="可填写完成说明或拒绝原因" :maxlength="1000" show-word-limit />
      </view>
      <AppBottomAction v-if="assignmentActions.length">
        <view class="action-row">
          <wd-button v-for="action in assignmentActions" :key="action" size="small" :type="action === 'reject' ? 'danger' : 'primary'" :variant="action === 'accept' ? 'base' : 'plain'" :loading="submitting === action" :disabled="submitting !== null" @click="runAssignmentAction(action)">
            {{ actionLabels[action] }}
          </wd-button>
        </view>
      </AppBottomAction>
    </template>

    <template v-else-if="task">
      <view class="hero-card">
        <view class="tag-row">
          <wd-tag :type="getTaskStatusTone(task.status)" variant="light">
            {{ task.status__mapping }}
          </wd-tag><wd-tag :type="getPriorityTone(task.priority)" variant="light">
            {{ task.priority__mapping }}
          </wd-tag>
        </view>
        <view class="detail-title">
          {{ task.title }}
        </view>
        <text class="description">{{ task.description || '任务未填写补充说明' }}</text>
      </view>
      <wd-cell-group title="任务信息" insert>
        <wd-cell title="任务范围" :value="task.team_name || '全组织'" />
        <wd-cell title="创建人" :value="formatOrganizationWorkUser(task.creator)" />
        <wd-cell title="截止时间" :value="formatOrganizationWorkDateTime(task.due_at)" />
        <wd-cell title="创建时间" :value="formatOrganizationWorkDateTime(task.created_at)" />
      </wd-cell-group>
      <view class="assignment-section">
        <view class="section-title">
          执行情况
        </view>
        <view v-for="item in task.assignments || []" :key="item.id" class="assignment-card">
          <view><strong>{{ formatOrganizationWorkUser(item.assignee) }}</strong><text>{{ item.result || '尚未填写处理结果' }}</text></view>
          <wd-tag :type="getAssignmentStatusTone(item.status)" variant="light" size="small">
            {{ item.status__mapping }}
          </wd-tag>
        </view>
      </view>
      <AppBottomAction v-if="taskActions.includes('cancel')">
        <wd-button type="danger" variant="plain" :loading="submitting === 'cancel'" :disabled="submitting !== null" @click="cancelTask">
          取消任务
        </wd-button>
      </AppBottomAction>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 24rpx 0 160rpx;
  background: var(--app-bg-page);
}
.hero-card,
.result-card {
  margin: 0 24rpx 24rpx;
  padding: 30rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.tag-row,
.action-row,
.assignment-card {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.detail-title {
  margin-top: 20rpx;
  color: var(--app-text-primary);
  font-size: 35rpx;
  font-weight: 700;
}
.description {
  display: block;
  margin-top: 14rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  line-height: 1.7;
  white-space: pre-wrap;
}
.field-label,
.section-title {
  margin-bottom: 16rpx;
  color: var(--app-text-primary);
  font-size: 27rpx;
  font-weight: 650;
}
.action-row {
  flex-wrap: wrap;
  justify-content: flex-end;
}
.assignment-section {
  margin: 28rpx 24rpx;
}
.assignment-card {
  justify-content: space-between;
  margin-bottom: 14rpx;
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--app-bg-card);
}
.assignment-card strong,
.assignment-card text {
  display: block;
}
.assignment-card strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.assignment-card text {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
</style>
