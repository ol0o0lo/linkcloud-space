<script setup lang="ts">
import type { NotificationReadFilter } from '@/domain/notifications'
import type { NotificationOut } from '@/features/notifications/service'
import { onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getNotificationCategoryPresentation, getNotificationFilterParam, getNotificationTone, resolveNotificationScope } from '@/domain/notifications'
import { getUnreadNotificationCount, listNotifications, markAllNotificationsRead, updateNotificationReadState } from '@/features/notifications/service'
import { APP_ROUTES, getNotificationDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import AppPage from '@/shared/components/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'
import { getTabbarItems } from '@/tabbar/config'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '消息', enablePullDownRefresh: true } })

const appContextStore = useAppContextStore()
const currentMode = computed(() => appContextStore.navigationMode)
const tabbarTitle = computed(() => getTabbarItems(currentMode.value).find(item => item.slot === 'messages')?.text || '消息')
const filter = ref<NotificationReadFilter>('all')
const filterOptions = [
  { value: 'all', payload: { label: '全部' } },
  { value: 'unread', payload: { label: '未读' } },
  { value: 'read', payload: { label: '已读' } },
]
const items = ref<NotificationOut[]>([])
const unreadCount = ref(0)
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')

const contextLabel = computed(() => ({
  visitor: '登录后查看消息',
  personal: '租客个人消息',
  landlord: `${appContextStore.currentLandlordRelationship?.contact_name || '当前房东关系'}消息`,
  organization: `${appContextStore.currentOrganization?.name || '当前组织'}消息`,
})[currentMode.value])

function currentScope() {
  return resolveNotificationScope({
    mode: currentMode.value,
    organizationSlug: appContextStore.currentOrganization?.slug,
    landlordContactId: appContextStore.currentLandlordRelationship?.contact_id,
  })
}

async function load(reset = false) {
  if (currentMode.value === 'visitor') {
    items.value = []
    finished.value = true
    uni.stopPullDownRefresh()
    return
  }
  if (loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const scope = currentScope()
    const [result, count] = await Promise.all([
      listNotifications(scope, page.value, pageSize, getNotificationFilterParam(filter.value)),
      getUnreadNotificationCount(scope),
    ])
    items.value = reset ? result.items : [...items.value, ...result.items]
    unreadCount.value = count.count
    finished.value = items.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '消息加载失败，请稍后重试'
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function changeFilter(option: { value: string | number }) {
  filter.value = option.value as NotificationReadFilter
  void load(true)
}

async function markRead(item: NotificationOut) {
  if (item.is_read)
    return
  try {
    Object.assign(item, await updateNotificationReadState(currentScope(), item.id, true))
    unreadCount.value = Math.max(0, unreadCount.value - 1)
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
    items.value = items.value.map(item => ({ ...item, is_read: true }))
    unreadCount.value = 0
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

function openPreferences() {
  uni.navigateTo({ url: APP_ROUTES.notificationPreferences })
}

function openLogin() {
  uni.navigateTo({ url: APP_ROUTES.login })
}

onShow(() => {
  uni.setNavigationBarTitle({ title: tabbarTitle.value })
  void load(true)
})
onPullDownRefresh(() => load(true))
onReachBottom(() => void load())
</script>

<template>
  <AppPage class="messages-page" tabbar>
    <template #navigation>
      <AppCustomNavigation :title="tabbarTitle" />
    </template>
    <view class="page-heading">
      <view>
        <view class="page-title">
          {{ contextLabel }}
        </view>
        <view class="page-subtitle">
          {{ unreadCount ? `${unreadCount} 条未读消息` : '当前没有未读消息' }}
        </view>
      </view>
      <wd-button size="small" variant="text" @click="openPreferences">
        通知设置
      </wd-button>
    </view>

    <view v-if="currentMode === 'visitor'" class="login-card">
      <view class="i-carbon-notification login-icon" />
      <strong>登录后查看业务消息</strong>
      <text>登录后可查看与你当前身份相关的预约、租约、任务、公告和订阅通知。</text>
      <wd-button block @click="openLogin">
        去登录
      </wd-button>
    </view>

    <template v-else>
      <view class="toolbar">
        <wd-segmented :value="filter" :options="filterOptions" @change="changeFilter">
          <template #label="{ option }">
            {{ option.payload.label }}
          </template>
        </wd-segmented>
        <wd-button size="small" variant="plain" :disabled="!unreadCount" @click="markAllRead">
          全部标记为已读
        </wd-button>
      </view>

      <view v-if="items.length" class="notification-list">
        <view v-for="item in items" :key="item.id" class="notification-card" :class="{ unread: !item.is_read }" @click="openNotification(item)">
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
      </view>
      <AppListState :loading="loading" :has-items="Boolean(items.length)" :finished="finished" :error-message="loadError" loading-text="正在加载消息…" empty-text="当前筛选下没有消息" finished-text="没有更多消息了" @retry="load(items.length === 0)" />
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
  margin-bottom: 24rpx;
}
.page-title {
  color: var(--app-text-primary);
  font-size: 38rpx;
  font-weight: 700;
}
.page-subtitle {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
.toolbar {
  margin-bottom: 22rpx;
}
.toolbar :deep(.wd-segmented) {
  flex: 1;
}
.notification-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.notification-card {
  display: flex;
  gap: 20rpx;
  padding: 26rpx;
  border: 1rpx solid transparent;
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.notification-card.unread {
  border-color: var(--app-color-brand);
}
.notification-icon {
  flex: 0 0 auto;
  margin-top: 4rpx;
  color: var(--app-color-brand);
  font-size: 42rpx;
}
.notification-main {
  min-width: 0;
  flex: 1;
}
.notification-topline strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 28rpx;
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
.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  padding: 54rpx 34rpx;
  border-radius: 28rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.login-card strong {
  color: var(--app-text-primary);
  font-size: 31rpx;
}
.login-card text {
  color: var(--app-text-secondary);
  font-size: 25rpx;
  line-height: 1.7;
}
.login-icon {
  color: var(--app-color-brand);
  font-size: 72rpx;
}
</style>
