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

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '中介 SaaS' } })

const appContextStore = useAppContextStore()
const plans = ref<SaaSPlan[]>([])
const loading = ref(true)
const loadError = ref('')
const switching = ref(false)
const openFaqIndex = ref<number | null>(0)
const heroScroll = ref(0)
const paidPlans = computed(() => plans.value.filter(plan => plan.code !== 'free'))
const hasOrganization = computed(() => appContextStore.organizations.length > 0)
const primaryActionText = computed(() => hasOrganization.value ? '查看套餐与订阅' : '免费开通工作台')
const stageMotionStyle = computed(() => ({ transform: `translateY(${Math.min(44, heroScroll.value * 0.09)}px)` }))
const haloMotionStyle = computed(() => ({ transform: `translateY(${Math.min(32, heroScroll.value * 0.06)}px)` }))

const activationSteps = [
  { day: '第 1 天', title: '建立真实房源盘面', description: '录入第一套房源，统一楼栋、房态和业主信息。' },
  { day: '第 3 天', title: '让团队开始协作', description: '邀请成员并分配职责，减少重复沟通和信息断层。' },
  { day: '第 7 天', title: '跑通第一次业务闭环', description: '完成首次带看或签约，让业务过程真正沉淀下来。' },
]

const signalItems = ['房源状态实时清晰', '客户跟进不断线', '带看排期协同', '签约履约可追踪', '经营数据自然沉淀']

const sellingPoints = [
  { number: '01', icon: 'i-carbon-data-base', title: '一份资料，全员对齐', description: '房源、业主与客户信息集中在同一工作台。状态变了，团队看到的也是同一份业务事实。', caption: '告别多份表格反复核对' },
  { number: '02', icon: 'i-carbon-collaborate', title: '交接顺畅，进度清晰', description: '需求、带看安排和跟进记录沿着业务过程留存，新成员接手也能快速了解前因后果。', caption: '让协作少一点口头传递' },
  { number: '03', icon: 'i-carbon-chart-line', title: '过程沉淀，决策有据', description: '从房源流转到团队协作，关键数据随日常工作逐步形成，经营情况不必临时拼凑。', caption: '把每天的动作变成洞察' },
]

const faqItems = [
  { question: '试用需要付费或绑定支付方式吗？', answer: '不需要。创建中介工作台后会自动开通 14 天专业版试用。' },
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
  <view class="saas-page">
    <AppCustomNavigation title="" back immersive transparent />
    <view class="hero-shell">
      <view class="hero-grid" />
      <view class="hero-halo hero-halo--one" :style="haloMotionStyle" />
      <view class="hero-halo hero-halo--two" :style="haloMotionStyle" />
      <view class="hero-inner">
        <view class="hero-overline">
          <view class="live-dot" />
          <text>LINKCLOUD SPACE / FOR AGENCIES</text>
        </view>
        <view class="hero-title">
          <text>门店生意，</text>
          <text class="hero-title__accent">从此有章可循。</text>
        </view>
        <text class="hero-description">告别在表格与聊天记录里来回找信息。房源、客户、带看与签约被连成一条清晰的业务线，每个人都知道下一步该做什么。</text>
        <view class="hero-actions">
          <button class="action-button action-button--blue" :disabled="switching" @click="primaryAction">
            <text>{{ primaryActionText }}</text>
            <view class="i-carbon-arrow-up-right" />
          </button>
          <button class="hero-link" @click="scrollToPlans">
            了解方案 <view class="i-carbon-arrow-down" />
          </button>
        </view>
        <view class="hero-trust">
          <view><view class="i-carbon-checkmark" />14 天专业版试用</view>
          <view><view class="i-carbon-checkmark" />无需技术配置</view>
          <view><view class="i-carbon-checkmark" />试用后可继续使用免费版</view>
        </view>

        <view class="product-stage" :style="stageMotionStyle">
          <view class="stage-label">
            <view class="stage-label__line" />
            <text>一个屏幕，看见业务全貌</text>
            <text class="stage-label__index">01 / 04</text>
          </view>
          <view class="dashboard-frame">
            <view class="dashboard-scan" />
            <view class="dashboard-topbar">
              <view class="dashboard-brand">
                <view class="dashboard-brand__mark">
                  L
                </view><text>门店工作台</text>
              </view>
              <view class="dashboard-topbar__right">
                <view class="dashboard-online" /> 实时同步 <view class="i-carbon-overflow-menu-horizontal" />
              </view>
            </view>
            <view class="dashboard-greeting">
              <view><text>经营总览 · 界面示意</text><strong>每一步，都看得见。</strong></view>
              <view class="i-carbon-arrow-up-right" />
            </view>
            <view class="dashboard-metrics">
              <view class="dashboard-metric dashboard-metric--main">
                <text>在管房源</text><strong>128 <small>套</small></strong><view class="metric-spark">
                  <i /><i /><i /><i /><i /><i /><i />
                </view>
              </view>
              <view class="dashboard-metric">
                <text>本周带看</text><strong>24 <small>次</small></strong><view class="dashboard-metric__trend">
                  ↗ 协作进行中
                </view>
              </view>
            </view>
            <view class="dashboard-activity">
              <view class="activity-icon i-carbon-notification" />
              <view><strong>新的带看已安排</strong><text>客户、房源与负责人自动关联</text></view>
              <view class="activity-time">
                刚刚
              </view>
            </view>
          </view>
          <view class="stage-floating">
            <view class="i-carbon-checkmark-filled" /><text>业务状态 · 已同步</text>
          </view>
        </view>
      </view>
      <view class="signal-strip">
        <view class="signal-track">
          <view v-for="copy in 2" :key="copy" class="signal-group">
            <view v-for="item in signalItems" :key="item" class="signal-item">
              <view class="signal-item__spark" />{{ item }}
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="light-area">
      <view class="content-width">
        <view class="section-intro capabilities-intro scroll-reveal">
          <view class="section-index">
            01 <view />
          </view>
          <text class="section-eyebrow">THE COMPLETE PICTURE</text>
          <strong>让复杂的业务，<br>变得一目了然。</strong>
          <text class="section-description">从第一套房源到每一次成交，所有信息在一处流转。不用反复切换工具，也不用靠记忆拼起业务全貌。</text>
        </view>

        <view class="feature-card feature-card--inventory scroll-reveal">
          <view class="feature-copy">
            <view class="feature-icon feature-icon--blue i-carbon-building" />
            <text class="feature-number">01 / 房源盘面</text>
            <strong>每套房源，<br>都在掌控之中。</strong>
            <text>小区、楼栋、房态与业主资料统一归档。空置、待带看、已出租的状态清清楚楚，减少重复询问与无效带看。</text>
            <button class="feature-detail-link" @click="openFeature('inventory')">
              查看房源盘面详情 <view class="i-carbon-arrow-up-right" />
            </button>
          </view>
          <view class="inventory-visual">
            <view class="inventory-visual__header">
              <text>房源状态</text><view><i /> 实时更新</view>
            </view>
            <view class="inventory-visual__grid">
              <view class="room room--active">
                <text>8F · 801</text><strong>待带看</strong>
              </view>
              <view class="room">
                <text>8F · 802</text><strong>空置</strong>
              </view>
              <view class="room room--occupied">
                <text>8F · 803</text><strong>已出租</strong>
              </view>
              <view class="room">
                <text>7F · 701</text><strong>空置</strong>
              </view>
              <view class="room room--active">
                <text>7F · 702</text><strong>待带看</strong>
              </view>
              <view class="room room--occupied">
                <text>7F · 703</text><strong>已出租</strong>
              </view>
            </view>
          </view>
        </view>

        <view class="feature-pair scroll-reveal">
          <view class="feature-card feature-card--client">
            <view class="feature-icon feature-icon--sky i-carbon-user-multiple" />
            <text class="feature-number">02 / 客户与带看</text>
            <strong>跟进不断线。</strong>
            <text>需求、带看排期与跟进记录连在一起；下一次联系客户，知道上一次聊到了哪里。</text>
            <button class="feature-detail-link" @click="openFeature('clients')">
              了解客户协作 <view class="i-carbon-arrow-up-right" />
            </button>
            <view class="client-visual">
              <view class="client-avatar">
                客
              </view><view class="client-visual__line">
                <i /><i />
              </view><view class="client-avatar client-avatar--accent">
                <view class="i-carbon-calendar" />
              </view>
            </view>
          </view>
          <view class="feature-card feature-card--contract">
            <view class="feature-icon feature-icon--indigo i-carbon-document-signed" />
            <text class="feature-number">03 / 签约与租约</text>
            <strong>成交有迹可循。</strong>
            <text>成交登记、合同资料和租约进度都有迹可循，关键节点不再散落在聊天里。</text>
            <button class="feature-detail-link" @click="openFeature('contracts')">
              了解签约租约 <view class="i-carbon-arrow-up-right" />
            </button>
            <view class="contract-visual">
              <view class="contract-visual__line" /><view class="contract-visual__line contract-visual__line--short" /><view class="contract-visual__stamp i-carbon-checkmark" />
            </view>
          </view>
        </view>

        <view class="feature-card feature-card--insight scroll-reveal">
          <view class="insight-content">
            <view class="feature-icon feature-icon--violet i-carbon-chart-line" />
            <text class="feature-number">04 / 经营分析</text>
            <strong>用数据，读懂门店下一步。</strong>
            <text>房源流转、客户转化与团队协作随着日常工作持续沉淀，让经营判断有清晰依据。</text>
            <button class="feature-detail-link feature-detail-link--light" @click="openFeature('insights')">
              查看分析能力 <view class="i-carbon-arrow-up-right" />
            </button>
          </view>
          <view class="insight-visual">
            <view class="insight-grid" /><view class="insight-bars">
              <i /><i /><i /><i /><i /><i />
            </view><view class="insight-trend">
              <view class="i-carbon-chart-line" /> 趋势清晰可见
            </view>
          </view>
        </view>

        <view class="benefits-section scroll-reveal">
          <view class="benefits-heading">
            <text class="section-eyebrow">LESS FRICTION. MORE MOMENTUM.</text>
            <strong>把琐碎留给系统，<br>把精力留给成交。</strong>
            <text>不只是把资料放到线上，更是让门店的每一次协作都接得上。</text>
          </view>
          <view class="benefits-list">
            <view v-for="point in sellingPoints" :key="point.number" class="benefit-item">
              <view class="benefit-item__number">
                {{ point.number }}
              </view>
              <view class="benefit-item__body">
                <view class="benefit-item__icon" :class="point.icon" />
                <strong>{{ point.title }}</strong>
                <text>{{ point.description }}</text>
                <view class="benefit-item__caption">
                  <view class="i-carbon-arrow-up-right" />{{ point.caption }}
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="journey-section scroll-reveal">
          <view class="journey-glow" />
          <view class="journey-heading">
            <text class="section-eyebrow">START SMALL. MOVE FAST.</text>
            <strong>7 天，跑通第一条<br>真实业务线。</strong>
            <text>从录入第一套房源到完成第一次带看或签约，按真实业务节奏逐步启动，不必一次学会所有功能。</text>
          </view>
          <view class="journey-steps">
            <view v-for="(step, index) in activationSteps" :key="step.day" class="journey-step">
              <view class="journey-step__rail">
                <view class="journey-step__node">
                  {{ index + 1 }}
                </view><view v-if="index < activationSteps.length - 1" class="journey-step__line" />
              </view>
              <view class="journey-step__content">
                <text>{{ step.day }}</text><strong>{{ step.title }}</strong><text>{{ step.description }}</text>
              </view>
            </view>
          </view>
          <view class="journey-foot">
            <view class="i-carbon-gift" /> 创建后自动获得 14 天专业版试用
          </view>
        </view>

        <view id="saas-plans" class="section-intro plans-intro scroll-reveal">
          <view class="section-index">
            02 <view />
          </view>
          <text class="section-eyebrow">A PLAN THAT GROWS WITH YOU</text>
          <strong>按自己的节奏，<br>选择合适的方案。</strong>
          <text class="section-description">先试用，再决定。付费方案按年计费，也能按团队成长逐步升级。</text>
        </view>
        <AppLoading v-if="loading" text="正在加载套餐…" />
        <AppErrorView v-else-if="loadError" title="套餐加载失败" :message="loadError" @retry="loadPlans" />
        <view v-else class="plan-list">
          <view v-for="plan in paidPlans" :key="plan.code" class="plan-card scroll-reveal" :class="{ 'plan-card--recommended': plan.code === 'professional' }">
            <view class="plan-card__topline">
              <text>{{ planEyebrow(plan) }}</text><view v-if="plan.code === 'professional'" class="plan-recommend">
                <view class="i-carbon-star-filled" /> 热门选择
              </view>
            </view>
            <view class="plan-heading">
              <strong>{{ plan.name }}</strong><text>{{ plan.description }}</text>
            </view>
            <view v-if="plan.purchase_mode === 'self_service' && planPrice(plan)" class="plan-price">
              <view><text>¥</text><strong>{{ formatMoney(planPrice(plan)!.amount) }}</strong><text>/ 年</text></view><text v-if="monthlyEquivalent(plan)" class="plan-monthly">折合约 ¥{{ monthlyEquivalent(plan) }} / 月</text>
            </view>
            <view v-else class="plan-price plan-price--custom">
              <strong>按需报价</strong><text class="plan-monthly">为连锁门店定制专属方案</text>
            </view>
            <view v-if="plan.entitlement" class="plan-facts">
              <view><view class="i-carbon-user-multiple" /><text>成员账号</text><strong>{{ quotaText(plan.entitlement.member_limit, '人') }}</strong></view>
              <view><view class="i-carbon-collaborate" /><text>协作团队</text><strong>{{ quotaText(plan.entitlement.team_limit, '个') }}</strong></view>
              <view><view class="i-carbon-building" /><text>房源容量</text><strong>{{ quotaText(plan.entitlement.house_limit, '套') }}</strong></view>
            </view>
            <button class="plan-action" :disabled="switching" @click="openPlan(plan)">
              <text>{{ planButtonText(plan) }}</text><view class="i-carbon-arrow-up-right" />
            </button>
          </view>
        </view>

        <view class="faq-section scroll-reveal">
          <view class="faq-heading">
            <text class="section-eyebrow">GOOD TO KNOW</text><strong>你可能还想知道</strong>
          </view>
          <view class="faq-list">
            <view v-for="(item, index) in faqItems" :key="item.question" class="faq-item" :class="{ 'faq-item--open': openFaqIndex === index }" @click="openFaqIndex = openFaqIndex === index ? null : index">
              <view class="faq-question">
                <strong>{{ item.question }}</strong><view :class="openFaqIndex === index ? 'i-carbon-subtract' : 'i-carbon-add'" />
              </view>
              <text v-if="openFaqIndex === index">{{ item.answer }}</text>
            </view>
          </view>
        </view>

        <view class="closing-card scroll-reveal">
          <view class="closing-card__orb" /><text>YOUR NEXT CHAPTER STARTS HERE</text><strong>从今天开始，<br>让生意更有序。</strong><button class="action-button action-button--blue" :disabled="switching" @click="primaryAction">
            <text>{{ primaryActionText }}</text><view class="i-carbon-arrow-up-right" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.saas-page {
  min-height: 100vh;
  background: #07152e;
  color: #172641;
}
.saas-page :deep(.app-custom-navigation) {
  --app-text-primary: #fff;
  margin: 0;
  background: transparent;
  pointer-events: none;
}
.saas-page :deep(.app-custom-navigation__back) {
  color: #fff;
  background: rgb(10 34 76 / 86%);
  pointer-events: auto;
}
.hero-shell {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 84% 18%, #275593 0, transparent 34%),
    linear-gradient(155deg, #07152e 0%, #0c2b58 57%, #0a1d3e 100%);
  color: #fff;
}
.hero-shell::before {
  position: absolute;
  top: -200rpx;
  right: -260rpx;
  width: 680rpx;
  height: 680rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(62 132 255 / 28%), transparent 68%);
  content: '';
  pointer-events: none;
  animation: hero-glow 9s ease-in-out infinite alternate;
}
.hero-grid {
  position: absolute;
  top: 30rpx;
  right: -140rpx;
  width: 610rpx;
  height: 760rpx;
  background-image:
    linear-gradient(rgb(134 191 255 / 9%) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgb(134 191 255 / 9%) 1rpx, transparent 1rpx);
  background-size: 68rpx 68rpx;
  pointer-events: none;
  transform: rotate(-12deg);
  animation: grid-drift 15s ease-in-out infinite alternate;
}
.hero-inner,
.content-width {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  box-sizing: border-box;
}
.hero-inner {
  z-index: 1;
  padding: calc(160rpx + env(safe-area-inset-top)) 36rpx 56rpx;
}
.hero-halo {
  position: absolute;
  border: 1rpx solid rgb(124 190 255 / 9%);
  border-radius: 50%;
  pointer-events: none;
}
.hero-halo--one {
  top: -210rpx;
  right: -380rpx;
  width: 850rpx;
  height: 850rpx;
}
.hero-halo--two {
  top: -112rpx;
  right: -280rpx;
  width: 640rpx;
  height: 640rpx;
}
.hero-overline {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #9bd3ff;
  font-size: 18rpx;
  font-weight: 700;
  letter-spacing: 2.2rpx;
  animation: hero-rise 700ms ease-out both;
}
.live-dot,
.dashboard-online {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #7cc8ff;
  box-shadow: 0 0 0 7rpx rgb(124 200 255 / 11%);
}
.live-dot {
  animation: live-pulse 2.8s ease-in-out infinite;
}
.hero-title {
  display: flex;
  flex-direction: column;
  margin-top: 30rpx;
  font-size: 64rpx;
  font-weight: 800;
  letter-spacing: -3rpx;
  line-height: 1.22;
  animation: hero-rise 780ms 100ms ease-out both;
}
.hero-title__accent {
  color: #7cc8ff;
  text-shadow: 0 0 45rpx rgb(124 200 255 / 21%);
}
.hero-description {
  display: block;
  max-width: 650rpx;
  margin-top: 28rpx;
  color: #b9cce5;
  font-size: 25rpx;
  line-height: 1.75;
  animation: hero-rise 780ms 200ms ease-out both;
}
.hero-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 24rpx;
  margin-top: 44rpx;
  animation: hero-rise 780ms 300ms ease-out both;
}
button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  font: inherit;
  line-height: normal;
}
button::after {
  border: 0;
}
.action-button {
  position: relative;
  display: flex;
  min-height: 92rpx;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 0 32rpx;
  border-radius: 22rpx;
  font-size: 26rpx;
  font-weight: 800;
  overflow: hidden;
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
  position: absolute;
  top: -35%;
  left: -45%;
  width: 35%;
  height: 170%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 47%), transparent);
  content: '';
  pointer-events: none;
  transform: rotate(22deg);
  animation: button-glint 5.5s ease-in-out infinite;
}
.action-button:active,
.plan-action:active {
  transform: scale(0.97);
}
.action-button .i-carbon-arrow-up-right {
  font-size: 31rpx;
}
.hero-link {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #dcecff;
  background: transparent;
  font-size: 24rpx;
}
.hero-link .i-carbon-arrow-down {
  font-size: 24rpx;
}
.hero-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx 28rpx;
  margin-top: 28rpx;
  color: #a7bdd8;
  font-size: 19rpx;
  animation: hero-rise 780ms 400ms ease-out both;
}
.hero-trust > view {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.hero-trust .i-carbon-checkmark {
  color: #7cc8ff;
  font-size: 21rpx;
}
.product-stage {
  position: relative;
  max-width: 710rpx;
  margin: 78rpx auto 0;
  animation: stage-appear 850ms 450ms ease-out both;
}
.signal-strip {
  position: relative;
  z-index: 1;
  overflow: hidden;
  margin-bottom: 30rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid rgb(124 200 255 / 16%);
  border-bottom: 1rpx solid rgb(124 200 255 / 16%);
  background: rgb(7 22 51 / 46%);
}
.signal-track,
.signal-group,
.signal-item {
  display: flex;
  align-items: center;
}
.signal-track {
  width: max-content;
  animation: signal-drift 29s linear infinite;
}
.signal-group {
  flex: 0 0 auto;
}
.signal-item {
  flex: 0 0 auto;
  gap: 13rpx;
  padding-right: 44rpx;
  color: #a9c8ed;
  font-size: 18rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  white-space: nowrap;
}
.signal-item__spark {
  width: 8rpx;
  height: 8rpx;
  background: #7cc8ff;
  box-shadow: 0 0 12rpx rgb(124 200 255 / 72%);
  transform: rotate(45deg);
}
.stage-label {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 22rpx;
  color: #acc4df;
  font-size: 20rpx;
  letter-spacing: 1rpx;
}
.stage-label__line {
  width: 30rpx;
  height: 2rpx;
  background: #7cc8ff;
}
.stage-label__index {
  margin-left: auto;
  color: #7f9bbc;
}
.dashboard-frame {
  position: relative;
  overflow: hidden;
  padding: 28rpx;
  border: 1rpx solid rgb(255 255 255 / 20%);
  border-radius: 28rpx;
  background: linear-gradient(135deg, rgb(244 249 255 / 98%), #eaf3ff);
  box-shadow: 0 30rpx 70rpx rgb(0 0 0 / 30%);
  color: #17365d;
  transform: rotate(-2deg);
  animation: dashboard-open 900ms 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.dashboard-scan {
  position: absolute;
  z-index: 1;
  top: 0;
  right: 0;
  left: 0;
  height: 2rpx;
  background: linear-gradient(90deg, transparent, rgb(69 158 255 / 48%), transparent);
  box-shadow: 0 0 25rpx 8rpx rgb(69 158 255 / 7%);
  pointer-events: none;
  animation: dashboard-scan 5.8s 1.4s ease-in-out infinite;
}
.dashboard-topbar,
.dashboard-brand,
.dashboard-topbar__right,
.dashboard-greeting,
.dashboard-metrics,
.dashboard-activity {
  display: flex;
  align-items: center;
}
.dashboard-topbar {
  justify-content: space-between;
  gap: 10rpx;
}
.dashboard-brand {
  gap: 10rpx;
  font-size: 18rpx;
  font-weight: 800;
}
.dashboard-brand__mark {
  display: flex;
  width: 30rpx;
  height: 30rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9rpx;
  color: #deefff;
  background: #164e95;
  font-size: 18rpx;
}
.dashboard-topbar__right {
  gap: 9rpx;
  color: #708aaa;
  font-size: 15rpx;
}
.dashboard-topbar__right .dashboard-online {
  width: 7rpx;
  height: 7rpx;
  box-shadow: none;
}
.dashboard-topbar__right .i-carbon-overflow-menu-horizontal {
  margin-left: 12rpx;
  font-size: 28rpx;
}
.dashboard-greeting {
  justify-content: space-between;
  margin: 36rpx 0 22rpx;
}
.dashboard-greeting > view:first-child {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.dashboard-greeting text {
  color: #7b91ad;
  font-size: 17rpx;
}
.dashboard-greeting strong {
  font-size: 28rpx;
}
.dashboard-greeting > .i-carbon-arrow-up-right {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2b6fc7;
  background: #dbeeff;
  font-size: 24rpx;
}
.dashboard-metrics {
  gap: 14rpx;
}
.dashboard-metric {
  position: relative;
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
  overflow: hidden;
  min-height: 136rpx;
  padding: 19rpx;
  border-radius: 16rpx;
  background: #fff;
  box-sizing: border-box;
}
.dashboard-metric--main {
  color: #e2f2ff;
  background: linear-gradient(140deg, #185eaa, #163e82);
}
.dashboard-metric > text {
  font-size: 16rpx;
}
.dashboard-metric:not(.dashboard-metric--main) > text {
  color: #879ab3;
}
.dashboard-metric strong {
  font-size: 40rpx;
  line-height: 1.15;
}
.dashboard-metric strong small {
  font-size: 17rpx;
  font-weight: 500;
}
.metric-spark {
  position: absolute;
  right: 14rpx;
  bottom: 16rpx;
  display: flex;
  height: 50rpx;
  align-items: flex-end;
  gap: 5rpx;
  opacity: 0.65;
}
.metric-spark i {
  width: 7rpx;
  height: 40%;
  border-radius: 4rpx 4rpx 0 0;
  background: #9ed9ff;
  transform-origin: bottom;
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
  margin-top: 8rpx;
  color: #287ac8;
  font-size: 15rpx;
}
.dashboard-activity {
  gap: 12rpx;
  margin-top: 14rpx;
  padding: 16rpx;
  border-radius: 15rpx;
  background: #fff;
}
.activity-icon {
  display: flex;
  width: 36rpx;
  height: 36rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 10rpx;
  color: #2877ca;
  background: #e5f2ff;
  font-size: 22rpx;
}
.dashboard-activity > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 3rpx;
}
.dashboard-activity strong {
  font-size: 16rpx;
}
.dashboard-activity text,
.activity-time {
  color: #96a9bd;
  font-size: 14rpx;
}
.stage-floating {
  position: absolute;
  right: -15rpx;
  bottom: -28rpx;
  display: flex;
  align-items: center;
  gap: 9rpx;
  padding: 13rpx 19rpx;
  border: 1rpx solid rgb(255 255 255 / 17%);
  border-radius: 100rpx;
  background: #143e78;
  box-shadow: 0 14rpx 30rpx rgb(0 0 0 / 26%);
  color: #d9efff;
  font-size: 17rpx;
  transform: rotate(3deg);
  animation: float-chip 3.8s ease-in-out infinite;
}
.stage-floating .i-carbon-checkmark-filled {
  font-size: 23rpx;
}
.light-area {
  position: relative;
  margin-top: -30rpx;
  padding: 1rpx 0 calc(70rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #f5f8fd;
}
.content-width {
  padding: 0 30rpx;
}
.section-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.capabilities-intro {
  padding-top: 94rpx;
}
.section-index {
  display: flex;
  align-items: center;
  gap: 14rpx;
  color: #a4b3c9;
  font-size: 21rpx;
  font-weight: 700;
}
.section-index > view {
  width: 46rpx;
  height: 1rpx;
  background: #b4c4d9;
}
.section-eyebrow {
  margin-top: 17rpx;
  color: #2d70c6;
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.section-intro > strong {
  margin-top: 20rpx;
  font-size: 47rpx;
  font-weight: 800;
  letter-spacing: -2rpx;
  line-height: 1.28;
}
.section-description {
  max-width: 650rpx;
  margin: 22rpx 0 35rpx;
  color: #718199;
  font-size: 23rpx;
  line-height: 1.7;
}
.feature-card {
  overflow: hidden;
  border: 1rpx solid #e2eaf5;
  border-radius: 29rpx;
  background: #fff;
  box-shadow: 0 12rpx 30rpx rgb(28 66 125 / 4%);
  box-sizing: border-box;
}
.feature-card--inventory {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
  padding: 34rpx;
}
.feature-copy,
.feature-card--client,
.feature-card--contract,
.insight-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.feature-icon {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 17rpx;
  font-size: 29rpx;
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
  margin-top: 28rpx;
  color: #5d83b8;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}
.feature-copy strong,
.feature-card--client strong,
.feature-card--contract strong,
.insight-content strong {
  margin-top: 12rpx;
  color: #1a2c4b;
  font-size: 33rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
  line-height: 1.3;
}
.feature-copy > text:nth-of-type(2),
.feature-card--client > text:nth-of-type(2),
.feature-card--contract > text:nth-of-type(2),
.insight-content > text:nth-of-type(2) {
  margin-top: 13rpx;
  color: #7989a1;
  font-size: 21rpx;
  line-height: 1.6;
}
.feature-detail-link {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8rpx;
  margin-top: 21rpx;
  padding: 8rpx 0;
  color: #276fc1;
  background: transparent;
  font-size: 20rpx;
  font-weight: 800;
  text-align: left;
  transition: transform 180ms ease;
}
.feature-detail-link .i-carbon-arrow-up-right {
  font-size: 23rpx;
}
.feature-detail-link:active {
  transform: translateX(5rpx);
}
.inventory-visual {
  padding: 25rpx;
  border-radius: 20rpx;
  background: #eff5fd;
}
.inventory-visual__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 19rpx;
  color: #2a4262;
  font-size: 19rpx;
  font-weight: 700;
}
.inventory-visual__header > view {
  display: flex;
  align-items: center;
  gap: 7rpx;
  color: #5f8cbd;
  font-size: 16rpx;
  font-weight: 500;
}
.inventory-visual__header i {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: #4394e8;
}
.inventory-visual__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9rpx;
}
.room {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 14rpx 9rpx;
  border-radius: 10rpx;
  background: #fff;
}
.room text {
  color: #8b9bb1;
  font-size: 14rpx;
}
.room strong {
  color: #435c7c;
  font-size: 17rpx;
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
.feature-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 15rpx;
  margin-top: 15rpx;
}
.feature-card--client,
.feature-card--contract {
  min-height: 370rpx;
  padding: 26rpx 23rpx;
}
.feature-card--client .feature-number,
.feature-card--contract .feature-number {
  margin-top: 22rpx;
  font-size: 17rpx;
}
.feature-card--client strong,
.feature-card--contract strong {
  font-size: 26rpx;
}
.feature-card--client > text:nth-of-type(2),
.feature-card--contract > text:nth-of-type(2) {
  font-size: 18rpx;
}
.feature-card--client .feature-detail-link,
.feature-card--contract .feature-detail-link {
  font-size: 18rpx;
}
.client-visual {
  display: flex;
  align-items: center;
  width: 100%;
  margin-top: auto;
  padding-top: 25rpx;
}
.client-avatar {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2b70c1;
  background: #dfedff;
  font-size: 18rpx;
  font-weight: 800;
}
.client-avatar--accent {
  color: #fff;
  background: #337fcf;
}
.client-avatar--accent .i-carbon-calendar {
  font-size: 21rpx;
}
.client-visual__line {
  position: relative;
  height: 1rpx;
  flex: 1;
  background: #b8d8f9;
}
.client-visual__line i {
  position: absolute;
  top: -5rpx;
  left: 30%;
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  background: #529fe8;
}
.client-visual__line i:nth-child(2) {
  left: 70%;
}
.contract-visual {
  position: relative;
  width: 85%;
  height: 72rpx;
  margin-top: auto;
  padding: 18rpx 20rpx;
  border-radius: 10rpx;
  background: #f1f0ff;
  box-sizing: border-box;
  transform: rotate(-5deg);
}
.contract-visual__line {
  width: 65%;
  height: 6rpx;
  margin-bottom: 10rpx;
  border-radius: 5rpx;
  background: #d7d3f2;
}
.contract-visual__line--short {
  width: 43%;
}
.contract-visual__stamp {
  position: absolute;
  right: -8rpx;
  bottom: -15rpx;
  display: flex;
  width: 43rpx;
  height: 43rpx;
  align-items: center;
  justify-content: center;
  border: 3rpx solid #9d92df;
  border-radius: 50%;
  color: #8074c7;
  font-size: 24rpx;
  transform: rotate(15deg);
}
.feature-card--insight {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 15rpx;
  padding: 32rpx;
  border-color: #2b4474;
  background: linear-gradient(135deg, #1b396d, #11254e);
}
.insight-content .feature-number {
  color: #a9c4e6;
}
.insight-content strong {
  color: #fff;
}
.insight-content > text:nth-of-type(2) {
  color: #b7c8df;
}
.feature-detail-link--light {
  color: #a4d7ff;
}
.insight-visual {
  position: relative;
  overflow: hidden;
  height: 200rpx;
  margin-top: 15rpx;
  border: 1rpx solid rgb(255 255 255 / 12%);
  border-radius: 20rpx;
  background: linear-gradient(180deg, rgb(147 202 255 / 8%), transparent);
}
.insight-grid {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    to top,
    transparent 0,
    transparent 48rpx,
    rgb(255 255 255 / 8%) 49rpx,
    rgb(255 255 255 / 8%) 50rpx
  );
}
.insight-bars {
  position: absolute;
  right: 28rpx;
  bottom: 0;
  left: 28rpx;
  display: flex;
  height: 160rpx;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10rpx;
}
.insight-bars i {
  width: 12%;
  height: 38%;
  border-radius: 7rpx 7rpx 0 0;
  background: linear-gradient(180deg, #a7dcff, #3f83e3);
  transform-origin: bottom;
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
  position: absolute;
  top: 18rpx;
  left: 18rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 7rpx 10rpx;
  border-radius: 7rpx;
  color: #d9efff;
  background: #254b86;
  font-size: 16rpx;
}
.benefits-section {
  overflow: hidden;
  margin-top: 72rpx;
  padding: 42rpx 32rpx 25rpx;
  border: 1rpx solid #d9e7fa;
  border-radius: 30rpx;
  background: linear-gradient(145deg, #e8f2ff, #ffffff 42%, #f7faff);
  box-shadow: 0 18rpx 46rpx rgb(34 92 183 / 7%);
}
.benefits-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.benefits-heading .section-eyebrow {
  margin-top: 0;
}
.benefits-heading strong {
  margin-top: 18rpx;
  color: #162b55;
  font-size: 37rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
  line-height: 1.32;
}
.benefits-heading > text:last-child {
  margin-top: 17rpx;
  color: #7285a2;
  font-size: 21rpx;
  line-height: 1.65;
}
.benefits-list {
  margin-top: 29rpx;
  border-top: 1rpx solid #dce8f7;
}
.benefit-item {
  display: flex;
  gap: 21rpx;
  padding: 29rpx 0;
  border-bottom: 1rpx solid #dce8f7;
}
.benefit-item:last-child {
  border-bottom: 0;
}
.benefit-item__number {
  width: 32rpx;
  flex: 0 0 auto;
  padding-top: 14rpx;
  color: #548ad4;
  font-size: 19rpx;
  font-weight: 800;
}
.benefit-item__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
}
.benefit-item__icon {
  display: flex;
  width: 46rpx;
  height: 46rpx;
  align-items: center;
  justify-content: center;
  border-radius: 13rpx;
  color: #2473c7;
  background: #e4f1ff;
  font-size: 25rpx;
}
.benefit-item__body strong {
  margin-top: 13rpx;
  color: #19385f;
  font-size: 25rpx;
  font-weight: 800;
}
.benefit-item__body > text {
  margin-top: 10rpx;
  color: #71839e;
  font-size: 20rpx;
  line-height: 1.65;
}
.benefit-item__caption {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 16rpx;
  color: #2873bf;
  font-size: 17rpx;
  font-weight: 700;
}
.benefit-item__caption .i-carbon-arrow-up-right {
  font-size: 19rpx;
}
.journey-section {
  position: relative;
  overflow: hidden;
  margin-top: 75rpx;
  padding: 47rpx 34rpx;
  border-radius: 30rpx;
  background: #102b60;
  color: #fff;
}
.journey-glow {
  position: absolute;
  top: -210rpx;
  right: -240rpx;
  width: 520rpx;
  height: 520rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(70 136 245 / 28%), transparent 68%);
}
.journey-heading,
.journey-steps,
.journey-foot {
  position: relative;
}
.journey-heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.journey-heading .section-eyebrow {
  margin-top: 0;
  color: #7cc8ff;
}
.journey-heading strong {
  margin-top: 18rpx;
  font-size: 38rpx;
  line-height: 1.34;
}
.journey-heading > text:last-child {
  margin-top: 13rpx;
  color: #b9cce4;
  font-size: 21rpx;
  line-height: 1.65;
}
.journey-steps {
  margin-top: 38rpx;
}
.journey-step {
  display: flex;
  gap: 18rpx;
}
.journey-step__rail {
  display: flex;
  width: 42rpx;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
}
.journey-step__node {
  display: flex;
  width: 41rpx;
  height: 41rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #7bbdff;
  border-radius: 50%;
  color: #7cc8ff;
  font-size: 19rpx;
  font-weight: 800;
}
.journey-step__line {
  width: 1rpx;
  min-height: 81rpx;
  flex: 1;
  margin: 8rpx 0;
  background: rgb(124 200 255 / 30%);
}
.journey-step__content {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
  padding-bottom: 32rpx;
}
.journey-step__content text:first-child {
  color: #7cc8ff;
  font-size: 17rpx;
  font-weight: 700;
}
.journey-step__content strong {
  font-size: 23rpx;
}
.journey-step__content text:last-child {
  color: #afc2dd;
  font-size: 18rpx;
  line-height: 1.55;
}
.journey-foot {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 10rpx;
  padding: 19rpx;
  border: 1rpx solid rgb(124 200 255 / 22%);
  border-radius: 14rpx;
  color: #d9efff;
  background: rgb(124 200 255 / 7%);
  font-size: 18rpx;
}
.journey-foot .i-carbon-gift {
  font-size: 26rpx;
}
.plans-intro {
  padding-top: 88rpx;
}
.plan-list {
  display: grid;
  gap: 17rpx;
}
.plan-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 30rpx;
  border: 1rpx solid #e1eaf5;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 10rpx 29rpx rgb(31 73 141 / 4%);
}
.plan-card--recommended {
  border-color: #75b7ff;
  background: linear-gradient(180deg, #ecf5ff, #fff 250rpx);
  box-shadow: 0 16rpx 40rpx rgb(54 118 215 / 11%);
}
.plan-card__topline {
  display: flex;
  min-height: 34rpx;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  color: #337bd0;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 1rpx;
}
.plan-recommend {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 7rpx 12rpx;
  border-radius: 100rpx;
  color: #205da9;
  background: #deeeff;
  font-size: 16rpx;
  letter-spacing: 0;
}
.plan-heading {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
  margin-top: 11rpx;
}
.plan-heading strong {
  color: #1c3153;
  font-size: 34rpx;
}
.plan-heading text {
  color: #8392a7;
  font-size: 21rpx;
  line-height: 1.55;
}
.plan-price {
  display: flex;
  min-height: 116rpx;
  flex-direction: column;
  justify-content: center;
  gap: 5rpx;
  margin: 15rpx 0;
  color: #163867;
}
.plan-price > view {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.plan-price > view text:first-child {
  font-size: 25rpx;
  font-weight: 800;
}
.plan-price strong {
  font-size: 50rpx;
  font-weight: 800;
  line-height: 1.1;
}
.plan-price > view text:last-child {
  color: #8496ae;
  font-size: 20rpx;
}
.plan-monthly {
  color: #8e9eb5;
  font-size: 19rpx;
}
.plan-price--custom strong {
  font-size: 38rpx;
}
.plan-facts {
  display: flex;
  flex-direction: column;
  gap: 2rpx;
  padding: 17rpx 0;
  border-top: 1rpx solid #eaf0f7;
}
.plan-facts > view {
  display: flex;
  align-items: center;
  min-height: 49rpx;
  gap: 12rpx;
  color: #788ca7;
  font-size: 20rpx;
}
.plan-facts > view > view {
  color: #327bcb;
  font-size: 24rpx;
}
.plan-facts strong {
  margin-left: auto;
  color: #233a61;
  font-size: 21rpx;
}
.plan-action {
  display: flex;
  width: 100%;
  min-height: 77rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding: 0 24rpx;
  border-radius: 16rpx;
  color: #1b57a2;
  background: #e6f1ff;
  font-size: 23rpx;
  font-weight: 800;
  text-align: left;
}
.plan-card--recommended .plan-action {
  color: #fff;
  background: #1757ad;
}
.plan-action .i-carbon-arrow-up-right {
  font-size: 25rpx;
}
.faq-section {
  padding: 90rpx 0 68rpx;
}
.faq-heading {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}
.faq-heading .section-eyebrow {
  margin: 0;
}
.faq-heading strong {
  font-size: 36rpx;
}
.faq-list {
  margin-top: 29rpx;
  border-top: 1rpx solid #dfe8f3;
}
.faq-item {
  padding: 27rpx 0;
  border-bottom: 1rpx solid #dfe8f3;
}
.faq-question {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.faq-question strong {
  font-size: 23rpx;
  line-height: 1.4;
}
.faq-question > view {
  display: flex;
  width: 37rpx;
  height: 37rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #315d94;
  background: #e8f1fb;
  font-size: 23rpx;
}
.faq-item > text {
  display: block;
  max-width: 600rpx;
  margin-top: 17rpx;
  color: #72849e;
  font-size: 21rpx;
  line-height: 1.7;
}
.closing-card {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
  padding: 45rpx 34rpx;
  border-radius: 29rpx;
  background: #0d2857;
  color: #fff;
}
.closing-card__orb {
  position: absolute;
  right: -180rpx;
  bottom: -240rpx;
  width: 540rpx;
  height: 540rpx;
  border: 1rpx solid rgb(124 200 255 / 18%);
  border-radius: 50%;
  box-shadow:
    0 0 0 70rpx rgb(124 200 255 / 3%),
    0 0 0 140rpx rgb(124 200 255 / 3%);
}
.closing-card > text {
  position: relative;
  color: #a1d4ff;
  font-size: 16rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.closing-card > strong {
  position: relative;
  margin: 26rpx 0 35rpx;
  font-size: 44rpx;
  line-height: 1.28;
}
.closing-card .action-button {
  position: relative;
  min-height: 76rpx;
  font-size: 22rpx;
}
button[disabled] {
  opacity: 0.6;
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
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 70rpx;
    align-items: center;
    padding: 150rpx 50rpx 130rpx;
  }
  .hero-overline,
  .hero-title,
  .hero-description,
  .hero-actions,
  .hero-trust {
    grid-column: 1;
  }
  .product-stage {
    grid-column: 2;
    grid-row: 1 / span 5;
    width: 100%;
    margin: 0;
  }
  .light-area {
    margin-top: -38rpx;
  }
  .content-width {
    padding: 0 50rpx;
  }
  .feature-card--inventory {
    flex-direction: row;
    align-items: center;
  }
  .feature-copy,
  .inventory-visual {
    flex: 1;
  }
  .feature-pair {
    gap: 20rpx;
  }
  .feature-card--client,
  .feature-card--contract {
    min-height: 310rpx;
  }
  .feature-card--insight {
    flex-direction: row;
    align-items: center;
  }
  .benefits-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .benefit-item {
    padding: 28rpx 20rpx;
    border-right: 1rpx solid #dce8f7;
    border-bottom: 0;
  }
  .benefit-item:last-child {
    border-right: 0;
  }
  .insight-content,
  .insight-visual {
    flex: 1;
  }
  .plan-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
