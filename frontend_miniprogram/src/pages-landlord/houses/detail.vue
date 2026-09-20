<script setup lang="ts">
import type { LandlordHouseOut } from '@/features/landlord/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { getLandlordHouseStatusTone } from '@/domain/landlord'
import { formatTenantHouseTitle } from '@/domain/tenant-rental'
import { getLandlordHouse } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppDetailPage from '@/components/app/AppDetailPage.vue'
import AppNotice from '@/components/app/AppNotice.vue'
import AppStatusTag from '@/components/app/AppStatusTag.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房源详情', navigationStyle: 'custom' } })

const appContextStore = useAppContextStore()
const houseId = ref(0)
const house = ref<LandlordHouseOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const title = computed(() => house.value ? formatTenantHouseTitle(house.value) : '房源详情')

async function loadHouse() {
  const contactId = appContextStore.currentLandlordRelationship?.contact_id
  if (!contactId) {
    loadError.value = '当前房东关系已失效，请重新选择身份'
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = ''
  try {
    house.value = await getLandlordHouse(contactId, houseId.value)
  }
  catch (error) {
    loadError.value = error instanceof Error ? error.message : '房源加载失败'
  }
  finally {
    loading.value = false
  }
}

function openPublicHouse() {
  if (house.value?.status === 'listed')
    uni.navigateTo({ url: getHouseDetailRoute(house.value.id) })
}

function openStore() {
  const key = appContextStore.currentLandlordRelationship?.public_key
  if (key)
    uni.navigateTo({ url: `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(key)}` })
}

function backToHouses() {
  uni.switchTab({ url: APP_ROUTES.houses, fail: () => uni.reLaunch({ url: APP_ROUTES.houses }) })
}

onLoad((options) => {
  houseId.value = Number(options?.id || 0)
  if (!houseId.value) {
    loadError.value = '房源参数不正确'
    loading.value = false
    return
  }
  void loadHouse()
})

onShareAppMessage(() => ({
  title: title.value,
  path: house.value?.status === 'listed' ? getHouseDetailRoute(house.value.id) : `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(appContextStore.currentLandlordRelationship?.public_key || '')}`,
}))
</script>

<template>
  <AppDetailPage
    :loading="loading"
    :error="loadError"
    loading-text="正在加载房源…"
    error-title="房源加载失败"
    :show-actions="Boolean(house)"
    content-class=""
    @retry="loadHouse"
  >
    <template #navigation>
      <AppCustomNavigation title="房源详情" back scroll-mode="sticky" />
    </template>

    <template v-if="house">
      <view class="hero-card">
        <view class="hero-topline">
          <view class="title">
            {{ title }}
          </view><AppStatusTag :text="house.status__mapping" :tone="getLandlordHouseStatusTone(house.status)" />
        </view>
        <view class="rent">
          {{ house.asking_rent ? `¥${house.asking_rent}/月` : '租金面议' }}
        </view>
        <view class="hero-meta">
          {{ formatHouseLayout(house.bedrooms, house.living_rooms) }} · {{ house.area ? `${house.area}㎡` : '面积未登记' }} · {{ house.floor === null ? '楼层未登记' : `${house.floor}层` }}
        </view>
        <view class="hero-meta">
          关联组织：{{ appContextStore.currentLandlordRelationship?.organization_name || '当前组织' }}
        </view>
      </view>
      <view class="status-grid">
        <view><text>房源状态</text><strong>{{ house.status__mapping }}</strong><view /></view>
        <view><text>公开展示</text><strong>{{ house.status === 'listed' ? '已开启' : '未开启' }}</strong><view /></view>
      </view>
      <AppNotice
        class="readonly-notice"
        title="只读查看"
        description="展示组织已登记的房源资料，不提供编辑、发布或经营分析。"
        compact
      />
      <view class="related-card">
        <view class="section-title">
          关联信息
        </view>
        <view class="related-copy">
          所属组织 {{ appContextStore.currentLandlordRelationship?.organization_name || '当前组织' }}
        </view>
        <view class="related-copy">
          装修 {{ house.decoration__mapping || '未登记' }} · 朝向 {{ house.orientation__mapping || '未登记' }}
        </view>
        <view class="related-copy">
          押金 {{ house.deposit_amount ? `¥${house.deposit_amount}` : '未登记' }}
        </view>
        <view class="related-links">
          <button @click="openStore">
            公开店铺
          </button><button v-if="house.status === 'listed'" @click="openPublicHouse">
            公开房源页
          </button>
        </view>
      </view>
    </template>

    <template #actions>
      <wd-button block @click="backToHouses">
        返回房源列表
      </wd-button>
    </template>
  </AppDetailPage>
</template>

<style scoped lang="scss">
.hero-card {
  margin: 0 var(--app-page-gutter);
  padding: 32rpx;
  position: relative;
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.rent {
  margin-top: 22rpx;
  color: var(--app-color-price);
  font-size: 34rpx;
  font-weight: 700;
}
.hero-meta {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin: 0 var(--app-page-gutter);
}
.status-grid > view {
  position: relative;
  display: flex;
  min-height: 128rpx;
  padding: 24rpx;
  flex-direction: column;
  gap: 8rpx;
  border-radius: 28rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
}
.status-grid text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}
.status-grid strong {
  color: var(--app-text-primary);
  font-size: 32rpx;
}
.status-grid view view {
  position: absolute;
  bottom: 0;
  left: 24rpx;
  width: 56rpx;
  height: 7rpx;
  border-radius: 999rpx;
  background: var(--app-color-brand);
}
.readonly-notice,
.related-card {
  margin: 0 var(--app-page-gutter);
}
.related-card {
  padding: 30rpx 32rpx;
  border-radius: 32rpx;
  background: var(--app-bg-card);
}
.section-title {
  margin-bottom: 20rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 700;
}
.related-copy {
  margin-top: 10rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  line-height: 1.55;
}
.related-links {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}
.related-links button {
  margin: 0;
  padding: 0 20rpx;
  border: 0;
  border-radius: 16rpx;
  color: var(--app-color-brand);
  font-size: 22rpx;
  line-height: 58rpx;
  background: var(--app-bg-brand-soft);
}
.related-links button::after {
  border: 0;
}
</style>
