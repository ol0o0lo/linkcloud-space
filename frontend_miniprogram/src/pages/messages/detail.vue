<script setup lang="ts">
import type { NotificationOut } from '@/features/notifications/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getNotificationCategoryPresentation, getNotificationTone, resolveNotificationAction, resolveNotificationScope } from '@/domain/notifications'
import { getNotification, removeNotification, updateNotificationReadState } from '@/features/notifications/service'
import { syncNotificationTabbarBadge } from '@/features/notifications/tabbar-badge'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '消息详情', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const notificationId = ref(0)
const notification = ref<NotificationOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const category = computed(() => getNotificationCategoryPresentation(notification.value?.category || ''))
const action = computed(() => notification.value
  ? resolveNotificationAction({
      category: notification.value.category,
      data: notification.value.data,
      targetType: notification.value.target_type,
      targetId: notification.value.target_id,
      url: notification.value.url,
      expiresAt: notification.value.expires_at,
    })
  : null)

function currentScope() {
  return resolveNotificationScope({ mode: appContextStore.navigationMode, organizationSlug: appContextStore.currentOrganization?.slug, landlordContactId: appContextStore.currentLandlordRelationship?.contact_id })
}

async function loadNotification() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getNotification(currentScope(), notificationId.value)
    notification.value = result.is_read ? result : await updateNotificationReadState(currentScope(), result.id, true)
    if (!result.is_read) {
      void syncNotificationTabbarBadge({
        mode: appContextStore.navigationMode,
        organizationSlug: appContextStore.currentOrganization?.slug,
        landlordContactId: appContextStore.currentLandlordRelationship?.contact_id,
      })
    }
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '消息加载失败'
  }
  finally {
    loading.value = false
  }
}

function openTarget() {
  const target = action.value
  if (!target)
    return
  if (target.kind === 'external') {
    // #ifdef H5
    window.location.assign(target.url)
    // #endif
    // #ifndef H5
    uni.setClipboardData({ data: target.url, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }) })
    // #endif
    return
  }
  uni.navigateTo({ url: target.route })
}

function copyContact(value: unknown) {
  if (typeof value !== 'string' || !value)
    return
  uni.setClipboardData({ data: value, success: () => uni.showToast({ title: '已复制', icon: 'success' }) })
}

function deleteCurrent() {
  uni.showModal({
    title: '删除消息',
    content: '删除后无法在消息中心恢复，确认继续吗？',
    success: async ({ confirm }) => {
      if (!confirm)
        return
      try {
        await removeNotification(currentScope(), notificationId.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 350)
      }
      catch (error) {
        uni.showToast({ title: error instanceof Error ? error.message : '删除失败', icon: 'none' })
      }
    },
  })
}

onLoad((options) => {
  notificationId.value = Number(options?.id || 0)
  if (!notificationId.value) {
    loadError.value = '消息参数不正确'
    loading.value = false
    return
  }
  void loadNotification()
})
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载消息…"
    error-title="消息加载失败"
    :show-actions="Boolean(notification)"
    @retry="loadNotification"
  >
    <template #navigation>
      <AppCustomNavigation title="消息详情" back scroll-mode="sticky" />
    </template>
    <template v-if="notification">
      <view class="message-hero app-card-plain">
        <view class="message-hero__topline">
          <view class="message-hero__icon" :class="category.icon" />
          <AppStatusTag :text="notification.is_read ? '已读' : '未读'" :tone="getNotificationTone(notification.is_read)" />
        </view>
        <view class="message-hero__title">
          {{ notification.title || '无标题通知' }}
        </view>
        <view class="message-hero__meta">
          {{ category.label }} · {{ new Date(notification.created_at).toLocaleString() }}
        </view>
      </view>
      <view class="message-body app-card-plain">
        {{ notification.body || '暂无正文' }}
      </view>
      <view v-if="notification.category === 'house.contact'" class="message-contact app-card-plain">
        <view class="message-section-title">
          租客联系方式
        </view>
        <view v-if="notification.data.phone" class="message-row">
          <text>手机号</text><button @click="copyContact(notification.data.phone)">
            {{ notification.data.phone }} · 复制
          </button>
        </view>
        <view v-if="notification.data.wechat" class="message-row">
          <text>微信号</text><button @click="copyContact(notification.data.wechat)">
            {{ notification.data.wechat }} · 复制
          </button>
        </view>
      </view>
      <view v-if="notification.actor" class="message-source app-card-plain">
        <view class="message-section-title">
          消息来源
        </view>
        <view class="message-row">
          <text>发起人</text><strong>{{ notification.actor.full_name || notification.actor.username }}</strong>
        </view>
      </view>
      <view class="message-note">
        <view class="message-note__bar" />
        <view><strong>{{ action ? '可继续处理' : '消息说明' }}</strong><text>{{ action ? `此消息关联业务记录，可通过下方“${action.label}”继续处理。` : '该消息仅用于告知，目前没有可继续处理的业务操作。' }}</text></view>
      </view>
    </template>

    <template #actions>
      <view class="grid w-full gap-2" :class="action ? 'grid-cols-2' : 'grid-cols-1'">
        <wd-button block type="danger" variant="plain" @click="deleteCurrent">
          删除
        </wd-button>
        <wd-button v-if="action" block @click="openTarget">
          {{ action.label }}
        </wd-button>
      </view>
    </template>
  </AppDetailPage>
</template>

<style scoped lang="scss">
.message-hero,
.message-body,
.message-contact,
.message-source,
.message-note {
  margin: 0 var(--app-page-gutter);
}
.message-hero {
  padding: 32rpx;
}
.message-hero__topline,
.message-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.message-hero__icon {
  display: flex;
  width: 92rpx;
  height: 92rpx;
  align-items: center;
  justify-content: center;
  border-radius: 28rpx;
  color: var(--app-color-brand);
  font-size: 46rpx;
  background: var(--app-bg-brand-soft);
}
.message-hero__title {
  margin-top: 26rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.message-hero__meta {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.message-body {
  min-height: 250rpx;
  padding: 36rpx 32rpx;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 27rpx;
  line-height: 1.9;
  white-space: pre-wrap;
}
.message-source {
  padding: 28rpx 32rpx 12rpx;
}
.message-contact {
  padding: 28rpx 32rpx 12rpx;
}
.message-section-title {
  margin-bottom: 22rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.message-row {
  min-height: 76rpx;
  border-top: 1rpx solid var(--app-divider-color);
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.message-row strong {
  color: var(--app-text-primary);
  font-weight: 500;
}
.message-row button {
  margin: 0;
  padding: 0;
  color: var(--app-color-brand);
  font-size: 24rpx;
  line-height: 1.5;
  background: transparent;
}
.message-row button::after {
  border: 0;
}
.message-note {
  display: flex;
  gap: 22rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 28rpx;
  background: var(--app-bg-brand-soft);
}
.message-note__bar {
  width: 8rpx;
  flex: 0 0 8rpx;
  border-radius: 999rpx;
  background: var(--app-color-brand);
}
.message-note > view:last-child {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.message-note strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.message-note text {
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.65;
}
</style>
