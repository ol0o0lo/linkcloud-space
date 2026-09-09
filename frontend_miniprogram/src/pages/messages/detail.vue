<script setup lang="ts">
import type { NotificationOut } from '@/features/notifications/service'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getNotificationCategoryPresentation, getNotificationTone, resolveNotificationScope } from '@/domain/notifications'
import { getNotification, removeNotification, updateNotificationReadState } from '@/features/notifications/service'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '消息详情' } })

const appContextStore = useAppContextStore()
const notificationId = ref(0)
const notification = ref<NotificationOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const category = computed(() => getNotificationCategoryPresentation(notification.value?.category || ''))

function currentScope() {
  return resolveNotificationScope({ mode: appContextStore.navigationMode, organizationSlug: appContextStore.currentOrganization?.slug, landlordContactId: appContextStore.currentLandlordRelationship?.contact_id })
}

async function loadNotification() {
  loading.value = true
  loadError.value = ''
  try {
    const result = await getNotification(currentScope(), notificationId.value)
    notification.value = result.is_read ? result : await updateNotificationReadState(currentScope(), result.id, true)
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '消息加载失败'
  }
  finally {
    loading.value = false
  }
}

function openTarget() {
  const url = notification.value?.url
  if (!url)
    return
  if (/^https?:\/\//i.test(url)) {
    // #ifdef H5
    window.location.assign(url)
    // #endif
    // #ifndef H5
    uni.setClipboardData({ data: url, success: () => uni.showToast({ title: '链接已复制', icon: 'success' }) })
    // #endif
    return
  }
  uni.showToast({ title: '请从当前身份的业务入口继续处理', icon: 'none' })
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
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载消息…" />
    <AppErrorView v-else-if="loadError" title="消息加载失败" :message="loadError" @retry="loadNotification" />
    <template v-else-if="notification">
      <view class="hero-card">
        <view class="hero-icon" :class="category.icon" />
        <wd-tag :type="getNotificationTone(notification.is_read)" variant="light">
          {{ notification.is_read ? '已读' : '未读' }}
        </wd-tag>
        <view class="title">
          {{ notification.title || '无标题通知' }}
        </view>
        <view class="meta">
          {{ category.label }} · {{ new Date(notification.created_at).toLocaleString() }}
        </view>
      </view>
      <view class="body-card">
        {{ notification.body || '暂无正文' }}
      </view>
      <wd-cell-group v-if="notification.actor" title="消息来源" insert>
        <wd-cell title="发起人" :value="notification.actor.full_name || notification.actor.username" />
      </wd-cell-group>
      <AppBottomAction>
        <view class="actions">
          <wd-button block type="danger" variant="plain" @click="deleteCurrent">
            删除
          </wd-button>
          <wd-button v-if="notification.url" block @click="openTarget">
            继续处理
          </wd-button>
        </view>
      </AppBottomAction>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding: 26rpx 24rpx 160rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.hero-card,
.body-card {
  padding: 30rpx;
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.hero-card {
  text-align: center;
}
.hero-icon {
  margin: 4rpx auto 20rpx;
  color: var(--app-color-brand);
  font-size: 62rpx;
}
.title {
  margin-top: 22rpx;
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.meta {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.body-card {
  margin: 20rpx 0;
  color: var(--app-text-secondary);
  font-size: 27rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}
</style>
