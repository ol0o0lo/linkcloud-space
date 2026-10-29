<script setup lang="ts">
import type { PublicHouseDetailOut, PublicHouseMatchShare } from '@/features/house-match/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout } from '@/domain/house'
import { getHouseDisplayMedia } from '@/domain/house-media'
import { getHouseMatchErrorCopy, resolveHouseMatchError } from '@/domain/house-match'
import type { HouseMatchErrorKind } from '@/domain/house-match'
import { getHouseMatchDetailRoute } from '@/modules/routes'
import { getPublicHouseMatchHouse, getPublicHouseMatchShare } from '@/features/house-match/service'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '推荐房源详情',
    navigationStyle: 'custom',
  },
})

const shareKey = ref('')
const houseId = ref(0)
const share = ref<PublicHouseMatchShare | null>(null)
const house = ref<PublicHouseDetailOut | null>(null)
const displayImages = computed(() => house.value ? getHouseDisplayMedia(house.value, 'image').map((item, index) => ({ id: String(item.media_id || item.id || index), url: String(item.url || item.thumbnail || '') })) : [])
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
  <AppPage variant="detail" gutter="none">
    <template #navigation>
      <AppCustomNavigation title="推荐房源详情" back scroll-mode="sticky" />
    </template>
    <view class="detail-page bg-surface-page pb-7.5 min-h-inherit">
      <AppLoading v-if="loading" text="正在加载推荐房源…" />
      <AppErrorView
        v-else-if="errorCopy"
        :title="errorCopy.title"
        :message="errorKind === 'not-found' ? '该房源可能已不在本次推荐中，或链接不完整。' : errorCopy.tip"
        :retryable="errorKind === 'load-failed'"
        @retry="loadDetail"
      />
      <template v-else-if="house">
        <swiper v-if="displayImages.length" class="gallery" indicator-dots circular>
          <swiper-item v-for="image in displayImages" :key="image.id">
            <image class="gallery__image h-full w-full" :src="image.url" mode="aspectFill" />
          </swiper-item>
        </swiper>
        <view v-else class="gallery gallery--empty">
          暂无房源图片
        </view>

        <view class="section hero-card relative z-1 rounded-3 bg-surface-card p-3.5">
          <view class="price-row flex flex-wrap items-center justify-between gap-2">
            <view class="price text-size-xs text-app-price">
              <text class="price__amount text-size-xl font-bold">{{ house.asking_rent || '面议' }}</text><text v-if="house.asking_rent"> 元/月</text>
            </view>
            <view class="flex shrink-0 items-center gap-2">
              <wd-tag v-if="house.has_elevator_access" type="success" variant="light">
                有电梯
              </wd-tag>
              <!-- #ifdef MP-WEIXIN -->
              <wd-button size="small" variant="soft" open-type="share">
                分享房源
              </wd-button>
              <!-- #endif -->
            </view>
          </view>
          <view class="title mt-2 text-size-lg text-content-primary font-bold">
            {{ title }}
          </view>
          <view class="location text-size-xs text-content-secondary">
            {{ location }}
          </view>
          <view class="facts grid grid-cols-3 mt-4 rounded-2.5 bg-surface-subtle px-1.5 py-2.5 text-center">
            <view><strong>{{ formatHouseLayout(house.bedrooms, house.living_rooms) }}</strong></view>
            <view><strong>{{ house.interior_area || house.area || '--' }}㎡</strong></view>
            <view><strong>{{ house.floor ?? '--' }} 层</strong></view>
          </view>
        </view>

        <view v-if="share?.remark" class="recommendation-note mx-3 mb-0 mt-2.5 flex gap-3 border-hairline border-app-border-brand-soft rounded-3.5 border-solid bg-surface-brand-soft px-3.5 py-3.5">
          <view class="recommendation-note__bar w-1 shrink-0 grow-0 basis-1 rounded-full bg-app-brand" />
          <view><strong>推荐说明</strong><text>{{ share.remark }}</text></view>
        </view>

        <view v-if="house.effective_tags.length" class="section rounded-3 bg-surface-card p-3.5">
          <view class="section-title mb-3 text-size-sm text-content-primary font-bold">
            房源亮点
          </view>
          <view class="tags flex flex-wrap gap-2">
            <wd-tag v-for="tag in house.effective_tags" :key="tag" variant="light" type="primary">
              {{ tag }}
            </wd-tag>
          </view>
        </view>

        <view class="section rounded-3 bg-surface-card p-3.5">
          <view class="section-title mb-3 text-size-sm text-content-primary font-bold">
            房源信息
          </view>
          <view class="info-grid grid grid-cols-2 gap-x-4.5 gap-y-3">
            <view><text>朝向</text><strong>{{ house.orientation__mapping || '待完善' }}</strong></view>
            <view><text>装修</text><strong>{{ house.decoration__mapping || '待完善' }}</strong></view>
            <view><text>卫生间</text><strong>{{ house.bathrooms ?? '--' }}</strong></view>
            <view><text>厨房</text><strong>{{ house.kitchens ?? '--' }}</strong></view>
            <view><text>阳台</text><strong>{{ house.balconies ?? '--' }}</strong></view>
            <view><text>押金</text><strong>{{ house.deposit_amount || '--' }}</strong></view>
          </view>
        </view>

        <view v-if="house.public_description" class="section rounded-3 bg-surface-card p-3.5">
          <view class="section-title mb-3 text-size-sm text-content-primary font-bold">
            房源介绍
          </view>
          <view class="description whitespace-pre-wrap text-size-sm text-content-secondary leading-relaxed">
            {{ house.public_description }}
          </view>
        </view>

        <view v-if="share?.consultant" class="section consultant-card flex items-center gap-2.5 rounded-3 bg-surface-card p-3.5">
          <image v-if="share.consultant.avatar_url" class="consultant-avatar h-10.5 w-10.5 shrink-0 grow-0 basis-10.5 rounded-full bg-$app-color-brand-soft" :src="share.consultant.avatar_url" mode="aspectFill" />
          <view v-else class="consultant-avatar consultant-avatar--empty h-10.5 w-10.5 shrink-0 grow-0 basis-10.5 rounded-full bg-$app-color-brand-soft">
            {{ share.consultant.name.slice(0, 1) }}
          </view>
          <view class="consultant-info min-w-0 flex-1">
            <view class="consultant-name text-size-sm text-content-primary font-semibold">
              {{ share.consultant.name }}
            </view>
            <view class="consultant-label mt-1 text-size-xs text-content-muted">
              本次配房顾问
            </view>
          </view>
          <wd-button v-if="share.consultant.phone" size="small" @click="callConsultant(share.consultant.phone)">
            电话咨询
          </wd-button>
        </view>
      </template>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.gallery {
  @apply w-full;
  @apply h-65;
  @apply bg-surface-subtle;
}

.gallery--empty {
  @apply flex;
  @apply items-center;
  @apply justify-center;
  @apply text-content-muted;
}

.section {
  @apply mt-2.5 mx-3 mb-0;
}

.hero-card {
  @apply -mt-3;
}

.facts view {
  @apply flex;
  @apply flex-col;
  @apply border-r-1 border-r-solid border-r-app-divider;
}

.facts view:last-child {
  @apply border-r-0;
}

.facts strong {
  @apply text-content-primary;
  @apply text-size-sm;
}

.location {
  @apply mt-2;
  @apply mb-3;
}
.recommendation-note > view:last-child {
  @apply flex;
  @apply flex-col;
  @apply gap-1.5;
}
.recommendation-note strong {
  @apply text-content-primary;
  @apply text-size-sm;
}
.recommendation-note text {
  @apply text-content-secondary;
  @apply text-size-xs;
  @apply leading-relaxed;
  @apply whitespace-pre-wrap;
}

.info-grid view {
  @apply flex;
  @apply justify-between;
  @apply gap-1.5;
  @apply text-size-xs;
}

.info-grid text {
  @apply text-content-muted;
}

.info-grid strong {
  @apply text-content-primary;
  @apply font-medium;
}

.consultant-avatar--empty {
  @apply flex;
  @apply items-center;
  @apply justify-center;
  @apply text-app-brand;
  @apply text-size-base;
  @apply font-bold;
}
</style>
