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
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { connectCurrentWechatMiniprogram, getWechatLoginCode } from '@/infra/auth/client'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '套餐与用量', navigationStyle: 'custom' } })

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
const currentSubscription = computed(() => current.value?.subscription as Record<string, unknown> | null | undefined)
const currentEntitlement = computed(() => current.value?.entitlement as Record<string, unknown> | undefined)
const currentUsage = computed(() => current.value?.usage as Record<string, number> | undefined)
const trialDaysRemaining = computed(() => {
  if (currentSubscription.value?.kind !== 'trial' || typeof currentSubscription.value.ends_at !== 'string')
    return null
  return Math.max(0, Math.ceil((new Date(currentSubscription.value.ends_at).getTime() - Date.now()) / 86400000))
})
const canManageSubscription = computed(() => appContextStore.capabilities.subscriptions_manage === true)
const invoiceableOrders = computed(() => orders.value.filter(order => order.status === 'paid' && order.refund_status === 'none' && !order.invoice))
const selectedInvoiceOrder = computed(() => invoiceableOrders.value.find(order => order.id === invoiceOrderId.value) || null)

function planPrices(plan: PlanOut): PlanPrice[] {
  const prices = plan.prices
    .map(price => price as Partial<PlanPrice>)
    .filter((price): price is PlanPrice => typeof price.billing_cycle === 'string' && typeof price.amount === 'number')
  return planPurchaseMode(plan) === 'sales_assisted' ? prices.slice(0, 1) : prices
}

function planPurchaseMode(plan: PlanOut) {
  return String((plan as PlanOut & { purchase_mode?: string }).purchase_mode || 'self_service')
}

function planEntitlement(plan: PlanOut) {
  return (plan.entitlement || {}) as Record<string, unknown>
}

function formatQuota(value: unknown, unit: string) {
  return value === null ? `不限${unit}` : `${Number(value || 0)}${unit}`
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
    throw new Error('暂时无法发起支付，请刷新订单后重试')
  const paymentRequest = resolveSubscriptionPaymentRequest(checkout, availability.paymentMode)
  if (paymentRequest.kind === 'native') {
    nativeCodeUrl.value = paymentRequest.codeUrl
    return
  }
  const requestWechatMiniprogramPayment = uni.requestPayment as unknown as (options: WechatMiniprogramPaymentOptions) => Promise<unknown>
  await requestWechatMiniprogramPayment(paymentRequest.options)
}

async function ensureWechatPaymentIdentity() {
  if (paymentMode.value !== 'miniprogram')
    return
  const code = await getWechatLoginCode()
  await connectCurrentWechatMiniprogram(code)
}

async function purchasePlan(plan: PlanOut, price: PlanPrice) {
  if (submitting.value || !canManageSubscription.value)
    return
  if (plan.code === 'free')
    return
  if (planPurchaseMode(plan) === 'sales_assisted') {
    uni.navigateTo({ url: APP_ROUTES.saasEnterprise })
    return
  }
  const confirmation = await uni.showModal({ title: '购买套餐', content: `将创建“${plan.name}”${formatBillingCycle(price.billing_cycle)} ¥${formatMoney(price.amount)} 支付订单，确定继续吗？`, confirmText: '创建订单' })
  if (!confirmation.confirm)
    return
  submitting.value = true
  try {
    await ensureWechatPaymentIdentity()
  }
  catch (error) {
    toast.error(error instanceof Error ? error.message : '微信身份绑定失败，请重试')
    submitting.value = false
    return
  }
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
    if (paymentMode.value === 'miniprogram') {
      uni.navigateTo({ url: `${APP_ROUTES.saasPaymentSuccess}?orderNo=${encodeURIComponent(order.order_no)}&organizationSlug=${encodeURIComponent(appContextStore.organizationSlug)}` })
      return
    }
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
    await ensureWechatPaymentIdentity()
    const checkoutOrder = paymentSnapshot(order).checkout ? order : await checkoutOrganizationSubscriptionOrder(appContextStore.organizationSlug, order.order_no)
    await requestPayment(checkoutOrder)
    toast.success(paymentMode.value === 'native' ? '请扫码完成支付' : '支付请求已发起')
    if (paymentMode.value === 'miniprogram')
      uni.navigateTo({ url: `${APP_ROUTES.saasPaymentSuccess}?orderNo=${encodeURIComponent(order.order_no)}&organizationSlug=${encodeURIComponent(appContextStore.organizationSlug)}` })
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
  if (invoiceType.value === 'company' && !taxNumber.value.trim()) {
    toast.warning('企业发票必须填写税号')
    return
  }
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

function openInvoiceFile(url: string) {
  uni.showLoading({ title: '正在打开' })
  uni.downloadFile({
    url,
    success: (result) => {
      if (result.statusCode !== 200) {
        uni.setClipboardData({ data: url })
        toast.warning('文件下载失败，地址已复制')
        return
      }
      uni.openDocument({ filePath: result.tempFilePath, showMenu: true, fail: () => uni.setClipboardData({ data: url }) })
    },
    fail: () => {
      uni.setClipboardData({ data: url })
      toast.warning('文件地址已复制，请在浏览器打开')
    },
    complete: () => uni.hideLoading(),
  })
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
  <view class="page-shell box-border min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="套餐与用量" back scroll-mode="sticky" />
    <wd-toast />
    <AppLoading v-if="loading" text="正在加载订阅信息…" />
    <AppErrorView v-else-if="loadError" title="订阅信息加载失败" :message="loadError" @retry="loadSubscription" />
    <template v-else>
      <view class="hero-card flex flex-col gap-1.5 rounded-3.5 p-4 text-content-on-brand bg-gradient-brand">
        <text>当前套餐</text><strong>{{ currentPlanName }}</strong>
        <text v-if="trialDaysRemaining !== null">专业版试用还剩 {{ trialDaysRemaining }} 天</text>
        <text v-else>支付方式：{{ paymentMode === 'miniprogram' ? '微信小程序支付' : '微信扫码支付' }}</text>
        <view v-if="currentUsage" class="usage-row mt-1.5 flex flex-wrap gap-1.5">
          <text>成员 {{ currentUsage.member || 0 }}/{{ currentEntitlement?.member_limit ?? '不限' }}</text>
          <text>团队 {{ currentUsage.team || 0 }}/{{ currentEntitlement?.team_limit ?? '不限' }}</text>
          <text>房源 {{ currentUsage.house || 0 }}/{{ currentEntitlement?.house_limit ?? '不限' }}</text>
        </view>
      </view>
      <view class="section-heading mx-1 mb-2 mt-3.5 text-size-sm text-content-primary font-bold">
        可用套餐
      </view>
      <view class="card-list flex flex-col gap-2">
        <view v-for="plan in plans" :key="plan.code" class="record-card rounded-3 bg-surface-card p-3">
          <view class="record-main min-w-0 flex-1">
            <strong>{{ plan.name }}</strong><text>{{ plan.description }}</text>
            <view v-if="plan.entitlement" class="quota-row mt-1.5 flex flex-wrap gap-1">
              <text>{{ formatQuota(planEntitlement(plan).member_limit, '人') }}</text>
              <text>{{ formatQuota(planEntitlement(plan).team_limit, '个团队') }}</text>
              <text>{{ formatQuota(planEntitlement(plan).house_limit, '套房源') }}</text>
            </view>
            <view class="price-list mt-2">
              <view v-for="price in planPrices(plan)" :key="price.billing_cycle" class="price-row mt-1.5 flex items-center justify-between gap-2">
                <text>{{ planPurchaseMode(plan) === 'sales_assisted' ? '按需报价' : `¥${formatMoney(price.amount)} / ${formatBillingCycle(price.billing_cycle)}` }}{{ price.display_note ? ` · ${price.display_note}` : '' }}</text>
                <wd-button v-if="canManageSubscription && plan.code !== 'free'" size="small" :loading="submitting" :disabled="submitting" @click="purchasePlan(plan, price)">
                  {{ planPurchaseMode(plan) === 'sales_assisted' ? '联系销售' : '购买此周期' }}
                </wd-button>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="section-heading mx-1 mb-2 mt-3.5 text-size-sm text-content-primary font-bold">
        支付记录
      </view>
      <view class="card-list flex flex-col gap-2">
        <view v-for="order in orders" :key="order.order_no" class="order-card rounded-3 bg-surface-card p-3">
          <view class="record-main min-w-0 flex-1">
            <view class="title-line">
              <strong>{{ order.target_plan_name }}</strong><wd-tag variant="light" size="small">
                {{ getSubscriptionOrderStatusLabel(order.status) }}
              </wd-tag>
            </view><text>订单号：{{ order.order_no }} · {{ formatBillingCycle(order.billing_cycle) }} · ¥{{ formatMoney(order.payable_amount) }}</text>
          </view>
          <view v-if="canManageSubscription && order.status === 'pending_payment'" class="action-row mt-2 flex-wrap">
            <wd-button v-if="orderPaymentAvailability(order).compatible" size="small" :loading="payingOrderNo === order.order_no" @click="continuePayment(order)">
              支付
            </wd-button><text v-else class="payment-terminal-tip w-full text-size-2xs text-content-muted">{{ orderPaymentAvailability(order).message }}</text><wd-button size="small" variant="plain" :disabled="Boolean(payingOrderNo)" @click="refreshPayment(order)">
              刷新
            </wd-button><wd-button size="small" type="danger" variant="plain" :disabled="Boolean(payingOrderNo)" @click="cancelOrder(order)">
              取消
            </wd-button>
          </view>
        </view>
      </view>
      <view class="section-heading mx-1 mb-2 mt-3.5 text-size-sm text-content-primary font-bold">
        发票
      </view>
      <view v-if="canManageSubscription" class="invoice-card rounded-3 bg-surface-card p-3">
        <view><strong>{{ invoiceProfile?.title || '尚未维护开票资料' }}</strong><text>{{ invoiceProfile?.recipient_email || '保存资料后可申请开票' }}</text></view><wd-button v-if="canManageSubscription" size="small" variant="plain" @click="invoiceVisible = true">
          维护资料
        </wd-button>
        <view class="field-label mx-0 mb-1.5 mt-2.5 text-size-xs text-content-secondary">
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
      <view class="section-heading mx-1 mb-2 mt-3.5 text-size-sm text-content-primary font-bold">
        开票申请
      </view>
      <view class="card-list flex flex-col gap-2">
        <view v-for="invoiceRequest in invoiceRequests" :key="invoiceRequest.id" class="record-card rounded-3 bg-surface-card p-3">
          <view class="record-main min-w-0 flex-1">
            <view class="title-line">
              <strong>{{ invoiceRequest.target_plan_name }}</strong><wd-tag variant="light" size="small">
                {{ getInvoiceStatusLabel(invoiceRequest.status) }}
              </wd-tag>
            </view>
            <text>订单号：{{ invoiceRequest.order_no }}{{ invoiceRequest.invoice_number ? ` · 发票号 ${invoiceRequest.invoice_number}` : '' }}</text>
            <text v-if="invoiceRequest.admin_note" class="invoice-note">处理说明：{{ invoiceRequest.admin_note }}</text>
            <wd-button v-if="invoiceRequest.file_url" size="small" variant="plain" @click="openInvoiceFile(invoiceRequest.file_url)">
              查看电子发票
            </wd-button>
          </view>
        </view>
      </view>
    </template>
    <AppBottomSheet v-model:visible="invoiceVisible" title="开票资料" height="tall">
      <view class="flex flex-col gap-1.5">
        <wd-radio-group v-model="invoiceType" type="button" direction="horizontal">
          <wd-radio value="personal">
            个人
          </wd-radio><wd-radio value="company">
            企业
          </wd-radio>
        </wd-radio-group>
        <wd-cell title="发票抬头" center>
          <wd-input v-model="invoiceTitle" compact align-right />
        </wd-cell>
        <template v-if="invoiceType === 'company'">
          <wd-cell title="税号" center>
            <wd-input v-model="taxNumber" compact align-right />
          </wd-cell>
          <wd-cell title="注册地址" center>
            <wd-input v-model="registeredAddress" compact align-right />
          </wd-cell>
          <wd-cell title="注册电话" center>
            <wd-input v-model="registeredPhone" compact align-right />
          </wd-cell>
          <wd-cell title="开户银行" center>
            <wd-input v-model="bankName" compact align-right />
          </wd-cell>
          <wd-cell title="银行账号" center>
            <wd-input v-model="bankAccount" compact align-right />
          </wd-cell>
        </template>
        <wd-cell title="接收邮箱" center>
          <wd-input v-model="recipientEmail" compact align-right />
        </wd-cell>
      </view>
      <template #footer>
        <wd-button block :loading="submitting" :disabled="submitting" @click="saveInvoiceProfile">
          保存开票资料
        </wd-button>
      </template>
    </AppBottomSheet>
    <AppBottomSheet :visible="Boolean(nativeCodeUrl)" title="微信扫码支付" :scrollable="false" @update:visible="!$event && (nativeCodeUrl = '')">
      <image class="payment-qr mx-auto my-0 block h-53 w-53" :src="`/qr/?data=${encodeURIComponent(nativeCodeUrl)}`" mode="aspectFit" />
      <text class="payment-tip block text-center text-size-2xs text-content-muted">请使用微信扫描二维码完成支付，支付后返回刷新订单状态。</text>
    </AppBottomSheet>
  </view>
</template>

<style scoped lang="scss">
.page-shell :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3;
}
.hero-card strong {
  @apply text-size-lg;
}
.hero-card text {
  @apply text-size-2xs opacity-82;
}
.usage-row text {
  @apply py-1 px-1.5 rounded-full;
  background: rgb(255 255 255 / 14%);
}
.record-card,
.title-line,
.action-row,
.invoice-card > view:first-child {
  @apply flex items-center gap-2;
}
.record-main strong,
.record-main text,
.invoice-card strong,
.invoice-card text {
  @apply block;
}
.record-main strong,
.invoice-card strong {
  @apply text-content-primary text-size-xs;
}
.record-main text,
.invoice-card text {
  @apply mt-1 text-content-muted text-size-2xs;
}
.quota-row text {
  @apply py-1 px-1.5 rounded-full bg-surface-subtle;
}
.empty-tip,
.file-url,
.invoice-note {
  @apply block my-1.5 mx-0 text-content-muted text-size-2xs;
  overflow-wrap: anywhere;
}
.invoice-card > view:first-child {
  @apply justify-between mb-2.5;
}
</style>
