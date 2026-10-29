<script setup lang="ts">
import type { NotificationOut } from '@/features/notifications/service'
import { onHide, onPageScroll, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppPage from '@/components/app/AppPage.vue'
import ConversationList from '@/features/messaging/ConversationList.vue'
import { formatMessageTime } from '@/features/messaging/presentation'
import { resolveNotificationScope } from '@/domain/notifications'
import { getUnreadNotificationCount, listNotifications } from '@/features/notifications/service'
import { setNotificationTabbarUnreadCount } from '@/features/notifications/tabbar-badge'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '消息', enablePullDownRefresh: true } })

const workspace = useAppContextStore()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
const chatList = ref<InstanceType<typeof ConversationList>>()
const latestNotification = ref<NotificationOut | null>(null)
const unreadCount = ref(0)
const summaryLoading = ref(false)
const summaryError = ref(false)
let generation = 0
let visible = false

async function refreshSummary() {
  const version = ++generation
  if (workspace.navigationMode === 'visitor')
    return
  const scope = resolveNotificationScope({ mode: workspace.navigationMode, organizationSlug: workspace.organizationSlug, landlordContactId: workspace.landlordContactId })
  summaryLoading.value = true
  summaryError.value = false
  try {
    const [result, count] = await Promise.all([listNotifications(scope, 1, 1), getUnreadNotificationCount(scope)])
    if (version !== generation)
      return
    latestNotification.value = result.items[0] || null
    unreadCount.value = count.count
    setNotificationTabbarUnreadCount(count.count)
  }
  catch {
    if (version === generation)
      summaryError.value = true
  }
  finally {
    if (version === generation)
      summaryLoading.value = false
  }
}

function openNotifications() {
  uni.navigateTo({ url: APP_ROUTES.notifications })
}

function openLogin() {
  uni.navigateTo({ url: getLoginRoute(APP_ROUTES.messages) })
}

onShow(() => {
  visible = true
  void refreshSummary()
})
onHide(() => {
  visible = false
  generation += 1
})
watch(() => [workspace.user?.id, workspace.navigationMode, workspace.organizationSlug, workspace.landlordContactId] as const, () => {
  generation += 1
  latestNotification.value = null
  unreadCount.value = 0
  summaryLoading.value = false
  summaryError.value = false
  if (visible)
    void refreshSummary()
})
onPullDownRefresh(async () => {
  try {
    await Promise.all([refreshSummary(), chatList.value?.refresh()])
  }
  finally {
    uni.stopPullDownRefresh()
  }
})
</script>

<template>
  <AppPage class="messages-page" tabbar gutter="none" ai-background>
    <template #navigation>
      <AppCustomNavigation title="消息" align="start" scroll-mode="fade" :scrolled="navigationScrolled" :scroll-progress="navigationProgress">
        <template #content>
          <text class="inbox-title text-size-2xl text-content-primary font-bold">消息</text>
        </template>
      </AppCustomNavigation>
    </template>
    <AppEmpty v-if="!workspace.authenticated" title="登录后查看消息" description="与你相关的聊天和业务提醒会显示在这里。" icon="no-message" action-text="登录查看" @action="openLogin" />
    <ConversationList v-else ref="chatList" :active="true">
      <template #before>
        <view class="notification-entry mx-0 mb-0 mt-2.5 border-b-hairline border-b-app-divider border-b-solid pb-0.5">
          <t-cell :bordered="false" hover aria-role="button" :aria-label="`通知消息，${unreadCount} 条未读`" @click="openNotifications">
            <template #left-icon>
              <view class="notification-avatar mr-3 h-12 w-12 flex items-center justify-center rounded-3.5 bg-surface-brand-soft text-size-2xl text-app-brand">
                <text class="i-carbon-notification" />
              </view>
            </template>
            <template #title>
              <text class="notification-title text-size-sm text-content-primary font-bold">通知消息</text>
            </template>
            <template #description>
              <text class="notification-preview mt-1.5 block overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-muted">{{ summaryError ? '暂时无法更新，点击查看通知' : summaryLoading && !latestNotification ? '正在加载通知…' : latestNotification?.title || '暂时没有通知' }}</text>
            </template>
            <template #note>
              <view class="notification-tail ml-2 min-h-11 flex flex-col items-end justify-between">
                <text class="notification-time text-size-2xs text-content-muted">{{ formatMessageTime(latestNotification?.created_at) }}</text>
                <view class="notification-trail flex items-center gap-1.5 text-size-2xs text-content-muted">
                  <t-badge v-if="unreadCount" :count="unreadCount" :max-count="99" /><text class="i-carbon-chevron-right" />
                </view>
              </view>
            </template>
          </t-cell>
        </view>
      </template>
    </ConversationList>
  </AppPage>
</template>

<style scoped>
.messages-page {
  @apply min-h-screen bg-transparent;
  --td-cell-bg-color: transparent;
  --td-cell-hover-color: rgb(255 255 255 / 40%);
  --td-cell-horizontal-padding: 40rpx;
  --td-cell-vertical-padding: 30rpx;
  --td-cell-border-color: var(--app-divider-color);
  --td-brand-color: var(--app-color-brand);
  --td-badge-bg-color: #ee5a55;
}
.messages-page :deep(.app-page__content) {
  @apply min-h-0;
}
</style>
