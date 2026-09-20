<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { getInvitationRoute } from '@/modules/routes'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '认领房东关系',
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
  <view class="legacy-invite-page">
    <AppCustomNavigation title="认领房东关系" back scroll-mode="sticky" />
    <wd-loading direction="horizontal" text="正在打开邀请…" />
  </view>
</template>

<style scoped lang="scss">
.legacy-invite-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
}
.legacy-invite-page :deep(.app-custom-navigation) {
  width: 100%;
  flex: 0 0 auto;
  align-self: stretch;
}
.legacy-invite-page :deep(.wd-loading) {
  flex: 1;
}
</style>
