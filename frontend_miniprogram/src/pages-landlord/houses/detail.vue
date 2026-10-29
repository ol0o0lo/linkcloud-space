<script setup lang="ts">
import type { LandlordHouseOut } from '@/features/landlord/service'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { formatHouseLayout, getHouseAuxiliaryLabels } from '@/domain/house'
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
const isPublic = computed(() => house.value?.is_active && house.value.status === 'listed')
const auxiliaryLabels = computed(() => house.value ? getHouseAuxiliaryLabels(house.value) : [])
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
  if (isPublic.value && house.value)
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
  path: isPublic.value && house.value ? getHouseDetailRoute(house.value.id) : `${APP_ROUTES.landlordStore}?key=${encodeURIComponent(appContextStore.currentLandlordRelationship?.public_key || '')}`,
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
      <view class="hero-card relative mx-app-gutter my-0 rounded-3.5 bg-surface-card p-4">
        <view class="hero-topline flex items-center justify-between">
          <view class="title text-size-lg text-content-primary font-bold">
            {{ title }}
          </view><AppStatusTag :text="house.status__mapping" :tone="getLandlordHouseStatusTone(house.status)" />
        </view>
        <view v-if="auxiliaryLabels.length" class="mt-2 flex flex-wrap gap-2">
          <AppStatusTag v-for="label in auxiliaryLabels" :key="label" :text="label" tone="default" />
        </view>
        <view class="rent mt-3 text-size-base text-app-price font-bold">
          {{ house.asking_rent ? `¥${house.asking_rent}/月` : '租金面议' }}
        </view>
        <view class="hero-meta mt-2 text-size-xs text-content-muted">
          {{ formatHouseLayout(house.bedrooms, house.living_rooms) }} · {{ house.area ? `${house.area}㎡` : '面积未登记' }} · {{ house.floor === null ? '楼层未登记' : `${house.floor}层` }}
        </view>
        <view class="hero-meta mt-2 text-size-xs text-content-muted">
          关联工作空间：{{ appContextStore.currentLandlordRelationship?.organization_name || '当前工作空间' }}
        </view>
      </view>
      <view class="status-grid grid grid-cols-2 mx-app-gutter my-0 gap-2.5">
        <view><text>房源状态</text><strong>{{ house.status__mapping }}</strong><view /></view>
        <view><text>公开展示</text><strong>{{ isPublic ? '已开启' : '未开启' }}</strong><view /></view>
      </view>
      <AppNotice
        class="readonly-notice"
        title="只读查看"
        description="展示工作空间已登记的房源资料，不提供编辑、发布或经营分析。"
        compact
      />
      <view class="related-card rounded-4 bg-surface-card px-4 py-4">
        <view class="section-title mb-2.5 text-size-sm text-content-primary font-bold">
          关联信息
        </view>
        <view class="related-copy mt-1.5 text-size-xs text-content-secondary leading-normal">
          所属工作空间 {{ appContextStore.currentLandlordRelationship?.organization_name || '当前工作空间' }}
        </view>
        <view class="related-copy mt-1.5 text-size-xs text-content-secondary leading-normal">
          装修 {{ house.decoration__mapping || '未登记' }} · 朝向 {{ house.orientation__mapping || '未登记' }}
        </view>
        <view class="related-copy mt-1.5 text-size-xs text-content-secondary leading-normal">
          押金 {{ house.deposit_amount ? `¥${house.deposit_amount}` : '未登记' }}
        </view>
        <view class="related-links mt-3 flex gap-2">
          <button @click="openStore">
            公开店铺
          </button><button v-if="isPublic" @click="openPublicHouse">
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

<style scoped>
.status-grid > view {
  @apply relative flex min-h-16 p-3 flex-col gap-1 rounded-3.5 box-border bg-surface-card;
}
.status-grid text {
  @apply text-content-muted text-size-2xs;
}
.status-grid strong {
  @apply text-content-primary text-size-base;
}
.status-grid view view {
  @apply absolute bottom-0 left-3 w-7 h-1 rounded-full bg-app-brand;
}
.readonly-notice,
.related-card {
  @apply my-0 mx-app-gutter;
}
.related-links button {
  @apply m-0 py-0 px-2.5 border-0 rounded-2 text-app-brand text-size-2xs leading-7.5 bg-surface-brand-soft;
}
.related-links button::after {
  @apply border-0;
}
</style>
