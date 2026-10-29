<script setup lang="ts">
import type { SaaSPlan } from '@/features/saas/service'
import { onPageScroll, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { listPublicSaaSPlans } from '@/features/saas/service'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '经纪工作台' } })

const appContextStore = useAppContextStore()
const plans = ref<SaaSPlan[]>([])
const loading = ref(true)
const loadError = ref('')
const switching = ref(false)
const openFaqIndex = ref<number | null>(0)
const heroScroll = ref(0)
const paidPlans = computed(() => plans.value.filter(plan => plan.code !== 'free'))
const hasOrganization = computed(() => appContextStore.organizations.length > 0)
const primaryActionText = computed(() => hasOrganization.value ? '查看套餐与用量' : '免费开通工作台')
const stageMotionStyle = computed(() => ({ transform: `translateY(${Math.min(44, heroScroll.value * 0.09)}px)` }))
const haloMotionStyle = computed(() => ({ transform: `translateY(${Math.min(32, heroScroll.value * 0.06)}px)` }))

const activationSteps = [
  { day: '第 1 天', title: '录入第一套房源', description: '填写楼栋、房态和房东信息。' },
  { day: '第 3 天', title: '让团队开始协作', description: '邀请成员并分配职责，减少重复沟通和信息断层。' },
  { day: '第 7 天', title: '完成首次带看或签约', description: '记录带看结果或签约信息，方便后续跟进。' },
]

const signalItems = ['房源状态集中查看', '客户跟进有记录', '带看排期更清晰', '签约履约可追踪', '经营数据随时查']

const sellingPoints = [
  { number: '01', icon: 'i-carbon-data-base', title: '一份资料，团队共享', description: '房源、房东与客户信息集中在同一工作台，方便成员查阅和更新。', caption: '减少多份表格反复核对' },
  { number: '02', icon: 'i-carbon-collaborate', title: '交接顺畅，进度清晰', description: '需求、带看安排和跟进记录沿着业务过程留存，新成员接手也能快速了解前因后果。', caption: '让协作少一点口头传递' },
  { number: '03', icon: 'i-carbon-chart-line', title: '经营记录，随时可查', description: '房源、带看和签约记录随日常工作保存，方便查看经营情况与近期变化。', caption: '了解业务进展与变化' },
]

const faqItems = [
  { question: '试用需要付费或绑定支付方式吗？', answer: '不需要。符合条件的新工作空间可享 14 天专业版试用，开通结果以创建后的提示为准。' },
  { question: '试用结束后还能继续使用吗？', answer: '可以。你可以购买适合的套餐，也可以继续使用免费版权益。' },
  { question: '连锁门店或特殊权限怎么购买？', answer: '企业版支持多门店、高级权限和接口集成，可提交需求后由销售跟进。' },
]

function formatMoney(amount: number) {
  return (amount / 100).toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function planPrice(plan: SaaSPlan) {
  return plan.prices.find(price => price.billing_cycle === 'year') || plan.prices[0]
}

function monthlyEquivalent(plan: SaaSPlan) {
  const price = planPrice(plan)
  if (!price || price.billing_cycle !== 'year')
    return ''
  return formatMoney(Math.round(price.amount / 12))
}

function planEyebrow(plan: SaaSPlan) {
  return ({ standard: '小型门店起步', professional: '成长团队首选', enterprise: '连锁与定制' } as Record<string, string>)[plan.code] || '灵活方案'
}

function planButtonText(plan: SaaSPlan) {
  if (plan.purchase_mode === 'sales_assisted')
    return '联系销售顾问'
  if (!hasOrganization.value)
    return `试用后选择${plan.name}`
  return `选择${plan.name}`
}

function quotaText(value: number | null | undefined, unit: string) {
  return value === null ? `不限${unit}` : `${value || 0}${unit}`
}

async function loadPlans() {
  loading.value = true
  loadError.value = ''
  try {
    plans.value = await listPublicSaaSPlans()
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '套餐加载失败'
  }
  finally {
    loading.value = false
  }
}

function startTrial() {
  const target = APP_ROUTES.saasOnboarding
  uni.navigateTo({ url: appContextStore.authenticated ? target : getLoginRoute(target) })
}

function scrollToPlans() {
  uni.pageScrollTo({ selector: '#saas-plans', duration: 280 })
}

function openFeature(feature: 'inventory' | 'clients' | 'contracts' | 'insights') {
  uni.navigateTo({ url: `${APP_ROUTES.saasFeature}?feature=${feature}` })
}

async function openCurrentSubscription() {
  const organizationSlug = appContextStore.organizationSlug || appContextStore.organizations[0]?.slug
  if (!organizationSlug || switching.value)
    return
  switching.value = true
  try {
    if (appContextStore.organizationSlug !== organizationSlug)
      await appContextStore.switchMode({ mode: 'organization', organizationSlug })
    uni.navigateTo({ url: APP_ROUTES.organizationAdminSubscription })
  }
  finally {
    switching.value = false
  }
}

async function primaryAction() {
  if (hasOrganization.value)
    await openCurrentSubscription()
  else
    startTrial()
}

async function openPlan(plan: SaaSPlan) {
  if (plan.purchase_mode === 'sales_assisted') {
    uni.navigateTo({ url: APP_ROUTES.saasEnterprise })
    return
  }
  if (!appContextStore.authenticated || !appContextStore.organizations.length) {
    startTrial()
    return
  }
  await openCurrentSubscription()
}

onShow(() => void loadPlans())
onPageScroll(({ scrollTop }) => {
  heroScroll.value = Math.min(680, Math.max(0, Math.round(scrollTop / 8) * 8))
})
</script>

<template>
  <view class="saas-page min-h-screen">
    <AppCustomNavigation title="" back immersive transparent />
    <view class="hero-shell relative overflow-hidden text-white">
      <view class="hero-grid pointer-events-none absolute top-3.5 h-96 w-80 -right-18" />
      <view class="hero-halo hero-halo--one pointer-events-none absolute h-96 w-96 border-hairline rounded-full border-solid -right-48 -top-28" :style="haloMotionStyle" />
      <view class="hero-halo hero-halo--two pointer-events-none absolute h-80 w-80 border-hairline rounded-full border-solid -right-36 -top-14" :style="haloMotionStyle" />
      <view class="hero-inner relative z-1 mx-auto my-0 box-border w-full px-4 pb-7">
        <view class="hero-overline flex items-center gap-1.5 text-size-3xs font-bold">
          <view class="live-dot h-1.5 w-1.5 rounded-full" />
          <text>LINKCLOUD SPACE / FOR AGENCIES</text>
        </view>
        <view class="hero-title mt-3.5 flex flex-col text-size-3xl font-extrabold leading-tight">
          <text>门店生意，</text>
          <text class="hero-title__accent">从此有章可循。</text>
        </view>
        <text class="hero-description mt-3.5 block text-size-xs leading-relaxed">告别在表格与聊天记录里来回找信息。房源、客户、带看与签约被连成一条清晰的业务线，每个人都知道下一步该做什么。</text>
        <view class="hero-actions mt-5 flex flex-wrap items-center gap-3">
          <button class="action-button action-button--blue relative m-0 box-border min-h-11 flex items-center justify-center gap-3 overflow-hidden border-0 rounded-xl px-4 py-0 text-size-xs font-extrabold" :disabled="switching" @click="primaryAction">
            <text>{{ primaryActionText }}</text>
            <view class="i-carbon-arrow-up-right" />
          </button>
          <button class="hero-link m-0 box-border flex items-center gap-1 border-0 bg-transparent p-0 text-size-xs" @click="scrollToPlans">
            了解方案 <view class="i-carbon-arrow-down" />
          </button>
        </view>
        <view class="hero-trust mt-3.5 flex flex-wrap gap-x-3.5 gap-y-2.5 text-size-2xs">
          <view><view class="i-carbon-checkmark" />符合条件可享 14 天专业版试用</view>
          <view><view class="i-carbon-checkmark" />无需技术配置</view>
          <view><view class="i-carbon-checkmark" />试用后可继续使用免费版</view>
        </view>

        <view class="product-stage relative mx-auto mb-0 mt-10" :style="stageMotionStyle">
          <view class="stage-label mb-2.5 flex items-center gap-1.5 text-size-2xs">
            <view class="stage-label__line w-3.5" />
            <text>一个屏幕，看见业务全貌</text>
            <text class="stage-label__index ml-auto">01 / 04</text>
          </view>
          <view class="dashboard-frame relative overflow-hidden border-hairline rounded-xl border-solid p-3.5">
            <view class="dashboard-scan pointer-events-none absolute left-0 right-0 top-0 z-1" />
            <view class="dashboard-topbar flex items-center justify-between gap-1">
              <view class="dashboard-brand flex items-center gap-1 text-size-3xs font-extrabold">
                <view class="dashboard-brand__mark h-3.5 w-3.5 flex items-center justify-center rounded text-size-3xs">
                  L
                </view><text>门店工作台</text>
              </view>
              <view class="dashboard-topbar__right flex items-center gap-1 text-size-3xs">
                <view class="dashboard-online h-1.5 w-1.5 rounded-full" /> 团队共享 <view class="i-carbon-overflow-menu-horizontal" />
              </view>
            </view>
            <view class="dashboard-greeting mx-0 mb-2.5 mt-4 flex items-center justify-between">
              <view><text>经营总览 · 界面示意</text><strong>每一步，都看得见。</strong></view>
              <view class="i-carbon-arrow-up-right" />
            </view>
            <view class="dashboard-metrics flex items-center gap-1.5">
              <view class="dashboard-metric dashboard-metric--main relative box-border min-h-16 min-w-0 flex flex-1 flex-col gap-0.5 overflow-hidden rounded-lg bg-white p-2.5">
                <text>在管房源</text><strong>128 <small>套</small></strong><view class="metric-spark absolute bottom-2 right-1.5 h-6 flex items-end gap-0.5 opacity-65">
                  <i /><i /><i /><i /><i /><i /><i />
                </view>
              </view>
              <view class="dashboard-metric relative box-border min-h-16 min-w-0 flex flex-1 flex-col gap-0.5 overflow-hidden rounded-lg bg-white p-2.5">
                <text>本周带看</text><strong>24 <small>次</small></strong><view class="dashboard-metric__trend mt-1 text-size-3xs">
                  ↗ 协作进行中
                </view>
              </view>
            </view>
            <view class="dashboard-activity mt-1.5 flex items-center gap-1.5 rounded-lg bg-white p-2">
              <view class="activity-icon i-carbon-notification h-4 w-4 flex flex-none items-center justify-center rounded text-size-2xs" />
              <view><strong>新的带看已安排</strong><text>客户、房源与负责人自动关联</text></view>
              <view class="activity-time">
                刚刚
              </view>
            </view>
          </view>
          <view class="stage-floating absolute flex items-center gap-1 border-hairline rounded-full border-solid px-2.5 py-1.5 text-size-3xs -bottom-3.5 -right-2">
            <view class="i-carbon-checkmark-filled" /><text>业务状态 · 已同步</text>
          </view>
        </view>
      </view>
      <view class="signal-strip relative z-1 mb-3.5 overflow-hidden border-b-hairline border-t-hairline border-b-solid border-t-solid px-0 py-2">
        <view class="signal-track w-max flex items-center">
          <view v-for="copy in 2" :key="copy" class="signal-group flex flex-none items-center">
            <view v-for="item in signalItems" :key="item" class="signal-item flex flex-none items-center gap-1.5 whitespace-nowrap pr-5 text-size-3xs font-semibold">
              <view class="signal-item__spark h-1 w-1" />{{ item }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="light-area relative px-0 -mt-3.5">
      <view class="content-width relative mx-auto my-0 box-border w-full px-3.5 py-0">
        <view class="section-intro capabilities-intro scroll-reveal flex flex-col items-start pt-12">
          <view class="section-index flex items-center gap-1.5 text-size-2xs font-bold">
            01 <view />
          </view>
          <text class="section-eyebrow mt-2 text-size-3xs font-extrabold">THE COMPLETE PICTURE</text>
          <strong>让复杂的业务，<br>变得一目了然。</strong>
          <text class="section-description mx-0 mb-4 mt-2.5 text-size-xs leading-relaxed">从第一套房源到每一次成交，所有信息在一处流转。不用反复切换工具，也不用靠记忆拼起业务全貌。</text>
        </view>

        <view class="feature-card feature-card--inventory scroll-reveal box-border flex flex-col gap-4 overflow-hidden border-hairline rounded-2xl border-solid bg-white p-4">
          <view class="feature-copy flex flex-col items-start">
            <view class="feature-icon feature-icon--blue i-carbon-building h-7 w-7 flex items-center justify-center rounded-lg text-size-sm" />
            <text class="feature-number mt-3.5 text-size-3xs font-extrabold">01 / 房源管理</text>
            <strong>每套房源，<br>都在掌控之中。</strong>
            <text>小区、楼栋、房态与业主资料统一归档。招租中、已出租、暂不出租的状态清清楚楚，减少重复询问与无效带看。</text>
            <button class="feature-detail-link mx-0 mb-0 mt-2.5 box-border flex items-center justify-start gap-1 border-0 bg-transparent px-0 py-1 text-left text-size-2xs font-extrabold" @click="openFeature('inventory')">
              查看房源管理详情 <view class="i-carbon-arrow-up-right" />
            </button>
          </view>
          <view class="inventory-visual rounded-lg p-3">
            <view class="inventory-visual__header mb-2.5 flex items-center justify-between text-size-2xs font-bold">
              <text>房源状态</text><view><i /> 集中查看</view>
            </view>
            <view class="inventory-visual__grid grid grid-cols-3 gap-1">
              <view class="room room--active flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>8F · 801</text><strong>待带看</strong>
              </view>
              <view class="room flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>8F · 802</text><strong>暂不出租</strong>
              </view>
              <view class="room room--occupied flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>8F · 803</text><strong>已出租</strong>
              </view>
              <view class="room flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>7F · 701</text><strong>暂不出租</strong>
              </view>
              <view class="room room--active flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>7F · 702</text><strong>待带看</strong>
              </view>
              <view class="room room--occupied flex flex-col gap-1 rounded bg-white px-1 py-1.5">
                <text>7F · 703</text><strong>已出租</strong>
              </view>
            </view>
          </view>
        </view>

        <view class="feature-pair scroll-reveal grid grid-cols-2 mt-2 gap-2">
          <view class="feature-card feature-card--client box-border min-h-48 flex flex-col items-start overflow-hidden border-hairline rounded-2xl border-solid bg-white p-3">
            <view class="feature-icon feature-icon--sky i-carbon-user-multiple h-7 w-7 flex items-center justify-center rounded-lg text-size-sm" />
            <text class="feature-number mt-3.5 text-size-3xs font-extrabold">02 / 客户与带看</text>
            <strong>跟进不断线。</strong>
            <text>需求、带看排期与跟进记录连在一起；下一次联系客户，知道上一次聊到了哪里。</text>
            <button class="feature-detail-link mx-0 mb-0 mt-2.5 box-border flex items-center justify-start gap-1 border-0 bg-transparent px-0 py-1 text-left text-size-2xs font-extrabold" @click="openFeature('clients')">
              了解客户协作 <view class="i-carbon-arrow-up-right" />
            </button>
            <view class="client-visual mt-auto w-full flex items-center pt-3">
              <view class="client-avatar h-5 w-5 flex flex-none items-center justify-center rounded-full text-size-3xs font-extrabold">
                客
              </view><view class="client-visual__line relative flex-1">
                <i /><i />
              </view><view class="client-avatar client-avatar--accent h-5 w-5 flex flex-none items-center justify-center rounded-full text-size-3xs text-white font-extrabold">
                <view class="i-carbon-calendar" />
              </view>
            </view>
          </view>
          <view class="feature-card feature-card--contract box-border min-h-48 flex flex-col items-start overflow-hidden border-hairline rounded-2xl border-solid bg-white p-3">
            <view class="feature-icon feature-icon--indigo i-carbon-document-signed h-7 w-7 flex items-center justify-center rounded-lg text-size-sm" />
            <text class="feature-number mt-3.5 text-size-3xs font-extrabold">03 / 签约与租约</text>
            <strong>成交有迹可循。</strong>
            <text>成交登记、合同资料和租约进度都有迹可循，关键节点不再散落在聊天里。</text>
            <button class="feature-detail-link mx-0 mb-0 mt-2.5 box-border flex items-center justify-start gap-1 border-0 bg-transparent px-0 py-1 text-left text-size-2xs font-extrabold" @click="openFeature('contracts')">
              了解签约租约 <view class="i-carbon-arrow-up-right" />
            </button>
            <view class="contract-visual relative mt-auto box-border h-9 rounded px-2.5 py-2">
              <view class="contract-visual__line mb-1 h-0.5 rounded-sm" /><view class="contract-visual__line contract-visual__line--short mb-1 h-0.5 rounded-sm" /><view class="contract-visual__stamp i-carbon-checkmark absolute h-5 w-5 flex items-center justify-center rounded-full text-size-xs -bottom-2 -right-1" />
            </view>
          </view>
        </view>

        <view class="feature-card feature-card--insight scroll-reveal mt-2 box-border flex flex-col gap-2 overflow-hidden border-hairline rounded-2xl border-solid bg-white p-4">
          <view class="insight-content flex flex-col items-start">
            <view class="feature-icon feature-icon--violet i-carbon-chart-line h-7 w-7 flex items-center justify-center rounded-lg text-size-sm" />
            <text class="feature-number mt-3.5 text-size-3xs font-extrabold">04 / 经营分析</text>
            <strong>用数据，读懂门店下一步。</strong>
            <text>查看房源浏览、咨询点击、预约和签约记录，了解所选时间内的业务变化。</text>
            <button class="feature-detail-link feature-detail-link--light mx-0 mb-0 mt-2.5 box-border flex items-center justify-start gap-1 border-0 bg-transparent px-0 py-1 text-left text-size-2xs font-extrabold" @click="openFeature('insights')">
              查看经营分析功能 <view class="i-carbon-arrow-up-right" />
            </button>
          </view>
          <view class="insight-visual relative mt-2 h-24 overflow-hidden border-hairline rounded-lg border-solid">
            <view class="insight-grid absolute inset-0" /><view class="insight-bars absolute bottom-0 left-3.5 right-3.5 h-20 flex items-end justify-between gap-1">
              <i /><i /><i /><i /><i /><i />
            </view><view class="insight-trend absolute left-2 top-2 flex items-center gap-0.5 rounded p-1 text-size-3xs">
              <view class="i-carbon-chart-line" /> 趋势清晰可见
            </view>
          </view>
        </view>

        <view class="benefits-section scroll-reveal mt-9 overflow-hidden border-hairline rounded-2xl border-solid px-4 pb-3 pt-5">
          <view class="benefits-heading flex flex-col items-start">
            <text class="section-eyebrow mt-2 text-size-3xs font-extrabold">LESS FRICTION. MORE MOMENTUM.</text>
            <strong>把琐碎留给系统，<br>把精力留给成交。</strong>
            <text>不只是把资料放到线上，更是让门店的每一次协作都接得上。</text>
          </view>
          <view class="benefits-list mt-3.5 border-t-hairline border-t-solid">
            <view v-for="point in sellingPoints" :key="point.number" class="benefit-item flex gap-2.5 border-b-hairline border-b-solid px-0 py-3.5">
              <view class="benefit-item__number w-4 flex-none pt-1.5 text-size-2xs font-extrabold">
                {{ point.number }}
              </view>
              <view class="benefit-item__body min-w-0 flex flex-1 flex-col items-start">
                <view class="benefit-item__icon h-6 w-6 flex items-center justify-center rounded-md text-size-xs" :class="point.icon" />
                <strong>{{ point.title }}</strong>
                <text>{{ point.description }}</text>
                <view class="benefit-item__caption mt-2 flex items-center gap-0.5 text-size-3xs font-bold">
                  <view class="i-carbon-arrow-up-right" />{{ point.caption }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="journey-section scroll-reveal relative mt-9 overflow-hidden rounded-2xl px-4 py-6 text-white">
          <view class="journey-glow absolute h-64 w-64 rounded-full -right-28 -top-28" />
          <view class="journey-heading relative flex flex-col items-start">
            <text class="section-eyebrow mt-2 text-size-3xs font-extrabold">START SMALL. MOVE FAST.</text>
            <strong>7 天，跑通第一条<br>真实业务线。</strong>
            <text>从录入第一套房源到完成第一次带看或签约，按真实业务节奏逐步启动，不必一次学会所有功能。</text>
          </view>
          <view class="journey-steps relative mt-5">
            <view v-for="(step, index) in activationSteps" :key="step.day" class="journey-step flex gap-2">
              <view class="journey-step__rail w-5 flex flex-none flex-col items-center">
                <view class="journey-step__node h-5 w-5 flex flex-none items-center justify-center border-hairline rounded-full border-solid text-size-2xs font-extrabold">
                  {{ index + 1 }}
                </view><view v-if="index < activationSteps.length - 1" class="journey-step__line mx-0 my-1 min-h-10 flex-1" />
              </view>
              <view class="journey-step__content flex flex-col gap-0.5 pb-4">
                <text>{{ step.day }}</text><strong>{{ step.title }}</strong><text>{{ step.description }}</text>
              </view>
            </view>
          </view>
          <view class="journey-foot relative mt-1 flex items-center gap-1.5 border-hairline rounded-md border-solid p-2.5 text-size-3xs">
            <view class="i-carbon-gift" /> 符合条件的新工作空间可享 14 天专业版试用
          </view>
        </view>

        <view id="saas-plans" class="section-intro plans-intro scroll-reveal flex flex-col items-start pt-11">
          <view class="section-index flex items-center gap-1.5 text-size-2xs font-bold">
            02 <view />
          </view>
          <text class="section-eyebrow mt-2 text-size-3xs font-extrabold">A PLAN THAT GROWS WITH YOU</text>
          <strong>按自己的节奏，<br>选择合适的方案。</strong>
          <text class="section-description mx-0 mb-4 mt-2.5 text-size-xs leading-relaxed">先试用，再决定。付费方案按年计费，也能按团队成长逐步升级。</text>
        </view>
        <AppLoading v-if="loading" text="正在加载套餐…" />
        <AppErrorView v-else-if="loadError" title="套餐加载失败" :message="loadError" @retry="loadPlans" />
        <view v-else class="plan-list grid gap-2">
          <view v-for="plan in paidPlans" :key="plan.code" class="plan-card scroll-reveal relative min-w-0 flex flex-col border-hairline rounded-xl border-solid bg-white p-3.5" :class="{ 'plan-card--recommended': plan.code === 'professional' }">
            <view class="plan-card__topline min-h-4 flex items-center justify-between gap-1.5 text-size-3xs font-extrabold">
              <text>{{ planEyebrow(plan) }}</text><view v-if="plan.code === 'professional'" class="plan-recommend flex items-center gap-0.5 rounded-full px-1.5 py-1 text-size-3xs">
                <view class="i-carbon-star-filled" /> 热门选择
              </view>
            </view>
            <view class="plan-heading mt-1.5 flex flex-col gap-1">
              <strong>{{ plan.name }}</strong><text>{{ plan.description }}</text>
            </view>
            <view v-if="plan.purchase_mode === 'self_service' && planPrice(plan)" class="plan-price mx-0 my-2 min-h-14 flex flex-col justify-center gap-0.5">
              <view><text>¥</text><strong>{{ formatMoney(planPrice(plan)!.amount) }}</strong><text>/ 年</text></view><text v-if="monthlyEquivalent(plan)" class="plan-monthly text-size-2xs">折合约 ¥{{ monthlyEquivalent(plan) }} / 月</text>
            </view>
            <view v-else class="plan-price plan-price--custom mx-0 my-2 min-h-14 flex flex-col justify-center gap-0.5">
              <strong>按需报价</strong><text class="plan-monthly text-size-2xs">为连锁门店定制专属方案</text>
            </view>
            <view v-if="plan.entitlement" class="plan-facts flex flex-col gap-0.5 border-t-hairline border-t-solid px-0 py-2">
              <view><view class="i-carbon-user-multiple" /><text>成员账号</text><strong>{{ quotaText(plan.entitlement.member_limit, '人') }}</strong></view>
              <view><view class="i-carbon-collaborate" /><text>协作团队</text><strong>{{ quotaText(plan.entitlement.team_limit, '个') }}</strong></view>
              <view><view class="i-carbon-building" /><text>房源容量</text><strong>{{ quotaText(plan.entitlement.house_limit, '套') }}</strong></view>
            </view>
            <button class="plan-action mx-0 mb-0 mt-auto box-border min-h-10 w-full flex items-center justify-between border-0 rounded-lg px-3 py-0 text-left text-size-xs font-extrabold" :disabled="switching" @click="openPlan(plan)">
              <text>{{ planButtonText(plan) }}</text><view class="i-carbon-arrow-up-right" />
            </button>
          </view>
        </view>

        <view class="faq-section scroll-reveal px-0 pb-8 pt-11">
          <view class="faq-heading flex flex-col gap-2">
            <text class="section-eyebrow mt-2 text-size-3xs font-extrabold">GOOD TO KNOW</text><strong>你可能还想知道</strong>
          </view>
          <view class="faq-list mt-3.5 border-t-hairline border-t-solid">
            <view v-for="(item, index) in faqItems" :key="item.question" class="faq-item border-b-hairline border-b-solid px-0 py-3.5" :class="{ 'faq-item--open': openFaqIndex === index }" @click="openFaqIndex = openFaqIndex === index ? null : index">
              <view class="faq-question flex items-center justify-between gap-2">
                <strong>{{ item.question }}</strong><view :class="openFaqIndex === index ? 'i-carbon-subtract' : 'i-carbon-add'" />
              </view>
              <text v-if="openFaqIndex === index">{{ item.answer }}</text>
            </view>
          </view>
        </view>

        <view class="closing-card scroll-reveal relative flex flex-col items-start overflow-hidden rounded-2xl px-4 py-6 text-white">
          <view class="closing-card__orb absolute h-64 w-64 border-hairline rounded-full border-solid -bottom-28 -right-24" /><text>YOUR NEXT CHAPTER STARTS HERE</text><strong>从今天开始，<br>让生意更有序。</strong><button class="action-button action-button--blue relative m-0 box-border min-h-11 flex items-center justify-center gap-3 overflow-hidden border-0 rounded-xl px-4 py-0 text-size-xs font-extrabold" :disabled="switching" @click="primaryAction">
            <text>{{ primaryActionText }}</text><view class="i-carbon-arrow-up-right" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.saas-page {
  background: #07152e;
  color: #172641;
}
.saas-page :deep(.app-custom-navigation) {
  @apply bg-transparent pointer-events-none m-0;
  --app-text-primary: #fff;
}
.saas-page :deep(.app-custom-navigation__back) {
  @apply text-white pointer-events-auto;
  background: rgb(10 34 76 / 86%);
}
.hero-shell {
  background:
    radial-gradient(ellipse at 84% 18%, #275593 0, transparent 34%),
    linear-gradient(155deg, #07152e 0%, #0c2b58 57%, #0a1d3e 100%);
}
.hero-shell::before {
  @apply absolute -top-24 -right-32 w-80 h-80 rounded-full pointer-events-none;
  background: radial-gradient(circle, rgb(62 132 255 / 28%), transparent 68%);
  content: '';
  animation: hero-glow 9s ease-in-out infinite alternate;
}
.hero-grid {
  background-image:
    linear-gradient(rgb(134 191 255 / 9%) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgb(134 191 255 / 9%) 1rpx, transparent 1rpx);
  background-size: 68rpx 68rpx;
  transform: rotate(-12deg);
  animation: grid-drift 15s ease-in-out infinite alternate;
}
.hero-inner,
.content-width {
  max-width: 980px;
}
.hero-inner {
  padding-top: calc(160rpx + env(safe-area-inset-top));
}
.hero-halo {
  border-color: rgb(124 190 255 / 9%);
}
.hero-overline {
  color: #9bd3ff;
  letter-spacing: 2.2rpx;
  animation: hero-rise 700ms ease-out both;
}
.live-dot,
.dashboard-online {
  background: #7cc8ff;
  box-shadow: 0 0 0 7rpx rgb(124 200 255 / 11%);
}
.live-dot {
  animation: live-pulse 2.8s ease-in-out infinite;
}
.hero-title {
  letter-spacing: -3rpx;
  animation: hero-rise 780ms 100ms ease-out both;
}
.hero-title__accent {
  color: #7cc8ff;
  text-shadow: 0 0 45rpx rgb(124 200 255 / 21%);
}
.hero-description {
  max-width: 650rpx;
  color: #b9cce5;
  animation: hero-rise 780ms 200ms ease-out both;
}
.hero-actions {
  animation: hero-rise 780ms 300ms ease-out both;
}
button {
  font-family: inherit;
  font-style: inherit;
  line-height: normal;
}
button::after {
  @apply border-0;
}
.action-button {
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}
.action-button--blue {
  color: #08294d;
  background: #7cc8ff;
  box-shadow: 0 16rpx 38rpx rgb(50 145 255 / 17%);
}
.action-button--blue::before {
  @apply absolute pointer-events-none;
  top: -35%;
  left: -45%;
  width: 35%;
  height: 170%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 47%), transparent);
  content: '';
  transform: rotate(22deg);
  animation: button-glint 5.5s ease-in-out infinite;
}
.action-button:active,
.plan-action:active {
  transform: scale(0.97);
}
.action-button .i-carbon-arrow-up-right {
  @apply text-size-base;
}
.hero-link {
  color: #dcecff;
}
.hero-link .i-carbon-arrow-down {
  @apply text-size-xs;
}
.hero-trust {
  color: #a7bdd8;
  animation: hero-rise 780ms 400ms ease-out both;
}
.hero-trust > view {
  @apply flex items-center gap-1;
}
.hero-trust .i-carbon-checkmark {
  @apply text-size-2xs;
  color: #7cc8ff;
}
.product-stage {
  max-width: 710rpx;
  animation: stage-appear 850ms 450ms ease-out both;
}
.signal-strip {
  border-top-color: rgb(124 200 255 / 16%);
  border-bottom-color: rgb(124 200 255 / 16%);
  background: rgb(7 22 51 / 46%);
}
.signal-track {
  animation: signal-drift 29s linear infinite;
}
.signal-item {
  color: #a9c8ed;
  letter-spacing: 1rpx;
}
.signal-item__spark {
  background: #7cc8ff;
  box-shadow: 0 0 12rpx rgb(124 200 255 / 72%);
  transform: rotate(45deg);
}
.stage-label {
  color: #acc4df;
  letter-spacing: 1rpx;
}
.stage-label__line {
  height: 2rpx;
  background: #7cc8ff;
}
.stage-label__index {
  color: #7f9bbc;
}
.dashboard-frame {
  border-color: rgb(255 255 255 / 20%);
  background: linear-gradient(135deg, rgb(244 249 255 / 98%), #eaf3ff);
  box-shadow: 0 30rpx 70rpx rgb(0 0 0 / 30%);
  color: #17365d;
  transform: rotate(-2deg);
  animation: dashboard-open 900ms 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.dashboard-scan {
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgb(69 158 255 / 48%), transparent);
  box-shadow: 0 0 25rpx 8rpx rgb(69 158 255 / 7%);
  animation: dashboard-scan 5.8s 1.4s ease-in-out infinite;
}
.dashboard-brand__mark {
  color: #deefff;
  background: #164e95;
}
.dashboard-topbar__right {
  color: #708aaa;
}
.dashboard-topbar__right .dashboard-online {
  @apply w-1 h-1;
  box-shadow: none;
}
.dashboard-topbar__right .i-carbon-overflow-menu-horizontal {
  @apply ml-1.5 text-size-sm;
}
.dashboard-greeting > view:first-child {
  @apply flex flex-col gap-0.5;
}
.dashboard-greeting text {
  @apply text-size-3xs;
  color: #7b91ad;
}
.dashboard-greeting strong {
  @apply text-size-sm;
}
.dashboard-greeting > .i-carbon-arrow-up-right {
  @apply flex w-5 h-5 items-center justify-center rounded-full text-size-xs;
  color: #2b6fc7;
  background: #dbeeff;
}
.dashboard-metric--main {
  color: #e2f2ff;
  background: linear-gradient(140deg, #185eaa, #163e82);
}
.dashboard-metric > text {
  @apply text-size-3xs;
}
.dashboard-metric:not(.dashboard-metric--main) > text {
  color: #879ab3;
}
.dashboard-metric strong {
  @apply text-size-xl;
  line-height: 1.15;
}
.dashboard-metric strong small {
  @apply text-size-3xs font-medium;
}
.metric-spark i {
  @apply w-1 origin-bottom;
  height: 40%;
  border-radius: 4rpx 4rpx 0 0;
  background: #9ed9ff;
  animation: bar-grow 750ms 1.1s ease-out both;
}
.metric-spark i:nth-child(2),
.metric-spark i:nth-child(5) {
  height: 65%;
}
.metric-spark i:nth-child(3),
.metric-spark i:nth-child(7) {
  height: 85%;
}
.metric-spark i:nth-child(4) {
  height: 55%;
}
.dashboard-metric__trend {
  color: #287ac8;
}
.activity-icon {
  color: #2877ca;
  background: #e5f2ff;
}
.dashboard-activity > view:nth-child(2) {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}
.dashboard-activity strong {
  @apply text-size-3xs;
}
.dashboard-activity text,
.activity-time {
  @apply text-size-3xs;
  color: #96a9bd;
}
.stage-floating {
  border-color: rgb(255 255 255 / 17%);
  background: #143e78;
  box-shadow: 0 14rpx 30rpx rgb(0 0 0 / 26%);
  color: #d9efff;
  transform: rotate(3deg);
  animation: float-chip 3.8s ease-in-out infinite;
}
.stage-floating .i-carbon-checkmark-filled {
  @apply text-size-xs;
}
.light-area {
  padding-top: 1rpx;
  padding-bottom: calc(70rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #f5f8fd;
}
.section-index {
  color: #a4b3c9;
}
.section-index > view {
  @apply w-6;
  height: 1rpx;
  background: #b4c4d9;
}
.section-eyebrow {
  color: #2d70c6;
  letter-spacing: 2rpx;
}
.section-intro > strong {
  @apply mt-2.5 text-size-2xl font-extrabold leading-tight;
  letter-spacing: -2rpx;
}
.section-description {
  max-width: 650rpx;
  color: #718199;
}
.feature-card {
  border-color: #e2eaf5;
  box-shadow: 0 12rpx 30rpx rgb(28 66 125 / 4%);
}
.feature-icon--blue {
  color: #246fcb;
  background: #e5f1ff;
}
.feature-icon--sky {
  color: #307bd3;
  background: #e9f4ff;
}
.feature-icon--indigo {
  color: #7774cf;
  background: #f0efff;
}
.feature-icon--violet {
  color: #a9d8ff;
  background: rgb(145 191 255 / 16%);
}
.feature-number {
  color: #5d83b8;
  letter-spacing: 1rpx;
}
.feature-copy strong,
.feature-card--client strong,
.feature-card--contract strong,
.insight-content strong {
  @apply mt-1.5 text-size-base font-extrabold leading-tight;
  color: #1a2c4b;
  letter-spacing: -1rpx;
}
.feature-copy > text:nth-of-type(2),
.feature-card--client > text:nth-of-type(2),
.feature-card--contract > text:nth-of-type(2),
.insight-content > text:nth-of-type(2) {
  @apply mt-1.5 text-size-2xs leading-relaxed;
  color: #7989a1;
}
.feature-detail-link {
  color: #276fc1;
  transition: transform 180ms ease;
}
.feature-detail-link .i-carbon-arrow-up-right {
  @apply text-size-xs;
}
.feature-detail-link:active {
  transform: translateX(5rpx);
}
.inventory-visual {
  background: #eff5fd;
}
.inventory-visual__header {
  color: #2a4262;
}
.inventory-visual__header > view {
  @apply flex items-center gap-1 text-size-3xs font-medium;
  color: #5f8cbd;
}
.inventory-visual__header i {
  @apply w-1 h-1 rounded-full;
  background: #4394e8;
}
.room text {
  @apply text-size-3xs;
  color: #8b9bb1;
}
.room strong {
  @apply text-size-3xs;
  color: #435c7c;
}
.room--active {
  background: #e0efff;
}
.room--active strong {
  color: #236ebd;
}
.room--occupied {
  background: #e9eef5;
}
.room--occupied strong {
  color: #8998ac;
}
.feature-card--client .feature-number,
.feature-card--contract .feature-number {
  @apply mt-2.5 text-size-3xs;
}
.feature-card--client strong,
.feature-card--contract strong {
  @apply text-size-xs;
}
.feature-card--client > text:nth-of-type(2),
.feature-card--contract > text:nth-of-type(2) {
  @apply text-size-3xs;
}
.feature-card--client .feature-detail-link,
.feature-card--contract .feature-detail-link {
  @apply text-size-3xs;
}
.client-avatar {
  color: #2b70c1;
  background: #dfedff;
}
.client-avatar--accent {
  background: #337fcf;
}
.client-avatar--accent .i-carbon-calendar {
  @apply text-size-2xs;
}
.client-visual__line {
  height: 1rpx;
  background: #b8d8f9;
}
.client-visual__line i {
  @apply absolute -top-0.5 w-1 h-1 rounded-full;
  left: 30%;
  background: #529fe8;
}
.client-visual__line i:nth-child(2) {
  left: 70%;
}
.contract-visual {
  width: 85%;
  background: #f1f0ff;
  transform: rotate(-5deg);
}
.contract-visual__line {
  width: 65%;
  background: #d7d3f2;
}
.contract-visual__line--short {
  width: 43%;
}
.contract-visual__stamp {
  border: 3rpx solid #9d92df;
  color: #8074c7;
  transform: rotate(15deg);
}
.feature-card--insight {
  border-color: #2b4474;
  background: linear-gradient(135deg, #1b396d, #11254e);
}
.insight-content .feature-number {
  color: #a9c4e6;
}
.insight-content strong {
  @apply text-white;
}
.insight-content > text:nth-of-type(2) {
  color: #b7c8df;
}
.feature-detail-link--light {
  color: #a4d7ff;
}
.insight-visual {
  border-color: rgb(255 255 255 / 12%);
  background: linear-gradient(180deg, rgb(147 202 255 / 8%), transparent);
}
.insight-grid {
  background: repeating-linear-gradient(
    to top,
    transparent 0,
    transparent 48rpx,
    rgb(255 255 255 / 8%) 49rpx,
    rgb(255 255 255 / 8%) 50rpx
  );
}
.insight-bars i {
  @apply origin-bottom;
  width: 12%;
  height: 38%;
  border-radius: 7rpx 7rpx 0 0;
  background: linear-gradient(180deg, #a7dcff, #3f83e3);
}
.insight-bars i:nth-child(2) {
  height: 55%;
}
.insight-bars i:nth-child(3) {
  height: 45%;
}
.insight-bars i:nth-child(4) {
  height: 74%;
}
.insight-bars i:nth-child(5) {
  height: 63%;
}
.insight-bars i:nth-child(6) {
  height: 94%;
}
.insight-trend {
  color: #d9efff;
  background: #254b86;
}
.benefits-section {
  border-color: #d9e7fa;
  background: linear-gradient(145deg, #e8f2ff, #ffffff 42%, #f7faff);
  box-shadow: 0 18rpx 46rpx rgb(34 92 183 / 7%);
}
.benefits-heading .section-eyebrow {
  @apply mt-0;
}
.benefits-heading strong {
  @apply mt-2 text-size-lg font-extrabold leading-snug;
  color: #162b55;
  letter-spacing: -1rpx;
}
.benefits-heading > text:last-child {
  @apply mt-2 text-size-2xs leading-relaxed;
  color: #7285a2;
}
.benefits-list {
  border-top-color: #dce8f7;
}
.benefit-item {
  border-bottom-color: #dce8f7;
}
.benefit-item:last-child {
  @apply border-b-0;
}
.benefit-item__number {
  color: #548ad4;
}
.benefit-item__icon {
  color: #2473c7;
  background: #e4f1ff;
}
.benefit-item__body strong {
  @apply mt-1.5 text-size-xs font-extrabold;
  color: #19385f;
}
.benefit-item__body > text {
  @apply mt-1 text-size-2xs leading-relaxed;
  color: #71839e;
}
.benefit-item__caption {
  color: #2873bf;
}
.benefit-item__caption .i-carbon-arrow-up-right {
  @apply text-size-2xs;
}
.journey-section {
  background: #102b60;
}
.journey-glow {
  background: radial-gradient(circle, rgb(70 136 245 / 28%), transparent 68%);
}
.journey-heading .section-eyebrow {
  @apply mt-0;
  color: #7cc8ff;
}
.journey-heading strong {
  @apply mt-2 text-size-lg leading-snug;
}
.journey-heading > text:last-child {
  @apply mt-1.5 text-size-2xs leading-relaxed;
  color: #b9cce4;
}
.journey-step__node {
  border-color: #7bbdff;
  color: #7cc8ff;
}
.journey-step__line {
  width: 1rpx;
  background: rgb(124 200 255 / 30%);
}
.journey-step__content text:first-child {
  @apply text-size-3xs font-bold;
  color: #7cc8ff;
}
.journey-step__content strong {
  @apply text-size-xs;
}
.journey-step__content text:last-child {
  @apply text-size-3xs leading-normal;
  color: #afc2dd;
}
.journey-foot {
  border-color: rgb(124 200 255 / 22%);
  color: #d9efff;
  background: rgb(124 200 255 / 7%);
}
.journey-foot .i-carbon-gift {
  @apply text-size-xs;
}
.plan-card {
  border-color: #e1eaf5;
  box-shadow: 0 10rpx 29rpx rgb(31 73 141 / 4%);
}
.plan-card--recommended {
  border-color: #75b7ff;
  background: linear-gradient(180deg, #ecf5ff, #fff 250rpx);
  box-shadow: 0 16rpx 40rpx rgb(54 118 215 / 11%);
}
.plan-card__topline {
  color: #337bd0;
  letter-spacing: 1rpx;
}
.plan-recommend {
  color: #205da9;
  background: #deeeff;
  letter-spacing: 0;
}
.plan-heading strong {
  @apply text-size-base;
  color: #1c3153;
}
.plan-heading text {
  @apply text-size-2xs leading-normal;
  color: #8392a7;
}
.plan-price {
  color: #163867;
}
.plan-price > view {
  @apply flex items-baseline gap-0.5;
}
.plan-price > view text:first-child {
  @apply text-size-xs font-extrabold;
}
.plan-price strong {
  @apply text-size-2xl font-extrabold;
  line-height: 1.1;
}
.plan-price > view text:last-child {
  @apply text-size-2xs;
  color: #8496ae;
}
.plan-monthly {
  color: #8e9eb5;
}
.plan-price--custom strong {
  @apply text-size-lg;
}
.plan-facts {
  border-top-color: #eaf0f7;
}
.plan-facts > view {
  @apply flex items-center min-h-6 gap-1.5 text-size-2xs;
  color: #788ca7;
}
.plan-facts > view > view {
  @apply text-size-xs;
  color: #327bcb;
}
.plan-facts strong {
  @apply ml-auto text-size-2xs;
  color: #233a61;
}
.plan-action {
  color: #1b57a2;
  background: #e6f1ff;
}
.plan-card--recommended .plan-action {
  @apply text-white;
  background: #1757ad;
}
.plan-action .i-carbon-arrow-up-right {
  @apply text-size-xs;
}
.faq-heading .section-eyebrow {
  @apply m-0;
}
.faq-heading strong {
  @apply text-size-lg;
}
.faq-list {
  border-top-color: #dfe8f3;
}
.faq-item {
  border-bottom-color: #dfe8f3;
}
.faq-question strong {
  @apply text-size-xs leading-snug;
}
.faq-question > view {
  @apply flex w-5 h-5 flex-none items-center justify-center rounded-full text-size-xs;
  color: #315d94;
  background: #e8f1fb;
}
.faq-item > text {
  @apply block mt-2 text-size-2xs leading-relaxed;
  max-width: 600rpx;
  color: #72849e;
}
.closing-card {
  background: #0d2857;
}
.closing-card__orb {
  border-color: rgb(124 200 255 / 18%);
  box-shadow:
    0 0 0 70rpx rgb(124 200 255 / 3%),
    0 0 0 140rpx rgb(124 200 255 / 3%);
}
.closing-card > text {
  @apply relative text-size-3xs font-bold;
  color: #a1d4ff;
  letter-spacing: 2rpx;
}
.closing-card > strong {
  @apply relative mt-3 mb-4 text-size-xl leading-tight mx-0;
}
.closing-card .action-button {
  @apply relative min-h-9 text-size-2xs;
}
button[disabled] {
  @apply opacity-60;
}
@keyframes hero-rise {
  from {
    opacity: 0;
    transform: translateY(26rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes hero-glow {
  from {
    opacity: 0.55;
    transform: translate(-20rpx, -20rpx) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-90rpx, 70rpx) scale(1.12);
  }
}
@keyframes grid-drift {
  from {
    transform: rotate(-12deg) translateY(0);
  }
  to {
    transform: rotate(-12deg) translateY(-60rpx);
  }
}
@keyframes live-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 5rpx rgb(124 200 255 / 10%);
  }
  50% {
    box-shadow: 0 0 0 12rpx rgb(124 200 255 / 3%);
  }
}
@keyframes stage-appear {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes dashboard-open {
  from {
    opacity: 0;
    transform: rotate(-6deg) translateY(42rpx) scale(0.92);
  }
  to {
    opacity: 1;
    transform: rotate(-2deg) translateY(0) scale(1);
  }
}
@keyframes dashboard-scan {
  0%,
  12% {
    top: 0;
    opacity: 0;
  }
  20% {
    opacity: 0.7;
  }
  62% {
    top: 100%;
    opacity: 0.55;
  }
  72%,
  100% {
    top: 100%;
    opacity: 0;
  }
}
@keyframes float-chip {
  0%,
  100% {
    transform: rotate(3deg) translateY(0);
  }
  50% {
    transform: rotate(3deg) translateY(-9rpx);
  }
}
@keyframes button-glint {
  0%,
  48%,
  100% {
    left: -45%;
    opacity: 0;
  }
  54% {
    opacity: 0.7;
  }
  75% {
    left: 125%;
    opacity: 0;
  }
}
@keyframes bar-grow {
  from {
    transform: scaleY(0.1);
  }
  to {
    transform: scaleY(1);
  }
}
@keyframes signal-drift {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
@keyframes saas-reveal {
  from {
    opacity: 0.25;
    transform: translateY(28rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@supports (animation-timeline: view()) {
  .scroll-reveal {
    animation-name: saas-reveal;
    animation-duration: 1s;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: view();
    animation-range: entry 0% cover 24%;
  }
  .insight-bars i {
    animation-name: bar-grow;
    animation-duration: 1s;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: view();
    animation-range: entry 0% cover 35%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero-shell::before,
  .hero-grid,
  .live-dot,
  .hero-overline,
  .hero-title,
  .hero-description,
  .hero-actions,
  .hero-trust,
  .dashboard-frame,
  .dashboard-scan,
  .metric-spark i,
  .stage-floating,
  .signal-track,
  .insight-bars i,
  .action-button--blue::before {
    animation: none !important;
  }
  .hero-halo,
  .product-stage {
    animation: none !important;
    transform: none !important;
  }
  .scroll-reveal {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
@media (min-width: 900px) {
  .hero-inner {
    @apply grid grid-cols-2 gap-y-0 gap-x-9 items-center pt-18 pb-16 px-6;
  }
  .hero-overline,
  .hero-title,
  .hero-description,
  .hero-actions,
  .hero-trust {
    @apply col-start-1;
  }
  .product-stage {
    @apply w-full m-0 col-start-2 row-start-1 row-span-5;
  }
  .light-area {
    @apply -mt-5;
  }
  .content-width {
    @apply py-0 px-6;
  }
  .feature-card--inventory {
    @apply flex-row items-center;
  }
  .feature-copy,
  .inventory-visual {
    @apply flex-1;
  }
  .feature-pair {
    @apply gap-2.5;
  }
  .feature-card--client,
  .feature-card--contract {
    @apply min-h-40;
  }
  .feature-card--insight {
    @apply flex-row items-center;
  }
  .benefits-list {
    @apply grid grid-cols-3;
  }
  .benefit-item {
    @apply border-r-hairline border-r-solid border-b-0 py-3.5 px-2.5;
    border-right-color: #dce8f7;
  }
  .benefit-item:last-child {
    @apply border-r-0;
  }
  .insight-content,
  .insight-visual {
    @apply flex-1;
  }
  .plan-list {
    @apply grid-cols-3;
  }
}
</style>
