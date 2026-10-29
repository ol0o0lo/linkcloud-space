<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { getInvitationRoute } from '@/modules/routes'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '关联房东档案',
  },
})

onLoad((options) => {
  const token = String(options?.token || '').trim()
  if (!token) {
    uni.showToast({ title: '邀请参数不正确', icon: 'none' })
    return
  }
  uni.redirectTo({ url: getInvitationRoute('landlord', token) })
})
</script>

<template>
  <view class="legacy-invite-page min-h-screen flex flex-col items-center justify-center text-content-muted">
    <AppCustomNavigation title="关联房东档案" back scroll-mode="sticky" />
    <wd-loading direction="horizontal" text="正在打开邀请…" />
  </view>
</template>

<style scoped>
.legacy-invite-page :deep(.app-custom-navigation) {
  @apply w-full flex-none self-stretch;
}
.legacy-invite-page :deep(.wd-loading) {
  @apply flex-1;
}
</style>
