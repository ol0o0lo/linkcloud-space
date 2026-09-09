<script setup lang="ts">
import { computed } from 'vue'
import { canOpenOrganizationCapability } from '@/domain/organization-rental'
import { APP_ROUTES } from '@/modules/routes'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '组织经营' } })

const appContextStore = useAppContextStore()

const sections = computed(() => [
  { title: '房源资产', items: [
    { title: '房源', subtitle: '查看组织房源状态与详情', icon: 'i-carbon-building', route: APP_ROUTES.organizationHouses },
    { title: '小区', subtitle: '查看项目片区与库存', icon: 'i-carbon-enterprise', route: APP_ROUTES.organizationEstates },
    { title: '楼栋', subtitle: '查看楼栋房源结构', icon: 'i-carbon-building-insights-1', route: APP_ROUTES.organizationBuildings },
    { title: '房源地图', subtitle: '查看已定位小区与楼栋', icon: 'i-carbon-map', route: APP_ROUTES.organizationMap },
    { title: '房表同步', subtitle: '预览并执行空置房表同步', icon: 'i-carbon-data-table', route: APP_ROUTES.organizationVacancySync },
  ] },
  { title: '客户成交', items: [
    { title: '联系人', subtitle: '管理房东与租客联系人', icon: 'i-carbon-user-multiple', route: APP_ROUTES.organizationContacts },
    { title: '带看', subtitle: '跟进预约、到访与成交', icon: 'i-carbon-calendar', route: APP_ROUTES.organizationViewings },
    { title: '租约', subtitle: '查看组织租约履约状态', icon: 'i-carbon-document', route: APP_ROUTES.organizationLeases },
    { title: '登记签约', subtitle: '创建成交租约并提交分配', icon: 'i-carbon-document-signed', route: APP_ROUTES.organizationSigning, capability: 'allocation' },
  ] },
  { title: '经营数据', items: [
    { title: '收益分配', subtitle: '查看分配申请与月度收益', icon: 'i-carbon-money', route: APP_ROUTES.organizationAllocation, capability: 'allocation' },
    { title: '经营分析', subtitle: '查看事件概览与趋势', icon: 'i-carbon-chart-line', route: APP_ROUTES.organizationAnalytics, capability: 'analytics' },
  ] },
].map(section => ({
  ...section,
  items: section.items.filter(item => canOpenOrganizationCapability(appContextStore.capabilities, item.capability)),
})).filter(section => section.items.length > 0))

function openRoute(route: string) {
  uni.navigateTo({ url: route })
}
</script>

<template>
  <view class="business-page">
    <view class="organization-card">
      <view class="eyebrow">
        当前组织
      </view>
      <view class="organization-name">
        {{ appContextStore.currentOrganization?.name || appContextStore.organizationSlug }}
      </view>
      <view class="organization-summary">
        当前展示该组织的经营数据，切换组织后会自动刷新。
      </view>
    </view>
    <view v-for="section in sections" :key="section.title" class="section">
      <view class="section-title">
        {{ section.title }}
      </view>
      <view class="entry-grid">
        <view v-for="item in section.items" :key="item.route" class="entry-card" @click="openRoute(item.route)">
          <view class="entry-icon" :class="item.icon" />
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
    </view>
  </view>
</template>

<style scoped lang="scss">
.business-page {
  min-height: 100vh;
  padding: 28rpx 24rpx 56rpx;
  background: var(--app-bg-page);
}
.organization-card {
  padding: 32rpx;
  border-radius: 28rpx;
  background: var(--app-gradient-organization);
  box-shadow: var(--app-shadow-hero-organization);
}
.eyebrow,
.organization-summary {
  color: rgb(255 255 255 / 72%);
  font-size: 23rpx;
}
.organization-name {
  margin-top: 10rpx;
  color: var(--app-text-on-brand);
  font-size: 38rpx;
  font-weight: 700;
}
.organization-summary {
  margin-top: 14rpx;
  line-height: 1.6;
}
.section {
  margin-top: 32rpx;
}
.section-title {
  margin: 0 8rpx 16rpx;
  color: var(--app-text-secondary);
  font-size: 26rpx;
  font-weight: 650;
}
.entry-grid {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.entry-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx;
  border-radius: 22rpx;
  background: var(--app-bg-card);
}
.entry-icon {
  color: var(--app-color-primary);
  font-size: 42rpx;
}
.entry-main {
  min-width: 0;
  flex: 1;
}
.entry-title {
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 650;
}
.entry-subtitle {
  margin-top: 6rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.entry-arrow {
  color: var(--app-text-muted);
}
</style>
