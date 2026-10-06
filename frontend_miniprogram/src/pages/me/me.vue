<script lang="ts" setup>
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { computed, ref, watch } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getRealNameStatusLabel } from '@/domain/personal-account'
import { getOrganizationAdminNavigation } from '@/features/organization-admin/service'
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
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState()
onPageScroll(handleNavigationScroll)
const displayName = computed(() => appContextStore.user?.first_name || appContextStore.user?.username || appContextStore.user?.email || '用户')
const avatar = computed(() => appContextStore.user?.avatar?.[0]?.thumbnail || appContextStore.user?.avatar?.[0]?.url || '/static/images/default-avatar.png')
const accountRoleLabel = computed(() => {
  if (!appContextStore.authenticated)
    return '访客'
  if (appContextStore.navigationMode === 'organization')
    return '中介端'
  if (appContextStore.mode === 'landlord')
    return '房东端'
  return '租客'
})
const organizationNavigationAvailable = ref(false)
let organizationNavigationLoadId = 0
const organizationAdminSections = computed(() => getOrganizationAdminSections(appContextStore.capabilities))
const canOpenOrganizationAdmin = computed(() => organizationNavigationAvailable.value || organizationAdminSections.value.length > 0)

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
  const personalTab = appContextStore.navigationMode === 'personal' || !appContextStore.authenticated
  openAccountRoute(personalTab ? APP_ROUTES.favorites : APP_ROUTES.personalFavorites, personalTab)
}

function openAccountSettings() {
  openAccountRoute(APP_ROUTES.accountSettings)
}

function openLandlordStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
}

function openLandlordHouses() {
  uni.switchTab({ url: APP_ROUTES.houses })
}

function openOrganizationRental() {
  uni.navigateTo({ url: APP_ROUTES.organizationRental })
}

function openOrganizationAdmin() {
  uni.navigateTo({ url: APP_ROUTES.organizationAdmin })
}

function openSaaS() {
  uni.navigateTo({ url: APP_ROUTES.saasHome })
}

async function refreshOrganizationAdminVisibility() {
  const organizationSlug = appContextStore.organizationSlug
  const currentLoadId = ++organizationNavigationLoadId
  organizationNavigationAvailable.value = false
  if (appContextStore.navigationMode !== 'organization' || !organizationSlug)
    return
  try {
    await getOrganizationAdminNavigation(organizationSlug)
    if (currentLoadId === organizationNavigationLoadId && appContextStore.organizationSlug === organizationSlug)
      organizationNavigationAvailable.value = true
  }
  catch {
    // 组织架构导航要求成员查看权限；其他管理能力仍由 access/navigation 裁剪。
  }
}

onShow(() => void refreshOrganizationAdminVisibility())
watch(() => [appContextStore.navigationMode, appContextStore.organizationSlug] as const, () => void refreshOrganizationAdminVisibility())
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
    <view class="profile-card" @click="openProfile">
      <view class="profile-decoration profile-decoration--large" />
      <view class="profile-decoration profile-decoration--small" />
      <view class="profile-summary">
        <view class="avatar-shell">
          <image v-if="appContextStore.authenticated" class="avatar" :src="avatar" mode="aspectFill" />
          <view v-else class="visitor-avatar i-carbon-user-avatar" />
        </view>
        <view class="profile-main">
          <view class="profile-name">
            {{ appContextStore.authenticated ? displayName : '登录 / 注册' }}
          </view>
          <view v-if="appContextStore.authenticated" class="profile-role">
            <view class="profile-role__dot" />
            {{ accountRoleLabel }}
          </view>
          <view v-else class="profile-prompt">
            登录后同步收藏、预约和消息
          </view>
        </view>
        <view class="profile-arrow i-carbon-chevron-right" />
      </view>
    </view>

    <view class="service-card">
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
        <view class="service-item" @click="openFavorites">
          <view class="service-icon service-icon--favorite">
            <view class="i-carbon-favorite" />
          </view>
          <text class="service-name">我的收藏</text>
          <text class="service-copy">喜欢的房源</text>
        </view>
        <view class="service-item" @click="openTenantViewings">
          <view class="service-icon service-icon--viewing">
            <view class="i-carbon-calendar" />
          </view>
          <text class="service-name">看房预约</text>
          <text class="service-copy">时间与进度</text>
        </view>
        <view class="service-item" @click="openTenantLeases">
          <view class="service-icon">
            <view class="i-carbon-document" />
          </view>
          <text class="service-name">我的租约</text>
          <text class="service-copy">合同与履约</text>
        </view>
      </view>
    </view>

    <view class="feature-card account-service-card">
      <view class="feature-section-title">
        账户服务
      </view>
      <view class="menu-row menu-row--compact" @click="openRealName">
        <view class="menu-icon">
          <view class="i-carbon-identification" />
        </view>
        <view class="menu-main">
          <text class="menu-title">实名认证</text>
          <text class="menu-copy">{{ appContextStore.authenticated ? getRealNameStatusLabel(appContextStore.user?.real_name_status, appContextStore.user?.real_name_status__mapping) : '登录后查看认证状态' }}</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </view>
      <view class="menu-row menu-row--compact" @click="openWallet">
        <view class="menu-icon menu-icon--wallet">
          <view class="i-carbon-wallet" />
        </view>
        <view class="menu-main">
          <text class="menu-title">我的钱包</text>
          <text class="menu-copy">余额与流水</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </view>
      <view class="menu-row menu-row--compact" @click="openReferrals">
        <view class="menu-icon">
          <view class="i-carbon-share" />
        </view>
        <view class="menu-main">
          <text class="menu-title">我的推广</text>
          <text class="menu-copy">邀请与奖励</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </view>
      <view class="menu-row menu-row--compact" @click="openAccountSettings">
        <view class="menu-icon menu-icon--settings">
          <view class="i-carbon-settings-adjust" />
        </view>
        <view class="menu-main">
          <text class="menu-title">设置</text>
          <text class="menu-copy">资料、通知与账号安全</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right" />
      </view>
    </view>

    <template v-if="appContextStore.mode === 'landlord' && appContextStore.currentLandlordRelationship">
      <view class="feature-card">
        <view class="feature-section-title">
          房东服务
        </view>
        <view class="menu-row" @click="openLandlordHouses">
          <view class="menu-icon">
            <view class="i-carbon-building" />
          </view>
          <view class="menu-main">
            <text class="menu-title">我的房源</text>
            <text class="menu-copy">查看名下房源与房态</text>
          </view>
          <view class="menu-arrow i-carbon-chevron-right" />
        </view>
        <view class="menu-row" @click="openLandlordStore">
          <view class="menu-icon menu-icon--store">
            <view class="i-carbon-store" />
          </view>
          <view class="menu-main">
            <text class="menu-title">公开店铺</text>
            <text class="menu-copy">房东服务 · 查看与分享公开房源</text>
          </view>
          <view class="menu-arrow i-carbon-chevron-right" />
        </view>
      </view>
    </template>
    <template v-if="appContextStore.navigationMode === 'organization'">
      <view class="feature-card">
        <view class="feature-section-title">
          中介服务
        </view>
        <view class="menu-row" @click="openOrganizationRental">
          <view class="menu-icon">
            <view class="i-carbon-workspace" />
          </view>
          <view class="menu-main">
            <text class="menu-title">组织经营</text>
            <text class="menu-copy">房源、带看与租约工作台</text>
          </view>
          <view class="menu-arrow i-carbon-chevron-right" />
        </view>
        <view v-if="canOpenOrganizationAdmin" class="menu-row" @click="openOrganizationAdmin">
          <view class="menu-icon">
            <view class="i-carbon-building" />
          </view>
          <view class="menu-main">
            <text class="menu-title">组织管理中心</text>
            <text class="menu-copy">{{ organizationAdminSections.length ? `组织服务 · ${organizationAdminSections.length} 项可用功能` : '组织服务 · 查看成员与团队' }}</text>
          </view>
          <view class="menu-arrow i-carbon-chevron-right" />
        </view>
      </view>
    </template>

    <view v-if="!appContextStore.authenticated || appContextStore.organizations.length === 0" class="saas-entry" @click="openSaaS">
      <view class="saas-entry__icon">
        <view class="i-carbon-store" />
      </view>
      <view class="saas-entry__main">
        <strong>我是中介，免费开通工作台</strong>
        <text>14 天试用 · 管理房源、带看与签约</text>
      </view>
      <view class="i-carbon-chevron-right" />
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.me-navigation__title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.25;
}
.profile-card {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  gap: 24rpx;
  padding: 28rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-gradient-profile);
  box-shadow: var(--app-shadow-profile);
}
.saas-entry {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 24rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.saas-entry__icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: var(--app-color-brand-active);
  font-size: 36rpx;
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
  font-size: 26rpx;
}
.saas-entry__main text {
  color: var(--app-text-secondary);
  font-size: 21rpx;
}
.profile-decoration {
  position: absolute;
  border-radius: 50%;
  background: var(--app-bg-brand-soft);
  opacity: 0.72;
  pointer-events: none;
}
.profile-decoration--large {
  top: -76rpx;
  right: -48rpx;
  width: 208rpx;
  height: 208rpx;
}
.profile-decoration--small {
  top: 90rpx;
  right: 104rpx;
  width: 54rpx;
  height: 54rpx;
  opacity: 0.46;
}
.profile-summary {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  align-items: center;
  gap: 20rpx;
}
.avatar-shell {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  flex: 0 0 112rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 50%;
  background: var(--app-bg-elevated);
  box-shadow: 0 12rpx 28rpx rgb(33 87 143 / 10%);
}
.avatar {
  width: 98rpx;
  height: 98rpx;
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
  font-size: 34rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.profile-role {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 10rpx;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  font-weight: 600;
  background: var(--app-bg-brand-soft);
}
.profile-role__dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: currentColor;
}
.profile-prompt {
  margin-top: 8rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
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
  border-radius: 28rpx;
  background: var(--app-bg-card);
}
.feature-section-title {
  padding: 24rpx 26rpx 8rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
  font-weight: 600;
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
  min-height: 112rpx;
  padding-top: 16rpx;
  padding-bottom: 16rpx;
}
.feature-card .menu-row + .menu-row::before {
  position: absolute;
  top: 0;
  right: 26rpx;
  left: 104rpx;
  height: 1rpx;
  background: var(--app-border-color);
  content: '';
}
.menu-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  border-radius: 20rpx;
  color: var(--app-color-brand-active);
  font-size: 32rpx;
  background: var(--app-bg-brand-soft);
}
.menu-icon--store {
  color: #b45f06;
  background: #fff3df;
}
.menu-icon--wallet {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.menu-icon--settings {
  color: #4c647f;
  background: #edf2f7;
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
  font-size: 26rpx;
  font-weight: 600;
}
.menu-copy {
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.menu-arrow {
  margin-left: 16rpx;
  color: var(--app-text-muted);
  font-size: 26rpx;
}
</style>
