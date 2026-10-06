<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'

definePage({ style: { navigationBarTitleText: '房源详情' } })

onLoad((options) => {
  const houseId = Number(options?.id || 0)
  uni.redirectTo({
    url: houseId ? getHouseDetailRoute(houseId) : APP_ROUTES.notFound,
  })
})
</script>

<template>
  <view class="compatibility-page">
    正在打开房源详情…
  </view>
</template>

<style scoped>
.compatibility-page {
  padding: 80rpx 32rpx;
  color: #78857f;
  text-align: center;
}
</style>
