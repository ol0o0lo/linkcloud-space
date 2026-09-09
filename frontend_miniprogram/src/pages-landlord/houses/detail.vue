<script setup lang="ts">
import type { LandlordHouseOut } from '@/features/landlord/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { getLandlordHouseStatusTone } from '@/domain/landlord'
import { formatTenantHouseTitle } from '@/domain/tenant-rental'
import { getLandlordHouse } from '@/features/landlord/service'
import { APP_ROUTES, getHouseDetailRoute } from '@/modules/routes'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'

definePage({ style: { navigationBarTitleText: '房东房源详情' } })

const appContextStore = useAppContextStore()
const houseId = ref(0)
const house = ref<LandlordHouseOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const title = computed(() => house.value ? formatTenantHouseTitle(house.value) : '房源详情')

function imageUrl(image: Record<string, unknown>) {
  return typeof image.url === 'string' ? image.url : typeof image.thumbnail === 'string' ? image.thumbnail : ''
}

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
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载房源…" />
    <AppErrorView v-else-if="loadError" title="房源加载失败" :message="loadError" @retry="loadHouse" />
    <template v-else-if="house">
      <swiper v-if="house.images.length" class="gallery" indicator-dots circular>
        <swiper-item v-for="(image, index) in house.images" :key="index">
          <image class="gallery-image" :src="imageUrl(image)" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view v-else class="gallery gallery--empty">
        暂无图片
      </view>
      <view class="hero-card">
        <view class="hero-topline">
          <wd-tag :type="getLandlordHouseStatusTone(house.status)" variant="light">
            {{ house.status__mapping }}
          </wd-tag>
          <text>{{ appContextStore.currentLandlordRelationship?.organization_name }}</text>
        </view>
        <view class="title">
          {{ title }}
        </view>
        <view class="rent">
          {{ house.asking_rent ? `¥${house.asking_rent} / 月` : '租金面议' }}
        </view>
      </view>
      <wd-cell-group title="房源信息" insert>
        <wd-cell title="户型" :value="formatHouseLayout(house.bedrooms, house.living_rooms)" />
        <wd-cell title="面积" :value="house.area ? `${house.area}㎡` : '未登记'" />
        <wd-cell title="楼层" :value="house.floor === null ? '未登记' : `${house.floor} 层`" />
        <wd-cell title="装修" :value="house.decoration__mapping || '未登记'" />
        <wd-cell title="朝向" :value="house.orientation__mapping || '未登记'" />
        <wd-cell title="押金" :value="house.deposit_amount ? `¥${house.deposit_amount}` : '未登记'" />
      </wd-cell-group>
      <AppBottomAction>
        <view class="actions">
          <wd-button block variant="plain" @click="openStore">
            公开店铺
          </wd-button>
          <wd-button v-if="house.status === 'listed'" block @click="openPublicHouse">
            查看公开页
          </wd-button>
        </view>
      </AppBottomAction>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding-bottom: 150rpx;
  background: var(--app-bg-page);
}
.gallery {
  width: 100%;
  height: 480rpx;
  background: var(--app-bg-subtle);
}
.gallery-image {
  width: 100%;
  height: 100%;
}
.gallery--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
}
.hero-card {
  margin: -24rpx 24rpx 24rpx;
  padding: 32rpx;
  position: relative;
  border-radius: 26rpx;
  background: var(--app-bg-card);
}
.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.title {
  margin-top: 20rpx;
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
.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
}
</style>
