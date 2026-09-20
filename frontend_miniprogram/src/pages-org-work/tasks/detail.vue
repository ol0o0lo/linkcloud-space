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
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppSection from '@/components/app/AppSection.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '任务详情' } })

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
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载任务详情…"
    error-title="任务详情加载失败"
    :show-actions="assignmentActions.length > 0 || taskActions.includes('cancel')"
    @retry="loadDetail"
  >
    <template #navigation>
      <AppCustomNavigation title="任务详情" back scroll-mode="sticky" />
    </template>
    <template #feedback>
      <wd-toast />
    </template>

    <template v-if="assignment">
      <view class="mx-app-gutter app-card-plain p-3.5">
        <view class="flex items-center gap-1.5">
          <AppStatusTag :text="assignment.status__mapping" :tone="getAssignmentStatusTone(assignment.status)" />
          <AppStatusTag :text="assignment.priority__mapping" :tone="getPriorityTone(assignment.priority)" />
        </view>
        <view class="mt-2.5 text-lg text-content-primary font-bold">
          {{ assignment.task_title }}
        </view>
        <text class="mt-1.5 block whitespace-pre-wrap text-xs text-content-secondary leading-relaxed">{{ assignment.task_description || '任务未填写补充说明' }}</text>
      </view>
      <wd-cell-group title="任务信息" insert>
        <wd-cell title="任务范围" :value="assignment.team_name || '全组织'" />
        <wd-cell title="创建人" :value="formatOrganizationWorkUser(assignment.creator)" />
        <wd-cell title="执行人" :value="formatOrganizationWorkUser(assignment.assignee)" />
        <wd-cell title="截止时间" :value="formatOrganizationWorkDateTime(assignment.due_at)" :label="assignment.is_overdue ? '当前任务已逾期' : ''" />
        <wd-cell title="处理结果" :label="assignment.result || '尚未填写处理结果'" />
      </wd-cell-group>
      <AppSection v-if="assignmentActions.includes('complete') || assignmentActions.includes('reject')" class="mx-app-gutter" title="处理结果">
        <wd-textarea v-model="result" placeholder="可填写完成说明或拒绝原因" :maxlength="1000" show-word-limit />
      </AppSection>
    </template>

    <template v-else-if="task">
      <view class="mx-app-gutter app-card-plain p-3.5">
        <view class="flex items-center gap-1.5">
          <AppStatusTag :text="task.status__mapping" :tone="getTaskStatusTone(task.status)" />
          <AppStatusTag :text="task.priority__mapping" :tone="getPriorityTone(task.priority)" />
        </view>
        <view class="mt-2.5 text-lg text-content-primary font-bold">
          {{ task.title }}
        </view>
        <text class="mt-1.5 block whitespace-pre-wrap text-xs text-content-secondary leading-relaxed">{{ task.description || '任务未填写补充说明' }}</text>
      </view>
      <wd-cell-group title="任务信息" insert>
        <wd-cell title="任务范围" :value="task.team_name || '全组织'" />
        <wd-cell title="创建人" :value="formatOrganizationWorkUser(task.creator)" />
        <wd-cell title="截止时间" :value="formatOrganizationWorkDateTime(task.due_at)" />
        <wd-cell title="创建时间" :value="formatOrganizationWorkDateTime(task.created_at)" />
      </wd-cell-group>
      <AppSection class="mx-app-gutter" title="执行情况">
        <view v-for="item in task.assignments || []" :key="item.id" class="mb-1.5 flex items-center justify-between gap-1.5 rounded-app-md bg-surface-page p-3 last:mb-0">
          <view class="min-w-0 flex-1">
            <view class="text-sm text-content-primary font-semibold">
              {{ formatOrganizationWorkUser(item.assignee) }}
            </view>
            <view class="mt-1 text-xs text-content-muted">
              {{ item.result || '尚未填写处理结果' }}
            </view>
          </view>
          <AppStatusTag :text="item.status__mapping" :tone="getAssignmentStatusTone(item.status)" />
        </view>
      </AppSection>
    </template>

    <template #actions>
      <view v-if="assignment" class="w-full flex flex-wrap justify-end gap-1.5">
        <wd-button v-for="action in assignmentActions" :key="action" size="small" :type="action === 'reject' ? 'danger' : 'primary'" :variant="action === 'accept' ? 'base' : 'plain'" :loading="submitting === action" :disabled="submitting !== null" @click="runAssignmentAction(action)">
          {{ actionLabels[action] }}
        </wd-button>
      </view>
      <view v-else-if="task" class="w-full">
        <wd-button type="danger" variant="plain" :loading="submitting === 'cancel'" :disabled="submitting !== null" @click="cancelTask">
          取消任务
        </wd-button>
      </view>
    </template>
  </AppDetailPage>
</template>
