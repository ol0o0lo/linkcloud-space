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
    <view class="phone-page box-border bg-surface-page px-5 pb-3.5 pt-6 min-h-inherit">
      <view class="phone-hero box-border min-h-40 flex flex-col items-center justify-center rounded-5 bg-surface-card p-4">
        <view class="phone-icon i-carbon-phone text-size-4xl text-app-brand" />
        <view class="phone-title mt-3 text-size-base text-content-primary font-bold">
          继续预约看房
        </view>
        <view class="phone-copy mt-1.5 text-center text-size-2xs text-content-muted leading-relaxed">
          完成手机号验证后，将用于建立或匹配当前工作空间的租客联系人。
        </view>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <wd-button block size="large" open-type="getPhoneNumber" :loading="loading" @getphonenumber="bindWechatPhone">
        使用微信手机号
      </wd-button>
      <view class="phone-divider mt-6 text-center text-size-2xs text-content-muted">
        或使用短信验证码
      </view>
      <!-- #endif -->

      <view class="phone-form mt-4 flex flex-col gap-3.5">
        <wd-input v-model="phoneCountryCode" label="区号" readonly />
        <wd-input v-model="phoneNationalNumber" label="手机号" type="number" clearable placeholder="请输入手机号" />
        <wd-input v-if="codeSent" v-model="code" label="验证码" type="number" clearable placeholder="请输入短信验证码" />
        <view v-if="codeSent" class="resend text-center text-size-xs text-app-brand" @click="sendCode">
          重新发送验证码
        </view>
        <wd-button block size="large" :loading="loading || sending" @click="verifyCode">
          {{ codeSent ? '验证并继续' : '获取验证码' }}
        </wd-button>
      </view>
    </view>
  </AppPage>
</template>

<style scoped>
:deep(.phone-form .wd-input) {
  @apply min-h-14 py-2 px-3.5 border-hairline border-solid border-app-border rounded-3.5 box-border bg-surface-card;
}
</style>
