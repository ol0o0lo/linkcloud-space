<script setup lang="ts">
import type { PublicHouseDetailOut } from '@/features/houses/service'
import { onLoad, onShareAppMessage, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { isTenantViewingPendingPayload } from '@/domain/tenant-rental'
import { favoriteHouse, getHouseFavorite, unfavoriteHouse } from '@/features/favorites/service'
import { getPublicHouse } from '@/features/houses/service'
import { bookTenantViewing } from '@/features/tenant-rental/service'
import { trackPublicHouseEvent } from '@/infra/analytics/client'
import { APP_ROUTES, getHouseDetailRoute, getTenantViewingDetailRoute } from '@/modules/routes'
import AppBottomAction from '@/shared/components/AppBottomAction.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'
import { useAppContextStore } from '@/store/app-context-v2'
import { useSessionStore } from '@/store/session'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
  },
})

const houseId = ref(0)
const house = ref<PublicHouseDetailOut | null>(null)
const loading = ref(true)
const loadError = ref('')
const favorited = ref(false)
const favoriteLoading = ref(false)
const bookingVisible = ref(false)
const bookingDateVisible = ref(false)
const bookingAt = ref(Date.now() + 24 * 60 * 60 * 1000)
const bookingNotes = ref('')
const bookingLoading = ref(false)
const appContextStore = useAppContextStore()
const sessionStore = useSessionStore()
const canRetry = computed(() => houseId.value > 0)
const minBookingDate = computed(() => Date.now() + 30 * 60 * 1000)
const maxBookingDate = computed(() => Date.now() + 90 * 24 * 60 * 60 * 1000)
const bookingDateLabel = computed(() => new Date(bookingAt.value).toLocaleString('zh-CN', { hour12: false }))

const title = computed(() => {
  if (!house.value)
    return '房源详情'
  return `${house.value.building.estate?.display_name || house.value.building.name} ${house.value.room_number}`
})

const location = computed(() => {
  if (!house.value)
    return ''
  const estate = house.value.building.estate
  return [estate?.city, estate?.district, estate?.address || house.value.building.address].filter(Boolean).join(' ')
})

async function loadHouse() {
  loading.value = true
  loadError.value = ''
  try {
    house.value = await getPublicHouse(houseId.value)
    trackPublicHouseEvent('house.view', houseId.value)
  }
  catch {
    loadError.value = '房源不存在、已下架或暂时无法加载'
  }
  finally {
    loading.value = false
  }
}

async function refreshFavorite() {
  if (!appContextStore.authenticated || !houseId.value) {
    favorited.value = false
    return
  }
  try {
    const result = await getHouseFavorite(houseId.value)
    favorited.value = result.items.length > 0
  }
  catch {
    favorited.value = false
  }
}

async function toggleFavorite() {
  if (!appContextStore.authenticated) {
    const redirect = getHouseDetailRoute(houseId.value)
    sessionStore.deferFavorite(houseId.value, redirect)
    uni.navigateTo({ url: `/pages/auth/login?redirect=${encodeURIComponent(redirect)}` })
    return
  }
  if (favoriteLoading.value)
    return
  favoriteLoading.value = true
  try {
    if (favorited.value)
      await unfavoriteHouse(houseId.value)
    else
      await favoriteHouse(houseId.value)
    favorited.value = !favorited.value
    if (favorited.value)
      trackPublicHouseEvent('house.favorite', houseId.value)
    uni.showToast({ title: favorited.value ? '已收藏' : '已取消收藏', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '操作失败，请稍后重试', icon: 'none' })
  }
  finally {
    favoriteLoading.value = false
  }
}

function openBooking() {
  const pending = sessionStore.pendingAction
  if (pending?.type === 'book-viewing' && isTenantViewingPendingPayload(pending.payload) && pending.payload.houseId === houseId.value) {
    bookingAt.value = Date.parse(pending.payload.scheduledAt)
    bookingNotes.value = pending.payload.notes
  }
  else {
    bookingAt.value = Date.now() + 24 * 60 * 60 * 1000
    bookingNotes.value = ''
  }
  bookingVisible.value = true
}

async function submitBooking() {
  if (bookingAt.value <= minBookingDate.value) {
    uni.showToast({ title: '请选择至少 30 分钟后的时间', icon: 'none' })
    return
  }
  const redirect = getHouseDetailRoute(houseId.value)
  const pendingPayload = {
    houseId: houseId.value,
    scheduledAt: new Date(bookingAt.value).toISOString(),
    notes: bookingNotes.value.trim(),
  }
  if (!appContextStore.authenticated) {
    sessionStore.deferViewing(pendingPayload, redirect)
    uni.navigateTo({ url: `${APP_ROUTES.login}?redirect=${encodeURIComponent(redirect)}` })
    return
  }
  if (!appContextStore.user?.phone_verified) {
    sessionStore.deferViewing(pendingPayload, redirect)
    uni.navigateTo({ url: `${APP_ROUTES.phoneVerification}?redirect=${encodeURIComponent(redirect)}` })
    return
  }

  bookingLoading.value = true
  try {
    const result = await bookTenantViewing({
      house_id: pendingPayload.houseId,
      scheduled_at: pendingPayload.scheduledAt,
      notes: pendingPayload.notes,
    })
    if (sessionStore.pendingAction?.type === 'book-viewing')
      sessionStore.clearPendingAction()
    bookingVisible.value = false
    uni.showToast({ title: '预约已提交', icon: 'success' })
    uni.navigateTo({ url: getTenantViewingDetailRoute(result.id) })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '预约失败，请稍后重试', icon: 'none' })
  }
  finally {
    bookingLoading.value = false
  }
}

function retry() {
  void loadHouse()
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

onShow(() => {
  void refreshFavorite()
  const pending = sessionStore.pendingAction
  if (pending?.type === 'book-viewing' && isTenantViewingPendingPayload(pending.payload) && pending.payload.houseId === houseId.value)
    openBooking()
})

onShareAppMessage(() => ({
  title: title.value,
  path: getHouseDetailRoute(houseId.value),
}))
</script>

<template>
  <view class="detail-page">
    <AppLoading v-if="loading" text="正在加载房源…" />
    <AppErrorView v-else-if="loadError" title="房源加载失败" :message="loadError" :retryable="canRetry" @retry="retry" />
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

      <view class="section publisher-card">
        <image v-if="house.publisher.logo[0]" class="publisher-logo" :src="house.publisher.logo[0].thumbnail || house.publisher.logo[0].url || ''" mode="aspectFill" />
        <view class="publisher-info">
          <view class="publisher-name">
            {{ house.publisher.name }}
          </view>
          <view class="publisher-description">
            {{ house.publisher.description || '房源由认证组织发布' }}
          </view>
        </view>
      </view>

      <AppBottomAction>
        <view class="bottom-actions">
          <wd-button block :loading="favoriteLoading" :variant="favorited ? 'plain' : 'soft'" @click="toggleFavorite">
            {{ favorited ? '已收藏' : '收藏' }}
          </wd-button>
          <wd-button block @click="openBooking">
            预约看房
          </wd-button>
        </view>
      </AppBottomAction>

      <wd-popup v-model="bookingVisible" position="bottom" round closable safe-area-inset-bottom :z-index="1200" root-portal custom-style="padding: 36rpx 28rpx 28rpx;">
        <view class="booking-panel">
          <view class="booking-title">
            预约看房
          </view>
          <view class="booking-copy">
            提交后会发送给该中介组织，由工作人员安排带看。
          </view>
          <view class="booking-field">
            <text>预约时间</text>
            <view class="booking-date" @click="bookingDateVisible = true">
              {{ bookingDateLabel }}
            </view>
          </view>
          <view class="booking-field booking-field--vertical">
            <text>补充说明</text>
            <wd-textarea v-model="bookingNotes" :maxlength="1000" show-word-limit clearable placeholder="例如：周末下午方便、请提前联系" />
          </view>
          <wd-button block size="large" :loading="bookingLoading" @click="submitBooking">
            确认预约
          </wd-button>
        </view>
      </wd-popup>
      <wd-datetime-picker
        v-model="bookingAt"
        v-model:visible="bookingDateVisible"
        type="datetime"
        title="选择预约时间"
        :min-date="minBookingDate"
        :max-date="maxBookingDate"
        :z-index="1300"
        root-portal
      />
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
  margin-top: -24rpx;
  position: relative;
  z-index: 1;
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
.publisher-card {
  display: flex;
  align-items: center;
  gap: 22rpx;
}
.publisher-logo {
  width: 88rpx;
  height: 88rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}
.publisher-info {
  min-width: 0;
  flex: 1;
}
.publisher-name {
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 600;
}
.publisher-description {
  margin-top: 8rpx;
  color: var(--app-text-muted);
  font-size: 23rpx;
}
.bottom-actions {
  display: grid;
  grid-template-columns: minmax(180rpx, 0.7fr) minmax(260rpx, 1.3fr);
  gap: 18rpx;
}
.booking-panel {
  display: flex;
  flex-direction: column;
  gap: 26rpx;
}
.booking-title {
  color: var(--app-text-primary);
  font-size: 36rpx;
  font-weight: 700;
}
.booking-copy {
  color: var(--app-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}
.booking-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
  color: var(--app-text-secondary);
  font-size: 25rpx;
}
.booking-field--vertical {
  align-items: stretch;
  flex-direction: column;
}
.booking-date {
  color: var(--app-color-primary);
  font-weight: 600;
}
</style>
