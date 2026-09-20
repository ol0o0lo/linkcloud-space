<script setup lang="ts">
import type { NotificationDispatchOut, NotificationOut } from '@/features/organization-admin/service'
import { onHide, onLoad, onPullDownRefresh, onReachBottom, onShow, onUnload } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getNotificationDispatchScopeLabel, getNotificationDispatchStatusLabel } from '@/domain/organization-admin'
import { getOrganizationNotificationDispatch, listOrganizationNotificationDispatchDeliveries } from '@/features/organization-admin/service'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppRecordCard from '@/components/app/AppRecordCard.vue'
import AppSection from '@/components/app/AppSection.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { createLatestRequestGuard } from '@/hooks/useAsyncTask'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '通知发送详情', navigationStyle: 'custom', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const dispatchId = ref(0)
const dispatch = ref<NotificationDispatchOut | null>(null)
const loading = ref(true)
const loadError = ref('')
let pollTimer: ReturnType<typeof setTimeout> | null = null
let pageActive = false
const pollingRequestGuard = createLatestRequestGuard()

const deliveryPage = usePagedPage<NotificationOut>({
  loader: ({ page, pageSize }) => listOrganizationNotificationDispatchDeliveries(appContextStore.organizationSlug, dispatchId.value, page, pageSize),
  pageSize: 20,
  enabled: () => dispatchId.value > 0,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})

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
        deliveryPage.refresh(),
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
      deliveryPage.refresh(),
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
  await deliveryPage.loadMore()
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
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载通知发送详情…"
    error-title="通知发送详情加载失败"
    :show-actions="false"
    content-class="flex flex-col gap-3.5 px-app-gutter py-3"
    @retry="refreshAll"
  >
    <template #navigation>
      <AppCustomNavigation title="通知发送详情" back scroll-mode="sticky" />
    </template>
    <template v-if="dispatch">
      <AppRecordCard variant="prominent">
        <template #title>
          {{ dispatch.title }}
        </template>
        <template #status>
          <AppStatusTag :text="getNotificationDispatchStatusLabel(dispatch.status, dispatch.status__mapping)" />
        </template>
        <template #description>
          {{ dispatch.body || '无正文' }}
        </template>
        <template #meta>
          {{ getNotificationDispatchScopeLabel(dispatch.scope, dispatch.scope__mapping) }} · 已发送 {{ dispatch.delivered_count }}/{{ dispatch.target_count }} 人
        </template>
        <view v-if="dispatch.error_message" class="mt-2 text-xs text-app-danger leading-relaxed">
          {{ dispatch.error_message }}
        </view>
      </AppRecordCard>

      <AppSection title="发送明细" variant="plain">
        <AppPagedList
          :items="deliveryPage.items.value"
          item-key="id"
          :loading="deliveryPage.loading.value"
          :refreshing="deliveryPage.refreshing.value"
          :loading-more="deliveryPage.loadingMore.value"
          :finished="deliveryPage.finished.value"
          :error="deliveryPage.error.value"
          loading-text="正在加载发送明细…"
          empty-text="当前暂无发送记录"
          finished-text="没有更多发送记录了"
          @retry="refreshAll"
        >
          <template #item="{ item: notification }">
            <AppRecordCard variant="compact">
              <template #title>
                {{ notification.title }}
              </template>
              <template #status>
                <AppStatusTag :text="notification.is_read ? '已读' : '未读'" :tone="notification.is_read ? 'success' : 'warning'" />
              </template>
              <template #description>
                {{ notification.body || '无正文' }}
              </template>
              <template #meta>
                {{ new Date(notification.created_at).toLocaleString('zh-CN', { hour12: false }) }}
              </template>
            </AppRecordCard>
          </template>
        </AppPagedList>
      </AppSection>
    </template>
  </AppDetailPage>
</template>
