<script setup lang="ts">
import { getDefaultRouteForMode } from '@/modules/registry'
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '页面状态', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
function goHome() {
  uni.reLaunch({ url: getDefaultRouteForMode(appContextStore.mode) })
}
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="页面状态" back scroll-mode="sticky" />
    </template>
    <view class="error-page">
      <view class="error-heading">
        <strong>你没有访问权限</strong><text>可切换到个人模式或其他有权限的组织后再试。</text>
      </view><AppStateCard tone="warning" icon="i-carbon-locked" title="访问受限" description="当前账号在这个工作空间中没有所需权限。">
        <template #action>
          <wd-button size="small" variant="plain" @click="goHome">
            返回当前模式首页
          </wd-button>
        </template>
      </AppStateCard>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.error-page {
  min-height: inherit;
  padding: 48rpx 40rpx;
  box-sizing: border-box;
  background: var(--app-bg-page);
}
.error-heading {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}
.error-heading strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.error-heading text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
</style>
