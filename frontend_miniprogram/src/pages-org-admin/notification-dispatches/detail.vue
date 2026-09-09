<script setup lang="ts">
import type { NotificationDispatchOut, NotificationOut } from '@/features/organization-admin/service'
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getNotificationDispatchScopeLabel, getNotificationDispatchStatusLabel } from '@/domain/organization-admin'
import { getOrganizationNotificationDispatch, listOrganizationNotificationDispatchDeliveries } from '@/features/organization-admin/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppListState from '@/shared/components/AppListState.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { createLatestRequestGuard } from '@/shared/composables/useAsyncTask'
import { usePagedQuery } from '@/shared/composables/usePagedQuery'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '通知发送详情', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const dispatchId = ref(0)
const dispatch = ref<NotificationDispatchOut | null>(null)
const loading = ref(true)
const loadError = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pageActive = false
const pollingRequestGuard = createLatestRequestGuard()

const deliveryQuery = usePagedQuery<NotificationOut>(({ page, pageSize }) => listOrganizationNotificationDispatchDeliveries(appContextStore.organizationSlug, dispatchId.value, page, pageSize), { pageSize: 20 })

function clearPollingTimer() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function stopPolling() {
  pageActive = false
  pollingRequestGuard.invalidate()
  clearPollingTimer()
}

function isPollingRequestCurrent(requestGeneration: number, organizationSlugSnapshot: string, dispatchIdSnapshot: number) {
  return pageActive
    && pollingRequestGuard.isCurrent(requestGeneration)
    && appContextStore.organizationSlug === organizationSlugSnapshot
    && dispatchId.value === dispatchIdSnapshot
}

function schedulePolling() {
  clearPollingTimer()
  if (!pageActive || !dispatch.value || !['pending', 'sending'].includes(dispatch.value.status))
    return
  const requestGeneration = pollingRequestGuard.begin()
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const dispatchIdSnapshot = dispatchId.value
  pollTimer = setTimeout(async () => {
    pollTimer = null
    try {
      const [nextDispatch] = await Promise.all([
        getOrganizationNotificationDispatch(organizationSlugSnapshot, dispatchIdSnapshot),
        deliveryQuery.refresh(),
      ])
      if (!isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
        return
      dispatch.value = nextDispatch
    }
    catch { /* 页面状态负责展示 */ }
    if (!isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
      return
    schedulePolling()
  }, 3000)
}

async function refreshAll() {
  clearPollingTimer()
  const requestGeneration = pollingRequestGuard.begin()
  const organizationSlugSnapshot = appContextStore.organizationSlug
  const dispatchIdSnapshot = dispatchId.value
  let shouldSchedule = false
  loading.value = true
  loadError.value = ''
  try {
    const [nextDispatch] = await Promise.all([
      getOrganizationNotificationDispatch(organizationSlugSnapshot, dispatchIdSnapshot),
      deliveryQuery.refresh(),
    ])
    if (!isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
      return
    dispatch.value = nextDispatch
    shouldSchedule = true
  }
  catch (error) {
    if (isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
      loadError.value = error instanceof Error ? error.message : '通知发送详情加载失败'
  }
  finally {
    if (isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
      loading.value = false
    uni.stopPullDownRefresh()
  }
  if (shouldSchedule && isPollingRequestCurrent(requestGeneration, organizationSlugSnapshot, dispatchIdSnapshot))
    schedulePolling()
}

async function loadMore() {
  try {
    await deliveryQuery.loadMore()
  }
  catch { /* 错误由分页状态展示 */ }
}

onLoad((options) => {
  dispatchId.value = Number(options?.id || 0)
})
onShow(() => {
  pageActive = true
  void refreshAll()
})
onHide(stopPolling)
onUnload(stopPolling)
onPullDownRefresh(refreshAll)
onReachBottom(() => void loadMore())
</script>

<template>
  <view class="page-shell">
    <AppLoading v-if="loading" text="正在加载通知发送详情…" />
    <AppErrorView v-else-if="loadError" title="通知发送详情加载失败" :message="loadError" @retry="refreshAll" />
    <template v-else-if="dispatch">
      <view class="summary-card">
        <view class="title-line">
          <strong>{{ dispatch.title }}</strong><wd-tag variant="light" size="small">
            {{ getNotificationDispatchStatusLabel(dispatch.status, dispatch.status__mapping) }}
          </wd-tag>
        </view>
        <text>{{ dispatch.body || '无正文' }}</text>
        <text>{{ getNotificationDispatchScopeLabel(dispatch.scope, dispatch.scope__mapping) }} · 已发送 {{ dispatch.delivered_count }}/{{ dispatch.target_count }} 人</text>
        <text v-if="dispatch.error_message" class="error-text">
          {{ dispatch.error_message }}
        </text>
      </view>
      <view class="section-heading">
        发送明细
      </view>
      <view class="card-list">
        <view v-for="notification in deliveryQuery.items.value" :key="notification.id" class="delivery-card">
          <view class="title-line">
            <strong>{{ notification.title }}</strong><wd-tag :type="notification.is_read ? 'success' : 'warning'" variant="light" size="small">
              {{ notification.is_read ? '已读' : '未读' }}
            </wd-tag>
          </view>
          <text>{{ notification.body || '无正文' }}</text>
          <text>{{ new Date(notification.created_at).toLocaleString('zh-CN', { hour12: false }) }}</text>
        </view>
      </view>
      <AppListState :loading="deliveryQuery.loading.value" :has-items="Boolean(deliveryQuery.items.value.length)" :finished="deliveryQuery.finished.value" :error-message="deliveryQuery.error.value?.message || ''" loading-text="正在加载发送明细…" empty-text="当前暂无发送记录" finished-text="没有更多发送记录了" @retry="refreshAll" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.summary-card,
.delivery-card {
  padding: 25rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
}
.summary-card strong,
.delivery-card strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.summary-card text,
.delivery-card text {
  display: block;
  margin-top: 10rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.55;
}
.summary-card .error-text {
  color: var(--app-color-danger);
}
.section-heading {
  margin: 28rpx 6rpx 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
</style>
