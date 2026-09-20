<script setup lang="ts">
import type { AppError } from '@/core/errors/app-error'
import type { HomeEntryDetail } from '@/domain/home-content'
import type { HomeEntryHouse } from '@/features/home/service'
import { onLoad, onPageScroll, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppErrorView from '@/components/app/AppErrorView.vue'
import AppHouseCardSkeleton from '@/components/app/AppHouseCardSkeleton.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import HouseCard from '@/components/house/HouseCard.vue'
import { normalizeAppError } from '@/core/errors/app-error'
import { getHomeEntry, listHomeEntryHouses } from '@/features/home/service'
import { useHouseCardFavorites } from '@/hooks/useHouseCardFavorites'
import { useNavigationScrollState } from '@/hooks/useNavigationScrollState'
import { usePagedPage } from '@/hooks/usePagedPage'
import { getHouseDetailRoute } from '@/modules/routes'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '内容详情',
    enablePullDownRefresh: true,
  },
})

const slug = ref('')
const entry = ref<HomeEntryDetail | null>(null)
const loading = ref(true)
const error = ref<AppError | null>(null)
const houseFavorites = useHouseCardFavorites()
const title = computed(() => entry.value?.title || '内容详情')
const coverUrl = computed(() => entry.value?.cover_image[0]?.url || entry.value?.cover_image[0]?.thumbnail || '')
const isTopic = computed(() => entry.value?.kind === 'topic')
const { navigationScrolled, navigationProgress, handleNavigationScroll } = useNavigationScrollState({ threshold: 24, fadeDistance: 220 })

const housePage = usePagedPage<HomeEntryHouse>({
  loader: ({ page, pageSize }) => listHomeEntryHouses(slug.value, page, pageSize),
  pageSize: 10,
  enabled: () => entry.value?.kind === 'topic' && Boolean(slug.value),
  refreshOnShow: false,
  pullDownRefresh: false,
  keyOf: item => item.house.id,
})

async function loadEntry() {
  if (!slug.value)
    return
  loading.value = true
  error.value = null
  try {
    entry.value = await getHomeEntry(slug.value)
    if (entry.value.kind === 'topic')
      await Promise.all([housePage.refresh(), houseFavorites.refreshFavorites()])
    else
      housePage.reset()
  }
  catch (cause) {
    error.value = normalizeAppError({ cause, fallbackMessage: '内容加载失败，请稍后重试' })
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openHouse(houseId: number) {
  uni.navigateTo({ url: getHouseDetailRoute(houseId) })
}

onLoad((options) => {
  slug.value = String(options?.slug || '')
  void loadEntry()
})

onPullDownRefresh(() => {
  void loadEntry()
})

onPageScroll(handleNavigationScroll)
</script>

<template>
  <AppPage class="entry-detail-page" variant="detail" :gutter="isTopic ? 'none' : 'normal'" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation
        v-if="isTopic"
        :title="title"
        back
        immersive
        scroll-mode="fade"
        :scrolled="navigationScrolled"
        :scroll-progress="navigationProgress"
        content-opacity-mode="fade-in"
      />
      <AppCustomNavigation v-else :title="title" back scroll-mode="sticky" scrolled />
    </template>

    <AppLoading v-if="loading && !entry" text="正在加载内容…" />
    <AppErrorView v-else-if="error && !entry" :error="error" @retry="loadEntry" />
    <template v-else-if="entry">
      <view v-if="isTopic" class="topic-immersive">
        <view class="topic-hero" :class="`topic-hero--${entry.tone}`">
          <image v-if="coverUrl" class="topic-hero__image" :src="coverUrl" mode="aspectFill" />
          <view class="topic-hero__wash" />
          <view class="topic-hero__content">
            <text class="topic-hero__eyebrow">{{ entry.eyebrow || '精选专题' }}</text>
            <text class="topic-hero__title">{{ entry.title }}</text>
            <text class="topic-hero__summary">{{ entry.summary }}</text>
          </view>
        </view>
        <view class="topic-story">
          <view class="topic-story__marker">
            <view class="topic-story__line" />
            <text>专题内容</text>
          </view>
          <rich-text class="entry-body topic-story__body" :nodes="entry.body_html" />
        </view>
      </view>

      <view v-else class="entry-article">
        <image v-if="coverUrl" class="entry-cover" :src="coverUrl" mode="aspectFill" />
        <view class="entry-heading">
          <text class="entry-eyebrow">{{ entry.eyebrow || '实用指南' }}</text>
          <text class="entry-title">{{ entry.title }}</text>
          <text class="entry-summary">{{ entry.summary }}</text>
        </view>
        <rich-text class="entry-body" :nodes="entry.body_html" />
      </view>

      <view v-if="isTopic" class="topic-houses topic-houses--immersive">
        <view class="section-heading">
          <text class="section-heading__title">专题房源</text>
          <text class="section-heading__subtitle">仅展示当前仍在公开招租的房源</text>
        </view>
        <AppPagedList
          :items="housePage.items.value"
          :item-key="item => item.house.id"
          :loading="housePage.loading.value"
          :loading-more="housePage.loadingMore.value"
          :finished="housePage.finished.value"
          :error="housePage.error.value"
          empty-text="本专题暂无公开房源"
          empty-description="已下架的房源会自动隐藏，正文仍可正常阅读。"
          loading-text="正在加载专题房源…"
          finished-text="已经看完本专题房源"
          @retry="housePage.refresh"
        >
          <template #loading>
            <AppHouseCardSkeleton :count="4" />
          </template>
          <template #item="{ item }">
            <view class="topic-house-item">
              <view v-if="item.recommendation_reason" class="recommendation-reason">
                <view class="i-carbon-recommend" />
                <text>{{ item.recommendation_reason }}</text>
              </view>
              <HouseCard
                :house="item.house"
                favorite-visible
                :favorited="houseFavorites.isFavorited(item.house.id)"
                :favorite-loading="houseFavorites.isLoading(item.house.id)"
                @click="openHouse(item.house.id)"
                @favorite="houseFavorites.toggleFavorite(item.house.id)"
              />
            </view>
          </template>
        </AppPagedList>
      </view>
    </template>
  </AppPage>
</template>

<style scoped lang="scss">
.entry-detail-page {
  min-height: 100vh;
  background: var(--app-bg-page);
}

.topic-immersive {
  background: var(--app-bg-card);
}

.topic-hero {
  position: relative;
  height: 72vh;
  min-height: 680rpx;
  max-height: 920rpx;
  overflow: hidden;
  background: linear-gradient(145deg, #194f48 0%, #327d6d 48%, #82b99e 100%);
}

.topic-hero--lavender {
  background: linear-gradient(145deg, #34285d 0%, #665797 48%, #a89acb 100%);
}

.topic-hero--slate {
  background: linear-gradient(145deg, #172638 0%, #3b536b 48%, #8295a6 100%);
}

.topic-hero--clay {
  background: linear-gradient(145deg, #6c372e 0%, #a96550 48%, #d3a184 100%);
}

.topic-hero__image,
.topic-hero__wash {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.topic-hero__image {
  display: block;
}

.topic-hero__wash {
  background:
    linear-gradient(180deg, rgb(7 15 27 / 18%) 0%, transparent 30%),
    linear-gradient(180deg, transparent 34%, rgb(7 15 27 / 82%) 100%);
}

.topic-hero__content {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  padding: 0 var(--app-page-gutter) 92rpx;
  flex-direction: column;
}

.topic-hero__eyebrow {
  align-self: flex-start;
  padding: 9rpx 18rpx;
  border: 1rpx solid rgb(255 255 255 / 35%);
  border-radius: 999rpx;
  color: rgb(255 255 255 / 92%);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
  background: rgb(255 255 255 / 12%);
  backdrop-filter: blur(16rpx);
}

.topic-hero__title {
  margin-top: 24rpx;
  color: #fff;
  font-size: 54rpx;
  font-weight: 800;
  line-height: 1.18;
  letter-spacing: -1rpx;
  text-shadow: 0 6rpx 20rpx rgb(0 0 0 / 22%);
}

.topic-hero__summary {
  margin-top: 22rpx;
  color: rgb(255 255 255 / 82%);
  font-size: 25rpx;
  line-height: 1.65;
}

.topic-story {
  position: relative;
  z-index: 2;
  margin-top: -48rpx;
  padding: 48rpx var(--app-page-gutter) 58rpx;
  border-radius: 42rpx 42rpx 0 0;
  background: var(--app-bg-card);
}

.topic-story__marker {
  display: flex;
  margin-bottom: 30rpx;
  align-items: center;
  gap: 16rpx;
  color: var(--app-text-muted);
  font-size: 20rpx;
  font-weight: 700;
  letter-spacing: 3rpx;
}

.topic-story__line {
  width: 46rpx;
  height: 5rpx;
  border-radius: 999rpx;
  background: var(--app-color-brand);
}

.entry-article {
  overflow: hidden;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.entry-cover {
  display: block;
  width: 100%;
  height: 350rpx;
  background: var(--app-bg-subtle);
}

.entry-heading {
  display: flex;
  padding: 34rpx 32rpx 24rpx;
  flex-direction: column;
}

.entry-eyebrow {
  color: var(--app-color-brand);
  font-size: 20rpx;
  font-weight: 700;
}

.entry-title {
  margin-top: 15rpx;
  color: var(--app-text-primary);
  font-size: 40rpx;
  font-weight: 800;
  line-height: 1.3;
}

.entry-summary {
  margin-top: 16rpx;
  color: var(--app-text-muted);
  font-size: 24rpx;
  line-height: 1.6;
}

.entry-body {
  display: block;
  padding: 0 32rpx 36rpx;
  color: var(--app-text-primary);
  font-size: 27rpx;
  line-height: 1.8;
  overflow-wrap: anywhere;
}

.topic-story__body {
  padding: 0;
  font-size: 28rpx;
  line-height: 1.9;
}

.topic-houses {
  margin-top: 42rpx;
}

.topic-houses--immersive {
  margin-top: 0;
  padding: 54rpx var(--app-page-gutter) 0;
  border-top: 16rpx solid var(--app-bg-page);
  background: var(--app-bg-page);
}

.section-heading {
  display: flex;
  margin-bottom: 20rpx;
  flex-direction: column;
  gap: 7rpx;
}

.section-heading__title {
  color: var(--app-text-primary);
  font-size: 31rpx;
  font-weight: 750;
}

.section-heading__subtitle {
  color: var(--app-text-muted);
  font-size: 21rpx;
}

.topic-house-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.recommendation-reason {
  display: flex;
  padding: 14rpx 18rpx;
  align-items: flex-start;
  gap: 10rpx;
  border-radius: var(--app-radius-md);
  color: var(--app-color-brand-active);
  font-size: 21rpx;
  line-height: 1.45;
  background: var(--app-bg-brand-soft);
}

.recommendation-reason > view {
  flex: 0 0 auto;
  margin-top: 3rpx;
}
</style>
