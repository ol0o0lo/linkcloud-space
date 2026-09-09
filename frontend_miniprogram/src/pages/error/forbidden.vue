<script setup lang="ts">
import { getDefaultRouteForMode } from '@/modules/registry'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '无权限' } })

const appContextStore = useAppContextStore()
function goHome() {
  uni.reLaunch({ url: getDefaultRouteForMode(appContextStore.mode) })
}
</script>

<template>
  <view class="error-page">
    <wd-empty icon="lock-on" tip="你没有访问此功能的权限" />
    <view class="error-copy">
      可切换到个人模式或其他有权限的组织后再试。
    </view>
    <wd-button @click="goHome">
      返回当前模式首页
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
