<script setup lang="ts">
import { useRuntimeStore } from '@/store/runtime'

definePage({ style: { navigationBarTitleText: '加载失败' } })

const runtimeStore = useRuntimeStore()

async function retry() {
  await runtimeStore.bootstrap()
  if (runtimeStore.startupState === 'ready')
    uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="error-page">
    <wd-empty icon="network" tip="应用暂时无法启动" />
    <view class="error-copy">
      {{ runtimeStore.startupErrorMessage || '请检查网络连接后重试' }}
    </view>
    <wd-button :loading="runtimeStore.startupState === 'loading'" @click="retry">
      重新加载
    </wd-button>
  </view>
</template>

<style scoped lang="scss">
.error-page {
  display: flex;
  min-height: 75vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  padding: 40rpx;
  text-align: center;
}
.error-copy {
  color: var(--app-text-muted);
  font-size: 25rpx;
  line-height: 1.7;
}
</style>
