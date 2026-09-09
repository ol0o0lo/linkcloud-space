<script setup lang="ts">
import type { CurrentSubscriptionOut, InvoiceProfileOut, InvoiceRequestOut, PlanOut, SaaSOrderOut } from '@/features/organization-admin/service'
import type { SubscriptionPaymentCheckout, SubscriptionPurchaseIntent, WechatMiniprogramPaymentOptions } from '@/domain/organization-admin'
import { onShow } from '@dcloudio/uni-app'
import { useToast } from '@wot-ui/ui/components/wd-toast'
import { computed, ref } from 'vue'
import { getInvoiceStatusLabel, getSubscriptionOrderStatusLabel, getSubscriptionPurchaseIntent, resolveSubscriptionOrderPaymentAvailability, resolveSubscriptionPaymentMode, resolveSubscriptionPaymentRequest, resolveSubscriptionPurchaseIntentAfterOrderAttempt } from '@/domain/organization-admin'
import {
  cancelOrganizationSubscriptionOrder,
  checkoutOrganizationSubscriptionOrder,
  createOrganizationInvoiceRequest,
  createOrganizationSubscriptionOrder,
  getOrganizationCurrentSubscription,
  getOrganizationInvoiceProfile,
  listAllOrganizationInvoiceRequests,
  listAllOrganizationSubscriptionOrders,
  listOrganizationSubscriptionPlans,
  refreshOrganizationSubscriptionPayment,
  updateOrganizationInvoiceProfile,
} from '@/features/organization-admin/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '订阅与发票' } })

interface PaymentSnapshot {
  payment_mode?: string
  checkout?: SubscriptionPaymentCheckout
}

interface PlanPrice {
  billing_cycle: string
  amount: number
  display_note?: string
}

let runtimePlatform: 'h5' | 'mp-weixin' = 'h5'
let purchaseIntent: SubscriptionPurchaseIntent | null = null
// #ifdef MP-WEIXIN
runtimePlatform = 'mp-weixin'
// #endif

const toast = useToast()
const appContextStore = useAppContextStore()
const current = ref<CurrentSubscriptionOut | null>(null)
const plans = ref<PlanOut[]>([])
const orders = ref<SaaSOrderOut[]>([])
const invoiceRequests = ref<InvoiceRequestOut[]>([])
const invoiceProfile = ref<InvoiceProfileOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const submitting = ref(false)
const payingOrderNo = ref('')
const invoiceVisible = ref(false)
const invoiceType = ref<'personal' | 'company'>('company')
const invoiceTitle = ref('')
const taxNumber = ref('')
const recipientEmail = ref('')
const registeredAddress = ref('')
const registeredPhone = ref('')
const bankName = ref('')
const bankAccount = ref('')
const invoiceOrderId = ref<number | null>(null)
const nativeCodeUrl = ref('')
const paymentMode = computed(() => resolveSubscriptionPaymentMode(runtimePlatform))
const currentPlanName = computed(() => String((current.value?.plan as Record<string, unknown> | undefined)?.name || '当前套餐'))
const canManageSubscription = computed(() => appContextStore.capabilities.subscriptions_manage === true)
const invoiceableOrders = computed(() => orders.value.filter(order => order.status === 'paid' && order.refund_status === 'none' && !order.invoice))
const selectedInvoiceOrder = computed(() => invoiceableOrders.value.find(order => order.id === invoiceOrderId.value) || null)

function planPrices(plan: PlanOut): PlanPrice[] {
  return plan.prices
    .map(price => price as Partial<PlanPrice>)
    .filter((price): price is PlanPrice => typeof price.billing_cycle === 'string' && typeof price.amount === 'number')
}

function formatMoney(amountInCents: number) {
  return (amountInCents / 100).toFixed(2)
}

function formatBillingCycle(billingCycle: string) {
  return ({ month: '月付', year: '年付', monthly: '月付', quarterly: '季付', yearly: '年付' } as Record<string, string>)[billingCycle] || '其他周期'
}

function paymentSnapshot(order: SaaSOrderOut) {
  return (order.payment || {}) as PaymentSnapshot
}

function orderPaymentAvailability(order: SaaSOrderOut) {
  const payment = paymentSnapshot(order)
  return resolveSubscriptionOrderPaymentAvailability(payment.payment_mode, paymentMode.value)
}

async function loadSubscription() {
  loading.value = true
  loadError.value = ''
  try {
    const [nextCurrent, nextPlans, nextOrders, nextInvoiceRequests, nextInvoiceProfile] = await Promise.all([
      getOrganizationCurrentSubscription(appContextStore.organizationSlug),
      listOrganizationSubscriptionPlans(appContextStore.organizationSlug),
      listAllOrganizationSubscriptionOrders(appContextStore.organizationSlug),
      listAllOrganizationInvoiceRequests(appContextStore.organizationSlug),
      canManageSubscription.value ? getOrganizationInvoiceProfile(appContextStore.organizationSlug) : Promise.resolve(null),
    ])
    current.value = nextCurrent
    plans.value = nextPlans
    orders.value = nextOrders
    invoiceRequests.value = nextInvoiceRequests
    invoiceProfile.value = nextInvoiceProfile
    if (nextInvoiceProfile) {
      invoiceType.value = nextInvoiceProfile.invoice_type === 'personal' ? 'personal' : 'company'
      invoiceTitle.value = nextInvoiceProfile.title
      taxNumber.value = nextInvoiceProfile.tax_number || ''
      recipientEmail.value = nextInvoiceProfile.recipient_email
      registeredAddress.value = nextInvoiceProfile.registered_address || ''
      registeredPhone.value = nextInvoiceProfile.registered_phone || ''
      bankName.value = nextInvoiceProfile.bank_name || ''
      bankAccount.value = nextInvoiceProfile.bank_account || ''
    }
  }
  catch (error) { loadError.value = error instanceof Error ? error.message : '订阅信息加载失败' }
  finally { loading.value = false }
}

async function requestPayment(order: SaaSOrderOut) {
  const payment = paymentSnapshot(order)
  const availability = orderPaymentAvailability(order)
  if (!availability.compatible)
    throw new Error(availability.message)
  const checkout = payment.checkout
  if (!checkout)
    throw new Error('支付参数尚未就绪')
  const paymentRequest = resolveSubscriptionPaymentRequest(checkout, availability.paymentMode)
  if (paymentRequest.kind === 'native') {
    nativeCodeUrl.value = paymentRequest.codeUrl
    return
  }
  const requestWechatMiniprogramPayment = uni.requestPayment as unknown as (options: WechatMiniprogramPaymentOptions) => Promise<unknown>
  await requestWechatMiniprogramPayment(paymentRequest.options)
}

async function purchasePlan(plan: PlanOut, price: PlanPrice) {
  if (submitting.value || !canManageSubscription.value)
    return
  const confirmation = await uni.showModal({ title: '购买套餐', content: `将创建“${plan.name}”${formatBillingCycle(price.billing_cycle)} ¥${formatMoney(price.amount)} 支付订单，确定继续吗？`, confirmText: '创建订单' })
  if (!confirmation.confirm)
    return
  submitting.value = true
  const intent = getSubscriptionPurchaseIntent(purchaseIntent, {
    organizationSlug: appContextStore.organizationSlug,
    planCode: plan.code,
    billingCycle: price.billing_cycle,
    paymentMode: paymentMode.value,
  })
  purchaseIntent = intent
  let order: SaaSOrderOut
  try {
    order = await createOrganizationSubscriptionOrder(appContextStore.organizationSlug, {
      target_plan_code: plan.code,
      billing_cycle: price.billing_cycle,
      payment_mode: paymentMode.value,
      idempotency_key: intent.idempotencyKey,
    })
  }
  catch (error) {
    purchaseIntent = resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent, error)
    toast.error(error instanceof Error ? error.message : '套餐购买失败')
    submitting.value = false
    return
  }

  purchaseIntent = resolveSubscriptionPurchaseIntentAfterOrderAttempt(intent)
  try {
    await requestPayment(order)
    toast.success(paymentMode.value === 'native' ? '订单已创建，请扫码支付' : '支付请求已发起')
    await loadSubscription()
  }
  catch (error) {
    toast.error(`订单已创建，请在支付记录中继续支付：${error instanceof Error ? error.message : '支付请求失败'}`)
    await loadSubscription()
  }
  finally { submitting.value = false }
}

async function continuePayment(order: SaaSOrderOut) {
  if (payingOrderNo.value || !canManageSubscription.value)
    return
  const availability = orderPaymentAvailability(order)
  if (!availability.compatible) {
    toast.warning(availability.message)
    return
  }
  payingOrderNo.value = order.order_no
  try {
    const checkoutOrder = paymentSnapshot(order).checkout ? order : await checkoutOrganizationSubscriptionOrder(appContextStore.organizationSlug, order.order_no)
    await requestPayment(checkoutOrder)
    toast.success(paymentMode.value === 'native' ? '请扫码完成支付' : '支付请求已发起')
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '继续支付失败') }
  finally { payingOrderNo.value = '' }
}

async function refreshPayment(order: SaaSOrderOut) {
  if (payingOrderNo.value || !canManageSubscription.value)
    return
  payingOrderNo.value = order.order_no
  try {
    await refreshOrganizationSubscriptionPayment(appContextStore.organizationSlug, order.order_no)
    toast.success('支付状态已刷新')
    await loadSubscription()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '支付状态刷新失败') }
  finally { payingOrderNo.value = '' }
}

async function cancelOrder(order: SaaSOrderOut) {
  if (payingOrderNo.value || !canManageSubscription.value)
    return
  const confirmation = await uni.showModal({ title: '取消待支付订单', content: '取消后如仍需购买，需要重新创建订单。', confirmText: '确认取消' })
  if (!confirmation.confirm)
    return
  payingOrderNo.value = order.order_no
  try {
    await cancelOrganizationSubscriptionOrder(appContextStore.organizationSlug, order.order_no)
    toast.success('订单已取消')
    await loadSubscription()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '订单取消失败') }
  finally { payingOrderNo.value = '' }
}

async function saveInvoiceProfile() {
  if (submitting.value || !canManageSubscription.value || !invoiceTitle.value.trim() || !recipientEmail.value.trim())
    return
  submitting.value = true
  try {
    invoiceProfile.value = await updateOrganizationInvoiceProfile(appContextStore.organizationSlug, {
      invoice_type: invoiceType.value,
      title: invoiceTitle.value.trim(),
      tax_number: taxNumber.value.trim(),
      recipient_email: recipientEmail.value.trim(),
      registered_address: registeredAddress.value.trim(),
      registered_phone: registeredPhone.value.trim(),
      bank_name: bankName.value.trim(),
      bank_account: bankAccount.value.trim(),
    })
    toast.success('开票资料已保存')
    invoiceVisible.value = false
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '开票资料保存失败') }
  finally { submitting.value = false }
}

async function requestInvoice() {
  if (submitting.value || !canManageSubscription.value || !selectedInvoiceOrder.value)
    return
  const confirmation = await uni.showModal({ title: '申请开票', content: `将按当前开票资料为订单 ${selectedInvoiceOrder.value.order_no} 申请发票。`, confirmText: '确认申请' })
  if (!confirmation.confirm)
    return
  submitting.value = true
  try {
    await createOrganizationInvoiceRequest(appContextStore.organizationSlug, { order_id: selectedInvoiceOrder.value.id })
    toast.success('开票申请已提交')
    invoiceOrderId.value = null
    await loadSubscription()
  }
  catch (error) { toast.error(error instanceof Error ? error.message : '开票申请失败') }
  finally { submitting.value = false }
}

onShow(() => void loadSubscription())
</script>

<template>
  <view class="page-shell">
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载订阅信息…" />
    <AppErrorView v-else-if="loadError" title="订阅信息加载失败" :message="loadError" @retry="loadSubscription" />
    <template v-else>
      <view class="hero-card">
        <text>当前套餐</text><strong>{{ currentPlanName }}</strong><text>支付方式：{{ paymentMode === 'miniprogram' ? '微信小程序支付' : '微信扫码支付' }}</text>
      </view>
      <view class="section-heading">
        可用套餐
      </view>
      <view class="card-list">
        <view v-for="plan in plans" :key="plan.code" class="record-card">
          <view class="record-main">
            <strong>{{ plan.name }}</strong><text>{{ plan.description }}</text>
            <view class="price-list">
              <view v-for="price in planPrices(plan)" :key="price.billing_cycle" class="price-row">
                <text>¥{{ formatMoney(price.amount) }} / {{ formatBillingCycle(price.billing_cycle) }}{{ price.display_note ? ` · ${price.display_note}` : '' }}</text>
                <wd-button v-if="canManageSubscription" size="small" :loading="submitting" :disabled="submitting" @click="purchasePlan(plan, price)">
                  购买此周期
                </wd-button>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="section-heading">
        支付记录
      </view>
      <view class="card-list">
        <view v-for="order in orders" :key="order.order_no" class="order-card">
          <view class="record-main">
            <view class="title-line">
              <strong>{{ order.target_plan_name }}</strong><wd-tag variant="light" size="small">
                {{ getSubscriptionOrderStatusLabel(order.status) }}
              </wd-tag>
            </view><text>订单号：{{ order.order_no }} · {{ formatBillingCycle(order.billing_cycle) }} · ¥{{ formatMoney(order.payable_amount) }}</text>
          </view>
          <view v-if="canManageSubscription && order.status === 'pending_payment'" class="action-row">
            <wd-button v-if="orderPaymentAvailability(order).compatible" size="small" :loading="payingOrderNo === order.order_no" @click="continuePayment(order)">
              支付
            </wd-button><text v-else class="payment-terminal-tip">{{ orderPaymentAvailability(order).message }}</text><wd-button size="small" variant="plain" :disabled="Boolean(payingOrderNo)" @click="refreshPayment(order)">
              刷新
            </wd-button><wd-button size="small" type="danger" variant="plain" :disabled="Boolean(payingOrderNo)" @click="cancelOrder(order)">
              取消
            </wd-button>
          </view>
        </view>
      </view>
      <view class="section-heading">
        发票
      </view>
      <view v-if="canManageSubscription" class="invoice-card">
        <view><strong>{{ invoiceProfile?.title || '尚未维护开票资料' }}</strong><text>{{ invoiceProfile?.recipient_email || '保存资料后可申请开票' }}</text></view><wd-button v-if="canManageSubscription" size="small" variant="plain" @click="invoiceVisible = true">
          维护资料
        </wd-button>
        <view class="field-label">
          选择可开票订单
        </view>
        <wd-radio-group v-model="invoiceOrderId" type="button" direction="vertical">
          <wd-radio v-for="order in invoiceableOrders" :key="order.id" :value="order.id">
            {{ order.order_no }} · {{ order.target_plan_name }} · ¥{{ formatMoney(order.payable_amount) }}
          </wd-radio>
        </wd-radio-group>
        <view v-if="!invoiceableOrders.length" class="empty-tip">
          当前没有未申请发票的已支付订单
        </view>
        <wd-button block :loading="submitting" :disabled="submitting || !selectedInvoiceOrder" @click="requestInvoice">
          申请开票
        </wd-button>
      </view>
      <view class="section-heading">
        开票申请
      </view>
      <view class="card-list">
        <view v-for="invoiceRequest in invoiceRequests" :key="invoiceRequest.id" class="record-card">
          <view class="record-main">
            <view class="title-line">
              <strong>{{ invoiceRequest.target_plan_name }}</strong><wd-tag variant="light" size="small">
                {{ getInvoiceStatusLabel(invoiceRequest.status) }}
              </wd-tag>
            </view>
            <text>订单号：{{ invoiceRequest.order_no }}{{ invoiceRequest.invoice_number ? ` · 发票号 ${invoiceRequest.invoice_number}` : '' }}</text>
            <text v-if="invoiceRequest.file_url" class="file-url" selectable>
              {{ invoiceRequest.file_url }}
            </text>
          </view>
        </view>
      </view>
    </template>
    <wd-popup v-model="invoiceVisible" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;">
      <view class="popup-title">
        开票资料
      </view>
      <wd-radio-group v-model="invoiceType" type="button" direction="horizontal">
        <wd-radio value="personal">
          个人
        </wd-radio><wd-radio value="company">
          企业
        </wd-radio>
      </wd-radio-group>
      <wd-input v-model="invoiceTitle" label="发票抬头" />
      <template v-if="invoiceType === 'company'">
        <wd-input v-model="taxNumber" label="税号" />
        <wd-input v-model="registeredAddress" label="注册地址" />
        <wd-input v-model="registeredPhone" label="注册电话" />
        <wd-input v-model="bankName" label="开户银行" />
        <wd-input v-model="bankAccount" label="银行账号" />
      </template>
      <wd-input v-model="recipientEmail" label="接收邮箱" />
      <wd-button block :loading="submitting" :disabled="submitting" @click="saveInvoiceProfile">
        保存开票资料
      </wd-button>
    </wd-popup>
    <wd-popup :model-value="Boolean(nativeCodeUrl)" position="bottom" round closable safe-area-inset-bottom custom-style="padding: 32rpx 26rpx;" @close="nativeCodeUrl = ''">
      <view class="popup-title">
        微信扫码支付
      </view>
      <image class="payment-qr" :src="`/qr/?data=${encodeURIComponent(nativeCodeUrl)}`" mode="aspectFit" />
      <text class="payment-tip">请使用微信扫描二维码完成支付，支付后返回刷新订单状态。</text>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.page-shell {
  min-height: 100vh;
  padding: 24rpx 24rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.hero-card {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 30rpx;
  border-radius: 26rpx;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-organization);
}
.hero-card strong {
  font-size: 36rpx;
}
.hero-card text {
  font-size: 22rpx;
  opacity: 0.82;
}
.section-heading {
  margin: 28rpx 6rpx 14rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 650;
}
.card-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.record-card,
.order-card,
.invoice-card {
  padding: 25rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.record-card,
.title-line,
.action-row,
.invoice-card > view:first-child {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.record-main {
  min-width: 0;
  flex: 1;
}
.record-main strong,
.record-main text,
.invoice-card strong,
.invoice-card text {
  display: block;
}
.record-main strong,
.invoice-card strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.record-main text,
.invoice-card text {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.action-row {
  flex-wrap: wrap;
  margin-top: 16rpx;
}
.payment-terminal-tip {
  width: 100%;
  color: var(--app-text-muted);
  font-size: 21rpx;
}
.price-list {
  margin-top: 14rpx;
}
.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 10rpx;
}
.field-label {
  margin: 18rpx 0 12rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
}
.empty-tip,
.file-url {
  display: block;
  margin: 12rpx 0;
  color: var(--app-text-muted);
  font-size: 21rpx;
  overflow-wrap: anywhere;
}
.invoice-card > view:first-child {
  justify-content: space-between;
  margin-bottom: 18rpx;
}
.popup-title {
  margin-bottom: 18rpx;
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.payment-qr {
  display: block;
  width: 420rpx;
  height: 420rpx;
  margin: 0 auto;
}
.payment-tip {
  display: block;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: center;
}
</style>
