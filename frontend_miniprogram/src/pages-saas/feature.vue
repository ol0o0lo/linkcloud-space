<script setup lang="ts">
import type { FeatureKey } from './feature-content'
import { onLoad, onPageScroll } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { featureContent, featureKeys, resolveFeatureKey } from './feature-content'
import { APP_ROUTES, getLoginRoute } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '功能介绍' } })

const appContextStore = useAppContextStore()
const featureKey = ref<FeatureKey>('inventory')
const scrollTop = ref(0)
const switching = ref(false)
const feature = computed(() => featureContent[featureKey.value])
const nextFeature = computed(() => featureContent[featureKeys[(featureKeys.indexOf(featureKey.value) + 1) % featureKeys.length]])
const hasOrganization = computed(() => appContextStore.organizations.length > 0)
const primaryActionText = computed(() => hasOrganization.value ? '查看套餐与用量' : '免费开通工作台')
const previewStyle = computed(() => ({ transform: `translateY(${Math.min(36, scrollTop.value * 0.08)}px)` }))

const previewRooms = [
  { number: '801', state: '招租中', tone: 'active' },
  { number: '802', state: '暂不出租', tone: '' },
  { number: '803', state: '已出租', tone: 'muted' },
  { number: '701', state: '暂不出租', tone: '' },
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
  <view class="feature-page min-h-screen">
    <AppCustomNavigation title="" back immersive transparent :fallback-url="APP_ROUTES.saasHome" />
    <view class="detail-hero relative overflow-hidden text-white">
      <view class="detail-hero__grid pointer-events-none absolute top-0 h-96 w-72 -right-18" />
      <view class="detail-hero__glow pointer-events-none absolute h-72 w-72 rounded-full -right-28 -top-24" />
      <view class="detail-hero__inner relative mx-auto my-0 box-border w-full px-4 pb-12">
        <view class="breadcrumb flex items-center gap-1.5 text-size-2xs">
          <button class="m-0 box-border border-0 p-0" @click="backToIntroduction">
            产品介绍
          </button>
          <view class="i-carbon-chevron-right" />
          <text>{{ feature.name }}</text>
        </view>
        <view class="hero-index mt-6 flex items-center gap-1.5 text-size-3xs font-extrabold">
          <view class="hero-index__line w-3.5" />PRODUCT MODULE / {{ feature.number }}
        </view>
        <view class="detail-hero__title mt-3 flex flex-col text-size-3xl font-extrabold leading-tight">
          <text>{{ feature.title }}</text><text>{{ feature.accent }}</text>
        </view>
        <text class="detail-hero__summary mt-3 block text-size-xs leading-relaxed">{{ feature.summary }}</text>
        <view class="highlight-list mt-3 flex flex-wrap gap-1.5">
          <view v-for="item in feature.highlights" :key="item">
            <view class="i-carbon-checkmark" />{{ item }}
          </view>
        </view>
        <button class="explore-button mx-0 mb-0 mt-3.5 box-border flex items-center gap-1.5 border-0 bg-transparent p-0 text-size-2xs font-bold" @click="scrollToCapabilities">
          深入了解 <view class="i-carbon-arrow-down" />
        </button>

        <view class="preview-stage relative mx-auto mb-0 mt-9" :style="previewStyle">
          <view class="preview-stage__caption mb-2.5 flex items-center gap-1.5 text-size-2xs">
            <view class="preview-stage__caption-line w-3.5" />{{ feature.previewTitle }}<text>界面示意</text>
          </view>
          <view class="preview-window relative box-border min-h-40 overflow-hidden border-hairline rounded-xl border-solid p-3">
            <view class="preview-window__top mb-3 flex items-center gap-1 text-size-3xs">
              <view class="preview-logo h-4 w-4 flex items-center justify-center rounded text-size-3xs font-extrabold">
                L
              </view><strong>{{ feature.name }}</strong><view class="preview-window__live ml-auto flex items-center gap-0.5 text-size-3xs">
                <i />团队协作
              </view>
            </view>

            <view v-if="featureKey === 'inventory'" class="preview-inventory">
              <view class="preview-panel-title flex flex-col gap-0.5">
                <strong>城西门店 · 房源管理</strong><text>共 6 套示意房源</text>
              </view>
              <view class="preview-tabs mx-0 mb-2 mt-2.5 flex gap-1.5">
                <text class="preview-tabs__active">全部</text><text>暂不出租</text><text>招租中</text><text>已出租</text>
              </view>
              <view class="preview-room-grid grid grid-cols-3 gap-1">
                <view v-for="room in previewRooms" :key="room.number" class="preview-room flex flex-col gap-1 rounded bg-white px-1 py-1.5" :class="`preview-room--${room.tone}`">
                  <text>{{ room.number.slice(0, 1) }}F · {{ room.number }}</text><strong>{{ room.state }}</strong>
                </view>
              </view>
            </view>

            <view v-else-if="featureKey === 'clients'" class="preview-clients">
              <view class="preview-client-card flex items-center gap-1.5 rounded-md bg-white p-2">
                <view class="preview-avatar h-5 w-5 flex items-center justify-center rounded-full text-size-2xs font-extrabold">
                  客
                </view><view><strong>客户需求档案</strong><text>城西片区 · 两居优先</text></view><view class="preview-client-state rounded-full px-1 py-0.5 text-size-3xs">
                  跟进中
                </view>
              </view>
              <view class="preview-flow-row flex items-center gap-1.5 border-b-hairline border-b-solid px-0.5 py-2">
                <view class="preview-flow-dot h-1.5 w-1.5 rounded-full" /><view><strong>需求已记录</strong><text>偏好与预算已整理</text></view><text>01</text>
              </view>
              <view class="preview-flow-row flex items-center gap-1.5 border-b-hairline border-b-solid px-0.5 py-2">
                <view class="preview-flow-dot h-1.5 w-1.5 rounded-full" /><view><strong>带看已安排</strong><text>关联房源与负责人</text></view><text>02</text>
              </view>
              <view class="preview-flow-row flex items-center gap-1.5 border-b-hairline border-b-solid px-0.5 py-2">
                <view class="preview-flow-dot preview-flow-dot--muted h-1.5 w-1.5 rounded-full" /><view><strong>等待后续反馈</strong><text>下次沟通可查阅记录</text></view><text>03</text>
              </view>
            </view>

            <view v-else-if="featureKey === 'contracts'" class="preview-contracts">
              <view class="preview-paper rounded-lg bg-white p-2.5">
                <view class="preview-paper__top flex items-center gap-1 text-size-2xs font-extrabold">
                  <view class="i-carbon-document-signed" /><text>签约信息</text><view class="preview-paper__status ml-auto rounded-full p-1 text-size-3xs font-semibold">
                    履约中
                  </view>
                </view><view class="preview-paper__line mt-2 h-1 rounded-sm" /><view class="preview-paper__line preview-paper__line--short mt-1 h-1 rounded-sm" /><view class="preview-paper__fields mt-2.5 flex justify-between gap-1">
                  <view><text>签约房源</text><strong>城西门店 · 8F 801</strong></view><view><text>租约进度</text><strong>持续跟进</strong></view>
                </view>
              </view>
              <view class="preview-contract-steps mt-2.5 flex justify-between gap-1">
                <view><i />成交登记</view><view><i />租约生效</view><view><i />履约跟进</view>
              </view>
            </view>

            <view v-else class="preview-insights">
              <view class="preview-insights__metrics grid grid-cols-2 gap-1.5">
                <view><text>业务记录数 · 示意</text><strong>128</strong></view><view><text>指标数量 · 示意</text><strong>04</strong></view>
              </view>
              <view class="preview-chart relative mt-1.5 h-16 overflow-hidden rounded-md">
                <view class="preview-chart__grid absolute inset-0" /><view class="preview-chart__bars absolute bottom-0 left-2 right-2 h-14 flex items-end justify-between">
                  <i /><i /><i /><i /><i /><i /><i />
                </view>
              </view>
              <view class="preview-chart__foot mt-1.5 flex items-center gap-0.5 text-size-3xs">
                <view class="i-carbon-chart-line" /> 时间趋势清晰可见
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-body relative px-0 -mt-3.5">
      <view class="detail-body__inner relative mx-auto my-0 box-border w-full px-3.5 py-0">
        <view id="feature-capabilities" class="detail-intro scroll-reveal flex flex-col items-start pt-11">
          <view class="section-number flex items-center gap-1.5 text-size-2xs font-extrabold">
            01 <view />
          </view><text class="section-eyebrow text-size-3xs font-extrabold">THE CAPABILITY</text><strong>{{ feature.sectionTitle }}</strong><text>{{ feature.sectionDescription }}</text>
        </view>
        <view class="scenario-card scroll-reveal mt-3.5 flex gap-2 border-hairline rounded-xl border-solid p-3.5">
          <view class="scenario-card__mark i-carbon-quotes flex-none text-size-base" /><view><text>一个真实的使用场景</text><strong>{{ feature.scenario }}</strong></view>
        </view>
        <view class="capability-list grid mt-2 gap-2">
          <view v-for="(item, index) in feature.capabilities" :key="item.title" class="capability-card scroll-reveal relative overflow-hidden border-hairline rounded-xl border-solid bg-white p-3.5">
            <view class="capability-card__top flex items-center justify-between">
              <view class="capability-card__icon h-7 w-7 flex items-center justify-center rounded-lg text-size-sm" :class="item.icon" /><text>0{{ index + 1 }}</text>
            </view><strong>{{ item.title }}</strong><text>{{ item.description }}</text><view class="capability-card__rule mt-3 h-0.5 w-7 rounded-sm" />
          </view>
        </view>

        <view class="workflow-panel scroll-reveal relative mt-9 overflow-hidden rounded-2xl px-4 py-5 text-white">
          <view class="workflow-panel__glow absolute h-64 w-64 rounded-full -right-24 -top-20" /><view class="workflow-panel__heading relative flex flex-col items-start">
            <text class="section-eyebrow text-size-3xs font-extrabold">HOW IT FLOWS</text><strong>从一个动作开始，<br>让业务顺畅向前。</strong>
          </view><view class="workflow-steps relative mt-5">
            <view v-for="(step, index) in feature.steps" :key="step.title" class="workflow-step flex gap-2">
              <view class="workflow-step__rail w-5 flex flex-none flex-col items-center">
                <view>{{ index + 1 }}</view><i v-if="index < feature.steps.length - 1" />
              </view><view class="workflow-step__body flex flex-col gap-1 px-0 pb-3.5 pt-0.5">
                <strong>{{ step.title }}</strong><text>{{ step.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="outcome-card scroll-reveal mt-2.5 flex flex-col items-start border-hairline rounded-xl border-solid p-3.5">
          <view class="outcome-card__icon i-carbon-checkmark-filled text-size-base" /><text>最后，你会得到</text><strong>{{ feature.outcome }}</strong>
        </view>

        <button class="next-feature scroll-reveal mx-0 mb-0 mt-6 box-border w-full flex items-center justify-between gap-2.5 border-0 border-hairline rounded-xl border-solid bg-white px-3.5 py-3 text-left" @click="openNextFeature">
          <view><text>继续了解下一项功能 / {{ nextFeature.number }}</text><strong>{{ nextFeature.name }}</strong></view><view class="next-feature__arrow i-carbon-arrow-up-right h-6 w-6 flex flex-none items-center justify-center rounded-full text-size-xs" />
        </button>

        <view class="detail-cta scroll-reveal relative mt-8 flex flex-col items-start overflow-hidden rounded-2xl px-4 py-5 text-white">
          <text>YOUR NEXT CHAPTER STARTS HERE</text><strong>从今天开始，<br>让生意更有序。</strong><button class="primary-button relative m-0 box-border min-h-10 flex items-center gap-2.5 border-0 rounded-lg px-3.5 py-0 text-size-xs font-extrabold" :disabled="switching" @click="primaryAction">
            {{ primaryActionText }} <view class="i-carbon-arrow-up-right" />
          </button><button class="return-link relative mx-0 mb-0 mt-3 box-border flex items-center gap-1 border-0 bg-transparent p-0 text-size-2xs" @click="backToIntroduction">
            返回完整产品介绍 <view class="i-carbon-arrow-right" />
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.feature-page {
  background: #07152e;
  color: #172641;
}
.feature-page :deep(.app-custom-navigation) {
  @apply bg-transparent pointer-events-none;
  --app-text-primary: #fff;
}
.feature-page :deep(.app-custom-navigation__back) {
  @apply text-white pointer-events-auto;
  background: rgb(10 34 76 / 86%);
}
button {
  font-family: inherit;
  font-style: inherit;
  line-height: normal;
}
button::after {
  @apply border-0;
}
.detail-hero {
  background:
    radial-gradient(ellipse at 85% 15%, #275593, transparent 39%),
    linear-gradient(155deg, #07152e, #0c2b58 58%, #0a1d3e);
}
.detail-hero__grid {
  background-image:
    linear-gradient(rgb(134 191 255 / 9%) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgb(134 191 255 / 9%) 1rpx, transparent 1rpx);
  background-size: 68rpx 68rpx;
  transform: rotate(-12deg);
}
.detail-hero__glow {
  background: radial-gradient(circle, rgb(80 143 255 / 28%), transparent 70%);
  animation: hero-glow 9s ease-in-out infinite alternate;
}
.detail-hero__inner,
.detail-body__inner {
  max-width: 980px;
}
.detail-hero__inner {
  padding-top: calc(150rpx + env(safe-area-inset-top));
}
.breadcrumb {
  color: #9dbbdd;
}
.breadcrumb button {
  @apply bg-transparent text-size-2xs;
  color: #9dbbdd;
}
.breadcrumb .i-carbon-chevron-right {
  @apply text-size-3xs;
}
.breadcrumb text {
  color: #d9eaff;
}
.hero-index {
  color: #8ecaff;
  letter-spacing: 2rpx;
  animation: rise-in 650ms ease-out both;
}
.hero-index__line {
  height: 2rpx;
  background: #8ecaff;
}
.detail-hero__title {
  letter-spacing: -2rpx;
  animation: rise-in 750ms 100ms ease-out both;
}
.detail-hero__title text:last-child {
  color: #7cc8ff;
  text-shadow: 0 0 45rpx rgb(124 200 255 / 22%);
}
.detail-hero__summary {
  max-width: 690rpx;
  color: #c0d1e9;
  animation: rise-in 750ms 200ms ease-out both;
}
.highlight-list {
  animation: rise-in 750ms 300ms ease-out both;
}
.highlight-list > view {
  @apply flex items-center gap-0.5 border-hairline border-solid rounded-full text-size-3xs py-1.5 px-2;
  border-color: rgb(124 200 255 / 20%);
  color: #c6dcf4;
  background: rgb(124 200 255 / 8%);
}
.highlight-list .i-carbon-checkmark {
  @apply text-size-2xs;
  color: #7cc8ff;
}
.explore-button {
  color: #a7d9ff;
  animation: rise-in 750ms 350ms ease-out both;
}
.explore-button .i-carbon-arrow-down {
  @apply text-size-2xs;
}
.preview-stage {
  max-width: 690rpx;
  animation: fade-in 800ms 400ms ease-out both;
}
.preview-stage__caption {
  color: #a8c7e8;
}
.preview-stage__caption-line {
  height: 2rpx;
  background: #7cc8ff;
}
.preview-stage__caption text {
  @apply ml-auto text-size-3xs;
  color: #819fbe;
}
.preview-window {
  border-color: rgb(255 255 255 / 34%);
  background: linear-gradient(145deg, #f5f9ff, #e8f1ff);
  color: #193a67;
  box-shadow: 0 27rpx 66rpx rgb(0 0 0 / 26%);
  transform: rotate(-2deg);
  animation: preview-open 850ms 400ms ease-out both;
}
.preview-logo {
  color: #eaf5ff;
  background: #18529b;
}
.preview-window__top strong {
  @apply text-size-3xs;
}
.preview-window__live {
  color: #6386b1;
}
.preview-window__live i {
  @apply w-1 h-1 rounded-full;
  background: #68b7f9;
  box-shadow: 0 0 0 5rpx rgb(104 183 249 / 12%);
}
.preview-panel-title strong {
  @apply text-size-xs;
}
.preview-panel-title text {
  @apply text-size-3xs;
  color: #899eb8;
}
.preview-tabs text {
  @apply rounded text-size-3xs p-1;
  color: #8da0b9;
}
.preview-tabs__active {
  color: #276bb8 !important;
  background: #dfedff;
}
.preview-room text {
  @apply text-size-3xs;
  color: #91a2b7;
}
.preview-room strong {
  @apply text-size-3xs;
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
.preview-avatar {
  color: #2069ba;
  background: #e0eeff;
}
.preview-client-card > view:nth-child(2) {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}
.preview-client-card strong {
  @apply text-size-3xs;
}
.preview-client-card text {
  @apply text-size-3xs;
  color: #8a9db5;
}
.preview-client-state {
  color: #276ebd;
  background: #e8f3ff;
}
.preview-flow-row {
  border-bottom-color: #e0eaf8;
}
.preview-flow-row:last-child {
  @apply border-b-0;
}
.preview-flow-dot {
  background: #5eabf2;
  box-shadow: 0 0 0 6rpx #dfefff;
}
.preview-flow-dot--muted {
  background: #a9bfdb;
  box-shadow: 0 0 0 6rpx #e8eef6;
}
.preview-flow-row > view:nth-child(2) {
  @apply flex flex-1 flex-col gap-0.5;
}
.preview-flow-row strong {
  @apply text-size-3xs;
}
.preview-flow-row text {
  @apply text-size-3xs;
  color: #91a4bb;
}
.preview-paper {
  box-shadow: 0 8rpx 20rpx rgb(28 76 153 / 7%);
}
.preview-paper__top .i-carbon-document-signed {
  @apply text-size-xs;
  color: #2e79c7;
}
.preview-paper__status {
  color: #286fbf;
  background: #e4f0ff;
}
.preview-paper__line {
  width: 70%;
  background: #e9eff7;
}
.preview-paper__line--short {
  width: 49%;
}
.preview-paper__fields > view {
  @apply flex flex-col gap-0.5;
}
.preview-paper__fields text {
  @apply text-size-3xs;
  color: #94a7bc;
}
.preview-paper__fields strong {
  @apply text-size-3xs;
}
.preview-contract-steps > view {
  @apply flex items-center gap-0.5 text-size-3xs;
  color: #5f82ac;
}
.preview-contract-steps i {
  @apply w-1 h-1 rounded-full;
  background: #5baff4;
}
.preview-insights__metrics > view {
  @apply flex flex-col gap-1 rounded-md bg-white p-2;
}
.preview-insights__metrics text {
  @apply text-size-3xs;
  color: #89a0bb;
}
.preview-insights__metrics strong {
  @apply text-size-base;
  color: #1e5eaa;
}
.preview-chart {
  background: #e9f2ff;
}
.preview-chart__grid {
  background: repeating-linear-gradient(to top, transparent 0, transparent 31rpx, rgb(75 126 196 / 12%) 32rpx);
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
  color: #4e80ba;
}
.detail-body {
  padding-top: 1rpx;
  padding-bottom: calc(80rpx + env(safe-area-inset-bottom));
  border-radius: 34rpx 34rpx 0 0;
  background: #f5f8fd;
}
.section-number {
  color: #a4b3c9;
}
.section-number > view {
  @apply w-5;
  height: 1rpx;
  background: #b6c7dc;
}
.section-eyebrow {
  color: #2d70c6;
  letter-spacing: 2rpx;
}
.detail-intro .section-eyebrow {
  @apply mt-2;
}
.detail-intro strong {
  @apply mt-2 text-size-xl font-extrabold leading-snug;
  color: #1b3054;
  letter-spacing: -1rpx;
}
.detail-intro > text:last-child {
  @apply mt-2 text-size-2xs leading-relaxed;
  color: #75869f;
}
.scenario-card {
  border-color: #dceaf9;
  background: linear-gradient(125deg, #e4f0ff, #fff);
}
.scenario-card__mark {
  color: #6ca9e9;
}
.scenario-card > view:last-child {
  @apply flex flex-col gap-1.5;
}
.scenario-card text {
  @apply text-size-3xs font-bold;
  color: #4183ca;
}
.scenario-card strong {
  @apply text-size-2xs font-semibold leading-relaxed;
  color: #385475;
}
.capability-card {
  border-color: #e1eaf6;
  box-shadow: 0 10rpx 29rpx rgb(28 67 132 / 4%);
}
.capability-card__icon {
  color: #2473c7;
  background: #e4f1ff;
}
.capability-card__top text {
  @apply text-size-2xs font-extrabold;
  color: #c4d4e9;
}
.capability-card > strong {
  @apply block mt-2.5 text-size-sm;
  color: #1b335a;
}
.capability-card > text {
  @apply block mt-1.5 text-size-2xs leading-relaxed;
  color: #74869f;
}
.capability-card__rule {
  background: #7cc8ff;
}
.workflow-panel {
  background: linear-gradient(145deg, #0f2c62, #173e79);
}
.workflow-panel__glow {
  background: radial-gradient(circle, rgb(108 169 255 / 27%), transparent 68%);
}
.workflow-panel__heading .section-eyebrow {
  color: #94ccff;
}
.workflow-panel__heading strong {
  @apply mt-2 text-size-lg leading-snug;
}
.workflow-step__rail > view {
  @apply flex w-5 h-5 flex-none items-center justify-center border-hairline border-solid rounded-full text-size-2xs font-extrabold;
  border-color: #8bcbff;
  color: #b7e0ff;
}
.workflow-step__rail i {
  @apply min-h-10 flex-1 my-1 mx-0;
  width: 1rpx;
  background: rgb(163 211 255 / 33%);
}
.workflow-step__body strong {
  @apply text-size-xs;
}
.workflow-step__body text {
  @apply text-size-2xs leading-normal;
  color: #b7cbe5;
}
.outcome-card {
  border-color: #dceafb;
  background: #eaf3ff;
}
.outcome-card__icon {
  color: #3387db;
}
.outcome-card text {
  @apply mt-2 text-size-3xs font-extrabold;
  color: #5182ba;
}
.outcome-card strong {
  @apply mt-1 text-size-xs leading-normal;
  color: #1d3a69;
}
.next-feature {
  border-color: #dce8f6;
}
.next-feature > view:first-child {
  @apply flex flex-col gap-1;
}
.next-feature text {
  @apply text-size-3xs font-bold;
  color: #6886aa;
}
.next-feature strong {
  @apply text-size-sm;
  color: #1e3b67;
}
.next-feature__arrow {
  color: #236fbe;
  background: #e6f2ff;
}
.detail-cta {
  background: #0d2857;
}
.detail-cta::before {
  @apply absolute -right-24 -bottom-28 w-64 h-64 border-hairline border-solid rounded-full pointer-events-none;
  border-color: rgb(124 200 255 / 18%);
  box-shadow:
    0 0 0 70rpx rgb(124 200 255 / 3%),
    0 0 0 140rpx rgb(124 200 255 / 3%);
  content: '';
}
.detail-cta > text {
  @apply relative text-size-3xs font-extrabold;
  color: #a1d4ff;
  letter-spacing: 2rpx;
}
.detail-cta > strong {
  @apply relative mt-3 mb-3.5 text-size-xl leading-tight mx-0;
}
.primary-button {
  color: #08294d;
  background: #7cc8ff;
  box-shadow: 0 14rpx 33rpx rgb(50 145 255 / 18%);
}
.primary-button .i-carbon-arrow-up-right {
  @apply text-size-sm;
}
.primary-button[disabled] {
  @apply opacity-60;
}
.return-link {
  color: #a9d6fa;
}
.return-link .i-carbon-arrow-right {
  @apply text-size-2xs;
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
    @apply grid grid-cols-2 gap-y-0 gap-x-9 items-center pt-18 pb-16 px-6;
  }
  .breadcrumb,
  .hero-index,
  .detail-hero__title,
  .detail-hero__summary,
  .highlight-list,
  .explore-button {
    @apply col-start-1;
  }
  .preview-stage {
    @apply w-full m-0 col-start-2 row-start-1 row-span-6;
  }
  .detail-body__inner {
    @apply py-0 px-6;
  }
  .capability-list {
    @apply grid-cols-3;
  }
  .workflow-panel {
    @apply grid gap-3.5 items-center;
    grid-template-columns: 0.9fr 1.1fr;
  }
}
</style>
