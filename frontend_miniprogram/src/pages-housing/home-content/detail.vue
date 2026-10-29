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
const articleBodyHtml = computed(() => {
  const body = entry.value?.body_html || ''
  const leadingTitle = body.match(/^\s*<h1>([\s\S]*?)<\/h1>\s*/i)
  return leadingTitle?.[1].trim() === entry.value?.title.trim() ? body.slice(leadingTitle[0].length) : body
})
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
  <AppPage class="entry-detail-page" :class="{ 'entry-detail-page--guide': entry && !isTopic }" variant="detail" :gutter="entry ? 'none' : 'normal'" safe-area-bottom>
    <template #navigation>
      <AppCustomNavigation
        :title="isTopic ? title : entry?.eyebrow || '租房指南'"
        back
        immersive
        scroll-mode="fade"
        :scrolled="navigationScrolled"
        :scroll-progress="navigationProgress"
        content-opacity-mode="fade-in"
      />
    </template>

    <AppLoading v-if="loading && !entry" text="正在加载内容…" />
    <AppErrorView v-else-if="error && !entry" :error="error" @retry="loadEntry" />
    <template v-else-if="entry">
      <view v-if="isTopic" class="topic-immersive bg-surface-card">
        <view class="topic-hero relative max-h-115 min-h-85 overflow-hidden" :class="`topic-hero--${entry.tone}`">
          <image v-if="coverUrl" class="topic-hero__image block" :src="coverUrl" mode="aspectFill" />
          <view class="topic-hero__wash" />
          <view class="topic-hero__content absolute bottom-0 left-0 right-0 flex flex-col px-app-gutter pb-11.5 pt-0">
            <text class="topic-hero__eyebrow self-start border-hairline border-hex-ffffff/35 rounded-full border-solid bg-hex-ffffff/12 px-2.5 py-1 text-size-2xs text-hex-ffffff/92 font-bold tracking-widest backdrop-blur-8">{{ entry.eyebrow || '精选专题' }}</text>
            <text class="topic-hero__title mt-3 text-size-2xl text-hex-fff font-extrabold leading-tight tracking-tight">{{ entry.title }}</text>
            <text class="topic-hero__summary mt-3 text-size-xs text-hex-ffffff/82 leading-relaxed">{{ entry.summary }}</text>
          </view>
        </view>
        <view class="topic-story relative z-2 bg-surface-card px-app-gutter pb-7.5 pt-6 -mt-6">
          <view class="topic-story__inner mx-auto my-0 max-w-178">
            <view class="topic-story__marker mb-4 flex items-center gap-2 text-size-2xs text-content-muted font-bold tracking-widest">
              <view class="topic-story__line h-0.5 w-6 rounded-full bg-app-brand" />
              <text>专题内容</text>
            </view>
            <rich-text class="entry-body topic-story__body" :nodes="entry.body_html" />
          </view>
        </view>
      </view>

      <view v-else class="entry-article mx-auto mb-0 mt-6 max-w-230 overflow-hidden rounded-4.5 bg-surface-card">
        <view class="entry-hero relative box-border min-h-55 flex items-end overflow-hidden px-9 pb-12 pt-24" :class="`entry-hero--${entry.tone}`">
          <image v-if="coverUrl" class="entry-hero__image block" :src="coverUrl" mode="aspectFill" />
          <view class="entry-hero__wash" />
          <view v-if="!coverUrl" class="entry-hero__ornament absolute h-81 w-81 border-hairline border-hex-ffffff/19 rounded-full border-solid -right-12 -top-27" />
          <view class="entry-hero__content relative z-1 w-full flex flex-col">
            <text class="entry-hero__eyebrow self-start border-hairline border-hex-ffffff/27 rounded-full border-solid bg-hex-ffffff/10 px-2.5 py-1 text-size-2xs text-hex-ffffff/92 font-bold tracking-wider">{{ entry.eyebrow || '实用指南' }}</text>
            <text class="entry-hero__title mt-3.5 max-w-170 text-balance text-hex-fff font-extrabold leading-tight tracking-tight">{{ entry.title }}</text>
            <text class="entry-hero__summary mt-3 max-w-155 text-size-sm text-hex-ffffff/81 leading-relaxed">{{ entry.summary }}</text>
          </view>
        </view>
        <view class="entry-article__paper relative bg-surface-card px-9 pb-13 pt-8 -mt-3.5">
          <view class="entry-reading-label mb-4 flex items-center gap-2 text-size-2xs text-content-muted font-bold tracking-widest">
            <view class="entry-reading-label__line h-0.5 w-5 rounded-full bg-app-brand" />
            <text>正文</text>
          </view>
          <rich-text class="entry-body entry-article__body" :nodes="articleBodyHtml" />
        </view>
      </view>

      <view v-if="isTopic" class="topic-houses topic-houses--immersive">
        <view class="section-heading mb-2.5 flex flex-col gap-1">
          <text class="section-heading__title text-size-base text-content-primary font-extrabold">专题房源</text>
          <text class="section-heading__subtitle text-size-2xs text-content-muted">仅展示当前仍在公开招租的房源</text>
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
            <view class="topic-house-item flex flex-col gap-1.5">
              <view v-if="item.recommendation_reason" class="recommendation-reason flex items-start gap-1.5 rounded-app-md bg-surface-brand-soft px-2.5 py-2 text-size-2xs text-app-brand-active leading-normal">
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
  @apply min-h-screen;
  @apply bg-surface-page;
}

.entry-detail-page--guide {
  background: linear-gradient(180deg, #edf2f7 0, var(--app-bg-page) 560rpx);
}

.topic-hero {
  height: 72vh;
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
  @apply absolute;
  @apply inset-0;
  @apply w-full;
  @apply h-full;
}

.topic-hero__wash {
  background:
    linear-gradient(180deg, rgb(7 15 27 / 18%) 0%, transparent 30%),
    linear-gradient(180deg, transparent 34%, rgb(7 15 27 / 82%) 100%);
}

.topic-hero__title {
  text-shadow: 0 6rpx 20rpx rgb(0 0 0 / 22%);
}

.topic-story {
  @apply rounded-t-5;
  @apply rounded-b-0;
}

.entry-article {
  width: calc(100% - var(--app-page-gutter) * 2);
  box-shadow: 0 28rpx 90rpx rgb(38 61 86 / 9%);
}

.entry-hero {
  background: linear-gradient(135deg, #152c47 0%, #254969 58%, #52758e 100%);
}

.entry-hero--sage {
  background: linear-gradient(135deg, #17423d 0%, #2d7169 58%, #669b8e 100%);
}

.entry-hero--lavender {
  background: linear-gradient(135deg, #302952 0%, #655889 58%, #9b8cba 100%);
}

.entry-hero--clay {
  background: linear-gradient(135deg, #54372f 0%, #95634e 58%, #c99b77 100%);
}

.entry-hero__image,
.entry-hero__wash {
  @apply absolute;
  @apply inset-0;
  @apply w-full;
  @apply h-full;
}

.entry-hero__wash {
  background: linear-gradient(90deg, rgb(10 23 39 / 68%) 0%, rgb(10 23 39 / 30%) 100%);
}

.entry-hero__ornament {
  box-shadow:
    0 0 0 110rpx rgb(255 255 255 / 5%),
    0 0 0 220rpx rgb(255 255 255 / 3%);
}

.entry-hero__title {
  font-size: clamp(54rpx, 4vw, 76rpx);
}

.entry-article__paper {
  @apply rounded-t-4;
  @apply rounded-b-0;
}

.entry-reading-label,
.entry-article__body {
  @apply max-w-178;
  @apply mr-auto;
  @apply ml-auto;
}

.entry-body {
  @apply block;
  @apply pt-0 px-4 pb-4.5;
  @apply text-content-primary;
  @apply text-size-sm;
  @apply leading-relaxed;
  @apply break-anywhere;
}

.entry-article__body {
  @apply p-0;
  @apply text-hex-465363;
  @apply text-size-base;
  @apply leading-loose;
}

.entry-article__body :deep(h1) {
  @apply mt-0 mx-0 mb-3.5;
  @apply text-content-primary;
  @apply text-size-xl;
  @apply leading-snug;
}

.entry-article__body :deep(h2) {
  @apply mt-6.5 mx-0 mb-2.5;
  @apply pt-5.5;
  @apply border-t-hairline border-t-solid border-t-app-card;
  @apply text-content-primary;
  @apply text-size-lg;
  @apply font-extrabold;
  @apply leading-normal;
}

.entry-article__body :deep(h2:first-child) {
  @apply mt-0;
  @apply pt-0;
  @apply border-t-0;
}

.entry-article__body :deep(h3) {
  @apply mt-4.5 mx-0 mb-2;
  @apply text-content-primary;
  @apply text-size-base;
  @apply leading-normal;
}

.entry-article__body :deep(p) {
  @apply mt-0 mx-0 mb-3.5;
}

.entry-article__body :deep(p:last-child) {
  @apply mb-0;
}

.entry-article__body :deep(ul),
.entry-article__body :deep(ol) {
  @apply mt-0 mx-0 mb-4;
  @apply pl-5.5;
}

.entry-article__body :deep(li) {
  @apply my-1.5 mx-0;
}

.entry-article__body :deep(blockquote) {
  @apply my-4 mx-0;
  @apply py-2.5 px-3.5;
  @apply border-l-3 border-l-solid border-l-app-brand;
  @apply rounded-l-0;
  @apply rounded-r-2;
  @apply bg-surface-brand-soft;
}

.entry-article__body :deep(img) {
  @apply max-w-full;
  @apply h-auto;
  @apply rounded-2.5;
}

.entry-article__body :deep(a) {
  @apply text-app-brand-active;
  @apply underline;
}

.topic-story__body {
  @apply p-0;
  @apply text-hex-465363;
  @apply text-size-base;
  @apply leading-loose;
}

.topic-story__body :deep(h2) {
  @apply mt-5.5 mx-0 mb-2;
  @apply text-content-primary;
  @apply text-size-lg;
  @apply leading-normal;
}

.topic-story__body :deep(p) {
  @apply mt-0 mx-0 mb-3.5;
}

.topic-story__body :deep(p:last-child) {
  @apply mb-0;
}

.topic-story__body :deep(li) {
  @apply my-1.5 mx-0;
}

.topic-houses {
  @apply mt-5.5;
}

.topic-houses--immersive {
  @apply mt-0;
  @apply pt-7 px-app-gutter pb-0;
  @apply border-t-8 border-t-solid border-t-surface-page;
  @apply bg-surface-page;
}

.recommendation-reason > view {
  @apply flex-none;
  @apply mt-0.5;
}

@media (max-width: 700px) {
  .entry-article {
    @apply w-full;
    @apply mt-0;
    @apply rounded-0;
    @apply shadow-none;
  }

  .entry-hero {
    @apply min-h-54;
    @apply pt-24 px-5.5 pb-12;
  }

  .entry-hero__ornament {
    @apply -right-40;
  }

  .entry-article__paper {
    @apply pt-6.5 px-5.5 pb-11.5;
  }
}
</style>
