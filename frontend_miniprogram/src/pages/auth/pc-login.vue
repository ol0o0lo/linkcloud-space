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
    <view class="pc-login-page box-border min-h-screen flex flex-col items-stretch bg-surface-page px-5 pb-7 pt-5">
      <view class="phase-heading mb-3.5 flex flex-col gap-1">
        <strong>扫码确认状态</strong><text>仅处理当前电脑端登录请求</text>
      </view>
      <view class="pc-login-card box-border w-full border-hairline border-app-border-brand-soft rounded-4 border-solid bg-surface-card px-5 pb-5 pt-6 text-center shadow-none" :class="`pc-login-card--${phase}`">
        <view v-if="loading" class="status-icon status-icon--loading mx-auto my-0 h-14 w-14 flex items-center justify-center rounded-full text-size-3xl font-bold">
          <view class="loading-ring h-6 w-6 rounded-full" />
        </view>
        <view v-else-if="phase === 'success'" class="status-icon status-icon--success mx-auto my-0 h-14 w-14 flex items-center justify-center rounded-full bg-surface-subtle text-size-3xl text-app-success font-bold">
          ✓
        </view>
        <view v-else class="status-icon status-icon--error mx-auto my-0 h-14 w-14 flex items-center justify-center rounded-full bg-surface-subtle text-size-3xl text-app-danger font-bold">
          !
        </view>

        <view class="status-title mt-4.5 text-size-lg text-content-primary font-bold">
          {{ loading ? '正在确认电脑登录' : phase === 'success' ? '已确认，请返回电脑' : '确认未完成' }}
        </view>
        <view class="status-copy mx-0 mb-5 mt-2.5 min-h-12 text-size-sm text-content-secondary leading-relaxed">
          {{ loading ? '正在安全验证本次扫码，请稍候。' : phase === 'success' ? '当前电脑将自动完成登录，你可以关闭此页面。' : errorMessage }}
        </view>

        <wd-button v-if="phase === 'error'" block size="large" :loading="loading" @click="confirmLogin">
          重新确认
        </wd-button>
      </view>
      <view class="security-copy mt-4 flex gap-2.5 rounded-3.5 px-3.5 py-3">
        <view /><view><strong>安全提醒</strong><text>请使用微信扫一扫，扫描您本人电脑上的登录码；请勿扫描来源不明的登录码。</text></view>
      </view>
    </view>
  </AppPage>
</template>

<style scoped>
.phase-heading strong {
  @apply text-content-primary text-size-sm;
}
.phase-heading text {
  @apply text-content-muted text-size-2xs;
}

.status-icon--loading {
  @apply bg-surface-brand-soft;
}

.loading-ring {
  @apply border-3 border-solid border-app-border;
  @apply border-t-app-brand;
  animation: loading-spin 0.8s linear infinite;
}

.security-copy {
  border: 1rpx solid #f1d49c;
  background: #fff8eb;
}
.security-copy > view:first-child {
  @apply w-1 flex-none basis-1 rounded-full bg-app-warning;
}
.security-copy > view:last-child {
  @apply flex flex-col gap-1;
}
.security-copy strong {
  @apply text-content-primary text-size-xs;
}
.security-copy text {
  @apply text-content-secondary text-size-2xs leading-relaxed;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
