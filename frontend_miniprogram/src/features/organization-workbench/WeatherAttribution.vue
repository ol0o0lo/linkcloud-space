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
  <view class="weather-attribution">
    <view class="weather-attribution-line" />
    <view class="weather-attribution-copy">
      <text>天气服务由</text>
      <text class="weather-attribution-link" @click="openAttribution">和风天气</text>
      <text>驱动</text>
    </view>
    <view class="weather-attribution-line" />
  </view>
</template>

<style scoped lang="scss">
.weather-attribution {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin: 8rpx 0 18rpx;
  color: var(--app-text-secondary);
  font-size: 22rpx;
}
.weather-attribution-line {
  width: 44rpx;
  height: 1rpx;
  background: var(--app-border-color);
}
.weather-attribution-copy {
  display: flex;
  align-items: center;
  gap: 4rpx;
  white-space: nowrap;
}
.weather-attribution-link {
  color: var(--app-color-brand);
  font-weight: 600;
}
</style>
