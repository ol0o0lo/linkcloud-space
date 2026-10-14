<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getWechatLoginCode } from '@/infra/auth/client'
import { confirmMiniprogramPcLogin } from '@/services/manual/pc-login'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '电脑登录确认',
    navigationStyle: 'custom',
  },
})

type LoginPhase = 'loading' | 'success' | 'error'

const scene = ref('')
const phase = ref<LoginPhase>('loading')
const errorMessage = ref('')
const loading = computed(() => phase.value === 'loading')

function normalizeScene(value: unknown): string {
  const raw = String(value || '').trim()
  if (!raw)
    return ''
  try {
    return decodeURIComponent(raw)
  }
  catch {
    return raw
  }
}

async function confirmLogin() {
  if (!scene.value) {
    errorMessage.value = '登录二维码缺少有效票据，请返回电脑重新获取。'
    phase.value = 'error'
    return
  }

  phase.value = 'loading'
  errorMessage.value = ''
  try {
    const code = await getWechatLoginCode()
    await confirmMiniprogramPcLogin({ scene: scene.value, code })
    phase.value = 'success'
  }
  catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '电脑登录确认失败，请重试。'
    phase.value = 'error'
  }
}

onLoad((options) => {
  scene.value = normalizeScene(options?.scene)
  // #ifdef MP-WEIXIN
  void confirmLogin()
  // #endif
  // #ifndef MP-WEIXIN
  errorMessage.value = '请使用微信扫描电脑端的小程序码。'
  phase.value = 'error'
  // #endif
})
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="电脑登录确认" back scroll-mode="sticky" />
    </template>
    <view class="pc-login-page">
      <view class="phase-heading">
        <strong>扫码确认状态</strong><text>仅处理当前电脑端登录请求</text>
      </view>
      <view class="pc-login-card" :class="`pc-login-card--${phase}`">
        <view v-if="loading" class="status-icon status-icon--loading">
          <view class="loading-ring" />
        </view>
        <view v-else-if="phase === 'success'" class="status-icon status-icon--success">
          ✓
        </view>
        <view v-else class="status-icon status-icon--error">
          !
        </view>

        <view class="status-title">
          {{ loading ? '正在确认电脑登录' : phase === 'success' ? '已确认，请返回电脑' : '确认未完成' }}
        </view>
        <view class="status-copy">
          {{ loading ? '正在安全验证本次扫码，请稍候。' : phase === 'success' ? '当前电脑将自动完成登录，你可以关闭此页面。' : errorMessage }}
        </view>

        <wd-button v-if="phase === 'error'" block size="large" :loading="loading" @click="confirmLogin">
          重新确认
        </wd-button>
      </view>
      <view class="security-copy">
        <view /><view><strong>安全提醒</strong><text>请勿扫描来源不明的登录二维码；H5 打开时会提示改用微信扫码。</text></view>
      </view>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.pc-login-page {
  display: flex;
  min-height: 100vh;
  padding: 40rpx 40rpx 56rpx;
  flex-direction: column;
  align-items: stretch;
  box-sizing: border-box;
  background: var(--app-bg-page);
}
.phase-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}
.phase-heading strong {
  color: var(--app-text-primary);
  font-size: 30rpx;
}
.phase-heading text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.pc-login-card {
  width: 100%;
  padding: 46rpx 40rpx 40rpx;
  box-sizing: border-box;
  border-radius: 32rpx;
  background: var(--app-bg-card);
  border: 1rpx solid var(--app-border-brand-soft);
  box-shadow: none;
  text-align: center;
}

.status-icon {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  margin: 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 64rpx;
  font-weight: 700;
}

.status-icon--loading {
  background: var(--app-color-brand-soft);
}

.status-icon--success {
  color: var(--app-color-success);
  background: var(--app-bg-subtle);
}

.status-icon--error {
  color: var(--app-color-danger);
  background: var(--app-bg-subtle);
}

.loading-ring {
  width: 48rpx;
  height: 48rpx;
  border: 6rpx solid var(--app-border-color);
  border-top-color: var(--app-color-brand);
  border-radius: 50%;
  animation: loading-spin 0.8s linear infinite;
}

.status-title {
  margin-top: 36rpx;
  color: var(--app-text-primary);
  font-size: 38rpx;
  font-weight: 700;
}

.status-copy {
  min-height: 96rpx;
  margin: 20rpx 0 40rpx;
  color: var(--app-text-secondary);
  font-size: 28rpx;
  line-height: 1.7;
}

.security-copy {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
  padding: 24rpx 28rpx;
  border: 1rpx solid #f1d49c;
  border-radius: 28rpx;
  background: #fff8eb;
}
.security-copy > view:first-child {
  width: 8rpx;
  flex: 0 0 8rpx;
  border-radius: 999rpx;
  background: var(--app-color-warning);
}
.security-copy > view:last-child {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.security-copy strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.security-copy text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.6;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
