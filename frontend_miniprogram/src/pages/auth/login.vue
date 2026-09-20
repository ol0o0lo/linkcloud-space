<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { executeAppPendingAction } from '@/features/pending-actions/service'
import { getDefaultRouteForMode } from '@/modules/registry'
import { APP_ROUTES } from '@/modules/routes'
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
  redirect.value = options?.redirect ? decodeURIComponent(String(options.redirect)) : ''
})
</script>

<template>
  <view class="login-page" :class="{ 'is-form-mode': loginMode }">
    <view class="ambient ambient-one" />
    <view class="ambient ambient-two" />

    <AppCustomNavigation title="" transparent />

    <view class="brand-lockup">
      <view class="brand-mark">
        <view class="brand-mark-dot" />
      </view>
      <view class="brand-name">
        链云空间
      </view>
    </view>

    <view class="coordinate-hero">
      <view class="coordinate-visual">
        <view class="orbit orbit-outer">
          <view class="orbit-dot orbit-dot-one" />
        </view>
        <view class="orbit orbit-inner">
          <view class="orbit-dot orbit-dot-two" />
        </view>
        <view class="coordinate-tile">
          <view class="coordinate-symbol">
            <view class="coordinate-ring" />
            <view class="coordinate-point" />
          </view>
        </view>
        <view class="spark spark-one" />
        <view class="spark spark-two" />
      </view>

      <view class="hero-title">
        你的城市坐标
        <text>正在点亮</text>
      </view>
      <view class="hero-copy">
        登录后继续收藏、预约与看房进度
      </view>
    </view>

    <view class="login-action-panel" :class="{ 'is-form-panel': loginMode }">
      <template v-if="!loginMode">
        <!-- #ifdef MP-WEIXIN -->
        <wd-button type="success" block size="large" custom-class="wechat-login-button" :loading="loading" @click="submitWechatLogin">
          <view class="wechat-button-content">
            <view class="wechat-button-icon i-carbon-logo-wechat" />
            <text>微信一键登录</text>
          </view>
        </wd-button>

        <view class="login-alternatives">
          <view class="alternative-button" role="button" @click="setLoginMode('phone')">
            验证码登录
          </view>
          <view class="alternative-divider" />
          <view class="alternative-button" role="button" @click="setLoginMode('password')">
            密码登录
          </view>
        </view>
        <!-- #endif -->

        <!-- #ifdef H5 -->
        <wd-button block size="large" custom-class="h5-login-button" :loading="loading" @click="setLoginMode('phone')">
          验证码登录
        </wd-button>
        <view class="login-alternatives h5-alternatives">
          <view class="alternative-button" role="button" @click="setLoginMode('password')">
            使用手机号密码登录
          </view>
        </view>
        <!-- #endif -->
      </template>

      <template v-else>
        <view class="form-header">
          <view class="form-title">
            {{ loginMode === 'phone' ? '验证码登录' : '密码登录' }}
          </view>
          <view class="form-copy">
            {{ loginMode === 'phone' ? '短信验证码将发送至你的手机' : '使用手机号和密码登录' }}
          </view>
        </view>

        <view v-if="loginMode === 'phone'" class="inline-form">
          <view class="field-shell phone-field-shell">
            <view class="country-code">
              {{ phoneCountryCode }}
            </view>
            <view class="field-divider" />
            <wd-input v-model="phoneNationalNumber" compact type="tel" clearable placeholder="请输入手机号" :cursor-spacing="120" />
          </view>

          <view v-if="codeSent" class="field-shell">
            <wd-input v-model="phoneCode" compact type="number" clearable placeholder="请输入短信验证码" confirm-type="go" :cursor-spacing="120" @confirm="submitPhoneLogin" />
          </view>

          <view v-if="codeSent" class="resend-row">
            <view class="resend-button" @click="sendPhoneCode">
              {{ sendingCode ? '正在发送…' : '重新发送验证码' }}
            </view>
          </view>

          <wd-button block size="large" custom-class="form-submit-button" :loading="loading || sendingCode" @click="submitPhoneLogin">
            {{ codeSent ? '登录' : '获取验证码' }}
          </wd-button>

          <view class="form-switches">
            <view class="form-switch" role="button" @click="setLoginMode('password')">
              切换到密码登录
            </view>
            <view class="alternative-divider" />
            <view class="form-switch" role="button" @click="setLoginMode(null)">
              <!-- #ifdef MP-WEIXIN -->
              返回微信登录
              <!-- #endif -->
              <!-- #ifdef H5 -->
              返回登录方式
              <!-- #endif -->
            </view>
          </view>
        </view>

        <view v-else class="inline-form">
          <view class="field-shell phone-field-shell">
            <view class="country-code">
              {{ phoneCountryCode }}
            </view>
            <view class="field-divider" />
            <wd-input v-model="phoneNationalNumber" compact type="tel" clearable placeholder="请输入手机号" :cursor-spacing="120" />
          </view>
          <view class="field-shell">
            <wd-input v-model="password" compact type="safe-password" show-password placeholder="请输入密码" confirm-type="go" :cursor-spacing="120" @confirm="submitPhonePasswordLogin" />
          </view>

          <wd-button block size="large" custom-class="form-submit-button" :loading="loading" @click="submitPhonePasswordLogin">
            登录
          </wd-button>

          <view class="form-switches">
            <view class="form-switch" role="button" @click="setLoginMode('phone')">
              切换到验证码登录
            </view>
            <view class="alternative-divider" />
            <view class="form-switch" role="button" @click="setLoginMode(null)">
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

      <view class="agreement-row">
        <wd-checkbox v-model="agreementAccepted" custom-class="agreement-checkbox" max-width="560rpx">
          我已阅读并同意用户协议和隐私政策
        </wd-checkbox>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 860rpx;
  min-height: 100vh;
  padding: 0 32rpx calc(32rpx + env(safe-area-inset-bottom));
  margin: 0 auto;
  overflow-x: hidden;
  background: linear-gradient(180deg, #d7ebff 0%, #edf7ff 48%, #fff 100%);
  box-sizing: border-box;
}

.ambient {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.ambient-one {
  top: -110rpx;
  right: -120rpx;
  width: 380rpx;
  height: 380rpx;
  background: rgb(255 255 255 / 58%);
}

.ambient-two {
  top: 320rpx;
  left: -170rpx;
  width: 320rpx;
  height: 320rpx;
  background: rgb(67 158 255 / 7%);
}

.brand-lockup {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 16rpx;
  align-self: flex-start;
}

.brand-mark {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  border: 1rpx solid rgb(255 255 255 / 78%);
  border-radius: 17rpx;
  background: linear-gradient(145deg, #188fff, #70c5ff);
  box-shadow: 0 12rpx 28rpx rgb(8 119 232 / 20%);
  transform: rotate(8deg);
}

.brand-mark::before {
  position: absolute;
  width: 20rpx;
  height: 20rpx;
  border: 3rpx solid rgb(255 255 255 / 90%);
  border-radius: 50%;
  content: '';
}

.brand-mark-dot {
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 5rpx rgb(255 255 255 / 20%);
}

.brand-name {
  color: var(--app-color-brand);
  font-size: 23rpx;
  font-weight: 700;
  letter-spacing: 6rpx;
}

.coordinate-hero {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 610rpx;
  padding: 34rpx 0 28rpx;
  text-align: center;
  transition:
    min-height 0.28s ease,
    padding 0.28s ease;
}

.coordinate-visual {
  position: relative;
  width: 390rpx;
  height: 350rpx;
  transition:
    height 0.28s ease,
    margin 0.28s ease,
    transform 0.28s ease;
}

.orbit {
  position: absolute;
  top: 50%;
  left: 50%;
  border: 1rpx solid rgb(30 137 236 / 18%);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.orbit-outer {
  width: 340rpx;
  height: 340rpx;
}

.orbit-inner {
  width: 238rpx;
  height: 238rpx;
  border-color: rgb(30 137 236 / 22%);
}

.orbit-dot {
  position: absolute;
  border-radius: 50%;
  background: #62b8ff;
}

.orbit-dot-one {
  top: 47rpx;
  left: 28rpx;
  width: 14rpx;
  height: 14rpx;
  box-shadow: 0 0 0 12rpx rgb(98 184 255 / 12%);
}

.orbit-dot-two {
  right: 4rpx;
  bottom: 48rpx;
  width: 11rpx;
  height: 11rpx;
  background: #8fd7ff;
  box-shadow: 0 0 0 10rpx rgb(143 215 255 / 13%);
}

.coordinate-tile {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 124rpx;
  height: 124rpx;
  border: 1rpx solid rgb(255 255 255 / 90%);
  border-radius: 42rpx;
  background: linear-gradient(145deg, rgb(255 255 255 / 96%), rgb(218 237 255 / 92%));
  box-shadow: 0 28rpx 70rpx rgb(31 101 174 / 18%);
  transform: translate(-50%, -50%) rotate(8deg);
}

.coordinate-symbol {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  transform: rotate(-8deg);
}

.coordinate-ring {
  width: 34rpx;
  height: 34rpx;
  border: 5rpx solid #1889ee;
  border-radius: 50%;
  box-shadow: 0 0 0 8rpx rgb(24 137 238 / 8%);
}

.coordinate-point {
  position: absolute;
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: #1889ee;
}

.spark {
  position: absolute;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 22rpx #fff;
}

.spark-one {
  top: 70rpx;
  right: 45rpx;
  width: 8rpx;
  height: 8rpx;
}

.spark-two {
  bottom: 49rpx;
  left: 66rpx;
  width: 6rpx;
  height: 6rpx;
}

.hero-title {
  color: var(--app-text-primary);
  font-size: 52rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
  line-height: 1.24;
  transition: font-size 0.28s ease;
}

.hero-title text {
  display: block;
}

.hero-copy {
  margin-top: 18rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
  transition:
    margin 0.28s ease,
    font-size 0.28s ease;
}

.login-page.is-form-mode .coordinate-hero {
  flex: none;
  min-height: 390rpx;
  padding: 8rpx 0 24rpx;
}

.login-page.is-form-mode .coordinate-visual {
  height: 230rpx;
  margin: -42rpx 0 -28rpx;
  transform: scale(0.7);
}

.login-page.is-form-mode .hero-title {
  font-size: 43rpx;
}

.login-page.is-form-mode .hero-copy {
  margin-top: 12rpx;
  font-size: 22rpx;
}

.login-action-panel {
  position: relative;
  z-index: 2;
  flex: none;
  padding: 32rpx 26rpx 24rpx;
  border: 1rpx solid rgb(255 255 255 / 92%);
  border-radius: 36rpx;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 28rpx 72rpx rgb(25 86 155 / 10%);
  backdrop-filter: blur(20rpx);
  transition: padding 0.28s ease;
}

.login-action-panel.is-form-panel {
  padding: 34rpx 28rpx 28rpx;
}

.login-page :deep(.wechat-login-button),
.login-page :deep(.h5-login-button),
.login-action-panel :deep(.form-submit-button) {
  height: 92rpx;
  border: 0 !important;
  border-radius: 27rpx !important;
  font-size: 29rpx;
  font-weight: 700;
  box-shadow: 0 18rpx 44rpx rgb(8 119 232 / 20%);
}

.login-page :deep(.wechat-login-button) {
  background: linear-gradient(135deg, #20a06a, #32bd7d) !important;
  box-shadow: 0 18rpx 44rpx rgb(31 157 104 / 22%);
}

.login-page :deep(.wechat-login-button:active),
.login-page :deep(.h5-login-button:active),
.login-action-panel :deep(.form-submit-button:active) {
  opacity: 0.86;
  transform: scale(0.99);
}

.wechat-button-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14rpx;
}

.wechat-button-icon {
  font-size: 38rpx;
}

.login-alternatives {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-top: 27rpx;
}

.h5-alternatives {
  margin-top: 25rpx;
}

.alternative-button {
  padding: 10rpx 4rpx;
  color: #507da4;
  font-size: 24rpx;
  line-height: 1;
  transition: opacity 0.15s ease;
}

.alternative-button:active,
.form-switch:active,
.resend-button:active {
  opacity: 0.55;
}

.alternative-divider {
  width: 1rpx;
  height: 24rpx;
  background: #d5e0ea;
}

.agreement-row {
  display: flex;
  justify-content: center;
  margin-top: 27rpx;
}

.login-page :deep(.agreement-checkbox) {
  align-items: flex-start;
  --wot-checkbox-icon-size: 32rpx;
  --wot-checkbox-label-color: #748396;
  --wot-checkbox-label-font-size: 21rpx;
  --wot-checkbox-label-line-height: 1.55;
}

.form-header {
  text-align: left;
}

.form-title {
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 760;
  line-height: 1.3;
}

.form-copy {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
  line-height: 1.55;
}

.inline-form {
  margin-top: 28rpx;
}

.field-shell {
  display: flex;
  align-items: center;
  min-height: 92rpx;
  padding: 0 24rpx;
  margin-top: 20rpx;
  border: 1rpx solid #e2eaf2;
  border-radius: 24rpx;
  background: #f9fbfd;
  box-sizing: border-box;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.field-shell:focus-within {
  border-color: rgb(0 129 255 / 35%);
  background: #fff;
}

.field-shell :deep(.wd-input) {
  flex: 1;
  min-width: 0;
  background: transparent;
  --wot-input-padding: 0;
  --wot-input-bg: transparent;
  --wot-input-inner-height: 88rpx;
  --wot-input-inner-font-size: 27rpx;
  --wot-input-inner-placeholder-color: #9ba8b7;
}

.phone-field-shell {
  gap: 20rpx;
}

.country-code {
  flex: none;
  color: #40536b;
  font-size: 27rpx;
  font-weight: 600;
}

.field-divider {
  flex: none;
  width: 1rpx;
  height: 34rpx;
  background: #dce5ee;
}

.resend-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 18rpx;
}

.resend-button {
  color: var(--app-color-brand);
  font-size: 23rpx;
}

.login-action-panel :deep(.form-submit-button) {
  margin-top: 30rpx;
  background: linear-gradient(135deg, #0877e8, #43aaff) !important;
}

.form-switches {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 22rpx;
  padding: 28rpx 0 4rpx;
}

.form-switch {
  color: #5e83a4;
  font-size: 23rpx;
  line-height: 1;
}

@media (max-height: 700px) {
  .coordinate-hero {
    min-height: 500rpx;
    padding-top: 14rpx;
  }

  .coordinate-visual {
    width: 320rpx;
    height: 270rpx;
    transform: scale(0.86);
  }

  .hero-title {
    font-size: 46rpx;
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
    transition: none;
  }
}

@media (min-width: 768px) {
  .login-page {
    min-height: 100vh;
    box-shadow: 0 0 80rpx rgb(20 76 142 / 8%);
  }
}
</style>
