<script setup lang="ts">
import type { NotificationReadFilter } from '@/domain/notifications'
import type { NotificationOut } from '@/features/notifications/service'
import { onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getNotificationCategoryPresentation, getNotificationFilterParam, getNotificationTone, resolveNotificationScope } from '@/domain/notifications'
import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead, updateNotificationReadState } from '@/features/notifications/service'
import { setNotificationTabbarUnreadCount } from '@/features/notifications/tabbar-badge'
import { APP_ROUTES, getNotificationDetailRoute } from '@/modules/routes'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppLoginGuide from '@/components/app/AppLoginGuide.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from '@/tabbar/config'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '消息', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
const currentMode = computed(() => appContextStore.navigationMode)
const tabbarTitle = computed(() => getTabbarItems(currentMode.value).find(item => item.slot === 'messages')?.text || '消息')
const filter = ref<NotificationReadFilter>('all')
const filterOptions = [
  { value: 'all', payload: { label: '全部' } },
  { value: 'unread', payload: { label: '未读' } },
  { value: 'read', payload: { label: '已读' } },
]
const unreadCount = ref(0)

const contextLabel = computed(() => ({
  visitor: '消息中心',
  personal: '租客个人消息',
  landlord: `${appContextStore.currentLandlordRelationship?.contact_name || '当前房东关系'}消息`,
  organization: `${appContextStore.currentOrganization?.name || '当前组织'}消息`,
})[currentMode.value])
const messageSummary = computed(() => currentMode.value === 'visitor'
  ? '登录后查看与你相关的消息'
  : unreadCount.value ? `${unreadCount.value} 条未读消息` : '当前没有未读消息')
const emptyMessageTitle = computed(() => ({
  all: '暂时没有消息',
  unread: '没有未读消息',
  read: '没有已读消息',
})[filter.value])
const emptyMessageDescription = computed(() => filter.value === 'unread'
  ? '需要你处理的新消息会显示在这里。'
  : filter.value === 'read'
    ? '读过的消息会保留在这里，方便之后查找。'
    : currentMode.value === 'personal'
      ? '预约进度和系统提醒会显示在这里。'
      : '与你当前身份相关的业务消息会显示在这里。')
function currentScope() {
  return resolveNotificationScope({
    mode: currentMode.value,
    organizationSlug: appContextStore.currentOrganization?.slug,
    landlordContactId: appContextStore.currentLandlordRelationship?.contact_id,
  })
}

const messagePage = usePagedPage<NotificationOut>({
  loader: ({ page, pageSize }) => listNotifications(currentScope(), page, pageSize, getNotificationFilterParam(filter.value)),
  pageSize: 12,
  enabled: () => currentMode.value !== 'visitor',
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const showToolbar = computed(() => filter.value !== 'all' || messagePage.loading.value || messagePage.total.value > 0)

async function refreshMessages() {
  if (currentMode.value === 'visitor') {
    messagePage.reset()
    unreadCount.value = 0
    setNotificationTabbarUnreadCount(0)
    uni.stopPullDownRefresh()
    return
  }
  const scope = currentScope()
  try {
    const [, count] = await Promise.all([
      messagePage.refresh(),
      getUnreadNotificationCount(scope),
    ])
    unreadCount.value = count.count
    setNotificationTabbarUnreadCount(count.count)
  }
  catch { /* 列表错误由分页状态展示 */ }
  finally {
    uni.stopPullDownRefresh()
  }
}

function changeFilter(option: { value: string | number }) {
  filter.value = option.value as NotificationReadFilter
  void refreshMessages()
}

function filterLabel(value: string | number, label: string) {
  if (value === 'unread' && unreadCount.value)
    return `${label} ${unreadCount.value}`
  return label
}

async function markRead(item: NotificationOut) {
  if (item.is_read)
    return
  try {
    const updated = await updateNotificationReadState(currentScope(), item.id, true)
    if (filter.value === 'unread')
      messagePage.remove(item)
    else
      messagePage.upsert(updated)
    unreadCount.value = Math.max(0, unreadCount.value - 1)
    setNotificationTabbarUnreadCount(unreadCount.value)
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  }
}

async function markAllRead() {
  if (!unreadCount.value)
    return
  try {
    await markAllNotificationsRead(currentScope())
    unreadCount.value = 0
    setNotificationTabbarUnreadCount(0)
    if (filter.value === 'unread')
      await messagePage.refresh()
    else
      messagePage.replace(messagePage.items.value.map(item => ({ ...item, is_read: true })), messagePage.total.value)
    uni.showToast({ title: '已全部标记为已读', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '操作失败', icon: 'none' })
  }
}

function openNotification(item: NotificationOut) {
  void markRead(item)
  uni.navigateTo({ url: getNotificationDetailRoute(item.id) })
}

onShow(() => {
  uni.setNavigationBarTitle({ title: tabbarTitle.value })
  void refreshMessages()
})
onPullDownRefresh(refreshMessages)
onReachBottom(() => void messagePage.loadMore())
</script>

<template>
  <AppPage class="messages-page" tabbar ai-background>
    <template #navigation>
      <AppCustomNavigation title="" scroll-mode="fade" :scrolled="navigationScrolled" content-opacity-mode="fade-in" :scroll-progress="navigationProgress" />
    </template>
    <view class="page-heading">
      <view>
        <view class="page-title">
          {{ contextLabel }}
        </view>
        <view class="page-subtitle">
          {{ messageSummary }}
        </view>
      </view>
    </view>

    <AppLoginGuide
      v-if="currentMode === 'visitor'"
      title="登录后查看业务消息"
      description="登录后可查看预约进度、系统提醒以及与你当前身份相关的业务消息。"
      icon="i-carbon-notification"
      :redirect="APP_ROUTES.messages"
    />

    <template v-else>
      <view v-if="showToolbar" class="toolbar">
        <wd-segmented :value="filter" :options="filterOptions" @change="changeFilter">
          <template #label="{ option }">
            {{ filterLabel(option.value, option.payload.label) }}
          </template>
        </wd-segmented>
        <wd-button v-if="unreadCount" size="small" variant="plain" @click="markAllRead">
          全部已读
        </wd-button>
      </view>

      <AppPagedList
        :items="messagePage.items.value"
        item-key="id"
        :loading="messagePage.loading.value"
        :refreshing="messagePage.refreshing.value"
        :loading-more="messagePage.loadingMore.value"
        :finished="messagePage.finished.value"
        :error="messagePage.error.value"
        loading-text="正在加载消息…"
        :empty-text="emptyMessageTitle"
        :empty-description="emptyMessageDescription"
        empty-icon="no-message"
        finished-text="没有更多消息了"
        @retry="refreshMessages"
      >
        <template #item="{ item }">
          <view class="notification-card" :class="{ unread: !item.is_read }" @click="openNotification(item)">
            <view class="notification-icon" :class="getNotificationCategoryPresentation(item.category).icon" />
            <view class="notification-main">
              <view class="notification-topline">
                <strong>{{ item.title || '无标题通知' }}</strong>
                <wd-tag :type="getNotificationTone(item.is_read)" size="small" variant="light">
                  {{ item.is_read ? '已读' : '未读' }}
                </wd-tag>
              </view>
              <text class="notification-body">{{ item.body || '暂无正文' }}</text>
              <view class="notification-meta">
                <text>{{ getNotificationCategoryPresentation(item.category).label }}</text>
                <text>{{ new Date(item.created_at).toLocaleString() }}</text>
              </view>
            </view>
          </view>
        </template>
      </AppPagedList>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.page-heading,
.toolbar,
.notification-topline,
.notification-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.page-heading {
  margin: 8rpx 0 28rpx;
}
.page-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.page-subtitle {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.toolbar {
  align-items: stretch;
  margin-bottom: 36rpx;
}
.toolbar :deep(.wd-segmented) {
  flex: 1;
}
.notification-card {
  display: flex;
  gap: 28rpx;
  min-height: 224rpx;
  padding: 24rpx;
  border: 1rpx solid transparent;
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.notification-card.unread {
  border-color: var(--app-color-brand);
}
.notification-icon {
  display: flex;
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  color: var(--app-color-brand);
  font-size: 38rpx;
  background: var(--app-bg-brand-soft);
}
.notification-main {
  min-width: 0;
  flex: 1;
}
.notification-topline strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.notification-body {
  display: -webkit-box;
  overflow: hidden;
  margin-top: 12rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.notification-meta {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
</style>
