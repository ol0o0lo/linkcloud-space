<script setup lang="ts">
import AppStateCard from '@/components/app/AppStateCard.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { useRuntimeStore } from '@/store/runtime'

definePage({ style: { navigationBarTitleText: '页面状态', navigationStyle: 'custom' } })

const runtimeStore = useRuntimeStore()

async function retry() {
  await runtimeStore.bootstrap()
  if (runtimeStore.startupState === 'ready')
    uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <AppPage variant="plain" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="页面状态" back scroll-mode="sticky" />
    </template><view class="error-page box-border bg-surface-page px-5 py-6 min-h-inherit">
      <view class="error-heading mb-3.5 flex flex-col gap-1">
        <strong>应用暂时无法启动</strong><text>启动失败时可在这里重新连接服务。</text>
      </view><AppStateCard tone="danger" icon="i-carbon-network-4" title="加载失败" :description="runtimeStore.startupErrorMessage || '请检查网络连接后重试'">
        <template #action>
          <wd-button size="small" :loading="runtimeStore.startupState === 'loading'" @click="retry">
            重新加载
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
