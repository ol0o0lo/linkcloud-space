<script setup lang="ts">
import type { PublicHouseDetailOut, PublicHouseMatchShare } from '@/features/house-match/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { getHouseMatchErrorCopy, resolveHouseMatchError } from '@/domain/house-match'
import type { HouseMatchErrorKind } from '@/domain/house-match'
import { getHouseMatchDetailRoute } from '@/modules/routes'
import { getPublicHouseMatchHouse, getPublicHouseMatchShare } from '@/features/house-match/service'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '推荐房源详情',
  },
})

const shareKey = ref('')
const houseId = ref(0)
const share = ref<PublicHouseMatchShare | null>(null)
const house = ref<PublicHouseDetailOut | null>(null)
const loading = ref(true)
const errorKind = ref<HouseMatchErrorKind | null>(null)

const errorCopy = computed(() => errorKind.value ? getHouseMatchErrorCopy(errorKind.value) : null)
const title = computed(() => house.value ? `${house.value.building.estate?.display_name || house.value.building.name} ${house.value.room_number}` : '推荐房源详情')
const location = computed(() => {
  if (!house.value)
    return ''
  const estate = house.value.building.estate
  return [estate?.city, estate?.district, estate?.address || house.value.building.address].filter(Boolean).join(' ')
})

async function loadDetail() {
  if (!shareKey.value || !houseId.value) {
    errorKind.value = 'not-found'
    loading.value = false
    return
  }

  loading.value = true
  errorKind.value = null
  try {
    const [shareResult, houseResult] = await Promise.all([
      getPublicHouseMatchShare(shareKey.value),
      getPublicHouseMatchHouse(shareKey.value, houseId.value),
    ])
    share.value = shareResult
    house.value = houseResult
    uni.setNavigationBarTitle({ title: title.value })
  }
  catch (error) {
    share.value = null
    house.value = null
    errorKind.value = resolveHouseMatchError(error)
  }
  finally {
    loading.value = false
  }
}

function callConsultant(phone?: string | null) {
  const phoneNumber = phone?.trim()
  if (phoneNumber)
    void uni.makePhoneCall({ phoneNumber })
}

onLoad((options) => {
  shareKey.value = String(options?.key || '').trim()
  houseId.value = Number(options?.id || 0)
  void loadDetail()
})

onShareAppMessage(() => ({
  title: title.value,
  path: getHouseMatchDetailRoute(shareKey.value, houseId.value),
}))
</script>

<template>
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载推荐房源…" />
    <AppErrorView
      v-else-if="errorCopy"
      :title="errorCopy.title"
      :message="errorKind === 'not-found' ? '该房源可能已不在本次推荐中，或链接不完整。' : errorCopy.tip"
      :retryable="errorKind === 'load-failed'"
      @retry="loadDetail"
    />
    <template v-else-if="house">
      <swiper v-if="house.images.length" class="gallery" indicator-dots circular>
        <swiper-item v-for="image in house.images" :key="image.media_id">
          <image class="gallery__image" :src="image.url || image.thumbnail || ''" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view v-else class="gallery gallery--empty">
        暂无房源图片
      </view>

      <view class="section hero-card">
        <view class="price-row">
          <view class="price">
            <text class="price__amount">{{ house.asking_rent || '面议' }}</text><text v-if="house.asking_rent"> 元/月</text>
          </view>
          <wd-tag v-if="house.has_elevator_access" type="success" variant="light">
            有电梯
          </wd-tag>
        </view>
        <view class="title">
          {{ title }}
        </view>
        <view class="facts">
          <view><strong>{{ formatHouseLayout(house.bedrooms, house.living_rooms) }}</strong><text>户型</text></view>
          <view><strong>{{ house.interior_area || house.area || '--' }}㎡</strong><text>面积</text></view>
          <view><strong>{{ house.floor ?? '--' }} 层</strong><text>楼层</text></view>
        </view>
        <view class="location">
          {{ location }}
        </view>
      </view>

      <view v-if="house.effective_tags.length" class="section">
        <view class="section-title">
          房源亮点
        </view>
        <view class="tags">
          <wd-tag v-for="tag in house.effective_tags" :key="tag" variant="light" type="primary">
            {{ tag }}
          </wd-tag>
        </view>
      </view>

      <view class="section">
        <view class="section-title">
          房源信息
        </view>
        <view class="info-grid">
          <view><text>朝向</text><strong>{{ house.orientation__mapping || '待完善' }}</strong></view>
          <view><text>装修</text><strong>{{ house.decoration__mapping || '待完善' }}</strong></view>
          <view><text>卫生间</text><strong>{{ house.bathrooms ?? '--' }}</strong></view>
          <view><text>厨房</text><strong>{{ house.kitchens ?? '--' }}</strong></view>
          <view><text>阳台</text><strong>{{ house.balconies ?? '--' }}</strong></view>
          <view><text>押金</text><strong>{{ house.deposit_amount || '--' }}</strong></view>
        </view>
      </view>

      <view v-if="house.public_description" class="section">
        <view class="section-title">
          房源介绍
        </view>
        <view class="description">
          {{ house.public_description }}
        </view>
      </view>

      <view v-if="share?.consultant" class="section consultant-card">
        <image v-if="share.consultant.avatar_url" class="consultant-avatar" :src="share.consultant.avatar_url" mode="aspectFill" />
        <view v-else class="consultant-avatar consultant-avatar--empty">
          {{ share.consultant.name.slice(0, 1) }}
        </view>
        <view class="consultant-info">
          <view class="consultant-name">
            {{ share.consultant.name }}
          </view>
          <view class="consultant-label">
            本次配房顾问
          </view>
        </view>
        <wd-button v-if="share.consultant.phone" size="small" @click="callConsultant(share.consultant.phone)">
          电话咨询
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail-page {
  min-height: 100vh;
  padding-bottom: 60rpx;
  background: var(--app-bg-page);
}

.gallery {
  width: 100%;
  height: 520rpx;
  background: var(--app-bg-subtle);
}

.gallery__image {
  width: 100%;
  height: 100%;
}

.gallery--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
}

.section {
  margin: 20rpx 24rpx 0;
  padding: 28rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
}

.hero-card {
  position: relative;
  z-index: 1;
  margin-top: -24rpx;
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.price {
  color: var(--app-color-price);
  font-size: 24rpx;
}

.price__amount {
  font-size: 44rpx;
  font-weight: 700;
}

.title {
  margin-top: 14rpx;
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 30rpx;
  text-align: center;
}

.facts view {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  border-right: 1px solid var(--app-divider-color);
}

.facts view:last-child {
  border-right: 0;
}

.facts strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}

.facts text {
  color: var(--app-text-muted);
  font-size: 22rpx;
}

.location {
  margin-top: 28rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
}

.section-title {
  margin-bottom: 22rpx;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 700;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx 36rpx;
}

.info-grid view {
  display: flex;
  justify-content: space-between;
  gap: 12rpx;
  font-size: 25rpx;
}

.info-grid text {
  color: var(--app-text-muted);
}

.info-grid strong {
  color: var(--app-text-primary);
  font-weight: 500;
}

.description {
  color: var(--app-text-secondary);
  font-size: 27rpx;
  line-height: 1.8;
  white-space: pre-wrap;
}

.consultant-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.consultant-avatar {
  width: 84rpx;
  height: 84rpx;
  flex: 0 0 84rpx;
  border-radius: 50%;
  background: var(--app-color-brand-soft);
}

.consultant-avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-brand);
  font-size: 32rpx;
  font-weight: 700;
}

.consultant-info {
  min-width: 0;
  flex: 1;
}

.consultant-name {
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 600;
}

.consultant-label {
  margin-top: 7rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}
</style>
