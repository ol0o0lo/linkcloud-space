<script setup lang="ts">
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { refreshSaaSOrderPayment } from '@/features/saas/service'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '支付结果' } })

type PaymentState = 'checking' | 'paid' | 'failed' | 'timeout'

const appContextStore = useAppContextStore()
const state = ref<PaymentState>('checking')
const message = ref('正在确认微信支付结果，请稍候…')
const orderNo = ref('')
const organizationSlug = ref('')
const attempts = ref(0)
let pollTimer: ReturnType<typeof setTimeout> | null = null

const title = computed(() => ({ checking: '支付确认中', paid: '购买成功', failed: '支付未完成', timeout: '确认时间较长' })[state.value])

async function poll() {
  if (!orderNo.value || !organizationSlug.value) {
    state.value = 'failed'
    message.value = '缺少订单信息，请返回订阅页面查看支付记录。'
    return
  }
  attempts.value += 1
  try {
    const order = await refreshSaaSOrderPayment(organizationSlug.value, orderNo.value)
    if (order.status === 'paid') {
      state.value = 'paid'
      message.value = `${order.target_plan_name}权益已经生效，可以立即继续使用。`
      return
    }
    if (order.status === 'closed' || order.status === 'payment_failed') {
      state.value = 'failed'
      message.value = '订单未支付成功，你可以返回订阅页重新支付或创建新订单。'
      return
    }
  }
  catch (error) {
    if (attempts.value >= 3)
      message.value = error instanceof Error ? error.message : '暂时无法查询支付结果'
  }
  if (attempts.value >= 15) {
    state.value = 'timeout'
    message.value = '微信侧可能仍在处理，请稍后到订阅页刷新订单状态。'
    return
  }
  pollTimer = setTimeout(() => void poll(), 2000)
}

function openSubscription() {
  uni.redirectTo({ url: APP_ROUTES.organizationAdminSubscription })
}

function openWorkbench() {
  uni.reLaunch({ url: APP_ROUTES.organizationRental })
}

onLoad((options) => {
  orderNo.value = typeof options?.orderNo === 'string' ? options.orderNo : ''
  organizationSlug.value = typeof options?.organizationSlug === 'string' ? options.organizationSlug : appContextStore.organizationSlug
  void poll()
})

onUnload(() => {
  if (pollTimer)
    clearTimeout(pollTimer)
})
</script>

<template>
  <view class="result-page">
    <AppCustomNavigation title="支付结果" back scroll-mode="sticky" />
    <view class="result-card">
      <view v-if="state === 'checking'" class="result-icon result-icon--checking i-carbon-renew" />
      <view v-else-if="state === 'paid'" class="result-icon result-icon--paid i-carbon-checkmark-filled" />
      <view v-else class="result-icon result-icon--warning i-carbon-warning-alt-filled" />
      <strong>{{ title }}</strong>
      <text>{{ message }}</text>
      <view class="order-no">
        订单号：{{ orderNo || '—' }}
      </view>
      <wd-button v-if="state === 'paid'" block size="large" @click="openWorkbench">
        进入工作台
      </wd-button>
      <wd-button block :variant="state === 'paid' ? 'plain' : 'base'" @click="openSubscription">
        查看订阅与订单
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.result-page {
  min-height: 100vh;
  padding: 0 24rpx 64rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.result-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx 24rpx;
}
.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 64rpx 30rpx 34rpx;
  border-radius: 30rpx;
  text-align: center;
  background: var(--app-bg-card);
}
.result-icon {
  font-size: 88rpx;
}
.result-icon--checking {
  color: var(--app-color-brand);
}
.result-icon--paid {
  color: var(--app-color-success);
}
.result-icon--warning {
  color: var(--app-color-warning);
}
.result-card strong {
  color: var(--app-text-primary);
  font-size: 36rpx;
}
.result-card > text {
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.6;
}
.order-no {
  margin-bottom: 12rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
</style>
