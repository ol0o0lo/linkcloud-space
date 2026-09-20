<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { bindWechatPhoneCode, confirmPhoneVerification, requestPhoneVerification } from '@/features/account/service'
import { executeAppPendingAction } from '@/features/pending-actions/service'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'
import { isPageTabbar } from '@/tabbar/store'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({ style: { navigationBarTitleText: '验证手机号', navigationStyle: 'custom' } })

const sessionStore = useSessionStore()
const appContextStore = useAppContextStore()
const phoneCountryCode = ref('+86')
const phoneNationalNumber = ref('')
const code = ref('')
const codeSent = ref(false)
const loading = ref(false)
const sending = ref(false)
const redirect = ref('')

function showError(error: unknown, fallback: string) {
  uni.showToast({ title: error instanceof Error ? error.message : fallback, icon: 'none' })
}

async function finishVerification(sessionToken = '') {
  if (sessionToken)
    sessionStore.setSessionToken(sessionToken)
  await appContextStore.refreshAuthenticatedContext()
  if (!appContextStore.user?.phone_verified)
    throw new Error('手机号尚未完成验证')

  const pending = sessionStore.consumePendingAction()
  let message = '手机号验证成功'
  if (pending) {
    const result = await executeAppPendingAction(pending)
    if (result.executed)
      message = `手机号验证成功，${result.successMessage}`
  }
  uni.showToast({ title: message, icon: 'success' })
  const target = pending?.redirect || redirect.value || APP_ROUTES.me
  if (isPageTabbar(target))
    uni.switchTab({ url: target })
  else
    uni.reLaunch({ url: target })
}

async function sendCode() {
  if (!phoneNationalNumber.value.trim()) {
    uni.showToast({ title: '请输入手机号', icon: 'none' })
    return
  }
  sending.value = true
  try {
    await requestPhoneVerification(phoneCountryCode.value, phoneNationalNumber.value.trim())
    codeSent.value = true
    uni.showToast({ title: '验证码已发送', icon: 'success' })
  }
  catch (error) {
    showError(error, '验证码发送失败')
  }
  finally {
    sending.value = false
  }
}

async function verifyCode() {
  if (!codeSent.value) {
    await sendCode()
    return
  }
  if (!code.value.trim()) {
    uni.showToast({ title: '请输入验证码', icon: 'none' })
    return
  }
  loading.value = true
  try {
    await confirmPhoneVerification(code.value.trim())
    await finishVerification()
  }
  catch (error) {
    showError(error, '手机号验证失败')
  }
  finally {
    loading.value = false
  }
}

async function bindWechatPhone(event: { detail?: { code?: string, errMsg?: string } }) {
  const phoneCode = event.detail?.code
  if (!phoneCode) {
    uni.showToast({ title: '未获得手机号授权', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await bindWechatPhoneCode(phoneCode)
    await finishVerification(result.session_token || '')
  }
  catch (error) {
    showError(error, '微信手机号绑定失败')
  }
  finally {
    loading.value = false
  }
}

onLoad((options) => {
  redirect.value = options?.redirect ? decodeURIComponent(String(options.redirect)) : ''
  if (appContextStore.user?.phone_verified)
    void finishVerification()
})
</script>

<template>
  <AppPage variant="form" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="验证手机号" back scroll-mode="sticky" />
    </template>
    <view class="phone-page">
      <view class="phone-hero">
        <view class="phone-icon i-carbon-phone" />
        <view class="phone-title">
          继续预约看房
        </view>
        <view class="phone-copy">
          完成手机号验证后，将用于建立或匹配当前组织的租客联系人。
        </view>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <wd-button block size="large" open-type="getPhoneNumber" :loading="loading" @getphonenumber="bindWechatPhone">
        使用微信手机号
      </wd-button>
      <view class="phone-divider">
        或使用短信验证码
      </view>
      <!-- #endif -->

      <view class="phone-form">
        <wd-input v-model="phoneCountryCode" label="区号" readonly />
        <wd-input v-model="phoneNationalNumber" label="手机号" type="number" clearable placeholder="请输入手机号" />
        <wd-input v-if="codeSent" v-model="code" label="验证码" type="number" clearable placeholder="请输入短信验证码" />
        <view v-if="codeSent" class="resend" @click="sendCode">
          重新发送验证码
        </view>
        <wd-button block size="large" :loading="loading || sending" @click="verifyCode">
          {{ codeSent ? '验证并继续' : '获取验证码' }}
        </wd-button>
      </view>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.phone-page {
  min-height: inherit;
  padding: 48rpx 40rpx 28rpx;
  box-sizing: border-box;
  background: var(--app-bg-page);
}
.phone-hero {
  display: flex;
  min-height: 320rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx;
  border-radius: 40rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.phone-icon {
  color: var(--app-color-brand);
  font-size: 68rpx;
}
.phone-title {
  margin-top: 24rpx;
  color: var(--app-text-primary);
  font-size: 34rpx;
  font-weight: 700;
}
.phone-copy {
  margin-top: 12rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: center;
  line-height: 1.7;
}
.phone-form {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  margin-top: 32rpx;
}
.phone-divider {
  margin-top: 48rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: center;
}
:deep(.phone-form .wd-input) {
  min-height: 112rpx;
  padding: 16rpx 28rpx;
  border: 1rpx solid var(--app-border-color);
  border-radius: 28rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.resend {
  color: var(--app-color-primary);
  font-size: 24rpx;
  text-align: center;
}
</style>
