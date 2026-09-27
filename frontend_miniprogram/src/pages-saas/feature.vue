<script setup lang="ts">
import type { FeatureKey } from './feature-content'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { featureContent, featureKeys, resolveFeatureKey } from './feature-content'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '能力介绍' } })

const appContextStore = useAppContextStore()
const featureKey = ref<FeatureKey>('inventory')
const scrollTop = ref(0)
const switching = ref(false)
const feature = computed(() => featureContent[featureKey.value])
const nextFeature = computed(() => featureContent[featureKeys[(featureKeys.indexOf(featureKey.value) + 1) % featureKeys.length]])
const hasOrganization = computed(() => appContextStore.organizations.length > 0)
const primaryActionText = computed(() => hasOrganization.value ? '查看套餐与订阅' : '免费开通工作台')
const previewStyle = computed(() => ({ transform: `translateY(${Math.min(36, scrollTop.value * 0.08)}px)` }))

const previewRooms = [
  { number: '801', state: '招租中', tone: 'active' },
  { number: '802', state: '空置', tone: '' },
  { number: '803', state: '已出租', tone: 'muted' },
  { number: '701', state: '空置', tone: '' },
  { number: '702', state: '招租中', tone: 'active' },
  { number: '703', state: '已出租', tone: 'muted' },
]

function backToIntroduction() {
  if (getCurrentPages().length > 1)
    uni.navigateBack()
  else
    uni.redirectTo({ url: APP_ROUTES.saasHome })
}

function openNextFeature() {
  uni.redirectTo({ url: `${APP_ROUTES.saasFeature}?feature=${nextFeature.value.key}` })
}

function scrollToCapabilities() {
  uni.pageScrollTo({ selector: '#feature-capabilities', duration: 320 })
}

function startTrial() {
  const target = APP_ROUTES.saasOnboarding
  uni.navigateTo({ url: appContextStore.authenticated ? target : getLoginRoute(target) })
}

async function primaryAction() {
  if (!hasOrganization.value) {
    startTrial()
    return
  }
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

onLoad((options) => {
  featureKey.value = resolveFeatureKey(options?.feature)
})
onPageScroll((event) => {
  scrollTop.value = Math.min(600, Math.round(event.scrollTop / 8) * 8)
})
</script>

<template>
  <view class="feature-page">
    <AppCustomNavigation title="" back immersive transparent :fallback-url="APP_ROUTES.saasHome" />
    <view class="detail-hero">
      <view class="detail-hero__grid" />
      <view class="detail-hero__glow" />
      <view class="detail-hero__inner">
        <view class="breadcrumb">
          <button @click="backToIntroduction">
            产品介绍
          </button>
          <view class="i-carbon-chevron-right" />
          <text>{{ feature.name }}</text>
        </view>
        <view class="hero-index">
          <view class="hero-index__line" />PRODUCT MODULE / {{ feature.number }}
        </view>
        <view class="detail-hero__title">
          <text>{{ feature.title }}</text><text>{{ feature.accent }}</text>
        </view>
        <text class="detail-hero__summary">{{ feature.summary }}</text>
        <view class="highlight-list">
          <view v-for="item in feature.highlights" :key="item">
            <view class="i-carbon-checkmark" />{{ item }}
          </view>
        </view>
        <button class="explore-button" @click="scrollToCapabilities">
          深入了解 <view class="i-carbon-arrow-down" />
        </button>

        <view class="preview-stage" :style="previewStyle">
          <view class="preview-stage__caption">
            <view class="preview-stage__caption-line" />{{ feature.previewTitle }}<text>界面示意</text>
          </view>
          <view class="preview-window">
            <view class="preview-window__top">
              <view class="preview-logo">
                L
              </view><strong>{{ feature.name }}</strong><view class="preview-window__live">
                <i />实时协作
              </view>
            </view>

            <view v-if="featureKey === 'inventory'" class="preview-inventory">
              <view class="preview-panel-title">
                <strong>城西门店 · 房源盘面</strong><text>共 6 套示意房源</text>
              </view>
              <view class="preview-tabs">
                <text class="preview-tabs__active">全部</text><text>空置</text><text>招租中</text><text>已出租</text>
              </view>
              <view class="preview-room-grid">
                <view v-for="room in previewRooms" :key="room.number" class="preview-room" :class="`preview-room--${room.tone}`">
                  <text>{{ room.number.slice(0, 1) }}F · {{ room.number }}</text><strong>{{ room.state }}</strong>
                </view>
              </view>
            </view>

            <view v-else-if="featureKey === 'clients'" class="preview-clients">
              <view class="preview-client-card">
                <view class="preview-avatar">
                  客
                </view><view><strong>客户需求档案</strong><text>城西片区 · 两居优先</text></view><view class="preview-client-state">
                  跟进中
                </view>
              </view>
              <view class="preview-flow-row">
                <view class="preview-flow-dot" /><view><strong>需求已记录</strong><text>偏好与预算已整理</text></view><text>01</text>
              </view>
              <view class="preview-flow-row">
                <view class="preview-flow-dot" /><view><strong>带看已安排</strong><text>关联房源与负责人</text></view><text>02</text>
              </view>
              <view class="preview-flow-row">
                <view class="preview-flow-dot preview-flow-dot--muted" /><view><strong>等待后续反馈</strong><text>下一次沟通有上下文</text></view><text>03</text>
              </view>
            </view>

            <view v-else-if="featureKey === 'contracts'" class="preview-contracts">
              <view class="preview-paper">
                <view class="preview-paper__top">
                  <view class="i-carbon-document-signed" /><text>签约信息</text><view class="preview-paper__status">
                    履约中
                  </view>
                </view><view class="preview-paper__line" /><view class="preview-paper__line preview-paper__line--short" /><view class="preview-paper__fields">
                  <view><text>签约房源</text><strong>城西门店 · 8F 801</strong></view><view><text>租约进度</text><strong>持续跟进</strong></view>
                </view>
              </view>
              <view class="preview-contract-steps">
                <view><i />成交登记</view><view><i />租约生效</view><view><i />履约跟进</view>
              </view>
            </view>

            <view v-else class="preview-insights">
              <view class="preview-insights__metrics">
                <view><text>经营事件 · 示意</text><strong>128</strong></view><view><text>指标数量 · 示意</text><strong>04</strong></view>
              </view>
              <view class="preview-chart">
                <view class="preview-chart__grid" /><view class="preview-chart__bars">
                  <i /><i /><i /><i /><i /><i /><i />
                </view>
              </view>
              <view class="preview-chart__foot">
                <view class="i-carbon-chart-line" /> 时间趋势清晰可见
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-body">
      <view class="detail-body__inner">
        <view id="feature-capabilities" class="detail-intro scroll-reveal">
          <view class="section-number">
            01 <view />
          </view><text class="section-eyebrow">THE CAPABILITY</text><strong>{{ feature.sectionTitle }}</strong><text>{{ feature.sectionDescription }}</text>
        </view>
        <view class="scenario-card scroll-reveal">
          <view class="scenario-card__mark i-carbon-quotes" /><view><text>一个真实的使用场景</text><strong>{{ feature.scenario }}</strong></view>
        </view>
        <view class="capability-list">
          <view v-for="(item, index) in feature.capabilities" :key="item.title" class="capability-card scroll-reveal">
            <view class="capability-card__top">
              <view class="capability-card__icon" :class="item.icon" /><text>0{{ index + 1 }}</text>
            </view><strong>{{ item.title }}</strong><text>{{ item.description }}</text><view class="capability-card__rule" />
          </view>
        </view>

        <view class="workflow-panel scroll-reveal">
          <view class="workflow-panel__glow" /><view class="workflow-panel__heading">
            <text class="section-eyebrow">HOW IT FLOWS</text><strong>从一个动作开始，<br>让业务顺畅向前。</strong>
          </view><view class="workflow-steps">
            <view v-for="(step, index) in feature.steps" :key="step.title" class="workflow-step">
              <view class="workflow-step__rail">
                <view>{{ index + 1 }}</view><i v-if="index < feature.steps.length - 1" />
              </view><view class="workflow-step__body">
                <strong>{{ step.title }}</strong><text>{{ step.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="outcome-card scroll-reveal">
          <view class="outcome-card__icon i-carbon-checkmark-filled" /><text>最后，你会得到</text><strong>{{ feature.outcome }}</strong>
        </view>

        <button class="next-feature scroll-reveal" @click="openNextFeature">
          <view><text>继续探索下一项能力 / {{ nextFeature.number }}</text><strong>{{ nextFeature.name }}</strong></view><view class="next-feature__arrow i-carbon-arrow-up-right" />
        </button>

        <view class="detail-cta scroll-reveal">
          <text>YOUR NEXT CHAPTER STARTS HERE</text><strong>从今天开始，<br>让生意更有序。</strong><button class="primary-button" :disabled="switching" @click="primaryAction">
            {{ primaryActionText }} <view class="i-carbon-arrow-up-right" />
          </button><button class="return-link" @click="backToIntroduction">
            返回完整产品介绍 <view class="i-carbon-arrow-right" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.feature-page {
  min-height: 100vh;
  background: #07152e;
  color: #172641;
}
.feature-page :deep(.app-custom-navigation) {
  --app-text-primary: #fff;
  background: transparent;
  pointer-events: none;
}
.feature-page :deep(.app-custom-navigation__back) {
  color: #fff;
  background: rgb(10 34 76 / 86%);
  pointer-events: auto;
}
button {
  margin: 0;
  padding: 0;
  border: 0;
  font: inherit;
  line-height: normal;
  box-sizing: border-box;
}
button::after {
  border: 0;
}
.detail-hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  background:
    radial-gradient(ellipse at 85% 15%, #275593, transparent 39%),
    linear-gradient(155deg, #07152e, #0c2b58 58%, #0a1d3e);
}
.detail-hero__grid {
  position: absolute;
  top: 0;
  right: -140rpx;
  width: 600rpx;
  height: 780rpx;
  background-image:
    linear-gradient(rgb(134 191 255 / 9%) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgb(134 191 255 / 9%) 1rpx, transparent 1rpx);
  background-size: 68rpx 68rpx;
  transform: rotate(-12deg);
  pointer-events: none;
}
.detail-hero__glow {
  position: absolute;
  top: -190rpx;
  right: -230rpx;
  width: 600rpx;
  height: 600rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(80 143 255 / 28%), transparent 70%);
  pointer-events: none;
  animation: hero-glow 9s ease-in-out infinite alternate;
}
.detail-hero__inner,
.detail-body__inner {
  position: relative;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  box-sizing: border-box;
}
.detail-hero__inner {
  padding: calc(150rpx + env(safe-area-inset-top)) 36rpx 96rpx;
}
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 12rpx;
  color: #9dbbdd;
  font-size: 19rpx;
}
.breadcrumb button {
  color: #9dbbdd;
  background: transparent;
  font-size: 19rpx;
}
.breadcrumb .i-carbon-chevron-right {
  font-size: 18rpx;
}
.breadcrumb text {
  color: #d9eaff;
}
.hero-index {
  display: flex;
  align-items: center;
  gap: 13rpx;
  margin-top: 49rpx;
  color: #8ecaff;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  animation: rise-in 650ms ease-out both;
}
.hero-index__line {
  width: 28rpx;
  height: 2rpx;
  background: #8ecaff;
}
.detail-hero__title {
  display: flex;
  flex-direction: column;
  margin-top: 25rpx;
  font-size: 59rpx;
  font-weight: 800;
  letter-spacing: -2rpx;
  line-height: 1.23;
  animation: rise-in 750ms 100ms ease-out both;
}
.detail-hero__title text:last-child {
  color: #7cc8ff;
  text-shadow: 0 0 45rpx rgb(124 200 255 / 22%);
}
.detail-hero__summary {
  display: block;
  max-width: 690rpx;
  margin-top: 23rpx;
  color: #c0d1e9;
  font-size: 23rpx;
  line-height: 1.75;
  animation: rise-in 750ms 200ms ease-out both;
}
.highlight-list {
  display: flex;
  flex-wrap: wrap;
  gap: 11rpx;
  margin-top: 26rpx;
  animation: rise-in 750ms 300ms ease-out both;
}
.highlight-list > view {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 11rpx 15rpx;
  border: 1rpx solid rgb(124 200 255 / 20%);
  border-radius: 100rpx;
  color: #c6dcf4;
  background: rgb(124 200 255 / 8%);
  font-size: 17rpx;
}
.highlight-list .i-carbon-checkmark {
  color: #7cc8ff;
  font-size: 20rpx;
}
.explore-button {
  display: flex;
  align-items: center;
  gap: 11rpx;
  margin-top: 27rpx;
  color: #a7d9ff;
  background: transparent;
  font-size: 21rpx;
  font-weight: 700;
  animation: rise-in 750ms 350ms ease-out both;
}
.explore-button .i-carbon-arrow-down {
  font-size: 21rpx;
}
.preview-stage {
  position: relative;
  max-width: 690rpx;
  margin: 70rpx auto 0;
  animation: fade-in 800ms 400ms ease-out both;
}
.preview-stage__caption {
  display: flex;
  align-items: center;
  gap: 11rpx;
  margin-bottom: 20rpx;
  color: #a8c7e8;
  font-size: 20rpx;
}
.preview-stage__caption-line {
  width: 30rpx;
  height: 2rpx;
  background: #7cc8ff;
}
.preview-stage__caption text {
  margin-left: auto;
  color: #819fbe;
  font-size: 17rpx;
}
.preview-window {
  position: relative;
  overflow: hidden;
  min-height: 310rpx;
  padding: 25rpx;
  border: 1rpx solid rgb(255 255 255 / 34%);
  border-radius: 27rpx;
  background: linear-gradient(145deg, #f5f9ff, #e8f1ff);
  color: #193a67;
  box-shadow: 0 27rpx 66rpx rgb(0 0 0 / 26%);
  transform: rotate(-2deg);
  animation: preview-open 850ms 400ms ease-out both;
  box-sizing: border-box;
}
.preview-window__top {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 24rpx;
  font-size: 18rpx;
}
.preview-logo {
  display: flex;
  width: 31rpx;
  height: 31rpx;
  align-items: center;
  justify-content: center;
  border-radius: 9rpx;
  color: #eaf5ff;
  background: #18529b;
  font-size: 18rpx;
  font-weight: 800;
}
.preview-window__top strong {
  font-size: 18rpx;
}
.preview-window__live {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-left: auto;
  color: #6386b1;
  font-size: 15rpx;
}
.preview-window__live i {
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: #68b7f9;
  box-shadow: 0 0 0 5rpx rgb(104 183 249 / 12%);
}
.preview-panel-title {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
}
.preview-panel-title strong {
  font-size: 23rpx;
}
.preview-panel-title text {
  color: #899eb8;
  font-size: 16rpx;
}
.preview-tabs {
  display: flex;
  gap: 11rpx;
  margin: 20rpx 0 17rpx;
}
.preview-tabs text {
  padding: 7rpx 10rpx;
  border-radius: 7rpx;
  color: #8da0b9;
  font-size: 15rpx;
}
.preview-tabs__active {
  color: #276bb8 !important;
  background: #dfedff;
}
.preview-room-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 9rpx;
}
.preview-room {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 14rpx 9rpx;
  border-radius: 9rpx;
  background: #fff;
}
.preview-room text {
  color: #91a2b7;
  font-size: 14rpx;
}
.preview-room strong {
  font-size: 16rpx;
}
.preview-room--active {
  background: #dceeff;
}
.preview-room--active strong {
  color: #226bbb;
}
.preview-room--muted {
  background: #e8edf6;
}
.preview-room--muted strong {
  color: #8596ab;
}
.preview-client-card {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 17rpx;
  border-radius: 14rpx;
  background: #fff;
}
.preview-avatar {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2069ba;
  background: #e0eeff;
  font-size: 19rpx;
  font-weight: 800;
}
.preview-client-card > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.preview-client-card strong {
  font-size: 18rpx;
}
.preview-client-card text {
  color: #8a9db5;
  font-size: 15rpx;
}
.preview-client-state {
  padding: 6rpx 9rpx;
  border-radius: 100rpx;
  color: #276ebd;
  background: #e8f3ff;
  font-size: 14rpx;
}
.preview-flow-row {
  display: flex;
  align-items: center;
  gap: 13rpx;
  padding: 16rpx 5rpx;
  border-bottom: 1rpx solid #e0eaf8;
}
.preview-flow-row:last-child {
  border-bottom: 0;
}
.preview-flow-dot {
  width: 11rpx;
  height: 11rpx;
  border-radius: 50%;
  background: #5eabf2;
  box-shadow: 0 0 0 6rpx #dfefff;
}
.preview-flow-dot--muted {
  background: #a9bfdb;
  box-shadow: 0 0 0 6rpx #e8eef6;
}
.preview-flow-row > view:nth-child(2) {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}
.preview-flow-row strong {
  font-size: 17rpx;
}
.preview-flow-row text {
  color: #91a4bb;
  font-size: 14rpx;
}
.preview-paper {
  padding: 20rpx;
  border-radius: 15rpx;
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgb(28 76 153 / 7%);
}
.preview-paper__top {
  display: flex;
  align-items: center;
  gap: 9rpx;
  font-size: 19rpx;
  font-weight: 800;
}
.preview-paper__top .i-carbon-document-signed {
  color: #2e79c7;
  font-size: 23rpx;
}
.preview-paper__status {
  margin-left: auto;
  padding: 7rpx 10rpx;
  border-radius: 100rpx;
  color: #286fbf;
  background: #e4f0ff;
  font-size: 14rpx;
  font-weight: 600;
}
.preview-paper__line {
  width: 70%;
  height: 7rpx;
  margin-top: 16rpx;
  border-radius: 5rpx;
  background: #e9eff7;
}
.preview-paper__line--short {
  width: 49%;
  margin-top: 8rpx;
}
.preview-paper__fields {
  display: flex;
  justify-content: space-between;
  gap: 10rpx;
  margin-top: 22rpx;
}
.preview-paper__fields > view {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.preview-paper__fields text {
  color: #94a7bc;
  font-size: 14rpx;
}
.preview-paper__fields strong {
  font-size: 16rpx;
}
.preview-contract-steps {
  display: flex;
  justify-content: space-between;
  gap: 7rpx;
  margin-top: 22rpx;
}
.preview-contract-steps > view {
  display: flex;
  align-items: center;
  gap: 5rpx;
  color: #5f82ac;
  font-size: 15rpx;
}
.preview-contract-steps i {
  width: 7rpx;
  height: 7rpx;
  border-radius: 50%;
  background: #5baff4;
}
.preview-insights__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12rpx;
}
.preview-insights__metrics > view {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
  padding: 17rpx;
  border-radius: 13rpx;
  background: #fff;
}
.preview-insights__metrics text {
  color: #89a0bb;
  font-size: 15rpx;
}
.preview-insights__metrics strong {
  color: #1e5eaa;
  font-size: 34rpx;
}
.preview-chart {
  position: relative;
  overflow: hidden;
  height: 130rpx;
  margin-top: 12rpx;
  border-radius: 13rpx;
  background: #e9f2ff;
}
.preview-chart__grid {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(to top, transparent 0, transparent 31rpx, rgb(75 126 196 / 12%) 32rpx);
}
.preview-chart__bars {
  position: absolute;
  right: 16rpx;
  bottom: 0;
  left: 16rpx;
  display: flex;
  height: 115rpx;
  align-items: flex-end;
  justify-content: space-between;
}
.preview-chart__bars i {
  width: 10%;
  height: 33%;
  border-radius: 6rpx 6rpx 0 0;
  background: linear-gradient(180deg, #8ed3ff, #3f80de);
}
.preview-chart__bars i:nth-child(2) {
  height: 58%;
}
.preview-chart__bars i:nth-child(3) {
  height: 44%;
}
.preview-chart__bars i:nth-child(4) {
  height: 77%;
}
.preview-chart__bars i:nth-child(5) {
  height: 62%;
}
.preview-chart__bars i:nth-child(6) {
  height: 91%;
}
.preview-chart__bars i:nth-child(7) {
  height: 70%;
}
.preview-chart__foot {
  display: flex;
  align-items: center;
  gap: 6rpx;
  margin-top: 11rpx;
  color: #4e80ba;
  font-size: 15rpx;
}
.detail-body {
  position: relative;
  margin-top: -28rpx;
  padding: 1rpx 0 calc(80rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #f5f8fd;
}
.detail-body__inner {
  padding: 0 30rpx;
}
.detail-intro {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding-top: 90rpx;
}
.section-number {
  display: flex;
  align-items: center;
  gap: 13rpx;
  color: #a4b3c9;
  font-size: 20rpx;
  font-weight: 800;
}
.section-number > view {
  width: 43rpx;
  height: 1rpx;
  background: #b6c7dc;
}
.section-eyebrow {
  color: #2d70c6;
  font-size: 17rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.detail-intro .section-eyebrow {
  margin-top: 17rpx;
}
.detail-intro strong {
  margin-top: 18rpx;
  color: #1b3054;
  font-size: 42rpx;
  font-weight: 800;
  letter-spacing: -1rpx;
  line-height: 1.32;
}
.detail-intro > text:last-child {
  margin-top: 18rpx;
  color: #75869f;
  font-size: 22rpx;
  line-height: 1.7;
}
.scenario-card {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
  padding: 27rpx;
  border: 1rpx solid #dceaf9;
  border-radius: 24rpx;
  background: linear-gradient(125deg, #e4f0ff, #fff);
}
.scenario-card__mark {
  flex: 0 0 auto;
  color: #6ca9e9;
  font-size: 32rpx;
}
.scenario-card > view:last-child {
  display: flex;
  flex-direction: column;
  gap: 11rpx;
}
.scenario-card text {
  color: #4183ca;
  font-size: 18rpx;
  font-weight: 700;
}
.scenario-card strong {
  color: #385475;
  font-size: 21rpx;
  font-weight: 600;
  line-height: 1.65;
}
.capability-list {
  display: grid;
  gap: 15rpx;
  margin-top: 16rpx;
}
.capability-card {
  position: relative;
  overflow: hidden;
  padding: 29rpx;
  border: 1rpx solid #e1eaf6;
  border-radius: 25rpx;
  background: #fff;
  box-shadow: 0 10rpx 29rpx rgb(28 67 132 / 4%);
}
.capability-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.capability-card__icon {
  display: flex;
  width: 55rpx;
  height: 55rpx;
  align-items: center;
  justify-content: center;
  border-radius: 16rpx;
  color: #2473c7;
  background: #e4f1ff;
  font-size: 28rpx;
}
.capability-card__top text {
  color: #c4d4e9;
  font-size: 20rpx;
  font-weight: 800;
}
.capability-card > strong {
  display: block;
  margin-top: 22rpx;
  color: #1b335a;
  font-size: 27rpx;
}
.capability-card > text {
  display: block;
  margin-top: 11rpx;
  color: #74869f;
  font-size: 21rpx;
  line-height: 1.65;
}
.capability-card__rule {
  width: 60rpx;
  height: 3rpx;
  margin-top: 25rpx;
  border-radius: 3rpx;
  background: #7cc8ff;
}
.workflow-panel {
  position: relative;
  overflow: hidden;
  margin-top: 70rpx;
  padding: 39rpx 31rpx;
  border-radius: 29rpx;
  color: #fff;
  background: linear-gradient(145deg, #0f2c62, #173e79);
}
.workflow-panel__glow {
  position: absolute;
  top: -170rpx;
  right: -200rpx;
  width: 500rpx;
  height: 500rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(108 169 255 / 27%), transparent 68%);
}
.workflow-panel__heading,
.workflow-steps {
  position: relative;
}
.workflow-panel__heading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.workflow-panel__heading .section-eyebrow {
  color: #94ccff;
}
.workflow-panel__heading strong {
  margin-top: 17rpx;
  font-size: 36rpx;
  line-height: 1.35;
}
.workflow-steps {
  margin-top: 37rpx;
}
.workflow-step {
  display: flex;
  gap: 18rpx;
}
.workflow-step__rail {
  display: flex;
  width: 43rpx;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
}
.workflow-step__rail > view {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #8bcbff;
  border-radius: 50%;
  color: #b7e0ff;
  font-size: 20rpx;
  font-weight: 800;
}
.workflow-step__rail i {
  width: 1rpx;
  min-height: 82rpx;
  flex: 1;
  margin: 8rpx 0;
  background: rgb(163 211 255 / 33%);
}
.workflow-step__body {
  display: flex;
  flex-direction: column;
  gap: 7rpx;
  padding: 4rpx 0 30rpx;
}
.workflow-step__body strong {
  font-size: 23rpx;
}
.workflow-step__body text {
  color: #b7cbe5;
  font-size: 19rpx;
  line-height: 1.55;
}
.outcome-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 19rpx;
  padding: 30rpx;
  border: 1rpx solid #dceafb;
  border-radius: 24rpx;
  background: #eaf3ff;
}
.outcome-card__icon {
  color: #3387db;
  font-size: 31rpx;
}
.outcome-card text {
  margin-top: 17rpx;
  color: #5182ba;
  font-size: 18rpx;
  font-weight: 800;
}
.outcome-card strong {
  margin-top: 9rpx;
  color: #1d3a69;
  font-size: 26rpx;
  line-height: 1.45;
}
.next-feature {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 52rpx;
  padding: 25rpx 28rpx;
  border: 1rpx solid #dce8f6;
  border-radius: 23rpx;
  background: #fff;
  text-align: left;
}
.next-feature > view:first-child {
  display: flex;
  flex-direction: column;
  gap: 9rpx;
}
.next-feature text {
  color: #6886aa;
  font-size: 17rpx;
  font-weight: 700;
}
.next-feature strong {
  color: #1e3b67;
  font-size: 29rpx;
}
.next-feature__arrow {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #236fbe;
  background: #e6f2ff;
  font-size: 26rpx;
}
.detail-cta {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 65rpx;
  padding: 43rpx 32rpx;
  border-radius: 29rpx;
  color: #fff;
  background: #0d2857;
}
.detail-cta::before {
  position: absolute;
  right: -180rpx;
  bottom: -220rpx;
  width: 520rpx;
  height: 520rpx;
  border: 1rpx solid rgb(124 200 255 / 18%);
  border-radius: 50%;
  box-shadow:
    0 0 0 70rpx rgb(124 200 255 / 3%),
    0 0 0 140rpx rgb(124 200 255 / 3%);
  content: '';
  pointer-events: none;
}
.detail-cta > text {
  position: relative;
  color: #a1d4ff;
  font-size: 16rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}
.detail-cta > strong {
  position: relative;
  margin: 24rpx 0 30rpx;
  font-size: 43rpx;
  line-height: 1.3;
}
.primary-button {
  position: relative;
  display: flex;
  min-height: 78rpx;
  align-items: center;
  gap: 19rpx;
  padding: 0 28rpx;
  border-radius: 17rpx;
  color: #08294d;
  background: #7cc8ff;
  font-size: 23rpx;
  font-weight: 800;
  box-shadow: 0 14rpx 33rpx rgb(50 145 255 / 18%);
}
.primary-button .i-carbon-arrow-up-right {
  font-size: 27rpx;
}
.primary-button[disabled] {
  opacity: 0.6;
}
.return-link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 7rpx;
  margin-top: 25rpx;
  color: #a9d6fa;
  background: transparent;
  font-size: 19rpx;
}
.return-link .i-carbon-arrow-right {
  font-size: 21rpx;
}
@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(24rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes preview-open {
  from {
    opacity: 0;
    transform: rotate(-6deg) translateY(36rpx) scale(0.93);
  }
  to {
    opacity: 1;
    transform: rotate(-2deg) translateY(0) scale(1);
  }
}
@keyframes hero-glow {
  from {
    opacity: 0.55;
    transform: translate(-20rpx, -20rpx) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translate(-80rpx, 65rpx) scale(1.12);
  }
}
@keyframes reveal-up {
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
    animation-name: reveal-up;
    animation-duration: 1s;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-timeline: view();
    animation-range: entry 0% cover 24%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail-hero__glow,
  .hero-index,
  .detail-hero__title,
  .detail-hero__summary,
  .highlight-list,
  .explore-button,
  .preview-stage,
  .preview-window,
  .scroll-reveal {
    animation: none !important;
    opacity: 1 !important;
  }
  .preview-stage {
    transform: none !important;
  }
  .scroll-reveal {
    transform: none !important;
  }
}
@media (min-width: 900px) {
  .detail-hero__inner {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 70rpx;
    align-items: center;
    padding: 150rpx 50rpx 130rpx;
  }
  .breadcrumb,
  .hero-index,
  .detail-hero__title,
  .detail-hero__summary,
  .highlight-list,
  .explore-button {
    grid-column: 1;
  }
  .preview-stage {
    grid-column: 2;
    grid-row: 1 / span 6;
    width: 100%;
    margin: 0;
  }
  .detail-body__inner {
    padding: 0 50rpx;
  }
  .capability-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .workflow-panel {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 30rpx;
    align-items: center;
  }
}
</style>
