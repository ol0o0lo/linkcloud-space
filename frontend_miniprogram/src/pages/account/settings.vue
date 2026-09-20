<script setup lang="ts">
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

definePage({ style: { navigationBarTitleText: '设置', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()

function openProfile() {
  uni.navigateTo({ url: APP_ROUTES.profile })
}

function openPhoneVerification() {
  if (!appContextStore.user?.phone_verified)
    uni.navigateTo({ url: APP_ROUTES.phoneVerification })
}

function openAccountSecurity() {
  uni.navigateTo({ url: APP_ROUTES.accountSecurity })
}

function openNotificationPreferences() {
  uni.navigateTo({ url: APP_ROUTES.notificationPreferences })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (!res.confirm)
        return
      await sessionStore.logout()
      appContextStore.resetToVisitor()
      uni.reLaunch({ url: APP_ROUTES.home })
    },
  })
}
</script>

<template>
  <AppPage variant="list" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation title="设置" back scroll-mode="sticky" />
    </template>

    <view class="settings-stack">
      <view class="settings-card">
        <view class="settings-row" @click="openProfile">
          <view class="settings-icon settings-icon--profile">
            <view class="i-carbon-user-avatar" />
          </view>
          <view class="settings-main">
            <text class="settings-title">个人资料</text>
            <text class="settings-copy">头像、昵称与时区</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right" />
        </view>
        <view class="settings-row">
          <view class="settings-icon settings-icon--email">
            <view class="i-carbon-email" />
          </view>
          <view class="settings-main">
            <text class="settings-title">邮箱</text>
          </view>
          <text class="settings-value">{{ appContextStore.user?.email || '未绑定' }}</text>
        </view>
        <view class="settings-row" @click="openPhoneVerification">
          <view class="settings-icon settings-icon--phone">
            <view class="i-carbon-phone" />
          </view>
          <view class="settings-main">
            <text class="settings-title">手机号</text>
          </view>
          <text class="settings-value">{{ appContextStore.user?.phone_verified ? (appContextStore.user?.phone_national_number || '已验证') : '未验证' }}</text>
          <view v-if="!appContextStore.user?.phone_verified" class="settings-arrow i-carbon-chevron-right" />
        </view>
      </view>

      <view class="settings-card">
        <view class="settings-row" @click="openNotificationPreferences">
          <view class="settings-icon settings-icon--notification">
            <view class="i-carbon-notification" />
          </view>
          <view class="settings-main">
            <text class="settings-title">通知设置</text>
            <text class="settings-copy">站内信与邮件接收方式</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right" />
        </view>
        <view class="settings-row" @click="openAccountSecurity">
          <view class="settings-icon settings-icon--security">
            <view class="i-carbon-security" />
          </view>
          <view class="settings-main">
            <text class="settings-title">账号安全</text>
            <text class="settings-copy">MFA 与通行密钥</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right" />
        </view>
      </view>

      <view class="logout-action">
        <wd-button block type="danger" variant="text" @click="handleLogout">
          <view class="logout-label">
            <view class="i-carbon-logout" />
            <text>退出登录</text>
          </view>
        </wd-button>
      </view>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.settings-card {
  overflow: hidden;
  border-radius: 28rpx;
  background: var(--app-bg-card);
}
.settings-row {
  position: relative;
  display: flex;
  min-height: 132rpx;
  align-items: center;
  padding: 22rpx 26rpx;
  box-sizing: border-box;
}
.settings-row + .settings-row::before {
  position: absolute;
  top: 0;
  right: 26rpx;
  left: 106rpx;
  height: 1rpx;
  background: var(--app-border-color);
  content: '';
}
.logout-action {
  margin-top: 12rpx;
  padding: 8rpx 0;
  border-radius: 28rpx;
  background: var(--app-bg-card);
}
.settings-icon {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  border-radius: 18rpx;
  color: var(--app-color-brand-active);
  font-size: 30rpx;
  background: var(--app-bg-brand-soft);
}
.settings-icon--email {
  color: #6b57e8;
  background: #f0edff;
}
.settings-icon--phone {
  color: #159d77;
  background: #e9f8f2;
}
.settings-icon--security {
  color: #b45f06;
  background: #fff3df;
}
.settings-icon--notification {
  color: #0879d1;
  background: #eaf5ff;
}
.settings-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.settings-title,
.settings-copy,
.settings-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.settings-title {
  color: var(--app-text-primary);
  font-size: 26rpx;
  font-weight: 600;
}
.settings-copy {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.settings-value {
  max-width: 50%;
  margin-left: 18rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
}
.settings-arrow {
  margin-left: 12rpx;
  color: var(--app-text-muted);
  font-size: 26rpx;
}
.logout-label {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
}
</style>
