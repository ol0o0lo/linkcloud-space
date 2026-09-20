<script setup lang="ts">
import type { PublicHouseListOut, PublicHouseMatchShare } from '@/features/house-match/service'
import { onLoad, onPullDownRefresh, onReachBottom, onShareAppMessage } from '@dcloudio/uni-app'
import dayjs from 'dayjs'
import { computed, ref } from 'vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { getPublicHouseMatchShare, listPublicHouseMatchHouses } from '@/features/house-match/service'
import { getHouseMatchErrorCopy, resolveHouseMatchError } from '@/domain/house-match'
import type { HouseMatchErrorKind } from '@/domain/house-match'
import { getHouseMatchDetailRoute, getHouseMatchRoute } from '@/modules/routes'
import AppEmpty from '@/components/app/AppEmpty.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPage from '@/components/app/AppPage.vue'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({
  excludeLoginPath: true,
  style: {
    navigationBarTitleText: '配房推荐',
    navigationStyle: 'custom',
    enablePullDownRefresh: true,
  },
})

const PAGE_SIZE = 12
const shareKey = ref('')
const share = ref<PublicHouseMatchShare | null>(null)
const loading = ref(true)
const errorKind = ref<HouseMatchErrorKind | null>(null)

const errorCopy = computed(() => errorKind.value ? getHouseMatchErrorCopy(errorKind.value) : null)
const expiryText = computed(() => {
  if (!share.value?.expires_at)
    return '长期有效'
  return `有效期至 ${dayjs(share.value.expires_at).format('YYYY年M月D日')}`
})

const housePage = usePagedPage<PublicHouseListOut>({
  loader: ({ page, pageSize }) => listPublicHouseMatchHouses(shareKey.value, page, pageSize),
  pageSize: PAGE_SIZE,
  enabled: () => Boolean(shareKey.value) && !errorKind.value,
  refreshOnShow: false,
  pullDownRefresh: false,
  reachBottom: false,
  keyOf: item => item.id,
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
    const shareResult = await getPublicHouseMatchShare(shareKey.value)
    share.value = shareResult
    await housePage.refresh()
    uni.setNavigationBarTitle({ title: shareResult.title || '配房推荐' })
  }
  catch (error) {
    share.value = null
    housePage.reset()
    errorKind.value = resolveHouseMatchError(error)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadMore() {
  await housePage.loadMore()
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
  <AppPage variant="list" gutter="none">
    <template #navigation>
      <AppCustomNavigation :title="share?.title || '配房推荐'" back scroll-mode="sticky">
        <template #action>
          <button class="navigation-action" open-type="share">
            分享
          </button>
        </template>
      </AppCustomNavigation>
    </template>
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
          <view class="share-summary">
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
          <text>{{ housePage.total.value }} 套</text>
        </view>

        <AppPagedList
          :items="housePage.items.value"
          item-key="id"
          :loading="housePage.loading.value"
          :refreshing="housePage.refreshing.value"
          :loading-more="housePage.loadingMore.value"
          :finished="housePage.finished.value"
          :error="housePage.error.value"
          loading-text="正在加载推荐房源…"
          finished-text="已展示全部推荐房源"
          @retry="housePage.refresh"
        >
          <template #item="{ item }">
            <HouseCard :house="item" @click="openHouse(item.id)" />
          </template>
          <template #empty>
            <AppEmpty title="当前推荐中暂无可展示房源" description="房源可能已出租或下架，请联系顾问更新推荐。" icon="no-result" />
          </template>
        </AppPagedList>
      </template>
    </view>
  </AppPage>
</template>

<style scoped lang="scss">
.match-page {
  min-height: inherit;
  padding: 40rpx 40rpx 80rpx;
  background: var(--app-bg-page);
  box-sizing: border-box;
}
.navigation-action {
  margin: 0;
  padding: 0;
  border: 0;
  color: var(--app-color-brand);
  font-size: 24rpx;
  font-weight: 600;
  line-height: 56rpx;
  background: transparent;
}
.navigation-action::after {
  border: 0;
}

.share-card {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.share-summary {
  padding: 32rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 40rpx;
  background: #f4f9ff;
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
  min-height: 120rpx;
  padding: 20rpx 28rpx;
  border-radius: 32rpx;
  box-sizing: border-box;
  background: var(--app-bg-card);
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
