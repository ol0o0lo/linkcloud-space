<script setup lang="ts">
import type { HomeEntryKind, HomeEntrySummary } from '@/domain/home-content'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import AppCustomNavigation from '@/components/app/AppCustomNavigation.vue'
import AppPagedList from '@/components/app/AppPagedList.vue'
import AppPage from '@/components/app/AppPage.vue'
import { getHomeEntryDetailRoute } from '@/domain/home-content'
import { listHomeEntries } from '@/features/home/service'
import { usePagedPage } from '@/hooks/usePagedPage'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '首页内容',
    enablePullDownRefresh: true,
  },
})

const kind = ref<HomeEntryKind>('topic')
const title = computed(() => kind.value === 'topic' ? '全部专题' : '租房指南')
const entryPage = usePagedPage<HomeEntrySummary>({
  loader: ({ page, pageSize }) => listHomeEntries(kind.value, page, pageSize),
  pageSize: 12,
  keyOf: item => item.slug,
})

function coverUrl(entry: HomeEntrySummary) {
  return entry.cover_image[0]?.thumbnail || entry.cover_image[0]?.url || ''
}

function openEntry(slug: string) {
  uni.navigateTo({ url: getHomeEntryDetailRoute(slug) })
}

onLoad((options) => {
  kind.value = options?.kind === 'guide' ? 'guide' : 'topic'
})
</script>

<template>
  <AppPage variant="list" ai-background>
    <template #navigation>
      <AppCustomNavigation :title="title" back scroll-mode="sticky" scrolled />
    </template>

    <AppPagedList
      :items="entryPage.items.value"
      item-key="slug"
      :loading="entryPage.loading.value"
      :loading-more="entryPage.loadingMore.value"
      :finished="entryPage.finished.value"
      :error="entryPage.error.value"
      :empty-text="kind === 'topic' ? '暂无专题活动' : '暂无租房指南'"
      empty-description="超级管理员启用内容后会显示在这里。"
      loading-text="正在加载内容…"
      finished-text="已经看完全部内容"
      @retry="entryPage.refresh"
    >
      <template #item="{ item }">
        <button class="content-card app-touchable" :class="`content-card--${item.tone}`" hover-class="app-touchable--pressed" @click="openEntry(item.slug)">
          <image v-if="coverUrl(item)" class="content-card__cover" :src="coverUrl(item)" mode="aspectFill" lazy-load />
          <view class="content-card__body">
            <text class="content-card__eyebrow">{{ item.eyebrow || (item.kind === 'topic' ? '精选专题' : '实用指南') }}</text>
            <text class="content-card__title">{{ item.title }}</text>
            <text class="content-card__summary">{{ item.summary }}</text>
            <view class="content-card__action">
              {{ item.kind === 'topic' ? '查看专题' : '阅读全文' }} <view class="i-carbon-arrow-right" />
            </view>
          </view>
        </button>
      </template>
    </AppPagedList>
  </AppPage>
</template>

<style scoped lang="scss">
button::after {
  border: 0;
}

.content-card {
  display: grid;
  width: 100%;
  min-height: 230rpx;
  margin: 0;
  padding: 0;
  overflow: hidden;
  grid-template-columns: 220rpx minmax(0, 1fr);
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  color: var(--app-text-primary);
  line-height: 1;
  text-align: left;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.content-card__cover {
  width: 220rpx;
  height: 100%;
  min-height: 230rpx;
  background: var(--app-bg-subtle);
}

.content-card__body {
  display: flex;
  min-width: 0;
  padding: 26rpx;
  flex-direction: column;
}

.content-card__eyebrow {
  color: var(--app-color-brand);
  font-size: 19rpx;
  font-weight: 700;
}

.content-card__title {
  margin-top: 15rpx;
  color: var(--app-text-primary);
  font-size: 29rpx;
  font-weight: 750;
  line-height: 1.35;
}

.content-card__summary {
  display: -webkit-box;
  margin-top: 11rpx;
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.5;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.content-card__action {
  display: flex;
  margin-top: auto;
  padding-top: 18rpx;
  align-items: center;
  gap: 6rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  font-weight: 700;
}

.content-card--sage,
.content-card--lavender {
  background: linear-gradient(145deg, var(--app-bg-card), var(--app-bg-brand-soft));
}
</style>
