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
    </template><view class="error-page box-border bg-surface-page px-5 py-6 min-h-inherit">
      <view class="error-heading mb-3.5 flex flex-col gap-1">
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

<style scoped>
.error-heading strong {
  @apply text-content-primary text-size-base;
}
.error-heading text {
  @apply text-content-muted text-size-2xs;
}
</style>
