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
  <view class="home-discovery">
    <template v-if="section === 'intro'">
      <view v-if="featuredItems.length" class="hero-swiper">
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
              class="hero-banner app-touchable"
              hover-class="app-touchable--pressed"
              @click="openFeatured(item)"
            >
              <image v-if="item.imageUrl" class="hero-banner__image" :src="item.imageUrl" mode="aspectFill" />
              <view v-if="item.imageUrl" class="hero-banner__shade" />
              <view class="hero-banner__copy">
                <text class="hero-banner__eyebrow">{{ item.eyebrow }}</text>
                <text class="hero-banner__title">{{ item.title }}</text>
                <view class="hero-banner__action">
                  {{ item.buttonText }} <view class="i-carbon-arrow-up-right" />
                </view>
              </view>
              <view class="hero-banner__frame" />
            </button>
          </template>
        </wd-swiper>
        <view v-if="featuredItems.length > 1" class="hero-swiper__page">
          {{ heroCurrent + 1 }} / {{ featuredItems.length }}
        </view>
      </view>
      <view v-else class="hero-swiper">
        <view class="hero-banner hero-banner--fallback">
          <view class="hero-banner__copy">
            <text class="hero-banner__eyebrow">本期精选</text>
            <text class="hero-banner__title">住进更自在的生活</text>
          </view>
          <view class="hero-banner__frame" />
        </view>
      </view>
    </template>

    <template v-if="section === 'content' && (loading || guides.length)">
      <template v-if="loading || guides.length">
        <view class="home-section-heading home-section-heading--guides">
          <text class="home-section-heading__small-title">租房指南</text>
          <button class="home-section-heading__more" @click="emit('list', 'guide')">
            全部指南 <view class="i-carbon-arrow-right" />
          </button>
        </view>
        <view class="guide-list">
          <button
            v-for="item in guides"
            :key="item.slug"
            class="guide-card app-touchable"
            hover-class="app-touchable--pressed"
            @click="emit('entry', item.slug)"
          >
            <view class="guide-card__media" :class="`guide-card__media--${item.tone}`">
              <image v-if="item.cover_image[0]?.url" class="guide-card__image" :src="item.cover_image[0].url" mode="aspectFill" />
              <view v-else class="i-carbon-home guide-card__placeholder" />
            </view>
            <view class="guide-card__copy">
              <text class="guide-card__eyebrow">{{ item.eyebrow || '实用指南' }}</text>
              <text class="guide-card__title">{{ item.title }}</text>
              <text class="guide-card__summary">{{ item.summary }}</text>
            </view>
            <view class="i-carbon-arrow-up-right guide-card__arrow" />
          </button>
          <view v-for="index in loading && !guides.length ? 2 : 0" :key="`guide-loading-${index}`" class="guide-card guide-card--loading" />
        </view>
      </template>
    </template>
  </view>
</template>

<style scoped lang="scss">
button::after {
  border: 0;
}
.home-discovery {
  min-width: 0;
}

.hero-swiper {
  position: relative;
  margin: 0 calc(var(--app-page-gutter) * -1);
  overflow: hidden;
}
.hero-swiper__page {
  position: absolute;
  right: 32rpx;
  bottom: 142rpx;
  z-index: 2;
  padding: 8rpx 14rpx;
  border: 1rpx solid rgb(255 255 255 / 28%);
  border-radius: 24rpx;
  background: rgb(6 55 102 / 30%);
  color: #fff;
  font-size: 18rpx;
  font-weight: 700;
  line-height: 1;
  pointer-events: none;
}
.hero-banner {
  position: relative;
  display: block;
  width: 100%;
  height: 440rpx;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border-radius: 0;
  box-sizing: border-box;
  color: #fff;
  text-align: left;
  background: linear-gradient(
    145deg,
    var(--app-color-brand) 0%,
    var(--app-color-brand-active) 48%,
    var(--app-bg-brand-soft) 100%
  );
}
.hero-banner__image,
.hero-banner__shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero-banner__shade {
  background: linear-gradient(112deg, rgb(0 129 255 / 92%) 0%, rgb(0 102 204 / 82%) 47%, rgb(234 244 255 / 42%) 100%);
}
.hero-banner__frame {
  position: absolute;
  top: 36rpx;
  right: -42rpx;
  width: 280rpx;
  height: 280rpx;
  border: 18rpx solid rgb(218 241 254 / 18%);
  border-radius: 25rpx;
  transform: rotate(-8deg);
  pointer-events: none;
}
.hero-banner__copy {
  position: relative;
  z-index: 1;
  display: flex;
  width: 74%;
  height: 100%;
  flex-direction: column;
  align-items: flex-start;
  padding: 112rpx 46rpx 124rpx;
  box-sizing: border-box;
  line-height: 1.4;
}
.hero-banner__eyebrow {
  flex: 0 0 auto;
  font-size: 22rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
}
.hero-banner__title {
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  max-width: 100%;
  max-height: 2.4em;
  margin-top: 14rpx;
  font-size: 38rpx;
  font-weight: 800;
  line-height: 1.2;
  white-space: normal;
}
.hero-banner__action {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 8rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  font-weight: 700;
}
.hero-banner__action view {
  font-size: 22rpx;
}

.home-section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin: 30rpx 0 18rpx;
}
.home-section-heading__small-title {
  color: #263b52;
  font-size: 28rpx;
  font-weight: 700;
}
.home-section-heading__more {
  display: flex;
  align-items: center;
  gap: 4rpx;
  width: auto;
  margin: 0;
  padding: 0;
  color: #7e90a2;
  background: transparent;
  font-size: 21rpx;
  line-height: 1.4;
}
.home-section-heading__more view {
  font-size: 23rpx;
}

.home-section-heading--guides {
  margin-top: 42rpx;
}
.guide-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.guide-card {
  display: flex;
  width: 100%;
  min-height: 150rpx;
  align-items: center;
  gap: 18rpx;
  margin: 0;
  padding: 14rpx;
  border: 1rpx solid #e9edf1;
  border-radius: 24rpx;
  box-sizing: border-box;
  background: #fff;
  color: #22394e;
  text-align: left;
  box-shadow: 0 6rpx 20rpx rgb(32 62 92 / 4%);
}
.guide-card--loading {
  background: #e9eef2;
}
.guide-card__media {
  display: flex;
  width: 140rpx;
  height: 120rpx;
  flex: 0 0 140rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 16rpx;
  background: #dcebe4;
  color: #5a8275;
}
.guide-card__media--lavender {
  background: #e9e4f3;
  color: #7b6caa;
}
.guide-card__media--slate {
  background: #dfe9ed;
  color: #54758a;
}
.guide-card__media--clay {
  background: #f2e7dc;
  color: #a17957;
}
.guide-card__image {
  width: 100%;
  height: 100%;
}
.guide-card__placeholder {
  font-size: 48rpx;
}
.guide-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}
.guide-card__eyebrow {
  color: var(--app-color-brand);
  font-size: 18rpx;
  font-weight: 700;
}
.guide-card__title,
.guide-card__summary {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.guide-card__title {
  font-size: 25rpx;
  font-weight: 700;
}
.guide-card__summary {
  color: #8998a7;
  font-size: 20rpx;
}
.guide-card__arrow {
  align-self: flex-start;
  color: #a3b1bd;
  font-size: 23rpx;
}
</style>
