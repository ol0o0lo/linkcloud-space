<script setup lang="ts">
import { computed } from 'vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({
  style: {
    navigationBarTitleText: '组织工作台',
  },
})

const appContextStore = useAppContextStore()
const availableCapabilities = computed(() => [
  ['经营分析', appContextStore.capabilities.analytics],
  ['收益分配', appContextStore.capabilities.allocation],
  ['订阅与权益', appContextStore.capabilities.subscriptions],
  ['组织设置', appContextStore.capabilities.organization_settings],
  ['团队设置', appContextStore.capabilities.team_settings],
  ['角色权限', appContextStore.capabilities.role_management],
  ['通知分发', appContextStore.capabilities.notification_dispatches],
].filter(([, enabled]) => enabled))
</script>

<template>
  <view class="workspace-page">
    <view class="workspace-hero">
      <view class="eyebrow">
        当前组织
      </view>
      <view class="workspace-name">
        {{ appContextStore.currentOrganization?.name }}
      </view>
      <view class="workspace-copy">
        身份和权限已按当前组织重新校验，后续业务模块只会在完成接入后显示。
      </view>
    </view>
    <view class="section-title">
      已识别能力
    </view>
    <view v-if="availableCapabilities.length" class="capability-grid">
      <view v-for="item in availableCapabilities" :key="String(item[0])" class="capability-card">
        <view class="capability-dot" />
        <text>{{ item[0] }}</text>
      </view>
    </view>
    <wd-empty v-else tip="当前组织暂时没有可用的管理能力" />
    <view class="notice-card">
      当前阶段只启用稳定的产品外壳；未接通的业务入口不会以空白页面占位。
    </view>
  </view>
</template>

<style scoped lang="scss">
.workspace-page {
  min-height: 100vh;
  padding: 30rpx 24rpx 150rpx;
  background: #f5f8f7;
  box-sizing: border-box;
}
.workspace-hero {
  padding: 42rpx 34rpx;
  border-radius: 30rpx;
  color: #fff;
  background: linear-gradient(135deg, #153d52, #1d6b72);
}
.eyebrow {
  font-size: 23rpx;
  letter-spacing: 3rpx;
  opacity: 0.72;
}
.workspace-name {
  margin-top: 18rpx;
  font-size: 44rpx;
  font-weight: 700;
}
.workspace-copy {
  margin-top: 18rpx;
  font-size: 25rpx;
  line-height: 1.7;
  opacity: 0.82;
}
.section-title {
  margin: 38rpx 6rpx 18rpx;
  color: #405049;
  font-size: 27rpx;
  font-weight: 600;
}
.capability-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}
.capability-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 28rpx 24rpx;
  border-radius: 22rpx;
  color: #25342e;
  font-size: 27rpx;
  background: #fff;
}
.capability-dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #1a8a69;
  box-shadow: 0 0 0 8rpx rgba(26, 138, 105, 0.1);
}
.notice-card {
  margin-top: 28rpx;
  padding: 26rpx;
  border-radius: 20rpx;
  color: #6d7b75;
  font-size: 24rpx;
  line-height: 1.7;
  background: #eaf2ef;
}
</style>
