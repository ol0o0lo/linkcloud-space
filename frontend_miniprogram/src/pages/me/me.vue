<script lang="ts" setup>
import { onHide, onPageScroll, onReady, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { getRealNameHint, getRealNameTone } from '@/domain/personal-account'
import { useRealNameStatus } from '@/features/account/useRealNameStatus'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import AppModeSwitcher from './components/AppModeSwitcher.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
  },
})

const appContextStore = useAppContextStore()
const pageInstance = getCurrentInstance()?.proxy
const copyrightYear = new Date().getFullYear()
const copyrightVisible = ref(false)
let copyrightObserver: UniNamespace.IntersectionObserver | null = null
let copyrightTimer: ReturnType<typeof setTimeout> | undefined
let pageReady = false

function resetCopyright() {
  clearTimeout(copyrightTimer)
  copyrightTimer = undefined
  copyrightVisible.value = false
}

function stopCopyrightObserver() {
  copyrightObserver?.disconnect()
  copyrightObserver = null
  resetCopyright()
}

function observeCopyright() {
  stopCopyrightObserver()
  const windowInfo = uni.getWindowInfo()
  copyrightObserver = uni.createIntersectionObserver(pageInstance, { thresholds: [0, 1] })
  copyrightObserver.relativeToViewport({ bottom: -uni.upx2px(100) - (windowInfo.safeAreaInsets?.bottom || 0) }).observe('.me-copyright', (result) => {
    if (result.intersectionRatio < 1) {
      resetCopyright()
      return
    }
    if (!copyrightTimer && !copyrightVisible.value) {
      copyrightTimer = setTimeout(() => {
        copyrightTimer = undefined
        copyrightVisible.value = true
      }, 1000)
    }
  })
}

onReady(() => {
  pageReady = true
  observeCopyright()
})
onShow(() => {
  if (pageReady)
    void nextTick(observeCopyright)
})
onHide(stopCopyrightObserver)
onUnload(stopCopyrightObserver)
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
const displayName = computed(() => appContextStore.user?.last_name || appContextStore.user?.first_name || appContextStore.user?.username || appContextStore.user?.email || '用户')
const avatar = computed(() => appContextStore.user?.avatar?.[0]?.thumbnail || appContextStore.user?.avatar?.[0]?.url || '/static/images/default-avatar.png')
const { status: realNameStatus } = useRealNameStatus()
const realNameHint = computed(() => getRealNameHint(realNameStatus.value))

function handleActionKeydown(event: KeyboardEvent, action: () => void) {
  // #ifdef H5
  if (event.key !== 'Enter' && event.key !== ' ')
    return
  event.preventDefault()
  if (!event.repeat)
    action()
  // #endif
}

function openAccountRoute(url: string, tabbar = false) {
  if (!appContextStore.authenticated) {
    uni.navigateTo({ url: getLoginRoute(url) })
    return
  }
  if (tabbar)
    uni.switchTab({ url })
  else
    uni.navigateTo({ url })
}

function openProfile() {
  openAccountRoute(APP_ROUTES.profile)
}

function openRealName() {
  openAccountRoute(APP_ROUTES.realName)
}

function openWallet() {
  openAccountRoute(APP_ROUTES.wallet)
}

function openReferrals() {
  openAccountRoute(APP_ROUTES.referrals)
}

function openTenantViewings() {
  openAccountRoute(APP_ROUTES.tenantViewings)
}

function openTenantLeases() {
  openAccountRoute(APP_ROUTES.tenantLeases)
}

function openFavorites() {
  openAccountRoute(APP_ROUTES.favorites, true)
}

function openAccountSettings() {
  openAccountRoute(APP_ROUTES.accountSettings)
}

function openNotificationPreferences() {
  openAccountRoute(APP_ROUTES.notificationPreferences)
}

function openLandlordStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
}

function openSaaS() {
  uni.navigateTo({ url: APP_ROUTES.saasHome })
}
</script>

<template>
  <AppPage class="me-page" tabbar ai-background>
    <template #navigation>
      <AppCustomNavigation title="" align="start" scroll-mode="fade" :scrolled="navigationScrolled" :scroll-progress="navigationProgress">
        <template #content>
          <AppModeSwitcher v-if="appContextStore.authenticated" variant="navigation" />
          <text v-else class="me-navigation__title">我的</text>
        </template>
      </AppCustomNavigation>
    </template>
    <button class="me-action profile-card app-touchable" role="button" tabindex="0" :aria-label="appContextStore.authenticated ? '查看个人资料' : '登录或注册'" hover-class="app-touchable--pressed" @click="openProfile" @keydown="handleActionKeydown($event, openProfile)">
      <view class="profile-summary">
        <view class="avatar-shell">
          <image v-if="appContextStore.authenticated" class="avatar" :src="avatar" mode="aspectFill" />
          <view v-else class="visitor-avatar i-carbon-user-avatar" />
        </view>
        <view class="profile-main">
          <view class="profile-name">
            {{ appContextStore.authenticated ? displayName : '登录 / 注册' }}
          </view>
          <view class="profile-prompt">
            {{ appContextStore.authenticated ? '个人资料' : '登录后同步收藏、预约和消息' }}
          </view>
        </view>
        <view class="profile-arrow i-carbon-chevron-right" />
      </view>
    </button>

    <button v-if="appContextStore.authenticated && realNameHint" class="me-action certification-hint app-touchable" :class="`certification-hint--${getRealNameTone(realNameStatus)}`" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openRealName" @keydown="handleActionKeydown($event, openRealName)">
      <view class="i-carbon-identification" />
      <text>{{ realNameHint }}</text>
      <view class="i-carbon-chevron-right" />
    </button>

    <view v-if="!appContextStore.authenticated || appContextStore.navigationMode === 'personal'" class="service-card">
      <view class="service-heading">
        <view>
          <view class="service-title">
            找房服务
          </view>
          <view class="service-subtitle">
            {{ !appContextStore.authenticated ? '登录后保存进度，继续找房' : '收藏、预约与租约进度' }}
          </view>
        </view>
      </view>
      <view class="service-grid">
        <button class="me-action service-item app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openFavorites" @keydown="handleActionKeydown($event, openFavorites)">
          <view class="service-icon service-icon--favorite">
            <view class="i-carbon-favorite" />
          </view>
          <text class="service-name">我的收藏</text>
          <text class="service-copy">喜欢的房源</text>
        </button>
        <button class="me-action service-item app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openTenantViewings" @keydown="handleActionKeydown($event, openTenantViewings)">
          <view class="service-icon service-icon--viewing">
            <view class="i-carbon-calendar" />
          </view>
          <text class="service-name">看房预约</text>
          <text class="service-copy">时间与进度</text>
        </button>
        <button class="me-action service-item app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openTenantLeases" @keydown="handleActionKeydown($event, openTenantLeases)">
          <view class="service-icon">
            <view class="i-carbon-document" />
          </view>
          <text class="service-name">我的租约</text>
          <text class="service-copy">合同与履约</text>
        </button>
      </view>
    </view>

    <view v-if="appContextStore.authenticated && appContextStore.mode === 'landlord' && appContextStore.currentLandlordRelationship?.public_key" class="feature-card">
      <button class="me-action menu-row app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openLandlordStore" @keydown="handleActionKeydown($event, openLandlordStore)">
        <view class="menu-icon menu-icon--store">
          <view class="i-carbon-store" />
        </view>
        <view class="menu-main">
          <text class="menu-title">公开店铺</text>
          <text class="menu-copy">查看与分享公开房源</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </button>
    </view>

    <view v-if="appContextStore.authenticated" class="feature-card account-service-card">
      <view class="feature-section-title">
        {{ appContextStore.navigationMode === 'organization' ? '个人账户' : '账户服务' }}
      </view>
      <button class="me-action menu-row menu-row--compact app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openWallet" @keydown="handleActionKeydown($event, openWallet)">
        <view class="menu-icon">
          <view class="i-carbon-wallet" />
        </view>
        <view class="menu-main">
          <text class="menu-title">我的钱包</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </button>
      <button class="me-action menu-row menu-row--compact app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openReferrals" @keydown="handleActionKeydown($event, openReferrals)">
        <view class="menu-icon">
          <view class="i-carbon-share" />
        </view>
        <view class="menu-main">
          <text class="menu-title">邀请好友</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </button>
      <button class="me-action menu-row menu-row--compact app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openNotificationPreferences" @keydown="handleActionKeydown($event, openNotificationPreferences)">
        <view class="menu-icon">
          <view class="i-carbon-notification" />
        </view>
        <view class="menu-main">
          <text class="menu-title">通知设置</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </button>
      <button class="me-action menu-row menu-row--compact app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openAccountSettings" @keydown="handleActionKeydown($event, openAccountSettings)">
        <view class="menu-icon">
          <view class="i-carbon-settings-adjust" />
        </view>
        <view class="menu-main">
          <text class="menu-title">设置</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </button>
    </view>

    <button v-if="!appContextStore.authenticated || appContextStore.organizations.length === 0" class="me-action saas-entry app-touchable" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openSaaS" @keydown="handleActionKeydown($event, openSaaS)">
      <view class="saas-entry__icon">
        <view class="i-carbon-store" />
      </view>
      <view class="saas-entry__main">
        <strong>我是中介，免费开通工作台</strong>
        <text>14 天试用 · 管理房源、带看与签约</text>
      </view>
      <view class="i-carbon-chevron-right" />
    </button>
    <template #footer>
      <view class="me-copyright">
        <text class="me-copyright__text" :class="{ 'me-copyright__text--visible': copyrightVisible }" :aria-hidden="!copyrightVisible">
          © {{ copyrightYear }} 链云空间
        </text>
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.me-copyright {
  padding: 16rpx 24rpx 28rpx;
  text-align: center;
  pointer-events: none;
}
.me-copyright__text {
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1.5;
  opacity: 0;
  transition: opacity 1200ms ease;
}
.me-copyright__text--visible {
  opacity: 0.55;
}
@media (prefers-reduced-motion: reduce) {
  .me-copyright__text {
    transition-duration: 200ms;
  }
}
.me-action {
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  color: inherit;
  font: inherit;
  line-height: 1.5;
  text-align: left;
  background: transparent;
}
.me-action::after {
  border: 0;
}
/* #ifdef H5 */
.me-action:focus-visible {
  outline: 2px solid var(--app-color-brand-active);
  outline-offset: -4px;
}
/* #endif */
.me-navigation__title {
  color: var(--app-text-secondary);
  font-size: 28rpx;
  font-weight: 500;
  line-height: 1.25;
}
.profile-card {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  padding: 20rpx 2rpx 32rpx;
  border-radius: 18rpx;
  box-sizing: border-box;
}
.saas-entry {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 24rpx;
  padding: 20rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 26rpx;
  background: transparent;
}
.saas-entry__icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: var(--app-text-secondary);
  font-size: 28rpx;
  background: var(--app-bg-brand-soft);
}
.saas-entry__main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 7rpx;
}
.saas-entry__main strong {
  color: var(--app-text-primary);
  font-size: 24rpx;
  overflow-wrap: anywhere;
}
.saas-entry__main text {
  color: var(--app-text-secondary);
  font-size: 20rpx;
}
.saas-entry > .i-carbon-chevron-right {
  flex-shrink: 0;
  color: var(--app-text-muted);
}
.profile-summary {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 28rpx;
}
.avatar-shell {
  display: flex;
  width: 116rpx;
  height: 116rpx;
  flex: 0 0 116rpx;
  align-items: center;
  justify-content: center;
  border: 6rpx solid var(--app-bg-card);
  border-radius: 50%;
  box-sizing: border-box;
  background: var(--app-bg-subtle);
  box-shadow: 0 0 0 1rpx var(--app-border-card);
}
.avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--app-bg-subtle);
}
.visitor-avatar {
  color: var(--app-color-brand);
  font-size: 62rpx;
}
.profile-main {
  min-width: 0;
  flex: 1;
}
.profile-arrow {
  color: var(--app-text-muted);
  font-size: 26rpx;
}
.profile-name {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 48rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-prompt {
  margin-top: 12rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.certification-hint {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-height: 44px;
  margin-top: -12rpx;
  padding: 0 2rpx;
  border-radius: 12rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
.certification-hint--default {
  color: var(--app-color-brand-active);
}
.certification-hint--danger {
  color: var(--app-color-danger);
}
.certification-hint > view {
  flex-shrink: 0;
  font-size: 28rpx;
}
.service-card {
  margin-top: 24rpx;
  padding: 26rpx 16rpx 24rpx;
  border-radius: 32rpx;
  background: var(--app-bg-card);
}
.service-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12rpx;
}
.service-title {
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.service-subtitle {
  margin-top: 5rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.service-grid {
  display: flex;
  margin-top: 24rpx;
}
.service-item {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  flex-direction: column;
  border-radius: 18rpx;
  padding: 4rpx 12rpx;
}
.service-item + .service-item::before {
  position: absolute;
  top: 16rpx;
  bottom: 16rpx;
  left: 0;
  width: 1rpx;
  background: var(--app-border-color);
  content: '';
}
.service-icon {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: var(--app-color-brand-active);
  font-size: 34rpx;
  background: var(--app-bg-brand-soft);
}
.service-icon--viewing {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.service-icon--favorite {
  color: #d55370;
  background: #fff0f3;
}
.service-name,
.service-copy {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-name {
  margin-top: 16rpx;
  color: var(--app-text-primary);
  font-size: 24rpx;
  font-weight: 600;
}
.service-copy {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.feature-card {
  overflow: hidden;
  margin-top: 24rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 36rpx;
  background: var(--app-bg-card);
}
.feature-section-title {
  padding: 32rpx 32rpx 12rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  font-weight: 500;
}
.menu-row {
  position: relative;
  display: flex;
  min-height: 132rpx;
  align-items: center;
  padding: 22rpx 26rpx;
  box-sizing: border-box;
}
.menu-row--compact {
  height: 106rpx;
  min-height: 44px;
  padding: 0 32rpx;
}
.feature-card .menu-row + .menu-row::before {
  position: absolute;
  top: 0;
  right: 32rpx;
  left: 96rpx;
  height: 1rpx;
  background: var(--app-divider-color);
  content: '';
}
.menu-icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  border-radius: 18rpx;
  color: var(--app-color-brand-active);
  font-size: 32rpx;
  background: var(--app-bg-brand-soft);
}
.menu-icon--store {
  color: #b45f06;
  background: #fff3df;
}
.account-service-card .menu-icon {
  width: 40rpx;
  height: 40rpx;
  flex-basis: 40rpx;
  margin-right: 24rpx;
  border-radius: 0;
  color: var(--app-text-secondary);
  font-size: 40rpx;
  background: transparent;
}
.menu-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}
.menu-title,
.menu-copy {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-title {
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 500;
}
.menu-copy {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.menu-arrow {
  flex-shrink: 0;
  margin-left: 16rpx;
  color: var(--app-text-muted);
  font-size: 26rpx;
}
</style>
