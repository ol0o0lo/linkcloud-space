<script setup lang="ts">
import type { PublicHouseListOut, PublicLandlordProfileOut } from '@/features/landlord/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { ref } from 'vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { getPublicLandlordStore, listPublicLandlordHouses } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppPagedList from '@/components/app/AppPagedList.vue'
import { usePagedPage } from '@/hooks/usePagedPage'
import { useAppContextStore } from '@/store/app-context-v2'

import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'

definePage({ style: { navigationStyle: 'custom', navigationBarTitleText: '房东公开店铺' } })

const appContextStore = useAppContextStore()
const publicKey = ref('')
const profile = ref<PublicLandlordProfileOut | null>(null)
const storePage = usePagedPage<PublicHouseListOut>({
  loader: async ({ page, pageSize }) => {
    const [nextProfile, result] = await Promise.all([
      profile.value ? Promise.resolve(profile.value) : getPublicLandlordStore(publicKey.value),
      listPublicLandlordHouses(publicKey.value, page, pageSize),
    ])
    profile.value = nextProfile
    return result
  },
  pageSize: 12,
  enabled: () => Boolean(publicKey.value),
  refreshOnShow: false,
  pullDownRefresh: false,
  keyOf: item => item.id,
})

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

onLoad((options) => {
  publicKey.value = String(options?.key || appContextStore.currentLandlordRelationship?.public_key || '')
  void storePage.refresh()
})
onShareAppMessage(() => ({
  title: profile.value ? `${profile.value.name}的公开房源` : '房东公开店铺',
  path: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(publicKey.value)}`,
}))
</script>

<template>
  <view class="store-page min-h-screen bg-surface-page px-3 pb-7 pt-0">
    <AppCustomNavigation title="房东公开店铺" back scroll-mode="sticky" />
    <view v-if="profile" class="profile-card mb-3.5 flex items-center gap-2.5 rounded-3.5 p-3.5 bg-gradient-warm">
      <image v-if="profile.avatar?.[0]" class="avatar h-12 w-12 flex-none basis-12 rounded-full bg-surface-subtle" :src="profile.avatar[0].thumbnail || profile.avatar[0].url || ''" mode="aspectFill" />
      <view v-else class="avatar avatar--empty h-12 w-12 flex flex-none basis-12 items-center justify-center rounded-full bg-surface-subtle text-size-2xl text-app-warm">
        <view class="i-carbon-user" />
      </view>
      <view class="profile-main min-w-0 flex-1">
        <view class="name text-size-base text-content-primary font-bold">
          {{ profile.name }}
        </view>
        <view class="organization mt-1 text-size-2xs text-content-muted">
          {{ profile.organization.name }}
        </view>
        <view class="summary mt-1 text-size-2xs text-content-muted">
          {{ profile.house_count }} 套公开房源
        </view>
      </view>
      <wd-button size="small" open-type="share" variant="plain">
        分享
      </wd-button>
    </view>
    <AppPagedList
      :items="storePage.items.value"
      item-key="id"
      :loading="storePage.loading.value"
      :refreshing="storePage.refreshing.value"
      :loading-more="storePage.loadingMore.value"
      :finished="storePage.finished.value"
      :error="storePage.error.value"
      loading-text="正在加载公开房源…"
      empty-text="该房东暂时没有公开房源"
      finished-text="没有更多房源了"
      @retry="storePage.refresh"
    >
      <template #item="{ item }">
        <HouseCard :house="item" @click="openHouse(item.id)" />
      </template>
    </AppPagedList>
  </view>
</template>

<style scoped>
.store-page :deep(.app-custom-navigation) {
  @apply mt-0 -mx-3 mb-3.5;
}
</style>
