<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getWebAuthnSupport } from '@/features/account-security/service'
import { executeAppPendingAction } from '@/features/pending-actions/service'
import { getDefaultRouteForMode } from '@/modules/registry'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'
import { isPageTabbar } from '@/tabbar/store'

definePage({
  style: {
    navigationBarTitleText: '登录',
  },
})

const sessionStore = useSessionStore()
const appContextStore = useAppContextStore()
const method = ref<'phone' | 'email'>('phone')
const phoneCountryCode = ref('+86')
const phoneNationalNumber = ref('')
const phoneCode = ref('')
const email = ref('')
const password = ref('')
const mfaCode = ref('')
const codeSent = ref(false)
const loading = ref(false)
const sendingCode = ref(false)
const redirect = ref('')
const webauthnSupport = getWebAuthnSupport()
const mfaSupportsCode = computed(() => !sessionStore.pendingMfaTypes.length || sessionStore.pendingMfaTypes.includes('totp') || sessionStore.pendingMfaTypes.includes('recovery_codes'))
const mfaSupportsPasskey = computed(() => sessionStore.pendingMfaTypes.includes('webauthn'))

async function handleLoginResult(result: Awaited<ReturnType<typeof sessionStore.loginByEmail>>) {
  if (result.kind === 'mfa-required') {
    uni.showToast({ title: '请完成多因素验证', icon: 'none' })
    return
  }
  await finishAuthentication()
}

function showError(error: unknown, fallback: string) {
  uni.showToast({
    title: error instanceof Error ? error.message : fallback,
    icon: 'none',
  })
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
    await handleLoginResult(await sessionStore.loginByPhoneCode(phoneCode.value.trim()))
  }
  catch (error) {
    showError(error, '手机登录失败')
  }
  finally {
    loading.value = false
  }
}

async function submitEmailLogin() {
  if (!email.value.trim() || !password.value) {
    uni.showToast({ title: '请输入邮箱和密码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await handleLoginResult(await sessionStore.loginByEmail(email.value.trim(), password.value))
  }
  catch (error) {
    showError(error, '邮箱登录失败')
  }
  finally {
    loading.value = false
  }
}

async function submitWechatLogin() {
  loading.value = true
  try {
    await handleLoginResult(await sessionStore.loginByWechat())
  }
  catch (error) {
    showError(error, '微信登录失败')
  }
  finally {
    loading.value = false
  }
}

async function submitMfaCode() {
  if (!mfaCode.value.trim()) {
    uni.showToast({ title: '请输入验证码或恢复码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await handleLoginResult(await sessionStore.completeMfa(mfaCode.value.trim()))
  }
  catch (error) {
    showError(error, '多因素验证失败')
  }
  finally {
    loading.value = false
  }
}

async function submitMfaPasskey() {
  if (!webauthnSupport.supported) {
    uni.showToast({ title: webauthnSupport.reason, icon: 'none' })
    return
  }
  loading.value = true
  try {
    await handleLoginResult(await sessionStore.completeMfaByPasskey())
  }
  catch (error) {
    showError(error, '通行密钥验证失败')
  }
  finally {
    loading.value = false
  }
}

function cancelMfa() {
  sessionStore.clearLoginFlow()
  mfaCode.value = ''
}

onLoad((options) => {
  redirect.value = options?.redirect ? decodeURIComponent(String(options.redirect)) : ''
})
</script>

<template>
  <view class="login-page">
    <view class="login-brand">
      链云空间
    </view>
    <view class="login-title">
      登录并继续
    </view>
    <view class="login-copy">
      登录后将恢复租客身份，并继续刚才的收藏或预约操作。
    </view>

    <view v-if="sessionStore.mfaPending" class="login-card mfa-card">
      <view class="card-title">
        多因素验证
      </view>
      <view class="card-copy">
        {{ mfaSupportsCode ? '请输入验证器当前显示的 6 位验证码，或使用一条未使用的恢复码。' : '请使用账号已绑定的通行密钥完成验证。' }}
      </view>
      <wd-input v-if="mfaSupportsCode" v-model="mfaCode" label="验证码" clearable placeholder="6 位验证码或恢复码" />
      <wd-button v-if="mfaSupportsCode" block size="large" :loading="loading" @click="submitMfaCode">
        验证并登录
      </wd-button>
      <!-- #ifdef H5 -->
      <wd-button v-if="mfaSupportsPasskey" block size="large" variant="plain" :disabled="!webauthnSupport.supported" :loading="loading" @click="submitMfaPasskey">
        使用通行密钥验证
      </wd-button>
      <view v-if="mfaSupportsPasskey && !webauthnSupport.supported" class="capability-note">
        {{ webauthnSupport.reason }}
      </view>
      <!-- #endif -->
      <!-- #ifdef MP-WEIXIN -->
      <view v-if="mfaSupportsPasskey && !mfaSupportsCode" class="capability-note">
        微信小程序暂不支持通行密钥验证。请改用网页端登录，或先在管理端配置动态验证码和恢复码。
      </view>
      <!-- #endif -->
      <wd-button block variant="text" @click="cancelMfa">
        返回其他登录方式
      </wd-button>
    </view>

    <!-- #ifdef MP-WEIXIN -->
    <view v-if="!sessionStore.mfaPending" class="login-card wechat-card">
      <view class="wechat-icon i-carbon-logo-wechat" />
      <view class="card-title">
        微信快捷登录
      </view>
      <view class="card-copy">
        首次登录会自动创建账号，无需额外注册。
      </view>
      <wd-button block size="large" :loading="loading" @click="submitWechatLogin">
        微信登录
      </wd-button>
    </view>
    <!-- #endif -->

    <view v-if="!sessionStore.mfaPending" class="method-switch">
      <wd-button :variant="method === 'phone' ? 'base' : 'plain'" @click="method = 'phone'">
        手机验证码
      </wd-button>
      <wd-button :variant="method === 'email' ? 'base' : 'plain'" @click="method = 'email'">
        邮箱密码
      </wd-button>
    </view>

    <view v-if="!sessionStore.mfaPending && method === 'phone'" class="login-card">
      <wd-input v-model="phoneCountryCode" label="区号" readonly />
      <wd-input v-model="phoneNationalNumber" label="手机号" type="tel" clearable placeholder="请输入手机号" />
      <wd-input v-if="codeSent" v-model="phoneCode" label="验证码" type="number" clearable placeholder="请输入短信验证码" />
      <view v-if="codeSent" class="code-again" @click="sendPhoneCode">
        重新发送验证码
      </view>
      <wd-button block size="large" :loading="loading || sendingCode" @click="submitPhoneLogin">
        {{ codeSent ? '登录' : '获取验证码' }}
      </wd-button>
    </view>

    <view v-else-if="!sessionStore.mfaPending" class="login-card">
      <wd-input v-model="email" label="邮箱" clearable placeholder="请输入邮箱" />
      <wd-input v-model="password" label="密码" type="safe-password" show-password placeholder="请输入密码" />
      <wd-button block size="large" :loading="loading" @click="submitEmailLogin">
        邮箱密码登录
      </wd-button>
    </view>
    <view class="privacy-note">
      登录即表示你同意仅将账号用于保持登录状态、收藏和已授权业务。
    </view>
  </view>
</template>

<style lang="scss" scoped>
.login-page {
  min-height: 100vh;
  padding: 90rpx 34rpx 48rpx;
  background: var(--app-gradient-auth);
  box-sizing: border-box;
}
.login-brand {
  color: var(--app-color-brand);
  font-size: 25rpx;
  font-weight: 600;
  letter-spacing: 5rpx;
}
.login-title {
  margin-top: 30rpx;
  color: var(--app-text-primary);
  font-size: 52rpx;
  font-weight: 750;
}
.login-copy {
  margin-top: 16rpx;
  color: var(--app-text-secondary);
  font-size: 27rpx;
  line-height: 1.7;
}
.method-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 44rpx;
}
.login-card {
  margin-top: 24rpx;
  padding: 30rpx 26rpx;
  border-radius: 28rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-auth-card);
}
.login-card :deep(.wd-button) {
  margin-top: 28rpx;
}
.wechat-card {
  margin-top: 50rpx;
  text-align: center;
}
.wechat-icon {
  margin: 0 auto;
  color: var(--app-color-success);
  font-size: 96rpx;
}
.card-title {
  margin-top: 16rpx;
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.card-copy {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 25rpx;
}
.mfa-card .card-copy {
  margin-bottom: 18rpx;
  line-height: 1.65;
}
.capability-note {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
  text-align: center;
}
.code-again {
  padding: 22rpx 0 0;
  color: var(--app-color-brand);
  font-size: 24rpx;
  text-align: right;
}
.privacy-note {
  margin-top: 34rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.6;
  text-align: center;
}
</style>
