<script lang="ts" setup>
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getRealNameStatusLabel } from '@/domain/personal-account'
import { getOrganizationAdminNavigation } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppModeSwitcher from './components/AppModeSwitcher.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppLoginGuide from '@/components/app/AppLoginGuide.vue'
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
const displayName = computed(() => appContextStore.user?.first_name || appContextStore.user?.username || appContextStore.user?.email || '未登录用户')
const avatar = computed(() => appContextStore.user?.avatar?.[0]?.thumbnail || appContextStore.user?.avatar?.[0]?.url || '/static/images/default-avatar.png')
const accountRoleLabel = computed(() => {
  if (!appContextStore.authenticated)
    return '访客'
  if (appContextStore.navigationMode === 'organization')
    return '中介管理'
  if (appContextStore.mode === 'landlord')
    return '房东管理'
  return '租客'
})
const isTenantMode = computed(() => appContextStore.navigationMode === 'personal')
const organizationNavigationAvailable = ref(false)
let organizationNavigationLoadId = 0
const organizationAdminSections = computed(() => getOrganizationAdminSections(appContextStore.capabilities))
const canOpenOrganizationAdmin = computed(() => organizationNavigationAvailable.value || organizationAdminSections.value.length > 0)

function openRealName() {
  uni.navigateTo({ url: APP_ROUTES.realName })
}

function openWallet() {
  uni.navigateTo({ url: APP_ROUTES.wallet })
}

function openReferrals() {
  uni.navigateTo({ url: APP_ROUTES.referrals })
}

function openTenantViewings() {
  uni.navigateTo({ url: APP_ROUTES.tenantViewings })
}

function openTenantLeases() {
  uni.navigateTo({ url: APP_ROUTES.tenantLeases })
}

function openFavorites() {
  uni.switchTab({ url: APP_ROUTES.favorites })
}

function openAccountSettings() {
  uni.navigateTo({ url: APP_ROUTES.accountSettings })
}

function openLandlordStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
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
    <view class="profile-card">
      <view class="profile-decoration profile-decoration--large" />
      <view class="profile-decoration profile-decoration--small" />
      <view class="profile-summary">
        <view class="avatar-shell">
          <image class="avatar" :src="avatar" mode="aspectFill" />
        </view>
        <view class="profile-main">
          <view class="profile-name">
            {{ displayName }}
          </view>
          <view class="profile-role">
            <view class="profile-role__dot" />
            {{ accountRoleLabel }}
          </view>
        </view>
      </view>
    </view>

    <view v-if="!appContextStore.authenticated || appContextStore.organizations.length === 0" class="saas-entry" @click="openSaaS">
      <view class="saas-entry__icon i-carbon-store" />
      <view class="saas-entry__main">
        <strong>我是中介，免费开通工作台</strong>
        <text>14 天专业版试用 · 房源、带看、签约一体化</text>
      </view>
      <view class="i-carbon-chevron-right" />
    </view>

    <template v-if="appContextStore.authenticated">
      <view class="service-card">
        <view class="service-heading">
          <view>
            <view class="service-title">
              {{ isTenantMode ? '租客服务' : '常用服务' }}
            </view>
            <view class="service-subtitle">
              {{ isTenantMode ? '查看找房和预约进度' : '账户相关功能快速入口' }}
            </view>
          </view>
          <view class="service-badge">
            {{ isTenantMode ? '2 项' : '3 项' }}
          </view>
        </view>
        <view v-if="isTenantMode" class="service-grid">
          <view class="service-item" @click="openTenantViewings">
            <view class="service-icon service-icon--viewing">
              <view class="i-carbon-calendar" />
            </view>
            <text class="service-name">看房预约</text>
            <text class="service-copy">时间与进度</text>
          </view>
          <view class="service-item" @click="openFavorites">
            <view class="service-icon service-icon--favorite">
              <view class="i-carbon-favorite" />
            </view>
            <text class="service-name">收藏房源</text>
            <text class="service-copy">快速继续找房</text>
          </view>
        </view>
        <view v-else class="service-grid">
          <view class="service-item" @click="openWallet">
            <view class="service-icon service-icon--wallet">
              <view class="i-carbon-wallet" />
            </view>
            <text class="service-name">我的钱包</text>
            <text class="service-copy">余额与流水</text>
          </view>
          <view class="service-item" @click="openRealName">
            <view class="service-icon service-icon--identity">
              <view class="i-carbon-identification" />
            </view>
            <text class="service-name">实名认证</text>
            <text class="service-copy">{{ getRealNameStatusLabel(appContextStore.user?.real_name_status, appContextStore.user?.real_name_status__mapping) }}</text>
          </view>
          <view class="service-item" @click="openReferrals">
            <view class="service-icon service-icon--referral">
              <view class="i-carbon-share" />
            </view>
            <text class="service-name">我的推广</text>
            <text class="service-copy">邀请与奖励</text>
          </view>
        </view>
      </view>

      <view v-if="isTenantMode" class="feature-card account-service-card">
        <view class="feature-section-title">
          账户服务
        </view>
        <view class="menu-row menu-row--compact" @click="openRealName">
          <view class="menu-icon menu-icon--identity">
            <view class="i-carbon-identification" />
          </view>
          <view class="menu-main">
            <text class="menu-title">实名认证</text>
            <text class="menu-copy">{{ getRealNameStatusLabel(appContextStore.user?.real_name_status, appContextStore.user?.real_name_status__mapping) }}</text>
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
          <view class="menu-icon menu-icon--referral">
            <view class="i-carbon-share" />
          </view>
          <view class="menu-main">
            <text class="menu-title">我的推广</text>
            <text class="menu-copy">邀请与奖励</text>
          </view>
          <view class="menu-arrow i-carbon-chevron-right" />
        </view>
      </view>

      <template v-if="appContextStore.mode === 'landlord' && appContextStore.currentLandlordRelationship">
        <view class="feature-card">
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
      <template v-if="appContextStore.navigationMode === 'organization' && canOpenOrganizationAdmin">
        <view class="feature-card">
          <view class="menu-row" @click="openOrganizationAdmin">
            <view class="menu-icon menu-icon--organization">
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

      <view class="feature-card">
        <view class="menu-row" @click="openAccountSettings">
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

      <view v-if="isTenantMode" class="secondary-entry" @click="openTenantLeases">
        <view class="i-carbon-document" />
        <text>我的租约</text>
        <view class="i-carbon-chevron-right" />
      </view>
    </template>
    <AppLoginGuide
      v-else
      class="visitor-guide"
      title="登录后使用完整服务"
      description="收藏房源、查看预约与消息，并在获得房东或中介身份后使用相应功能。"
      :redirect="APP_ROUTES.me"
    />
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
  margin-top: 20rpx;
  padding: 24rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 26rpx;
  background: var(--app-bg-brand-soft);
}
.saas-entry__icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  color: var(--app-text-on-brand);
  font-size: 36rpx;
  background: var(--app-color-brand);
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
.profile-main {
  min-width: 0;
  flex: 1;
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
.service-badge {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 18rpx;
  font-weight: 600;
  background: var(--app-bg-brand-soft);
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
.service-icon--identity {
  color: #159d77;
  background: #e9f8f2;
}
.service-icon--viewing {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.service-icon--favorite {
  color: #d55370;
  background: #fff0f3;
}
.service-icon--referral {
  color: #6b57e8;
  background: #f0edff;
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
.account-service-card .menu-row + .menu-row::before {
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
.menu-icon--organization {
  color: #6b57e8;
  background: #f0edff;
}
.menu-icon--identity {
  color: #159d77;
  background: #e9f8f2;
}
.menu-icon--wallet {
  color: var(--app-color-brand-active);
  background: var(--app-bg-brand-soft);
}
.menu-icon--referral {
  color: #6b57e8;
  background: #f0edff;
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
.secondary-entry {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8rpx;
  padding: 22rpx 8rpx 4rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.secondary-entry > view:first-child {
  font-size: 24rpx;
}
.secondary-entry > view:last-child {
  font-size: 22rpx;
}
.visitor-guide {
  margin-top: 28rpx;
}
</style>
