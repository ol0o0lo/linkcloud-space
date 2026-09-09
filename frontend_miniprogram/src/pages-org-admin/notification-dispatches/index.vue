<script setup lang="ts">
import type { NotificationDispatchOut, NotificationDispatchTargetOut } from '@/features/organization-admin/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { ref } from 'vue'
import { buildTenantDispatchScope, getNotificationDispatchScopeLabel, getNotificationDispatchStatusLabel } from '@/domain/organization-admin'
import type { TenantDispatchScope } from '@/domain/organization-admin'
import { createOrganizationNotificationDispatch, listAllOrganizationNotificationDispatchTargets, listOrganizationNotificationDispatches } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { createLatestRequestGuard } from '@/shared/composables/useAsyncTask'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '通知发送', enablePullDownRefresh: true } })

const toast = useToast()
const appContextStore = useAppContextStore()
const tenantRequest = { management_context: 'tenant' as const }
const createVisible = ref(false)
const scope = ref<TenantDispatchScope>('organization')
const targetKeyword = ref('')
const targets = ref<NotificationDispatchTargetOut[]>([])
const selectedIds = ref<number[]>([])
const title = ref('')
const body = ref('')
const category = ref('')
const creating = ref(false)
const searching = ref(false)
const requestGuard = createLatestRequestGuard()

const dispatchQuery = usePagedQuery<NotificationDispatchOut>(({ page, pageSize }) => listOrganizationNotificationDispatches(appContextStore.organizationSlug, page, pageSize), { pageSize: 15 })

async function refreshList() {
  try {
    await dispatchQuery.refresh()
  }
  catch { /* 错误由分页状态展示 */ }
  finally { uni.stopPullDownRefresh() }
}

async function loadMore() {
  try {
    await dispatchQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

function changeScope(nextScope: TenantDispatchScope) {
  requestGuard.invalidate()
  scope.value = nextScope
  selectedIds.value = []
  targets.value = []
  searching.value = false
  if (nextScope !== 'organization')
    void searchTargets()
}

function toggleTarget(id: number) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0)
    selectedIds.value.splice(index, 1)
  else
    selectedIds.value.push(id)
}

async function searchTargets() {
  if (scope.value === 'organization')
    return
  const scopeSnapshot = scope.value
  const keywordSnapshot = targetKeyword.value.trim()
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const requestGeneration = requestGuard.begin()
  searching.value = true
  try {
    const nextTargets = await listAllOrganizationNotificationDispatchTargets(organizationSlugSnapshot, scopeSnapshot, keywordSnapshot)
    if (!requestGuard.isCurrent(requestGeneration) || scope.value !== scopeSnapshot)
      return
    targets.value = nextTargets
  }
  catch (error) {
    if (requestGuard.isCurrent(requestGeneration) && scope.value === scopeSnapshot)
      toast.error(error instanceof Error ? error.message : '接收对象加载失败')
  }
  finally {
    if (requestGuard.isCurrent(requestGeneration) && scope.value === scopeSnapshot)
      searching.value = false
  }
}

function openDispatch(item: NotificationDispatchOut) {
  uni.navigateTo({ url: `${APP_ROUTES.organizationAdminNotificationDispatchDetail}?id=${item.id}` })
}

async function submitDispatch() {
  if (creating.value || !title.value.trim())
    return
  const organizationId = appContextStore.currentOrganization?.id
  if (!organizationId) {
    toast.error('未选择组织，请先切换到中介端')
    return
  }
  if (scope.value !== 'organization' && !selectedIds.value.length) {
    toast.warning('请选择接收对象')
    return
  }
  const scopePayload = buildTenantDispatchScope(scope.value, organizationId, selectedIds.value)
  const confirmation = await uni.showModal({
    title: '确认发送通知',
    content: `通知将在${tenantRequest.management_context === 'tenant' ? '当前组织' : ''}范围内异步发送，创建后不能撤回。`,
    confirmText: '确认发送',
  })
  if (!confirmation.confirm)
    return
  creating.value = true
  try {
    await createOrganizationNotificationDispatch(appContextStore.organizationSlug, {
      ...scopePayload,
      category: category.value.trim() || 'system',
      title: title.value.trim(),
      body: body.value.trim(),
    })
    toast.success('通知已提交发送')
    createVisible.value = false
    title.value = ''
    body.value = ''
    selectedIds.value = []
    await refreshList()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '通知发送失败') }
  finally { creating.value = false }
}

onShow(() => void refreshList())
onPullDownRefresh(refreshList)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <view class="toolbar">
      <view><strong>组织通知发送</strong><text>向整个组织、指定团队或成员发送通知</text></view><wd-button size="small" @click="createVisible = true">
        发送通知
      </wd-button>
    </view>
    <view v-if="dispatchQuery.items.value.length" class="card-list">
      <view v-for="item in dispatchQuery.items.value" :key="item.id" class="record-card" @click="openDispatch(item)">
        <view class="title-line">
          <strong>{{ item.title }}</strong><wd-tag variant="light" size="small">
            {{ getNotificationDispatchStatusLabel(item.status, item.status__mapping) }}
          </wd-tag>
        </view>
        <text class="body">{{ item.body || '无正文' }}</text>
        <view class="meta">
          <text>{{ getNotificationDispatchScopeLabel(item.scope, item.scope__mapping) }} · {{ item.target_count }} 人</text><text>已发送 {{ item.delivered_count }} 人</text>
        </view>
      </view>
    </view>
    <AppListState :loading="dispatchQuery.loading.value" :has-items="Boolean(dispatchQuery.items.value.length)" :finished="dispatchQuery.finished.value" :error-message="dispatchQuery.error.value?.message || ''" loading-text="正在加载发送记录…" empty-text="当前组织暂无通知发送记录" finished-text="没有更多发送记录了" @retry="refreshList" />
    <wd-popup v-model="createVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx; max-height: 84vh; overflow: scroll;">
      <view class="popup-title">
        发送通知
      </view>
      <view class="scope-row">
        <view v-for="option in [{ label: '整个组织', value: 'organization' }, { label: '指定团队', value: 'teams' }, { label: '指定成员', value: 'users' }]" :key="option.value" class="scope-pill" :class="[{ active: scope === option.value }]" @click="changeScope(option.value as TenantDispatchScope)">
          {{ option.label }}
        </view>
      </view>
      <template v-if="scope !== 'organization'">
        <wd-search v-model="targetKeyword" placeholder="搜索接收对象" hide-cancel @search="searchTargets" />
        <view v-if="searching" class="hint">
          正在加载接收对象…
        </view>
        <view class="target-grid">
          <view v-for="target in targets" :key="target.id" class="target-pill" :class="[{ selected: selectedIds.includes(target.id) }]" @click="toggleTarget(target.id)">
            {{ target.label }}
          </view>
        </view>
      </template>
      <wd-input v-model="category" label="通知类别代码（可选）" placeholder="留空则归为系统通知" />
      <wd-input v-model="title" label="标题" placeholder="请输入通知标题" />
      <wd-textarea v-model="body" placeholder="请输入通知正文" :maxlength="2000" show-word-limit />
      <wd-button block :loading="creating" :disabled="creating" @click="submitDispatch">
        确认创建并发送
      </wd-button>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 20rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.toolbar,
.title-line,
.meta,
.scope-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}
.toolbar {
  padding: 24rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.toolbar strong,
.toolbar text {
  display: block;
}
.toolbar strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.toolbar text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}
.record-card {
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.title-line strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.body {
  display: block;
  margin-top: 12rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.55;
}
.meta {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.popup-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.scope-row {
  justify-content: flex-start;
  margin-bottom: 18rpx;
}
.scope-pill,
.target-pill {
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
  background: var(--app-bg-page);
}
.scope-pill.active,
.target-pill.selected {
  color: var(--app-text-on-brand);
  background: var(--app-color-primary);
}
.target-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-bottom: 18rpx;
}
.hint {
  padding: 20rpx;
  color: var(--app-text-muted);
  text-align: center;
}
</style>
