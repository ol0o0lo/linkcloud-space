<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMatchShare } from '@/features/house-match/service'
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import HouseCard from '@/features/houses/components/HouseCard.vue'
import { getPublicHouseMatchShare, listPublicHouseMatchHouses } from '@/features/house-match/service'
import { getHouseMatchErrorCopy, resolveHouseMatchError } from '@/domain/house-match'
import type { HouseMatchErrorKind } from '@/domain/house-match'
import { getHouseMatchDetailRoute, getHouseMatchRoute } from '@/modules/routes'
import AppEmpty from '@/shared/components/AppEmpty.vue'
import AppErrorView from '@/shared/components/AppErrorView.vue'
import AppLoading from '@/shared/components/AppLoading.vue'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '配房推荐',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 12
const shareKey = ref('')
const share = ref<PublicHouseMatchShare | null>(null)
const houses = ref<PublicHouseListOut[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const page = ref(1)
const total = ref(0)
const finished = ref(false)
const errorKind = ref<HouseMatchErrorKind | null>(null)

const errorCopy = computed(() => errorKind.value ? getHouseMatchErrorCopy(errorKind.value) : null)
const expiryText = computed(() => {
  if (!share.value?.expires_at)
    return '长期有效'
  return `有效期至 ${dayjs(share.value.expires_at).format('YYYY年M月D日')}`
})

async function loadInitial() {
  if (!shareKey.value) {
    errorKind.value = 'not-found'
    loading.value = false
    uni.stopPullDownRefresh()
    return
  }

  loading.value = true
  errorKind.value = null
  try {
    const [shareResult, houseResult] = await Promise.all([
      getPublicHouseMatchShare(shareKey.value),
      listPublicHouseMatchHouses(shareKey.value, 1, PAGE_SIZE),
    ])
    share.value = shareResult
    houses.value = houseResult.items
    total.value = houseResult.total
    page.value = 2
    finished.value = houses.value.length >= houseResult.total || houseResult.items.length < PAGE_SIZE
    uni.setNavigationBarTitle({ title: shareResult.title || '配房推荐' })
  }
  catch (error) {
    share.value = null
    houses.value = []
    total.value = 0
    finished.value = true
    errorKind.value = resolveHouseMatchError(error)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadMore() {
  if (loading.value || loadingMore.value || finished.value || errorKind.value)
    return
  loadingMore.value = true
  try {
    const result = await listPublicHouseMatchHouses(shareKey.value, page.value, PAGE_SIZE)
    houses.value = [...houses.value, ...result.items]
    total.value = result.total
    page.value += 1
    finished.value = houses.value.length >= result.total || result.items.length < PAGE_SIZE
  }
  catch (error) {
    const kind = resolveHouseMatchError(error)
    if (kind === 'expired' || kind === 'not-found' || kind === 'unsupported')
      errorKind.value = kind
    else
      uni.showToast({ icon: 'none', title: '更多房源加载失败，请重试' })
  }
  finally {
    loadingMore.value = false
  }
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseMatchDetailRoute(shareKey.value, houseId) })
}

function callConsultant(phone?: string | null) {
  const phoneNumber = phone?.trim()
  if (phoneNumber)
    void uni.makePhoneCall({ phoneNumber })
}

onLoad((options) => {
  shareKey.value = String(options?.key || '').trim()
  void loadInitial()
})

onPullDownRefresh(loadInitial)
onReachBottom(loadMore)
onShareAppMessage(() => ({
  title: share.value?.title || '配房推荐',
  path: getHouseMatchRoute(shareKey.value),
}))
</script>

<template>
  <view class="match-page">
    <AppLoading v-if="loading" text="正在加载配房推荐…" />

    <AppErrorView
      v-else-if="errorCopy"
      :title="errorCopy.title"
      :message="errorCopy.tip"
      :retryable="errorKind === 'load-failed'"
      @retry="loadInitial"
    />

    <template v-else-if="share">
      <view class="share-card">
        <view class="share-card__eyebrow">
          专属配房推荐
        </view>
        <view class="share-card__title">
          {{ share.title }}
        </view>
        <view v-if="share.remark" class="share-card__remark">
          {{ share.remark }}
        </view>
        <view class="share-card__meta">
          <wd-tag type="primary" variant="light">
            {{ share.mode === 'manual' ? '顾问精选' : '动态匹配' }}
          </wd-tag>
          <text>{{ expiryText }}</text>
        </view>
        <view v-if="share.consultant" class="consultant-row">
          <image v-if="share.consultant.avatar_url" class="consultant-avatar" :src="share.consultant.avatar_url" mode="aspectFill" />
          <view v-else class="consultant-avatar consultant-avatar--empty">
            {{ share.consultant.name.slice(0, 1) }}
          </view>
          <view class="consultant-info">
            <text class="consultant-name">{{ share.consultant.name }}</text>
            <text class="consultant-label">为你整理本次房源推荐</text>
          </view>
          <wd-button v-if="share.consultant.phone" size="small" variant="plain" @click="callConsultant(share.consultant.phone)">
            联系顾问
          </wd-button>
        </view>
      </view>

      <view class="list-heading">
        <text>推荐房源</text>
        <text>{{ total }} 套</text>
      </view>

      <view v-if="houses.length" class="house-list">
        <HouseCard v-for="house in houses" :key="house.id" :house="house" @click="openHouse(house.id)" />
      </view>
      <AppEmpty v-else title="当前推荐中暂无可展示房源" description="房源可能已出租或下架，请联系顾问更新推荐。" />
      <wd-loadmore v-if="houses.length" :state="finished ? 'finished' : 'loading'" finished-text="已展示全部推荐房源" />
    </template>
  </view>
</template>

<style scoped lang="scss">
.match-page {
  min-height: 100vh;
  padding: 24rpx 24rpx 80rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}

.share-card {
  padding: 32rpx;
  border-radius: 28rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.share-card__eyebrow {
  color: var(--app-color-brand);
  font-size: 24rpx;
  font-weight: 600;
}

.share-card__title {
  margin-top: 10rpx;
  color: var(--app-text-primary);
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.35;
}

.share-card__remark {
  margin-top: 18rpx;
  color: var(--app-text-secondary);
  font-size: 27rpx;
  line-height: 1.75;
  white-space: pre-wrap;
}

.share-card__meta {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-top: 22rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
}

.consultant-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 28rpx;
  padding-top: 24rpx;
  border-top: 1px solid var(--app-divider-color);
}

.consultant-avatar {
  width: 76rpx;
  height: 76rpx;
  flex: 0 0 76rpx;
  border-radius: 50%;
  background: var(--app-color-brand-soft);
}

.consultant-avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-color-brand);
  font-size: 30rpx;
  font-weight: 700;
}

.consultant-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 5rpx;
}

.consultant-name {
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 600;
}

.consultant-label {
  color: var(--app-text-muted);
  font-size: 23rpx;
}

.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 4rpx 20rpx;
  color: var(--app-text-primary);
  font-size: 28rpx;
  font-weight: 600;
}

.list-heading text:last-child {
  color: var(--app-text-muted);
  font-size: 24rpx;
  font-weight: 400;
}

.house-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
</style>
