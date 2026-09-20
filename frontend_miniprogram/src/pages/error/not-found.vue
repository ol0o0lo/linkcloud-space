<script setup lang="ts">
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({ style: { navigationBarTitleText: '页面状态', navigationStyle: 'custom' } })
function goHome() {
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="页面状态" back scroll-mode="sticky" />
    </template><view class="error-page">
      <view class="error-heading">
        <strong>没有找到这个页面</strong><text>页面可能已调整，或对应模块尚未开放。</text>
      </view><AppStateCard tone="info" icon="i-carbon-search-locate" title="页面不存在" description="请检查访问链接，或返回首页继续浏览。">
        <template #action>
          <wd-button size="small" variant="plain" @click="goHome">
            返回首页
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
