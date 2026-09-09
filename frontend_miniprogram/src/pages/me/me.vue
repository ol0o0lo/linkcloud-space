<script lang="ts" setup>
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getOrganizationAdminSections } from '@/domain/organization-admin'
import { getRealNameStatusLabel } from '@/domain/personal-account'
import { getOrganizationAdminNavigation } from '@/features/organization-admin/service'
import { APP_ROUTES } from '@/modules/routes'
import AppModeSwitcher from '@/shared/components/AppModeSwitcher.vue'
import AppCustomNavigation from '@/shared/components/AppCustomNavigation.vue'
import AppPage from '@/shared/components/AppPage.vue'
import { LOGIN_PAGE } from '@/router/config'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '我的',
  },
})

const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()
const displayName = computed(() => appContextStore.user?.first_name || appContextStore.user?.username || appContextStore.user?.email || '未登录用户')
const avatar = computed(() => appContextStore.user?.avatar?.[0]?.thumbnail || appContextStore.user?.avatar?.[0]?.url || '/static/images/default-avatar.png')
const organizationNavigationAvailable = ref(false)
let organizationNavigationLoadId = 0
const organizationAdminSections = computed(() => getOrganizationAdminSections(appContextStore.capabilities))
const canOpenOrganizationAdmin = computed(() => organizationNavigationAvailable.value || organizationAdminSections.value.length > 0)

function handleLogin() {
  uni.navigateTo({
    url: LOGIN_PAGE,
  })
}

function handleLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        await sessionStore.logout()
        appContextStore.resetToVisitor()
        uni.reLaunch({ url: '/pages/index/index' })
      }
    },
  })
}

function openPhoneVerification() {
  uni.navigateTo({ url: APP_ROUTES.phoneVerification })
}

function openProfile() {
  uni.navigateTo({ url: APP_ROUTES.profile })
}

function openRealName() {
  uni.navigateTo({ url: APP_ROUTES.realName })
}

function openWallet() {
  uni.navigateTo({ url: APP_ROUTES.wallet })
}

function openReferrals() {
  uni.navigateTo({ url: APP_ROUTES.referrals })
}

function openSecurity() {
  uni.navigateTo({ url: APP_ROUTES.security })
}

function openLandlordStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
}

function openOrganizationAdmin() {
  uni.navigateTo({ url: APP_ROUTES.organizationAdmin })
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
  <AppPage class="me-page" tabbar>
    <template #navigation>
      <AppCustomNavigation title="我的" />
    </template>
    <view class="profile-card">
      <image class="avatar" :src="avatar" mode="aspectFill" />
      <view class="profile-main">
        <view class="profile-name">
          {{ displayName }}
        </view>
        <view class="profile-mode">
          当前：{{ appContextStore.modePresentation.title }}
        </view>
      </view>
      <wd-tag :type="appContextStore.authenticated ? 'success' : 'default'" variant="light">
        {{ appContextStore.authenticated ? '已登录' : '游客' }}
      </wd-tag>
    </view>

    <template v-if="appContextStore.authenticated">
      <view class="section-title">
        切换身份
      </view>
      <wd-cell-group border>
        <AppModeSwitcher variant="cell" />
      </wd-cell-group>

      <view class="section-title">
        账号
      </view>
      <wd-cell-group border>
        <wd-cell title="个人资料" value="头像、昵称与时区" is-link @click="openProfile" />
        <wd-cell title="邮箱" :value="appContextStore.user?.email || '未绑定'" />
        <wd-cell
          title="手机号"
          :value="appContextStore.user?.phone_verified ? (appContextStore.user?.phone_national_number || '已验证') : '未验证'"
          :is-link="!appContextStore.user?.phone_verified"
          @click="!appContextStore.user?.phone_verified && openPhoneVerification()"
        />
        <wd-cell title="实名认证" :value="getRealNameStatusLabel(appContextStore.user?.real_name_status, appContextStore.user?.real_name_status__mapping)" is-link @click="openRealName" />
        <wd-cell title="我的钱包" value="余额、流水与微信提现" is-link @click="openWallet" />
        <wd-cell title="我的推广" value="邀请码、链接与邀请记录" is-link @click="openReferrals" />
        <wd-cell title="账号安全" value="动态验证码、恢复码与通行密钥" is-link @click="openSecurity" />
      </wd-cell-group>
      <template v-if="appContextStore.mode === 'landlord' && appContextStore.currentLandlordRelationship">
        <view class="section-title">
          房东服务
        </view>
        <wd-cell-group border>
          <wd-cell title="公开店铺" value="查看与分享公开房源" is-link @click="openLandlordStore" />
        </wd-cell-group>
      </template>
      <template v-if="appContextStore.navigationMode === 'organization' && canOpenOrganizationAdmin">
        <view class="section-title">
          组织管理
        </view>
        <wd-cell-group border>
          <wd-cell title="组织管理中心" :value="organizationAdminSections.length ? `${organizationAdminSections.length} 项可用功能` : '查看组织成员与团队'" is-link @click="openOrganizationAdmin" />
        </wd-cell-group>
      </template>
      <view class="logout-action">
        <wd-button block type="danger" variant="plain" @click="handleLogout">
          退出登录
        </wd-button>
      </view>
    </template>
    <view v-else class="visitor-card">
      <view class="visitor-title">
        登录后保存找房进度
      </view>
      <view class="visitor-copy">
        收藏房源、保留找房进度，并在获得房东或中介身份后使用相应功能。
      </view>
      <wd-button block @click="handleLogin">
        登录 / 注册
      </wd-button>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.profile-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 32rpx 28rpx;
  border-radius: 28rpx;
  background: var(--app-gradient-profile);
  box-shadow: var(--app-shadow-profile);
}
.avatar {
  width: 104rpx;
  height: 104rpx;
  border: 4rpx solid var(--app-bg-elevated);
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
.profile-mode {
  margin-top: 10rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
}
.section-title {
  margin: 38rpx 8rpx 16rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  font-weight: 600;
}
.logout-action {
  margin-top: 34rpx;
}
.visitor-card {
  margin-top: 28rpx;
  padding: 38rpx 30rpx;
  border-radius: 28rpx;
  background: var(--app-bg-card);
}
.visitor-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.visitor-copy {
  margin: 16rpx 0 30rpx;
  color: var(--app-text-secondary);
  font-size: 26rpx;
  line-height: 1.7;
}
</style>
