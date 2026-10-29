<script setup lang="ts">
import type { NotificationReadFilter } from '@/domain/notifications'
import type { NotificationOut } from '@/features/notifications/service'
import { onHide, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { getNotificationCategoryPresentation, getNotificationFilterParam, resolveNotificationScope } from '@/domain/notifications'
import { formatMessageClock, formatMessageDay, messageDayKey } from '@/features/messaging/presentation'
import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead } from '@/features/notifications/service'
import { setNotificationTabbarUnreadCount } from '@/features/notifications/tabbar-badge'
import { usePagedPage } from '@/hooks/usePagedPage'
import { APP_ROUTES, getNotificationDetailRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '通知消息', enablePullDownRefresh: true } })

const workspace = useAppContextStore()
const filter = ref<NotificationReadFilter>('all')
const unreadCount = ref(0)
const markingAll = ref(false)
let generation = 0
let visible = false

function currentScope() {
  return resolveNotificationScope({ mode: workspace.navigationMode, organizationSlug: workspace.organizationSlug, landlordContactId: workspace.landlordContactId })
}

const notifications = usePagedPage<NotificationOut>({
  loader: ({ page, pageSize }) => listNotifications(currentScope(), page, pageSize, getNotificationFilterParam(filter.value)),
  pageSize: 20,
  enabled: () => workspace.navigationMode !== 'visitor',
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const rows = computed(() => notifications.items.value.map((item, index, items) => ({
  ...item,
  dayHeading: index === 0 || messageDayKey(item.created_at) !== messageDayKey(items[index - 1].created_at) ? formatMessageDay(item.created_at) : '',
})))

async function refresh() {
  const version = ++generation
  if (workspace.navigationMode === 'visitor') {
    uni.stopPullDownRefresh()
    return
  }
  try {
    const [, count] = await Promise.all([notifications.refresh(), getUnreadNotificationCount(currentScope())])
    if (version !== generation)
      return
    unreadCount.value = count.count
    setNotificationTabbarUnreadCount(count.count)
  }
  catch { /* 列表请求错误由分页组件展示。 */ }
  finally {
    uni.stopPullDownRefresh()
  }
}

function changeFilter(event: { value: string | number }) {
  filter.value = event.value as NotificationReadFilter
  void refresh()
}

function openNotification(item: NotificationOut) {
  uni.navigateTo({ url: getNotificationDetailRoute(item.id) })
}

function notificationIcon(category: string) {
  if (category.startsWith('team.task'))
    return 'task'
  return ({ 'house.contact': 'calendar', 'team.announcement': 'sound', 'allocation.status': 'chart-line', 'subscription.billing': 'file' })[category] || 'notification'
}

async function markAllRead() {
  if (!unreadCount.value || markingAll.value)
    return
  const version = generation
  const scope = currentScope()
  markingAll.value = true
  try {
    await markAllNotificationsRead(scope)
    if (version !== generation)
      return
    unreadCount.value = 0
    setNotificationTabbarUnreadCount(0)
    await notifications.refresh()
    uni.showToast({ title: '通知已全部标记为已读', icon: 'none' })
  }
  catch (error) {
    if (version === generation)
      uni.showToast({ title: error instanceof Error ? error.message : '操作失败，请重试', icon: 'none' })
  }
  finally {
    markingAll.value = false
  }
}

onShow(() => {
  visible = true
  void refresh()
})
onHide(() => {
  visible = false
  generation += 1
  notifications.reset()
})
watch(() => [workspace.user?.id, workspace.navigationMode, workspace.organizationSlug, workspace.landlordContactId] as const, () => {
  generation += 1
  notifications.reset()
  unreadCount.value = 0
  if (visible)
    void refresh()
})
onPullDownRefresh(refresh)
onReachBottom(() => void notifications.loadMore())
</script>

<template>
  <AppPage class="notifications-page" gutter="none" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="通知消息" back scroll-mode="sticky" :fallback-url="APP_ROUTES.messages" />
    </template>
    <view class="flex flex-wrap items-center gap-x-2 pr-app-gutter">
      <view class="min-w-0 flex-1">
        <t-tabs :value="filter" :space-evenly="false" :swipeable="false" @change="changeFilter">
          <t-tab-panel value="all" label="全部" />
          <t-tab-panel value="unread" :label="unreadCount ? `未读 ${unreadCount}` : '未读'" />
          <t-tab-panel value="read" label="已读" />
        </t-tabs>
      </view>
      <wd-button variant="text" size="small" :disabled="!unreadCount" :loading="markingAll" @click="markAllRead">
        全部已读
      </wd-button>
    </view>
    <AppPagedList
      :items="rows" item-key="id" layout="cell"
      :loading="notifications.loading.value" :refreshing="notifications.refreshing.value"
      :loading-more="notifications.loadingMore.value" :finished="notifications.finished.value" :error="notifications.error.value"
      loading-text="正在加载通知…" :empty-text="filter === 'unread' ? '没有未读通知了' : '暂时没有通知'"
      empty-description="新的业务提醒会显示在这里。" empty-icon="no-message" finished-text="已显示全部通知" @retry="refresh"
    >
      <template #item="{ item }">
        <view v-if="item.dayHeading" class="notification-date px-5 pb-1 pt-4.5 text-size-xs">
          {{ item.dayHeading }}
        </view>
        <t-cell t-class="notification-cell" hover :aria-label="item.title + (item.is_read ? '，已读' : '，未读')" @click="openNotification(item)">
          <template #left-icon>
            <view class="notice-icon mr-3 h-9 w-9 flex shrink-0 items-center justify-center rounded-3 text-size-base" :class="[`notice-icon--${getNotificationCategoryPresentation(item.category).tone}`, { 'notice-icon--announcement': item.category === 'team.announcement' }]">
              <t-icon :name="notificationIcon(item.category)" size="34rpx" />
            </view>
          </template>
          <template #title>
            <view class="notice-heading min-w-0 w-full">
              <view class="notice-topline mb-1.5 flex justify-between gap-2 text-size-2xs font-normal">
                <text>{{ getNotificationCategoryPresentation(item.category).label }}</text><text>{{ formatMessageClock(item.created_at) }}</text>
              </view>
              <view class="notice-title flex items-center gap-1.5 text-size-sm font-semibold leading-normal">
                <text>{{ item.title || '无标题通知' }}</text><t-badge v-if="!item.is_read" dot />
              </view>
            </view>
          </template>
          <template #description>
            <text class="notice-body mt-1.5 overflow-hidden text-size-xs leading-relaxed">{{ item.body || '暂无正文' }}</text>
            <view class="notice-link mt-2 flex items-center gap-1 text-size-2xs">
              查看详情<text class="i-carbon-chevron-right" />
            </view>
          </template>
        </t-cell>
      </template>
    </AppPagedList>
  </AppPage>
</template>

<style scoped>
.notifications-page :deep(.notification-cell) {
  @apply items-start;
}

.notifications-page {
  @apply min-h-screen bg-surface-card;
  --td-brand-color: var(--app-color-brand);
  --td-tabs-bg-color: var(--app-bg-card);
  --td-tabs-item-color: var(--app-text-muted);
  --td-cell-bg-color: var(--app-bg-card);
  --td-cell-horizontal-padding: 40rpx;
  --td-cell-vertical-padding: 30rpx;
  --td-cell-border-left-space: 136rpx;
  --td-cell-border-right-space: 40rpx;
  --td-cell-border-color: var(--app-divider-color);
}
.notification-date {
  @apply text-content-secondary;
}
.notifications-page :deep(.app-page__content) {
  @apply min-h-0;
}
.notice-icon {
  @apply text-app-brand bg-surface-brand-soft;
}
.notice-icon--warning {
  color: #ad8640;
  background: #fbf3e2;
}
.notice-icon--success {
  color: #5e9a83;
  background: #eaf4ee;
}
.notice-topline {
  @apply text-content-muted;
}
.notice-icon--announcement {
  color: #9679bf;
  background: #f3edfa;
}
.notice-title {
  @apply text-content-primary;
}
.notice-body {
  display: -webkit-box;
  @apply text-content-secondary;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.notice-link {
  @apply text-content-muted;
}
</style>
