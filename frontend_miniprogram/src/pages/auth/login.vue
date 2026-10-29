<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { executeAppPendingAction } from '@/features/pending-actions/service'
import { getDefaultRouteForMode } from '@/modules/registry'
import { APP_ROUTES } from '@/modules/routes'
import { getNavigationRedirect } from '@/router/permission'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'
import { isPageTabbar } from '@/tabbar/store'

definePage({
  style: {
    navigationBarTitleText: '登录',
    navigationStyle: 'custom',
    backgroundColor: '#f7fbff',
  },
})

const sessionStore = useSessionStore()
const appContextStore = useAppContextStore()
const loginMode = ref<'phone' | 'password' | null>(null)
const phoneCountryCode = ref('+86')
const phoneNationalNumber = ref('')
const phoneCode = ref('')
const password = ref('')
const codeSent = ref(false)
const loading = ref(false)
const sendingCode = ref(false)
const redirect = ref('')
const agreementAccepted = ref(false)

function showError(error: unknown, fallback: string) {
  uni.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
}

function ensureAgreementAccepted(): boolean {
  if (agreementAccepted.value)
    return true
  uni.showToast({
    title: '请先阅读并同意用户协议和隐私政策',
    icon: 'none',
  })
  return false
}

async function finishAuthentication() {
  appContextStore.requestPersonalMode()
  await appContextStore.refreshAuthenticatedContext()
  const savedPending = sessionStore.pendingAction
  if (savedPending?.type === 'book-viewing' && !appContextStore.user?.phone_verified) {
    uni.showToast({ title: '登录成功，请先验证手机号', icon: 'none' })
    const target = `${APP_ROUTES.phoneVerification}?redirect=${encodeURIComponent(savedPending.redirect)}`
    uni.reLaunch({ url: target })
    return
  }

  const pending = sessionStore.consumePendingAction()
  if (pending) {
    try {
      const result = await executeAppPendingAction(pending)
      uni.showToast({ title: result.executed ? `登录成功，${result.successMessage}` : '登录成功', icon: 'success' })
    }
    catch {
      uni.showToast({ title: '登录成功，刚才的操作未完成', icon: 'none' })
    }
  }
  else {
    uni.showToast({ title: '登录成功', icon: 'success' })
  }
  const target = pending?.redirect || redirect.value || getDefaultRouteForMode(appContextStore.mode)
  if (isPageTabbar(target))
    uni.switchTab({ url: target })
  else
    uni.reLaunch({ url: target })
}

async function sendPhoneCode() {
  if (!ensureAgreementAccepted())
    return
  if (!phoneNationalNumber.value.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  sendingCode.value = true
  try {
    await sessionStore.requestPhoneCode(phoneCountryCode.value, phoneNationalNumber.value.trim())
    codeSent.value = true
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  }
  catch (error) {
    showError(error, '验证码发送失败')
  }
  finally {
    sendingCode.value = false
  }
}

async function submitPhoneLogin() {
  if (!ensureAgreementAccepted())
    return
  if (loading.value || sendingCode.value)
    return
  if (!codeSent.value) {
    await sendPhoneCode()
    return
  }
  if (!phoneCode.value.trim()) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await sessionStore.loginByPhoneCode(phoneCode.value.trim())
    await finishAuthentication()
  }
  catch (error) {
    showError(error, '手机登录失败')
  }
  finally {
    loading.value = false
  }
}

async function submitPhonePasswordLogin() {
  if (!ensureAgreementAccepted())
    return
  if (loading.value)
    return
  if (!phoneNationalNumber.value.trim() || !password.value) {
    uni.showToast({ title: '请输入手机号和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await sessionStore.loginByPhonePassword(phoneCountryCode.value, phoneNationalNumber.value.trim(), password.value)
    await finishAuthentication()
  }
  catch (error) {
    showError(error, '密码登录失败')
  }
  finally {
    loading.value = false
  }
}

async function submitWechatLogin() {
  if (!ensureAgreementAccepted())
    return
  loading.value = true
  try {
    await sessionStore.loginByWechat()
    await finishAuthentication()
  }
  catch (error) {
    showError(error, '微信登录失败')
  }
  finally {
    loading.value = false
  }
}

function setLoginMode(type: 'phone' | 'password' | null) {
  loginMode.value = type
}

onLoad((options) => {
  redirect.value = getNavigationRedirect(options)
})
</script>

<template>
  <view class="login-page relative mx-auto my-0 box-border max-w-108 min-h-screen w-full flex flex-col overflow-x-hidden" :class="{ 'is-form-mode': loginMode }">
    <view class="ambient ambient-one pointer-events-none absolute h-48 w-48 rounded-full -right-15 -top-13.5" />
    <view class="ambient ambient-two pointer-events-none absolute top-40 h-40 w-40 rounded-full -left-21" />

    <AppCustomNavigation title="" transparent />

    <view class="brand-lockup relative z-1 flex items-center self-start gap-2">
      <view class="brand-mark relative h-6 w-6 flex items-center justify-center rounded-2">
        <view class="brand-mark-dot h-1 w-1 rounded-full bg-white" />
      </view>
      <view class="brand-name text-size-xs text-app-brand font-bold">
        链云空间
      </view>
    </view>

    <view class="coordinate-hero relative z-1 min-h-76 flex flex-1 flex-col items-center justify-center px-0 pb-3.5 pt-4.5 text-center">
      <view class="coordinate-visual relative h-44 w-49">
        <view class="orbit orbit-outer absolute left-1/2 top-1/2 h-43 w-43 rounded-full">
          <view class="orbit-dot orbit-dot-one absolute left-3.5 top-6 h-2 w-2 rounded-full" />
        </view>
        <view class="orbit orbit-inner absolute left-1/2 top-1/2 h-30 w-30 rounded-full">
          <view class="orbit-dot orbit-dot-two absolute bottom-6 right-0.5 h-1.5 w-1.5 rounded-full" />
        </view>
        <view class="coordinate-tile absolute left-1/2 top-1/2 h-15.5 w-15.5 flex items-center justify-center rounded-5.5">
          <view class="coordinate-symbol relative h-7 w-7 flex items-center justify-center">
            <view class="coordinate-ring h-4.5 w-4.5 rounded-full" />
            <view class="coordinate-point absolute h-1 w-1 rounded-full" />
          </view>
        </view>
        <view class="spark spark-one absolute right-5.5 top-9 h-1 w-1 rounded-full bg-white" />
        <view class="spark spark-two absolute bottom-6 left-8.5 h-1 w-1 rounded-full bg-white" />
      </view>

      <view class="hero-title text-size-2xl text-content-primary font-extrabold leading-tight">
        你的城市坐标
        <text>正在点亮</text>
      </view>
      <view class="hero-copy mt-2.5 text-size-xs text-content-secondary leading-relaxed">
        登录后继续收藏、预约与看房进度
      </view>
    </view>

    <view class="login-action-panel relative z-2 flex-none rounded-4.5 px-3.5 pb-3 pt-4" :class="{ 'is-form-panel': loginMode }">
      <template v-if="!loginMode">
        <!-- #ifdef MP-WEIXIN -->
        <wd-button type="success" block size="large" custom-class="wechat-login-button" :loading="loading" @click="submitWechatLogin">
          <view class="wechat-button-content flex items-center justify-center gap-2">
            <view class="wechat-button-icon i-carbon-logo-wechat text-size-lg" />
            <text>微信一键登录</text>
          </view>
        </wd-button>

        <view class="login-alternatives flex items-center justify-center gap-3">
          <view class="alternative-button px-0.5 py-1.5 text-size-xs leading-none" role="button" @click="setLoginMode('phone')">
            验证码登录
          </view>
          <view class="alternative-divider h-3" />
          <view class="alternative-button px-0.5 py-1.5 text-size-xs leading-none" role="button" @click="setLoginMode('password')">
            密码登录
          </view>
        </view>
        <!-- #endif -->

        <!-- #ifdef H5 -->
        <wd-button block size="large" custom-class="h5-login-button" :loading="loading" @click="setLoginMode('phone')">
          验证码登录
        </wd-button>
        <view class="login-alternatives h5-alternatives flex items-center justify-center gap-3">
          <view class="alternative-button px-0.5 py-1.5 text-size-xs leading-none" role="button" @click="setLoginMode('password')">
            使用手机号密码登录
          </view>
        </view>
        <!-- #endif -->
      </template>

      <template v-else>
        <view class="form-header text-left">
          <view class="form-title text-size-base text-content-primary font-extrabold leading-tight">
            {{ loginMode === 'phone' ? '验证码登录' : '密码登录' }}
          </view>
          <view class="form-copy mt-1.5 text-size-xs text-content-muted leading-normal">
            {{ loginMode === 'phone' ? '短信验证码将发送至你的手机' : '使用手机号和密码登录' }}
          </view>
        </view>

        <view v-if="loginMode === 'phone'" class="inline-form mt-3.5">
          <view class="field-shell phone-field-shell mt-2.5 box-border min-h-11.5 flex items-center gap-2.5 rounded-3 px-3 py-0">
            <view class="country-code flex-none text-size-sm font-semibold">
              {{ phoneCountryCode }}
            </view>
            <view class="field-divider h-4.5 flex-none" />
            <wd-input v-model="phoneNationalNumber" compact type="tel" clearable placeholder="请输入手机号" :cursor-spacing="120" />
          </view>

          <view v-if="codeSent" class="field-shell mt-2.5 box-border min-h-11.5 flex items-center rounded-3 px-3 py-0">
            <wd-input v-model="phoneCode" compact type="number" clearable placeholder="请输入短信验证码" confirm-type="go" :cursor-spacing="120" @confirm="submitPhoneLogin" />
          </view>

          <view v-if="codeSent" class="resend-row mt-2.5 flex justify-end">
            <view class="resend-button text-size-xs text-app-brand" @click="sendPhoneCode">
              {{ sendingCode ? '正在发送…' : '重新发送验证码' }}
            </view>
          </view>

          <wd-button block size="large" custom-class="form-submit-button" :loading="loading || sendingCode" @click="submitPhoneLogin">
            {{ codeSent ? '登录' : '获取验证码' }}
          </wd-button>

          <view class="form-switches flex items-center justify-center gap-3 px-0 pb-0.5 pt-3.5">
            <view class="form-switch text-size-xs leading-none" role="button" @click="setLoginMode('password')">
              切换到密码登录
            </view>
            <view class="alternative-divider h-3" />
            <view class="form-switch text-size-xs leading-none" role="button" @click="setLoginMode(null)">
              <!-- #ifdef MP-WEIXIN -->
              返回微信登录
              <!-- #endif -->
              <!-- #ifdef H5 -->
              返回登录方式
              <!-- #endif -->
            </view>
          </view>
        </view>

        <view v-else class="inline-form mt-3.5">
          <view class="field-shell phone-field-shell mt-2.5 box-border min-h-11.5 flex items-center gap-2.5 rounded-3 px-3 py-0">
            <view class="country-code flex-none text-size-sm font-semibold">
              {{ phoneCountryCode }}
            </view>
            <view class="field-divider h-4.5 flex-none" />
            <wd-input v-model="phoneNationalNumber" compact type="tel" clearable placeholder="请输入手机号" :cursor-spacing="120" />
          </view>
          <view class="field-shell mt-2.5 box-border min-h-11.5 flex items-center rounded-3 px-3 py-0">
            <wd-input v-model="password" compact type="safe-password" show-password placeholder="请输入密码" confirm-type="go" :cursor-spacing="120" @confirm="submitPhonePasswordLogin" />
          </view>

          <wd-button block size="large" custom-class="form-submit-button" :loading="loading" @click="submitPhonePasswordLogin">
            登录
          </wd-button>

          <view class="form-switches flex items-center justify-center gap-3 px-0 pb-0.5 pt-3.5">
            <view class="form-switch text-size-xs leading-none" role="button" @click="setLoginMode('phone')">
              切换到验证码登录
            </view>
            <view class="alternative-divider h-3" />
            <view class="form-switch text-size-xs leading-none" role="button" @click="setLoginMode(null)">
              <!-- #ifdef MP-WEIXIN -->
              返回微信登录
              <!-- #endif -->
              <!-- #ifdef H5 -->
              返回登录方式
              <!-- #endif -->
            </view>
          </view>
        </view>
      </template>

      <view class="agreement-row mt-3.5 flex justify-center">
        <wd-checkbox v-model="agreementAccepted" custom-class="agreement-checkbox" max-width="560rpx">
          我已阅读并同意用户协议和隐私政策
        </wd-checkbox>
      </view>
    </view>
  </view>
</template>

<style scoped>
.login-page {
  @apply pt-0 px-4;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  background: linear-gradient(180deg, #d7ebff 0%, #edf7ff 48%, #fff 100%);
}

.ambient-one {
  background: rgb(255 255 255 / 58%);
}

.ambient-two {
  background: rgb(67 158 255 / 7%);
}

.brand-mark {
  border: 1rpx solid rgb(255 255 255 / 78%);
  background: linear-gradient(145deg, #188fff, #70c5ff);
  box-shadow: 0 12rpx 28rpx rgb(8 119 232 / 20%);
  transform: rotate(8deg);
}

.brand-mark::before {
  @apply absolute w-2.5 h-2.5;
  border: 3rpx solid rgb(255 255 255 / 90%);
  @apply rounded-full;
  content: '';
}

.brand-mark-dot {
  box-shadow: 0 0 0 5rpx rgb(255 255 255 / 20%);
}

.brand-name {
  letter-spacing: 6rpx;
}

.coordinate-hero {
  transition:
    min-height 0.28s ease,
    padding 0.28s ease;
}

.coordinate-visual {
  transition:
    height 0.28s ease,
    margin 0.28s ease,
    transform 0.28s ease;
}

.orbit {
  border: 1rpx solid rgb(30 137 236 / 18%);
  transform: translate(-50%, -50%);
}

.orbit-inner {
  border-color: rgb(30 137 236 / 22%);
}

.orbit-dot {
  background: #62b8ff;
}

.orbit-dot-one {
  box-shadow: 0 0 0 12rpx rgb(98 184 255 / 12%);
}

.orbit-dot-two {
  background: #8fd7ff;
  box-shadow: 0 0 0 10rpx rgb(143 215 255 / 13%);
}

.coordinate-tile {
  border: 1rpx solid rgb(255 255 255 / 90%);
  background: linear-gradient(145deg, rgb(255 255 255 / 96%), rgb(218 237 255 / 92%));
  box-shadow: 0 28rpx 70rpx rgb(31 101 174 / 18%);
  transform: translate(-50%, -50%) rotate(8deg);
}

.coordinate-symbol {
  transform: rotate(-8deg);
}

.coordinate-ring {
  border: 5rpx solid #1889ee;
  box-shadow: 0 0 0 8rpx rgb(24 137 238 / 8%);
}

.coordinate-point {
  background: #1889ee;
}

.spark {
  box-shadow: 0 0 22rpx #fff;
}

.hero-title {
  letter-spacing: -1rpx;
  transition: font-size 0.28s ease;
}

.hero-title text {
  @apply block;
}

.hero-copy {
  transition:
    margin 0.28s ease,
    font-size 0.28s ease;
}

.login-page.is-form-mode .coordinate-hero {
  @apply flex-none min-h-49 pt-1 px-0 pb-3;
}

.login-page.is-form-mode .coordinate-visual {
  @apply h-29 -mt-5 mx-0 -mb-3.5;
  transform: scale(0.7);
}

.login-page.is-form-mode .hero-title {
  @apply text-size-xl;
}

.login-page.is-form-mode .hero-copy {
  @apply mt-1.5 text-size-2xs;
}

.login-action-panel {
  border: 1rpx solid rgb(255 255 255 / 92%);
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 28rpx 72rpx rgb(25 86 155 / 10%);
  backdrop-filter: blur(20rpx);
  transition: padding 0.28s ease;
}

.login-action-panel.is-form-panel {
  @apply pt-4.5 px-3.5 pb-3.5;
}

.login-page :deep(.wechat-login-button),
.login-page :deep(.h5-login-button),
.login-action-panel :deep(.form-submit-button) {
  @apply h-11.5;
  @apply border-0 !important;
  @apply rounded-3.5 !important;
  @apply text-size-sm font-bold;
  box-shadow: 0 18rpx 44rpx rgb(8 119 232 / 20%);
}

.login-page :deep(.wechat-login-button) {
  background: linear-gradient(135deg, #20a06a, #32bd7d) !important;
  box-shadow: 0 18rpx 44rpx rgb(31 157 104 / 22%);
}

.login-page :deep(.wechat-login-button:active),
.login-page :deep(.h5-login-button:active),
.login-action-panel :deep(.form-submit-button:active) {
  @apply opacity-86;
  transform: scale(0.99);
}

.login-alternatives {
  @apply mt-3.5;
}

.h5-alternatives {
  @apply mt-3;
}

.alternative-button {
  color: #507da4;
  transition: opacity 0.15s ease;
}

.alternative-button:active,
.form-switch:active,
.resend-button:active {
  @apply opacity-55;
}

.alternative-divider {
  width: 1rpx;
  background: #d5e0ea;
}

.login-page :deep(.agreement-checkbox) {
  @apply items-start;
  --wot-checkbox-icon-size: 32rpx;
  --wot-checkbox-label-color: #748396;
  --wot-checkbox-label-font-size: 21rpx;
  --wot-checkbox-label-line-height: 1.55;
}

.field-shell {
  border: 1rpx solid #e2eaf2;
  background: #f9fbfd;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.field-shell:focus-within {
  border-color: rgb(0 129 255 / 35%);
  @apply bg-white;
}

.field-shell :deep(.wd-input) {
  @apply flex-1 min-w-0 bg-transparent;
  --wot-input-padding: 0;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 88rpx;
  --wot-input-inner-font-size: 27rpx;
  --wot-input-inner-placeholder-color: #9ba8b7;
}

.country-code {
  color: #40536b;
}

.field-divider {
  width: 1rpx;
  background: #dce5ee;
}

.login-action-panel :deep(.form-submit-button) {
  @apply mt-4;
  background: linear-gradient(135deg, #0877e8, #43aaff) !important;
}

.form-switch {
  color: #5e83a4;
}

@media (max-height: 700px) {
  .coordinate-hero {
    @apply min-h-63 pt-2;
  }

  .coordinate-visual {
    @apply w-40 h-34;
    transform: scale(0.86);
  }

  .hero-title {
    @apply text-size-2xl;
  }
}

@media (prefers-reduced-motion: reduce) {
  .alternative-button,
  .field-shell,
  .coordinate-hero,
  .coordinate-visual,
  .hero-title,
  .hero-copy,
  .login-action-panel {
    @apply transition-none;
  }
}

@media (min-width: 768px) {
  .login-page {
    @apply min-h-screen;
    box-shadow: 0 0 80rpx rgb(20 76 142 / 8%);
  }
}
</style>
