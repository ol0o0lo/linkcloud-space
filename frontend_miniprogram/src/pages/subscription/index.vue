<script lang="ts" setup>
import type { CurrentSubscriptionOut, PlanOut, SaaSOrderOut } from '@/services/openapi'
import { subscriptionsCurrentUsingGet, subscriptionsOrdersOrderNoUsingGet, subscriptionsOrdersUsingPost, subscriptionsPlansUsingGet } from '@/services/openapi'

definePage({
  style: {
    navigationBarTitleText: '订阅与权益',
  },
})

interface Entitlement { member_limit?: number | null, team_limit?: number | null, house_limit?: number | null, ends_at?: string | null }
interface Usage { member?: number, team?: number, house?: number }
interface Price { billing_cycle?: string, amount?: number }

const current = ref<CurrentSubscriptionOut>()
const plans = ref<PlanOut[]>([])
const loading = ref(false)
const purchasingKey = ref('')
const entitlement = computed(() => (current.value?.entitlement || {}) as Entitlement)
const usage = computed(() => (current.value?.usage || {}) as Usage)

function amountLabel(amount?: number) {
  return `¥${((amount || 0) / 100).toFixed(2)}`
}

function limitLabel(used?: number, limit?: number | null) {
  return `${used || 0} / ${limit == null ? '不限' : limit}`
}

function planEntitlement(plan: PlanOut) {
  return (plan.entitlement || {}) as Entitlement
}

async function load() {
  loading.value = true
  try {
    const [subscription, catalog] = await Promise.all([subscriptionsCurrentUsingGet({}), subscriptionsPlansUsingGet({})])
    current.value = subscription
    plans.value = catalog
  }
  finally {
    loading.value = false
  }
}

async function purchase(plan: PlanOut, price: Price) {
  // #ifdef H5
  uni.showToast({ title: '请前往微信小程序完成支付', icon: 'none' })
  return
  // #endif

  const billingCycle = price.billing_cycle || 'month'
  const key = `${plan.code}-${billingCycle}`
  purchasingKey.value = key
  try {
    const order = await subscriptionsOrdersUsingPost({ body: { target_plan_code: plan.code, billing_cycle: billingCycle, payment_mode: 'miniprogram' } })
    const params = ((order as SaaSOrderOut).payment || {}).checkout?.payment_params
    // #ifdef MP-WEIXIN
    if (params) {
      await new Promise<void>((resolve, reject) => {
        uni.requestPayment({
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
          success: () => resolve(),
          fail: error => reject(error),
        })
      })
      if (await waitForPaymentSuccess(order.order_no)) {
        uni.showToast({ title: '支付成功，权益已开通', icon: 'success' })
      }
      return
    }
    // #endif
    uni.showToast({ title: '订单已创建，请在微信支付中完成付款', icon: 'none' })
  }
  catch (error: any) {
    uni.showToast({ title: error?.message || '创建订单失败', icon: 'none' })
  }
  finally {
    purchasingKey.value = ''
  }
}

async function waitForPaymentSuccess(orderNo?: string) {
  if (!orderNo)
    return false
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const latest = await subscriptionsOrdersOrderNoUsingGet({ params: { order_no: orderNo } })
    if (latest.status === 'paid') {
      await load()
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  uni.showToast({ title: '支付已完成，权益将在稍后开通', icon: 'none' })
  return false
}

onShow(load)
</script>

<template>
  <view class="min-h-screen bg-[#f7f8fa] p-3">
    <view class="mb-3 rounded-3 bg-white p-4 shadow-sm">
      <view class="text-lg font-semibold">
        当前套餐：{{ current?.plan?.name || '免费版' }}
      </view>
      <view class="grid grid-cols-3 mt-3 gap-2 text-center text-sm">
        <view>
          <view class="text-gray-500">
            成员
          </view>
          <view class="mt-1 font-medium">
            {{ limitLabel(usage.member, entitlement.member_limit) }}
          </view>
        </view>
        <view>
          <view class="text-gray-500">
            团队
          </view>
          <view class="mt-1 font-medium">
            {{ limitLabel(usage.team, entitlement.team_limit) }}
          </view>
        </view>
        <view>
          <view class="text-gray-500">
            房源
          </view>
          <view class="mt-1 font-medium">
            {{ limitLabel(usage.house, entitlement.house_limit) }}
          </view>
        </view>
      </view>
    </view>

    <view v-for="plan in plans" :key="plan.code" class="mb-3 rounded-3 bg-white p-4 shadow-sm">
      <view class="flex items-center justify-between">
        <view class="text-base font-semibold">
          {{ plan.name }}
        </view>
        <view class="text-xs text-gray-500">
          成员 {{ planEntitlement(plan).member_limit ?? '不限' }} · 团队 {{ planEntitlement(plan).team_limit ?? '不限' }}
        </view>
      </view>
      <view class="mt-2 text-sm text-gray-500">
        {{ plan.description || '按套餐权益使用服务。' }}
      </view>
      <view v-for="price in plan.prices as Price[]" :key="price.billing_cycle" class="mt-3">
        <button
          v-if="plan.code !== 'free'"
          class="w-full rounded-full bg-[#018d71] text-white"
          :loading="purchasingKey === `${plan.code}-${price.billing_cycle}`"
          @click="purchase(plan, price)"
        >
          开通 {{ plan.name }}（{{ price.billing_cycle === 'year' ? '年付' : '月付' }}） {{ amountLabel(price.amount) }}
        </button>
      </view>
    </view>

    <view v-if="loading" class="py-8 text-center text-sm text-gray-400">
      加载中…
    </view>
  </view>
</template>
