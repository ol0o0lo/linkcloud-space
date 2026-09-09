<script lang="ts" setup>
import { onLoad } from '@dcloudio/uni-app'
import { LOGIN_PAGE } from '@/router/config'

definePage({
  style: {
    navigationBarTitleText: '注册',
  },
})

onLoad((options) => {
  const redirect = options?.redirect ? String(options.redirect) : ''
  uni.redirectTo({
    url: redirect ? `${LOGIN_PAGE}?redirect=${encodeURIComponent(redirect)}` : LOGIN_PAGE,
  })
})
</script>

<template>
  <view class="redirect-page">
    正在进入登录页面…
  </view>
</template>

<style lang="scss" scoped>
.redirect-page {
  padding: 80rpx 32rpx;
  color: var(--app-text-muted);
  text-align: center;
}
</style>
