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
        <button class="content-card grid m-0 min-h-29 w-full app-touchable overflow-hidden border-hairline border-app-card rounded-app-lg border-solid bg-surface-card p-0 text-left text-content-primary leading-none shadow-app-card" :class="`content-card--${item.tone}`" hover-class="app-touchable--pressed" @click="openEntry(item.slug)">
          <image v-if="coverUrl(item)" class="content-card__cover h-full min-h-29 w-28 bg-surface-subtle" :src="coverUrl(item)" mode="aspectFill" lazy-load />
          <view class="content-card__body min-w-0 flex flex-col p-3.5">
            <text class="content-card__eyebrow text-size-2xs text-app-brand font-bold">{{ item.eyebrow || (item.kind === 'topic' ? '精选专题' : '实用指南') }}</text>
            <text class="content-card__title mt-2 text-size-sm text-content-primary font-extrabold leading-snug">{{ item.title }}</text>
            <text class="content-card__summary line-clamp-2 mt-1.5 overflow-hidden text-size-2xs text-content-muted leading-normal">{{ item.summary }}</text>
            <view class="content-card__action mt-auto flex items-center gap-1 pt-2.5 text-size-2xs text-app-brand-active font-bold">
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
  @apply border-0;
}

.content-card {
  grid-template-columns: 220rpx minmax(0, 1fr);
}

.content-card--sage,
.content-card--lavender {
  background: linear-gradient(145deg, var(--app-bg-card), var(--app-bg-brand-soft));
}
</style>
