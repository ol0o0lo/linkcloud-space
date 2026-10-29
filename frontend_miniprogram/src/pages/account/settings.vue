<script setup lang="ts">
import { getRealNameStatusLabel } from '@/domain/personal-account'
import { useRealNameStatus } from '@/features/account/useRealNameStatus'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

definePage({ style: { navigationBarTitleText: '设置', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()
const { status: realNameStatus } = useRealNameStatus()

function openProfile() {
  uni.navigateTo({ url: APP_ROUTES.profile })
}

function openRealName() {
  uni.navigateTo({ url: APP_ROUTES.realName })
}

function handleRealNameKeydown(event: KeyboardEvent) {
  // #ifdef H5
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  if (!event.repeat)
    openRealName()
  // #endif
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

    <view class="settings-stack flex flex-col gap-3">
      <view class="settings-card overflow-hidden rounded-3.5 bg-surface-card">
        <view class="settings-row relative box-border min-h-17 flex items-center px-3.5 py-3" @click="openProfile">
          <view class="settings-icon settings-icon--profile mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-user-avatar" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">个人资料</text>
            <text class="settings-copy overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">头像、昵称与时区</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right ml-1.5 text-size-xs text-content-muted" />
        </view>
        <button class="settings-row settings-row--action relative m-0 box-border min-h-17 w-full flex app-touchable items-center border-0 rounded-0 bg-transparent px-3.5 py-3 text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openRealName" @keydown="handleRealNameKeydown">
          <view class="settings-icon mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-identification" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">实名认证</text>
          </view>
          <text class="settings-value ml-2.5 max-w-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-secondary">{{ realNameStatus ? getRealNameStatusLabel(realNameStatus) : '状态未知' }}</text>
          <view class="settings-arrow i-carbon-chevron-right ml-1.5 text-size-xs text-content-muted" />
        </button>
        <view class="settings-row relative box-border min-h-17 flex items-center px-3.5 py-3">
          <view class="settings-icon mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-email" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">邮箱</text>
          </view>
          <text class="settings-value ml-2.5 max-w-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-secondary">{{ appContextStore.user?.email || '未绑定' }}</text>
        </view>
        <view class="settings-row relative box-border min-h-17 flex items-center px-3.5 py-3" @click="openPhoneVerification">
          <view class="settings-icon mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-phone" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">手机号</text>
          </view>
          <text class="settings-value ml-2.5 max-w-1/2 overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-secondary">{{ appContextStore.user?.phone_verified ? (appContextStore.user?.phone_national_number || '已验证') : '未验证' }}</text>
          <view v-if="!appContextStore.user?.phone_verified" class="settings-arrow i-carbon-chevron-right ml-1.5 text-size-xs text-content-muted" />
        </view>
      </view>

      <view class="settings-card overflow-hidden rounded-3.5 bg-surface-card">
        <view class="settings-row relative box-border min-h-17 flex items-center px-3.5 py-3" @click="openNotificationPreferences">
          <view class="settings-icon settings-icon--notification mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-notification" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">通知设置</text>
            <text class="settings-copy overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">站内信与邮件接收方式</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right ml-1.5 text-size-xs text-content-muted" />
        </view>
        <view class="settings-row relative box-border min-h-17 flex items-center px-3.5 py-3" @click="openAccountSecurity">
          <view class="settings-icon settings-icon--security mr-2.5 h-7.5 w-7.5 flex items-center justify-center rounded-2.5 text-size-sm">
            <view class="i-carbon-security" />
          </view>
          <view class="settings-main min-w-0 flex flex-1 flex-col gap-1">
            <text class="settings-title overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">账号安全</text>
            <text class="settings-copy overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">MFA 与通行密钥</text>
          </view>
          <view class="settings-arrow i-carbon-chevron-right ml-1.5 text-size-xs text-content-muted" />
        </view>
      </view>

      <view class="logout-action mt-1.5 rounded-3.5 bg-surface-card px-0 py-1">
        <wd-button block type="danger" variant="text" @click="handleLogout">
          <view class="logout-label inline-flex items-center gap-1.5">
            <view class="i-carbon-logout" />
            <text>退出登录</text>
          </view>
        </wd-button>
      </view>
    </view>
  </AppPage>
</template>

<style scoped>
.settings-row + .settings-row::before {
  @apply absolute top-0 right-3.5 left-13.5;
  height: 1rpx;
  @apply bg-app-border;
  content: '';
}
.settings-row--action::after {
  @apply border-0;
}
/* #ifdef H5 */
.settings-row--action:focus-visible {
  outline: 2px solid var(--app-color-brand-active);
  outline-offset: -4px;
}
/* #endif */
.settings-icon {
  @apply text-app-brand-active bg-surface-brand-soft;
}
.settings-icon--security {
  color: #b45f06;
  background: #fff3df;
}
.settings-icon--notification {
  color: #0879d1;
  background: #eaf5ff;
}
</style>
