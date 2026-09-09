<script setup lang="ts">
definePage({ style: { navigationBarTitleText: '页面不存在' } })
function goHome() {
  uni.reLaunch({ url: '/pages/index/index' })
}
</script>

<template>
  <view class="error-page">
    <wd-empty icon="search" tip="没有找到这个页面" />
    <view class="error-copy">
      页面可能已调整，或对应模块尚未开放。
    </view>
    <wd-button @click="goHome">
      返回首页
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
