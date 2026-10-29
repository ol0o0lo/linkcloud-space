<script setup lang="ts">
function openAttribution() {
  // #ifdef H5
  window.open('https://www.qweather.com', '_blank', 'noopener,noreferrer')
  // #endif
  // #ifdef MP-WEIXIN
  uni.setClipboardData({ data: 'https://www.qweather.com', success: () => uni.showToast({ title: '来源链接已复制', icon: 'success' }) })
  // #endif
}
</script>

<template>
  <view class="weather-attribution mx-0 mb-2.5 mt-1 flex items-center justify-center gap-2.5 text-size-2xs text-content-secondary">
    <view class="weather-attribution-line w-5.5 bg-app-border" />
    <view class="weather-attribution-copy flex items-center gap-0.5 whitespace-nowrap">
      <text>天气服务由</text>
      <text class="weather-attribution-link text-app-brand font-semibold" @click="openAttribution">和风天气</text>
      <text>驱动</text>
    </view>
    <view class="weather-attribution-line w-5.5 bg-app-border" />
  </view>
</template>

<style scoped lang="scss">
.weather-attribution-line {
  height: 1rpx;
}
</style>
