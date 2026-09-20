<script setup lang="ts">
import type { SaaSOnboardingTask } from '@/features/saas/service'
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { canOpenOrganizationCapability } from '@/pages-org-rental/domain/organization-rental'
import { getSaaSOnboardingProgress } from '@/features/saas/service'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '组织经营' } })

const appContextStore = useAppContextStore()
const activationProgress = ref<Awaited<ReturnType<typeof getSaaSOnboardingProgress>> | null>(null)

const primaryEntries = computed(() => [
  { title: '房源盘面', subtitle: '小区、楼栋、房态和地图', icon: 'i-carbon-building', tone: 'purple', route: APP_ROUTES.organizationHouses },
  { title: '联系人管理', subtitle: '房东、租客与账号绑定', icon: 'i-carbon-user-multiple', tone: 'green', route: APP_ROUTES.organizationContacts },
  { title: '带看管理', subtitle: '团队排期与跟进记录', icon: 'i-carbon-calendar', tone: 'blue', route: APP_ROUTES.organizationViewings },
  { title: '租约与收益', subtitle: '签约、履约与分配', icon: 'i-carbon-document-signed', tone: 'orange', route: APP_ROUTES.organizationLeases },
  { title: '经营分析', subtitle: '收益、转化与去化趋势', icon: 'i-carbon-chart-line', tone: 'purple', route: APP_ROUTES.organizationAnalytics, capability: 'analytics' },
].filter(item => canOpenOrganizationCapability(appContextStore.capabilities, item.capability)))

const supportEntries = computed(() => [
  { title: '小区资料', route: APP_ROUTES.organizationEstates },
  { title: '楼栋资料', route: APP_ROUTES.organizationBuildings },
  { title: '房源地图', route: APP_ROUTES.organizationMap },
  { title: '房表同步', route: APP_ROUTES.organizationVacancySync },
  { title: '登记签约', route: APP_ROUTES.organizationSigning, capability: 'allocation' },
  { title: '收益分配', route: APP_ROUTES.organizationAllocation, capability: 'allocation' },
].filter(item => canOpenOrganizationCapability(appContextStore.capabilities, item.capability)))

function openRoute(route: string) {
  uni.navigateTo({ url: route })
}

function openActivationTask(task: SaaSOnboardingTask) {
  const route = {
    create_house: APP_ROUTES.organizationHouseForm,
    invite_member: APP_ROUTES.organizationAdminInvitations,
    assign_responsibility: APP_ROUTES.organizationAdminResponsibilities,
    create_viewing: APP_ROUTES.organizationViewingForm,
  }[task.action]
  openRoute(route)
}

async function loadActivationProgress() {
  if (!appContextStore.organizationSlug) {
    activationProgress.value = null
    return
  }
  try {
    activationProgress.value = await getSaaSOnboardingProgress(appContextStore.organizationSlug)
  }
  catch {
    activationProgress.value = null
  }
}

onShow(() => void loadActivationProgress())
</script>

<template>
  <view class="business-page">
    <AppCustomNavigation title="组织经营" back scroll-mode="sticky" />
    <view v-if="activationProgress && !activationProgress.activated" class="activation-card">
      <view class="activation-heading">
        <view><strong>完成 3 步，让试用真正跑起来</strong><text v-if="activationProgress.trial_days_remaining !== null">专业版试用还剩 {{ activationProgress.trial_days_remaining }} 天</text></view>
        <text>{{ activationProgress.completed_count }}/{{ activationProgress.total_count }}</text>
      </view>
      <wd-progress :percentage="activationProgress.completion_percent" hide-text />
      <view class="activation-list">
        <view v-for="task in activationProgress.tasks" :key="task.key" class="activation-item" :class="{ 'activation-item--done': task.completed }" @click="!task.completed && openActivationTask(task)">
          <view :class="task.completed ? 'i-carbon-checkmark-filled' : 'i-carbon-circle-dash'" />
          <view><strong>{{ task.title }}</strong><text>{{ task.completed ? '已完成' : task.description }}</text></view>
          <view v-if="!task.completed" class="i-carbon-chevron-right" />
        </view>
      </view>
    </view>
    <view class="permission-card">
      <view class="permission-icon">
        权
      </view>
      <view><strong>按权限显示业务入口</strong><text>仅展示当前角色可访问的房源、联系人、带看、租约、任务和组织管理入口。</text><text class="permission-link">查看我的职责 ›</text></view>
    </view>
    <view class="entry-grid">
      <view v-for="item in primaryEntries" :key="item.route" class="entry-card" @click="openRoute(item.route)">
        <view class="entry-icon" :class="[`entry-icon--${item.tone}`, item.icon]" />
        <view class="entry-main">
          <view class="entry-title">
            {{ item.title }}
          </view>
          <view class="entry-subtitle">
            {{ item.subtitle }}
          </view>
        </view>
        <view class="i-carbon-chevron-right entry-arrow" />
      </view>
    </view>
    <view v-if="supportEntries.length" class="support-section">
      <view class="section-title">
        资料与工具
      </view>
      <view class="support-grid">
        <view v-for="item in supportEntries" :key="item.route" @click="openRoute(item.route)">
          {{ item.title }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.business-page {
  min-height: 100vh;
  padding: 0 40rpx 56rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.business-page :deep(.app-custom-navigation) {
  margin: 0 -40rpx 64rpx;
}
.activation-card {
  margin-bottom: 24rpx;
  padding: 28rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 30rpx;
  background: var(--app-bg-card);
}
.activation-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 18rpx;
}
.activation-heading > view {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7rpx;
}
.activation-heading strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}
.activation-heading text {
  color: var(--app-color-brand);
  font-size: 21rpx;
}
.activation-list {
  margin-top: 18rpx;
}
.activation-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 0;
  border-top: 1rpx solid var(--app-border-subtle);
  color: var(--app-color-brand);
}
.activation-item > view:nth-child(2) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}
.activation-item strong {
  color: var(--app-text-primary);
  font-size: 23rpx;
}
.activation-item text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}
.activation-item--done {
  color: var(--app-color-success);
}
.permission-card {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 32rpx;
  background: var(--app-bg-brand-soft);
}
.permission-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  background: var(--app-color-brand);
}
.permission-card > view:last-child {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}
.permission-card strong {
  font-size: 28rpx;
}
.permission-card text {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  line-height: 1.55;
}
.permission-card .permission-link {
  color: var(--app-color-brand);
  font-weight: 700;
}
.section-title {
  margin: 0 0 20rpx;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
}
.entry-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 48rpx;
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  min-height: 168rpx;
  padding: 24rpx 32rpx;
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.entry-icon {
  display: flex;
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  color: #fff;
  font-size: 34rpx;
  background: var(--app-color-brand);
}
.entry-icon--green {
  background: #16a078;
}
.entry-icon--blue {
  background: #0982f8;
}
.entry-icon--orange {
  background: #c88400;
}
.entry-main {
  min-width: 0;
  flex: 1;
}
.entry-title {
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 650;
}
.entry-subtitle {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.entry-arrow {
  color: var(--app-text-muted);
}
.support-section {
  margin-top: 48rpx;
}
.support-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}
.support-grid view {
  padding: 28rpx;
  border-radius: 28rpx;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  text-align: center;
  background: var(--app-bg-card);
}
</style>
