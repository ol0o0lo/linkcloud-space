<script setup lang="ts">
import type { SaaSPlan } from '@/features/saas/service'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppBottomAction from '@/components/app/AppBottomAction.vue'
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
const paidPlans = computed(() => plans.value.filter(plan => plan.code !== 'free'))
const hasOrganization = computed(() => appContextStore.organizations.length > 0)
const primaryActionText = computed(() => hasOrganization.value ? '查看套餐与订阅' : '免费开通工作台')

const valueItems = [
  { icon: 'i-carbon-building', tone: 'blue', title: '房源盘面', description: '小区、楼栋、房态和业主资料统一管理，团队看到同一份实时数据。' },
  { icon: 'i-carbon-user-multiple', tone: 'green', title: '客户与带看', description: '客户需求、带看排期和跟进记录完整留痕，减少交接遗漏。' },
  { icon: 'i-carbon-document-signed', tone: 'orange', title: '签约与租约', description: '从成交登记到租约履行集中沉淀，关键节点清晰可追踪。' },
  { icon: 'i-carbon-chart-line', tone: 'purple', title: '经营分析', description: '用房源、转化和团队协作数据，及时看清门店经营状态。' },
]

const activationSteps = [
  { day: '第 1 天', title: '建立真实房源盘面', description: '录入第一套房源，统一楼栋、房态和业主信息。' },
  { day: '第 3 天', title: '让团队开始协作', description: '邀请成员并分配职责，减少重复沟通和信息断层。' },
  { day: '第 7 天', title: '跑通第一次业务闭环', description: '完成首次带看或签约，让业务过程真正沉淀下来。' },
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
</script>

<template>
  <view class="saas-page">
    <AppCustomNavigation title="链云空间 SaaS" back scroll-mode="sticky" />
    <view class="saas-content">
      <view class="hero-card">
        <view class="hero-main">
          <wd-tag type="primary" variant="light" round>
            为中介门店打造的一体化工作台
          </wd-tag>
          <view class="hero-title">
            把房源、客户、带看与签约，收进一个工作台
          </view>
          <view class="hero-copy">
            不再靠表格和群聊拼业务。链云空间把门店从房源盘面到成交履约的关键过程统一沉淀，让成员协作有序、经营结果可见。
          </view>
          <view class="hero-actions">
            <view class="hero-action">
              <wd-button block size="large" :loading="switching" @click="primaryAction">
                {{ primaryActionText }}
              </wd-button>
            </view>
            <view class="hero-action">
              <wd-button block size="large" variant="soft" @click="scrollToPlans">
                查看套餐
              </wd-button>
            </view>
          </view>
          <view class="hero-assurances">
            <view><text class="i-carbon-checkmark" />14 天专业版试用</view>
            <view><text class="i-carbon-checkmark" />无需技术配置</view>
            <view><text class="i-carbon-checkmark" />按团队阶段升级</view>
          </view>
        </view>
        <view class="hero-preview">
          <view class="preview-heading">
            <view>
              <text>门店经营闭环</text>
              <strong>业务过程持续沉淀</strong>
            </view>
            <wd-tag type="success" variant="light" round>
              实时协作
            </wd-tag>
          </view>
          <view class="preview-flow">
            <view class="preview-step">
              <view class="preview-icon preview-icon--blue i-carbon-building" />
              <view><strong>房源</strong><text>统一盘面</text></view>
            </view>
            <view class="preview-line" />
            <view class="preview-step">
              <view class="preview-icon preview-icon--green i-carbon-calendar" />
              <view><strong>带看</strong><text>协同跟进</text></view>
            </view>
            <view class="preview-line" />
            <view class="preview-step">
              <view class="preview-icon preview-icon--orange i-carbon-document-signed" />
              <view><strong>签约</strong><text>结果沉淀</text></view>
            </view>
          </view>
          <view class="preview-result">
            <view class="i-carbon-chart-line" />
            <view><strong>经营数据自然形成</strong><text>不用重复整理，关键过程随业务自动积累</text></view>
          </view>
        </view>
      </view>

      <view class="section-heading">
        <view>
          <text class="section-kicker">门店经营能力</text>
          <strong>一套系统，覆盖从房源到成交</strong>
          <text class="section-copy">先把业务流程跑顺，再用数据帮助团队持续提升。</text>
        </view>
      </view>
      <view class="value-grid">
        <view v-for="item in valueItems" :key="item.title" class="value-card">
          <view class="value-icon" :class="`value-icon--${item.tone}`">
            <view :class="item.icon" />
          </view>
          <strong>{{ item.title }}</strong>
          <text>{{ item.description }}</text>
        </view>
      </view>

      <view id="saas-plans" class="section-heading section-heading--plans">
        <view>
          <text class="section-kicker">方案选择</text>
          <strong>按团队阶段选择，不为用不到的能力付费</strong>
          <text class="section-copy">所有付费方案都可以从 14 天专业版试用开始。</text>
        </view>
        <wd-tag type="primary" variant="light" round>
          年付方案
        </wd-tag>
      </view>
      <AppLoading v-if="loading" text="正在加载套餐…" />
      <AppErrorView v-else-if="loadError" title="套餐加载失败" :message="loadError" @retry="loadPlans" />
      <view v-else class="plan-list">
        <view v-for="plan in paidPlans" :key="plan.code" class="plan-card" :class="{ 'plan-card--recommended': plan.code === 'professional' }">
          <view class="plan-card__topline">
            <text>{{ planEyebrow(plan) }}</text>
            <wd-tag v-if="plan.code === 'professional'" type="primary" variant="light" round>
              推荐
            </wd-tag>
          </view>
          <view class="plan-heading">
            <strong>{{ plan.name }}</strong>
            <text>{{ plan.description }}</text>
          </view>
          <view v-if="plan.purchase_mode === 'self_service' && planPrice(plan)" class="plan-price">
            <view><text>¥</text><strong>{{ formatMoney(planPrice(plan)!.amount) }}</strong><text>/ 年</text></view>
            <text v-if="monthlyEquivalent(plan)" class="plan-monthly">折合约 ¥{{ monthlyEquivalent(plan) }}/月</text>
          </view>
          <view v-else class="plan-price plan-price--custom">
            <strong>按需报价</strong><text class="plan-monthly">根据门店规模与实施需求提供方案</text>
          </view>
          <view v-if="plan.entitlement" class="plan-facts">
            <view><text class="i-carbon-user-multiple" /><strong>{{ quotaText(plan.entitlement.member_limit, '人') }}</strong><text>成员账号</text></view>
            <view><text class="i-carbon-collaborate" /><strong>{{ quotaText(plan.entitlement.team_limit, '个') }}</strong><text>协作团队</text></view>
            <view><text class="i-carbon-building" /><strong>{{ quotaText(plan.entitlement.house_limit, '套') }}</strong><text>房源容量</text></view>
          </view>
          <view class="plan-button">
            <wd-button block size="large" :variant="plan.code === 'professional' ? 'base' : 'soft'" :loading="switching" @click="openPlan(plan)">
              {{ planButtonText(plan) }}
            </wd-button>
          </view>
        </view>
      </view>

      <view class="activation-section">
        <view class="activation-intro">
          <text class="section-kicker">不是买完就结束</text>
          <strong>用 7 天跑通第一次真实业务闭环</strong>
          <text>工作台会按真实业务数据显示激活进度，帮助团队尽快从“开通”走到“用起来”。</text>
          <view class="activation-promise">
            <view class="i-carbon-checkmark-filled" />
            <text>创建后自动获得 14 天专业版试用</text>
          </view>
        </view>
        <view class="activation-list">
          <view v-for="(step, index) in activationSteps" :key="step.day" class="activation-item">
            <view class="activation-index">
              {{ index + 1 }}
            </view>
            <view><text>{{ step.day }}</text><strong>{{ step.title }}</strong><text>{{ step.description }}</text></view>
          </view>
        </view>
      </view>

      <view class="section-heading">
        <view>
          <text class="section-kicker">购买前常见问题</text>
          <strong>先试用，再决定</strong>
        </view>
      </view>
      <view class="faq-list">
        <view v-for="item in faqItems" :key="item.question" class="faq-item">
          <strong>{{ item.question }}</strong>
          <text>{{ item.answer }}</text>
        </view>
      </view>
    </view>

    <AppBottomAction>
      <view class="bottom-action-inner">
        <view class="bottom-action-copy">
          <strong>{{ hasOrganization ? '已有工作台，直接选择方案' : '14 天专业版免费试用' }}</strong>
          <text>{{ hasOrganization ? '查看当前套餐、用量和升级价格' : '创建即可使用，无需技术配置' }}</text>
        </view>
        <view class="bottom-action-button">
          <wd-button block size="large" :loading="switching" @click="primaryAction">
            {{ primaryActionText }}
          </wd-button>
        </view>
      </view>
    </AppBottomAction>
  </view>
</template>

<style scoped lang="scss">
.saas-page {
  min-height: 100vh;
  padding: 0 24rpx 190rpx;
  background: linear-gradient(180deg, #edf6ff 0, var(--app-bg-page) 520rpx);
  box-sizing: border-box;
}
.saas-page :deep(.app-custom-navigation) {
  margin: 0 -24rpx;
}
.saas-content {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}
.hero-card {
  display: grid;
  gap: 32rpx;
  margin-top: 24rpx;
  padding: 40rpx 32rpx 34rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 36rpx;
  background: linear-gradient(145deg, #ffffff 0%, #eef7ff 62%, #e7f2ff 100%);
  box-shadow: 0 18rpx 54rpx rgb(35 102 174 / 10%);
}
.hero-main {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 20rpx;
}
.hero-title {
  color: var(--app-text-primary);
  font-size: 52rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
  line-height: 1.22;
}
.hero-copy {
  max-width: 720rpx;
  color: var(--app-text-secondary);
  font-size: 26rpx;
  line-height: 1.75;
}
.hero-actions {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-top: 4rpx;
}
.hero-action {
  min-width: 240rpx;
  flex: 1;
}
.hero-assurances {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx 24rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
}
.hero-assurances view {
  display: flex;
  align-items: center;
  gap: 6rpx;
}
.hero-assurances text {
  color: var(--app-color-success);
  font-size: 24rpx;
}
.hero-preview {
  padding: 28rpx;
  border: 1rpx solid rgb(255 255 255 / 82%);
  border-radius: 28rpx;
  background: rgb(255 255 255 / 86%);
  box-shadow: var(--app-shadow-card-raised);
}
.preview-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}
.preview-heading > view:first-child {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.preview-heading text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.preview-heading strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}
.preview-flow {
  display: flex;
  align-items: center;
  margin: 30rpx 0;
}
.preview-step {
  display: flex;
  min-width: 112rpx;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  text-align: center;
}
.preview-step > view:last-child {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.preview-step strong {
  color: var(--app-text-primary);
  font-size: 22rpx;
}
.preview-step text {
  color: var(--app-text-muted);
  font-size: 18rpx;
}
.preview-icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 22rpx;
  font-size: 32rpx;
}
.preview-icon--blue {
  color: #1677d8;
  background: #e8f3ff;
}
.preview-icon--green {
  color: #19865b;
  background: #e9f8f1;
}
.preview-icon--orange {
  color: #c66a13;
  background: #fff2e4;
}
.preview-line {
  height: 2rpx;
  flex: 1;
  background: linear-gradient(90deg, var(--app-border-color), var(--app-color-brand-soft));
}
.preview-result {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  color: #5845c9;
  background: #f1efff;
}
.preview-result > view:first-child {
  flex: 0 0 auto;
  font-size: 34rpx;
}
.preview-result > view:last-child {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.preview-result strong {
  color: var(--app-text-primary);
  font-size: 22rpx;
}
.preview-result text {
  color: var(--app-text-secondary);
  font-size: 19rpx;
}
.value-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}
.value-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
  padding: 26rpx 22rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 26rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.value-icon {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  font-size: 29rpx;
}
.value-icon--blue {
  color: #1677d8;
  background: #e8f3ff;
}
.value-icon--green {
  color: #19865b;
  background: #e9f8f1;
}
.value-icon--orange {
  color: #c66a13;
  background: #fff2e4;
}
.value-icon--purple {
  color: #604bcc;
  background: #f0edff;
}
.value-card strong {
  color: var(--app-text-primary);
  font-size: 26rpx;
}
.value-card text {
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.6;
}
.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 52rpx 6rpx 20rpx;
}
.section-heading > view:first-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.section-heading strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
  line-height: 1.35;
}
.section-kicker {
  color: var(--app-color-brand);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}
.section-copy {
  color: var(--app-text-muted);
  font-size: 22rpx;
  line-height: 1.55;
}
.plan-list {
  display: grid;
  gap: 18rpx;
}
.plan-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 30rpx;
  border: 1rpx solid var(--app-border-subtle);
  border-radius: 30rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}
.plan-card--recommended {
  border: 2rpx solid var(--app-color-brand);
  background: linear-gradient(180deg, #f5faff 0, #ffffff 250rpx);
  box-shadow: 0 16rpx 44rpx rgb(0 102 204 / 11%);
}
.plan-card__topline {
  display: flex;
  min-height: 44rpx;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 10rpx;
}
.plan-card__topline > text {
  color: var(--app-color-brand);
  font-size: 20rpx;
  font-weight: 700;
}
.plan-heading {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.plan-heading strong {
  color: var(--app-text-primary);
  font-size: 34rpx;
}
.plan-heading text {
  min-height: 66rpx;
  color: var(--app-text-secondary);
  font-size: 21rpx;
  line-height: 1.6;
}
.plan-price {
  display: flex;
  min-height: 110rpx;
  flex-direction: column;
  justify-content: center;
  gap: 5rpx;
  margin: 18rpx 0;
  color: var(--app-color-brand);
}
.plan-price > view {
  display: flex;
  align-items: baseline;
}
.plan-price > view text:first-child {
  margin-right: 4rpx;
  font-size: 27rpx;
  font-weight: 700;
}
.plan-price strong {
  font-size: 48rpx;
  line-height: 1.1;
}
.plan-price > view text:last-child {
  margin-left: 6rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.plan-monthly {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.plan-price--custom strong {
  font-size: 38rpx;
}
.plan-facts {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid var(--app-divider-color);
}
.plan-facts > view {
  display: grid;
  grid-template-columns: 42rpx minmax(90rpx, auto) 1fr;
  align-items: center;
  gap: 8rpx;
  min-height: 52rpx;
}
.plan-facts > view > text:first-child {
  color: var(--app-color-brand);
  font-size: 26rpx;
}
.plan-facts strong {
  color: var(--app-text-primary);
  font-size: 22rpx;
}
.plan-facts > view > text:last-child {
  color: var(--app-text-secondary);
  font-size: 20rpx;
}
.plan-button {
  margin-top: auto;
  padding-top: 14rpx;
}
.activation-section {
  display: grid;
  gap: 28rpx;
  margin-top: 56rpx;
  padding: 34rpx;
  border-radius: 32rpx;
  color: var(--app-text-on-brand);
  background: var(--app-gradient-organization);
  box-shadow: var(--app-shadow-hero-organization);
}
.activation-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
}
.activation-intro .section-kicker {
  color: #dcd6ff;
}
.activation-intro > strong {
  color: #ffffff;
  font-size: 36rpx;
  line-height: 1.35;
}
.activation-intro > text:not(.section-kicker) {
  color: rgb(255 255 255 / 76%);
  font-size: 22rpx;
  line-height: 1.65;
}
.activation-promise {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 8rpx;
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  color: #ffffff;
  font-size: 21rpx;
  background: rgb(255 255 255 / 12%);
}
.activation-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.activation-item {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 20rpx;
  border-radius: 22rpx;
  background: rgb(255 255 255 / 10%);
}
.activation-index {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: #5945c9;
  font-size: 22rpx;
  font-weight: 700;
  background: #ffffff;
}
.activation-item > view:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 5rpx;
}
.activation-item text:first-child {
  color: #dcd6ff;
  font-size: 18rpx;
  font-weight: 700;
}
.activation-item strong {
  color: #ffffff;
  font-size: 23rpx;
}
.activation-item text:last-child {
  color: rgb(255 255 255 / 72%);
  font-size: 19rpx;
  line-height: 1.5;
}
.faq-list {
  display: grid;
  gap: 14rpx;
}
.faq-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 26rpx 28rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 24rpx;
  background: var(--app-bg-card);
}
.faq-item strong {
  color: var(--app-text-primary);
  font-size: 24rpx;
}
.faq-item text {
  color: var(--app-text-secondary);
  font-size: 21rpx;
  line-height: 1.6;
}
.bottom-action-inner {
  display: flex;
  width: 100%;
  max-width: 1120px;
  align-items: center;
  justify-content: space-between;
  gap: 22rpx;
  margin: 0 auto;
}
.bottom-action-copy {
  display: none;
  min-width: 0;
  flex-direction: column;
  gap: 4rpx;
}
.bottom-action-copy strong {
  color: var(--app-text-primary);
  font-size: 23rpx;
}
.bottom-action-copy text {
  color: var(--app-text-muted);
  font-size: 19rpx;
}
.bottom-action-button {
  width: 100%;
}

@media (min-width: 900px) {
  .hero-card {
    grid-template-columns: minmax(0, 1.12fr) minmax(360px, 0.88fr);
    align-items: center;
    padding: 52rpx;
  }
  .hero-actions {
    max-width: 680rpx;
  }
  .value-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .plan-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .activation-section {
    grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
    align-items: center;
    padding: 44rpx;
  }
  .faq-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .bottom-action-copy {
    display: flex;
  }
  .bottom-action-button {
    width: 360rpx;
    flex: 0 0 auto;
  }
}
</style>
