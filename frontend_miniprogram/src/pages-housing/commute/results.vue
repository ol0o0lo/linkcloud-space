<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import AppPage from '@/components/app/AppPage.vue'
import { APP_ROUTES } from '@/modules/routes'

definePage({ style: { navigationBarTitleText: '通勤找房结果' } })

onLoad((options) => {
  const searchId = String(options?.search_id || '')
  if (!searchId) {
    uni.redirectTo({ url: APP_ROUTES.publicHouseSearch })
    return
  }
  const params = [
    `commute_search_id=${encodeURIComponent(searchId)}`,
    `commute_place=${encodeURIComponent(String(options?.place || '通勤目的地'))}`,
    `commute_mode=${encodeURIComponent(String(options?.mode || 'metro'))}`,
    `commute_max_minutes=${encodeURIComponent(String(options?.max_minutes || 45))}`,
  ]
  uni.redirectTo({ url: `${APP_ROUTES.publicHouseSearch}?${params.join('&')}` })
})
</script>

<template>
  <AppPage>
    <view>正在返回房源列表…</view>
  </AppPage>
</template>
