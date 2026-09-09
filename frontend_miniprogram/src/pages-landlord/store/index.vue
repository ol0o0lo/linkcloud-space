<script setup lang="ts">
import type { PublicHouseListOut, PublicLandlordProfileOut } from '@/features/landlord/service'
import { onLoad, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import { ref } from 'vue'
import HouseCard from '@/features/houses/components/HouseCard.vue'
import { getPublicLandlordStore, listPublicLandlordHouses } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppListState from '@/shared/components/AppListState.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房东公开店铺' } })

const appContextStore = useAppContextStore()
const publicKey = ref('')
const profile = ref<PublicLandlordProfileOut | null>(null)
const houses = ref<PublicHouseListOut[]>([])
const page = ref(1)
const pageSize = 12
const loading = ref(false)
const finished = ref(false)
const loadError = ref('')

async function loadStore(reset = false) {
  if (!publicKey.value || loading.value || (!reset && finished.value))
    return
  if (reset) {
    page.value = 1
    finished.value = false
  }
  loading.value = true
  loadError.value = ''
  try {
    const [nextProfile, result] = await Promise.all([
      profile.value ? Promise.resolve(profile.value) : getPublicLandlordStore(publicKey.value),
      listPublicLandlordHouses(publicKey.value, page.value, pageSize),
    ])
    profile.value = nextProfile
    houses.value = reset ? result.items : [...houses.value, ...result.items]
    finished.value = houses.value.length >= result.total || result.items.length < pageSize
    if (!finished.value)
      page.value += 1
  }
  catch {
    loadError.value = '公开店铺不存在或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

onLoad((options) => {
  publicKey.value = String(options?.key || appContextStore.currentLandlordRelationship?.public_key || '')
  void loadStore(true)
})
onReachBottom(() => void loadStore())
onShareAppMessage(() => ({
  title: profile.value ? `${profile.value.name}的公开房源` : '房东公开店铺',
  path: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(publicKey.value)}`,
}))
</script>

<template>
  <view class="store-page">
    <view v-if="profile" class="profile-card">
      <image v-if="profile.avatar?.[0]" class="avatar" :src="profile.avatar[0].thumbnail || profile.avatar[0].url || ''" mode="aspectFill" />
      <view v-else class="avatar avatar--empty">
        <view class="i-carbon-user" />
      </view>
      <view class="profile-main">
        <view class="name">
          {{ profile.name }}
        </view>
        <view class="organization">
          {{ profile.organization.name }}
        </view>
        <view class="summary">
          {{ profile.house_count }} 套公开房源
        </view>
      </view>
      <wd-button size="small" open-type="share" variant="plain">
        分享
      </wd-button>
    </view>
    <view v-if="houses.length" class="house-list">
      <HouseCard v-for="house in houses" :key="house.id" :house="house" @click="openHouse(house.id)" />
    </view>
    <AppListState
      :loading="loading"
      :has-items="Boolean(houses.length)"
      :finished="finished"
      :error-message="loadError"
      loading-text="正在加载公开房源…"
      empty-text="该房东暂时没有公开房源"
      finished-text="没有更多房源了"
      @retry="loadStore(houses.length === 0)"
    />
  </view>
</template>

<style scoped lang="scss">
.store-page {
  min-height: 100vh;
  padding: 28rpx 24rpx 56rpx;
  background: var(--app-bg-page);
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-bottom: 28rpx;
  padding: 28rpx;
  border-radius: 26rpx;
  background: var(--app-gradient-warm);
}
.avatar {
  width: 96rpx;
  height: 96rpx;
  flex: 0 0 96rpx;
  border-radius: 50%;
  background: var(--app-bg-subtle);
}
.avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-warm);
  font-size: 48rpx;
}
.profile-main {
  min-width: 0;
  flex: 1;
}
.name {
  color: var(--app-text-primary);
  font-size: 32rpx;
  font-weight: 700;
}
.organization,
.summary {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.house-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
