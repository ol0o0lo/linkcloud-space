<script lang="ts" setup>
import type { TenantViewingRecordOut } from '@/features/tenant-rental/service'
import { onHide, onPageScroll, onReady, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import { getRealNameHint, getRealNameTone } from '@/domain/personal-account'
import { useRealNameStatus } from '@/features/account/useRealNameStatus'
import { sortCurrentTenantViewings } from '@/domain/tenant-rental'
import { cancelScheduledTenantViewing, listCurrentTenantViewings } from '@/features/tenant-rental/service'
import { APP_ROUTES, getLoginRoute, getTenantViewingDetailRoute } from '@/modules/routes'
import AppModeSwitcher from './components/AppModeSwitcher.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import TenantViewingCard from '@/components/house/TenantViewingCard.vue'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
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
const cancelingViewing = ref(false)
const viewingScope = computed(() => appContextStore.authenticated && appContextStore.navigationMode === 'personal' ? appContextStore.user?.id : null)
const viewingPage = usePagedPage<TenantViewingRecordOut>({
  loader: async () => {
    const items = await listCurrentTenantViewings()
    return { items, total: items.length, page: 1, page_size: Math.max(items.length, 1) }
  },
  enabled: () => Boolean(viewingScope.value),
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
})
const nextViewing = computed(() => sortCurrentTenantViewings(viewingPage.items.value)[0])
watch(viewingScope, () => {
  viewingPage.reset()
  void viewingPage.refresh()
})

async function cancelNextViewing() {
  const record = nextViewing.value
  if (!record || cancelingViewing.value)
    return
  const userId = viewingScope.value
  const confirmation = await uni.showModal({ title: '取消预约', content: '确定取消这次看房预约吗？', confirmText: '确认取消' })
  if (!confirmation.confirm || userId !== viewingScope.value)
    return
  cancelingViewing.value = true
  try {
    await cancelScheduledTenantViewing(record.id)
    if (userId !== viewingScope.value)
      return
    viewingPage.remove(record)
    uni.showToast({ title: '预约已取消', icon: 'success' })
  }
  catch (error) {
    if (userId === viewingScope.value)
      uni.showToast({ title: error instanceof Error ? error.message : '取消失败，请稍后重试', icon: 'none' })
  }
  finally {
    cancelingViewing.value = false
  }
}

function openNextViewing() {
  if (nextViewing.value)
    openAccountRoute(getTenantViewingDetailRoute(nextViewing.value.id))
}

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
          <text v-else class="me-navigation__title text-size-sm text-content-secondary font-medium leading-tight">我的</text>
        </template>
      </AppCustomNavigation>
    </template>
    <button class="me-action profile-card relative box-border w-full flex flex-col app-touchable overflow-hidden text-left leading-normal" role="button" tabindex="0" :aria-label="appContextStore.authenticated ? '查看个人资料' : '登录或注册'" hover-class="app-touchable--pressed" @click="openProfile" @keydown="handleActionKeydown($event, openProfile)">
      <view class="profile-summary relative z-1 w-full flex items-center gap-3.5">
        <view class="avatar-shell box-border h-14.5 w-14.5 flex flex-none basis-14.5 items-center justify-center border-3 border-surface-card rounded-full border-solid bg-surface-subtle">
          <image v-if="appContextStore.authenticated" class="avatar h-full w-full rounded-full bg-surface-subtle" :src="avatar" mode="aspectFill" />
          <view v-else class="visitor-avatar i-carbon-user-avatar text-size-3xl text-app-brand" />
        </view>
        <view class="profile-main min-w-0 flex-1">
          <view class="profile-name overflow-hidden text-ellipsis whitespace-nowrap text-size-2xl text-content-primary font-semibold">
            {{ appContextStore.authenticated ? displayName : '登录 / 注册' }}
          </view>
          <view class="profile-prompt mt-1.5 text-size-xs text-content-secondary">
            {{ appContextStore.authenticated ? '个人资料' : '登录后同步收藏、预约和消息' }}
          </view>
        </view>
        <view class="profile-arrow i-carbon-chevron-right text-size-xs text-content-muted" />
      </view>
    </button>

    <button v-if="appContextStore.authenticated && realNameHint" class="me-action certification-hint w-full flex app-touchable items-center gap-1.5 text-left text-size-2xs leading-normal" :class="`certification-hint--${getRealNameTone(realNameStatus)}`" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openRealName" @keydown="handleActionKeydown($event, openRealName)">
      <view class="i-carbon-identification" />
      <text>{{ realNameHint }}</text>
      <view class="i-carbon-chevron-right" />
    </button>

    <view v-if="viewingScope && nextViewing" class="mt-4">
      <view class="mb-3 app-row-between">
        <text class="text-base text-content-primary font-semibold">待看房</text>
        <wd-button size="mini" variant="text" @click="openTenantViewings">
          全部看房
        </wd-button>
      </view>
      <TenantViewingCard :record="nextViewing" :canceling="cancelingViewing" @open="openNextViewing" @cancel="cancelNextViewing" />
    </view>

    <view v-if="!appContextStore.authenticated || appContextStore.navigationMode === 'personal'" class="service-card mt-3 rounded-4 bg-surface-card px-2 pb-3 pt-3.5">
      <view class="service-heading flex items-center justify-between px-1.5 py-0">
        <view>
          <view class="service-title text-size-sm text-content-primary font-bold">
            找房服务
          </view>
          <view class="service-subtitle mt-0.5 text-size-2xs text-content-muted">
            {{ !appContextStore.authenticated ? '登录后保存进度，继续找房' : '收藏、预约与租约进度' }}
          </view>
        </view>
      </view>
      <view class="service-grid mt-3 flex">
        <button class="me-action service-item relative min-w-0 w-full flex flex-1 flex-col app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openFavorites" @keydown="handleActionKeydown($event, openFavorites)">
          <view class="service-icon service-icon--favorite h-8.5 w-8.5 flex items-center justify-center rounded-3 text-size-base">
            <view class="i-carbon-favorite" />
          </view>
          <text class="service-name mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">我的收藏</text>
          <text class="service-copy mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">喜欢的房源</text>
        </button>
        <button class="me-action service-item relative min-w-0 w-full flex flex-1 flex-col app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openTenantViewings" @keydown="handleActionKeydown($event, openTenantViewings)">
          <view class="service-icon service-icon--viewing h-8.5 w-8.5 flex items-center justify-center rounded-3 text-size-base">
            <view class="i-carbon-calendar" />
          </view>
          <text class="service-name mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">我的看房</text>
          <text class="service-copy mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">待看房与历史</text>
        </button>
        <button class="me-action service-item relative min-w-0 w-full flex flex-1 flex-col app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openTenantLeases" @keydown="handleActionKeydown($event, openTenantLeases)">
          <view class="service-icon h-8.5 w-8.5 flex items-center justify-center rounded-3 text-size-base">
            <view class="i-carbon-document" />
          </view>
          <text class="service-name mt-2 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary font-semibold">我的租约</text>
          <text class="service-copy mt-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">合同与履约</text>
        </button>
      </view>
    </view>

    <view v-if="appContextStore.authenticated && appContextStore.mode === 'landlord' && appContextStore.currentLandlordRelationship?.public_key" class="feature-card mt-3 overflow-hidden border-hairline border-app-card rounded-4.5 border-solid bg-surface-card">
      <button class="me-action menu-row relative box-border w-full flex app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openLandlordStore" @keydown="handleActionKeydown($event, openLandlordStore)">
        <view class="menu-icon menu-icon--store mr-2.5 h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 text-size-base">
          <view class="i-carbon-store" />
        </view>
        <view class="menu-main min-w-0 flex flex-1 flex-col gap-1">
          <text class="menu-title overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-medium">公开店铺</text>
          <text class="menu-copy overflow-hidden text-ellipsis whitespace-nowrap text-size-2xs text-content-muted">查看与分享公开房源</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right ml-2 shrink-0 text-size-xs text-content-muted" />
      </button>
    </view>

    <view v-if="appContextStore.authenticated" class="feature-card account-service-card mt-3 overflow-hidden border-hairline border-app-card rounded-4.5 border-solid bg-surface-card">
      <view class="feature-section-title px-4 pb-1.5 pt-4 text-size-2xs text-content-muted font-medium">
        {{ appContextStore.navigationMode === 'organization' ? '个人账户' : '账户服务' }}
      </view>
      <button class="me-action menu-row menu-row--compact relative box-border h-13.5 w-full flex app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openWallet" @keydown="handleActionKeydown($event, openWallet)">
        <view class="menu-icon mr-2.5 h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 text-size-base">
          <view class="i-carbon-wallet" />
        </view>
        <view class="menu-main min-w-0 flex flex-1 flex-col gap-1">
          <text class="menu-title overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-medium">我的钱包</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right ml-2 shrink-0 text-size-xs text-content-muted" />
      </button>
      <button class="me-action menu-row menu-row--compact relative box-border h-13.5 w-full flex app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openReferrals" @keydown="handleActionKeydown($event, openReferrals)">
        <view class="menu-icon mr-2.5 h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 text-size-base">
          <view class="i-carbon-share" />
        </view>
        <view class="menu-main min-w-0 flex flex-1 flex-col gap-1">
          <text class="menu-title overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-medium">邀请好友</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right ml-2 shrink-0 text-size-xs text-content-muted" />
      </button>
      <button class="me-action menu-row menu-row--compact relative box-border h-13.5 w-full flex app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openNotificationPreferences" @keydown="handleActionKeydown($event, openNotificationPreferences)">
        <view class="menu-icon mr-2.5 h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 text-size-base">
          <view class="i-carbon-notification" />
        </view>
        <view class="menu-main min-w-0 flex flex-1 flex-col gap-1">
          <text class="menu-title overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-medium">通知设置</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right ml-2 shrink-0 text-size-xs text-content-muted" />
      </button>
      <button class="me-action menu-row menu-row--compact relative box-border h-13.5 w-full flex app-touchable items-center text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openAccountSettings" @keydown="handleActionKeydown($event, openAccountSettings)">
        <view class="menu-icon mr-2.5 h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 text-size-base">
          <view class="i-carbon-settings-adjust" />
        </view>
        <view class="menu-main min-w-0 flex flex-1 flex-col gap-1">
          <text class="menu-title overflow-hidden text-ellipsis whitespace-nowrap text-size-sm text-content-primary font-medium">设置</text>
        </view>
        <view class="menu-arrow i-carbon-chevron-right ml-2 shrink-0 text-size-xs text-content-muted" />
      </button>
    </view>

    <button v-if="!appContextStore.authenticated || appContextStore.organizations.length === 0" class="me-action saas-entry w-full flex app-touchable items-center gap-2 text-left leading-normal" role="button" tabindex="0" hover-class="app-touchable--pressed" @click="openSaaS" @keydown="handleActionKeydown($event, openSaaS)">
      <view class="saas-entry__icon h-7 w-7 flex flex-none basis-7 items-center justify-center rounded-2.5 bg-surface-brand-soft text-size-sm text-content-secondary">
        <view class="i-carbon-store" />
      </view>
      <view class="saas-entry__main min-w-0 flex flex-1 flex-col gap-1">
        <strong>我是经纪人，开通工作台</strong>
        <text>14 天试用 · 管理房源、带看与签约</text>
      </view>
      <view class="i-carbon-chevron-right" />
    </button>
    <template #footer>
      <view class="me-copyright pointer-events-none px-3 pb-3.5 pt-2 text-center">
        <text class="me-copyright__text text-size-2xs text-content-muted leading-normal" :class="{ 'me-copyright__text--visible': copyrightVisible }" :aria-hidden="!copyrightVisible">
          © {{ copyrightYear }} 链云空间
        </text>
      </view>
    </template>
  </AppPage>
</template>

<style scoped>
.me-copyright__text {
  @apply opacity-0;
  transition: opacity 1200ms ease;
}
.me-copyright__text--visible {
  @apply opacity-55;
}
@media (prefers-reduced-motion: reduce) {
  .me-copyright__text {
    transition-duration: 200ms;
  }
}
.me-action {
  @apply m-0 p-0 border-0 rounded-0 text-inherit;
  font: inherit;
  @apply bg-transparent;
}
.me-action::after {
  @apply border-0;
}
/* #ifdef H5 */
.me-action:focus-visible {
  outline: 2px solid var(--app-color-brand-active);
  outline-offset: -4px;
}
/* #endif */
.profile-card {
  @apply pt-2.5 px-0 pb-4;
  @apply rounded-2.5;
}
.saas-entry {
  @apply mt-3 p-2.5 border-hairline border-solid border-app-border rounded-3.5 bg-transparent;
}
.saas-entry__main strong {
  @apply text-content-primary text-size-xs;
  overflow-wrap: anywhere;
}
.saas-entry__main text {
  @apply text-content-secondary text-size-2xs;
}
.saas-entry > .i-carbon-chevron-right {
  @apply shrink-0 text-content-muted;
}
.avatar-shell {
  box-shadow: 0 0 0 1rpx var(--app-border-card);
}
.certification-hint {
  min-height: 44px;
  @apply -mt-1.5;
  @apply p-0;
  @apply rounded-1.5 text-content-secondary;
}
.certification-hint--default {
  @apply text-app-brand-active;
}
.certification-hint--danger {
  @apply text-app-danger;
}
.certification-hint > view {
  @apply shrink-0 text-size-sm;
}
.service-item {
  @apply rounded-2.5 py-0.5 px-1.5;
}
.service-item + .service-item::before {
  @apply absolute top-2 bottom-2 left-0;
  width: 1rpx;
  @apply bg-app-border;
  content: '';
}
.service-icon {
  @apply text-app-brand-active bg-surface-brand-soft;
}
.service-icon--viewing {
  @apply text-app-brand-active bg-surface-brand-soft;
}
.service-icon--favorite {
  color: #d55370;
  background: #fff0f3;
}
.menu-row {
  @apply min-h-17 py-3 px-3.5;
}
.menu-row--compact {
  min-height: 44px;
  @apply py-0 px-4;
}
.feature-card .menu-row + .menu-row::before {
  @apply absolute top-0 right-4 left-12;
  height: 1rpx;
  @apply bg-app-divider;
  content: '';
}
.menu-icon {
  @apply text-app-brand-active bg-surface-brand-soft;
}
.menu-icon--store {
  color: #b45f06;
  background: #fff3df;
}
.account-service-card .menu-icon {
  @apply w-5 h-5 basis-5 mr-3 rounded-0 text-content-secondary text-size-xl bg-transparent;
}
</style>
