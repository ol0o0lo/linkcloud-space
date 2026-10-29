<script setup lang="ts">
import type { HomeBanner, HomeEntryKind, HomeEntrySummary } from '@/domain/home-content'
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  banners?: HomeBanner[]
  topics?: HomeEntrySummary[]
  guides?: HomeEntrySummary[]
  loading?: boolean
  section?: 'intro' | 'content'
}>(), {
  banners: () => [],
  topics: () => [],
  guides: () => [],
  loading: false,
  section: 'intro',
})

const emit = defineEmits<{
  banner: [banner: HomeBanner]
  entry: [slug: string]
  list: [kind: HomeEntryKind]
}>()

const heroCurrent = ref(0)
const featuredItems = computed(() => [
  ...props.banners.map(item => ({
    key: `banner-${item.id}`,
    type: 'banner' as const,
    eyebrow: item.eyebrow || '本期精选',
    title: item.title,
    buttonText: item.button_text || '了解详情',
    imageUrl: item.image[0]?.url,
    banner: item,
    slug: '',
  })),
  ...props.topics.map(item => ({
    key: `topic-${item.slug}`,
    type: 'topic' as const,
    eyebrow: item.eyebrow || '精选专题',
    title: item.title,
    buttonText: '了解详情',
    imageUrl: item.cover_image[0]?.url,
    banner: null,
    slug: item.slug,
  })),
])
const heroSwiperStyle = [
  '--wot-swiper-border-radius: 0',
  '--wot-swiper-item-padding: 0',
].join('; ')

watch(() => featuredItems.value.length, (length) => {
  if (!length || heroCurrent.value >= length)
    heroCurrent.value = 0
})

function openFeatured(item: typeof featuredItems.value[number]) {
  if (item.type === 'banner' && item.banner)
    emit('banner', item.banner)
  else if (item.type === 'topic')
    emit('entry', item.slug)
}
</script>

<template>
  <view class="home-discovery min-w-0">
    <template v-if="section === 'intro'">
      <view v-if="featuredItems.length" class="hero-swiper relative overflow-hidden">
        <wd-swiper
          v-model:current="heroCurrent"
          :list="featuredItems"
          :indicator="false"
          autoplay
          :interval="5000"
          height="440rpx"
          :custom-style="heroSwiperStyle"
        >
          <template #default="{ item }">
            <button
              class="hero-banner relative m-0 box-border block h-55 w-full app-touchable overflow-hidden rounded-0 p-0 text-left text-hex-fff"
              hover-class="app-touchable--pressed"
              @click="openFeatured(item)"
            >
              <image v-if="item.imageUrl" class="hero-banner__image" :src="item.imageUrl" mode="aspectFill" />
              <view v-if="item.imageUrl" class="hero-banner__shade" />
              <view class="hero-banner__copy relative z-1 box-border h-full flex flex-col items-start px-6 pb-16 pt-14 leading-snug">
                <text class="hero-banner__eyebrow flex-none text-size-2xs font-bold tracking-wide">{{ item.eyebrow }}</text>
                <text class="hero-banner__title mt-2 block max-w-full flex-none overflow-hidden whitespace-normal text-size-lg font-extrabold leading-tight">{{ item.title }}</text>
                <view class="hero-banner__action mt-1.5 flex flex-none items-center gap-1 text-size-2xs font-bold">
                  {{ item.buttonText }} <view class="i-carbon-arrow-up-right" />
                </view>
              </view>
              <view class="hero-banner__frame pointer-events-none absolute top-4.5 h-35 w-35 border-9 border-hex-daf1fe/18 rounded-3 border-solid -right-5" />
            </button>
          </template>
        </wd-swiper>
        <view v-if="featuredItems.length > 1" class="hero-swiper__page pointer-events-none absolute bottom-18 right-4 z-2 border-hairline border-hex-ffffff/28 rounded-3 border-solid bg-hex-063766/30 px-2 py-1 text-size-3xs text-hex-fff font-bold leading-none">
          {{ heroCurrent + 1 }} / {{ featuredItems.length }}
        </view>
      </view>
      <view v-else class="hero-swiper relative overflow-hidden">
        <view class="hero-banner hero-banner--fallback relative m-0 box-border block h-55 w-full overflow-hidden rounded-0 p-0 text-left text-hex-fff">
          <view class="hero-banner__copy relative z-1 box-border h-full flex flex-col items-start px-6 pb-16 pt-14 leading-snug">
            <text class="hero-banner__eyebrow flex-none text-size-2xs font-bold tracking-wide">本期精选</text>
            <text class="hero-banner__title mt-2 block max-w-full flex-none overflow-hidden whitespace-normal text-size-lg font-extrabold leading-tight">住进更自在的生活</text>
          </view>
          <view class="hero-banner__frame pointer-events-none absolute top-4.5 h-35 w-35 border-9 border-hex-daf1fe/18 rounded-3 border-solid -right-5" />
        </view>
      </view>
    </template>

    <template v-if="section === 'content' && (loading || guides.length)">
      <template v-if="loading || guides.length">
        <view class="home-section-heading home-section-heading--guides flex items-center justify-between gap-2">
          <text class="home-section-heading__small-title text-size-sm text-hex-263b52 font-bold">租房指南</text>
          <button class="home-section-heading__more m-0 w-auto flex items-center gap-0.5 bg-transparent p-0 text-size-2xs text-hex-7e90a2 leading-snug" @click="emit('list', 'guide')">
            全部指南 <view class="i-carbon-arrow-right" />
          </button>
        </view>
        <view class="guide-list flex flex-col gap-2">
          <button
            v-for="item in guides"
            :key="item.slug"
            class="guide-card m-0 box-border min-h-19 w-full flex app-touchable items-center gap-2.5 border-hairline border-hex-e9edf1 rounded-3 border-solid p-2 text-left text-hex-22394e"
            hover-class="app-touchable--pressed"
            @click="emit('entry', item.slug)"
          >
            <view class="guide-card__media h-15 w-18 flex shrink-0 grow-0 basis-18 items-center justify-center overflow-hidden rounded-2 bg-hex-dcebe4 text-hex-5a8275" :class="`guide-card__media--${item.tone}`">
              <image v-if="item.cover_image[0]?.url" class="guide-card__image h-full w-full" :src="item.cover_image[0].url" mode="aspectFill" />
              <view v-else class="i-carbon-home guide-card__placeholder text-size-2xl" />
            </view>
            <view class="guide-card__copy min-w-0 flex gap-1">
              <text class="guide-card__eyebrow text-size-3xs text-app-brand font-bold">{{ item.eyebrow || '实用指南' }}</text>
              <text class="guide-card__title text-size-xs font-bold">{{ item.title }}</text>
              <text class="guide-card__summary text-size-2xs text-hex-8998a7">{{ item.summary }}</text>
            </view>
            <view class="i-carbon-arrow-up-right guide-card__arrow self-start text-size-xs text-hex-a3b1bd" />
          </button>
          <view v-for="index in loading && !guides.length ? 2 : 0" :key="`guide-loading-${index}`" class="guide-card guide-card--loading m-0 box-border min-h-19 w-full flex items-center gap-2.5 border-hairline border-hex-e9edf1 rounded-3 border-solid p-2 text-left text-hex-22394e" />
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
button::after {
  @apply border-0;
}

.hero-swiper {
  margin: 0 calc(var(--app-page-gutter) * -1);
}
.hero-banner {
  background: linear-gradient(
    145deg,
    var(--app-color-brand) 0%,
    var(--app-color-brand-active) 48%,
    var(--app-bg-brand-soft) 100%
  );
}
.hero-banner__image,
.hero-banner__shade {
  @apply absolute;
  @apply inset-0;
  @apply w-full;
  @apply h-full;
}
.hero-banner__shade {
  background: linear-gradient(112deg, rgb(0 129 255 / 92%) 0%, rgb(0 102 204 / 82%) 47%, rgb(234 244 255 / 42%) 100%);
}
.hero-banner__frame {
  transform: rotate(-8deg);
}
.hero-banner__copy {
  width: 74%;
}
.hero-banner__title {
  max-height: 2.4em;
}
.hero-banner__action view {
  @apply text-size-2xs;
}

.home-section-heading {
  @apply mt-4 mx-0 mb-2.5;
}
.home-section-heading__more view {
  @apply text-size-xs;
}

.home-section-heading--guides {
  @apply mt-5.5;
}
.guide-card {
  @apply bg-hex-fff;
  box-shadow: 0 6rpx 20rpx rgb(32 62 92 / 4%);
}
.guide-card--loading {
  @apply bg-hex-e9eef2;
}
.guide-card__media--lavender {
  @apply bg-hex-e9e4f3;
  @apply text-hex-7b6caa;
}
.guide-card__media--slate {
  @apply bg-hex-dfe9ed;
  @apply text-hex-54758a;
}
.guide-card__media--clay {
  @apply bg-hex-f2e7dc;
  @apply text-hex-a17957;
}
.guide-card__copy {
  @apply flex-1;
  @apply flex-col;
}
.guide-card__title,
.guide-card__summary {
  @apply overflow-hidden;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}
</style>
