<script setup lang="ts">
import type { HomeBanner, HomeEntryKind, HomeEntrySummary, PublicHouseSearchPreset } from '@/domain/home-content'
import { ref, watch } from 'vue'
import { HOME_QUICK_SEARCHES, HOME_RANKING_SEARCHES } from '@/domain/home-content'

type HomeAction = 'find' | 'map' | 'reserved'

interface HomeEntry {
  title: string
  subtitle?: string
  icon: string
  action: HomeAction
}

const props = withDefaults(defineProps<{
  banners?: HomeBanner[]
  topics?: HomeEntrySummary[]
  guides?: HomeEntrySummary[]
  loading?: boolean
}>(), {
  banners: () => [],
  topics: () => [],
  guides: () => [],
  loading: false,
})

const emit = defineEmits<{
  banner: [banner: HomeBanner]
  find: [preset?: PublicHouseSearchPreset]
  map: []
  entry: [slug: string]
  list: [kind: HomeEntryKind]
  reserved: [title: string]
}>()

const heroCurrent = ref(0)
const swiperIndicator = { type: 'dots-bar' as const }
const heroSwiperStyle = [
  '--wot-swiper-border-radius: 0',
  '--wot-swiper-item-padding: 0 0 0 var(--app-page-gutter)',
  '--wot-swiper-nav-dot-color: rgb(123 135 152 / 24%)',
  '--wot-swiper-nav-dot-color-active: var(--app-color-brand)',
  '--wot-swiper-nav-spacing: 6rpx',
].join('; ')

const quickEntries: HomeEntry[] = [
  { title: '条件找房', icon: 'i-carbon-search', action: 'find' },
  { title: '低价好房', icon: 'i-carbon-tag', action: 'find' },
  { title: '品质整租', icon: 'i-carbon-home', action: 'find' },
  { title: '最新上架', icon: 'i-carbon-time', action: 'find' },
]

const secondaryEntries: Array<HomeEntry & { description: string }> = [
  { title: '地图找房', description: '按区域与位置浏览', icon: 'i-carbon-map', action: 'map' },
  { title: '地铁找房', description: '沿地铁线路筛选', icon: 'i-carbon-train', action: 'find' },
]

const ranking = [
  { name: '热门区域', description: '大家最近都在看', icon: 'i-carbon-location-filled' },
  { name: '地铁线路', description: '按通勤路线筛选', icon: 'i-carbon-train' },
  { name: '性价比榜', description: '租金与条件综合推荐', icon: 'i-carbon-chart-line' },
]

const services: HomeEntry[] = [
  { title: '搬家', icon: 'i-carbon-delivery', action: 'reserved' },
  { title: '保洁', icon: 'i-carbon-clean', action: 'reserved' },
  { title: '维修', icon: 'i-carbon-tools', action: 'reserved' },
  { title: '宽带', icon: 'i-carbon-wifi', action: 'reserved' },
]

function activate(action: HomeAction, title: string) {
  if (action === 'find') {
    emit('find', HOME_QUICK_SEARCHES[title])
    return
  }
  if (action === 'map') {
    emit('map')
    return
  }
  emit('reserved', title)
}

watch(() => props.banners.length, (length) => {
  if (!length || heroCurrent.value >= length)
    heroCurrent.value = 0
})
</script>

<template>
  <view class="home-discovery">
    <view v-if="banners.length" class="hero-swiper">
      <wd-swiper
        v-model:current="heroCurrent"
        :list="banners"
        :indicator="swiperIndicator"
        autoplay
        :interval="5000"
        height="328rpx"
        next-margin="50rpx"
        snap-to-edge
        :custom-style="heroSwiperStyle"
      >
        <template #default="{ item }">
          <button
            class="hero-banner app-touchable"
            :class="`hero-banner--${item.tone}`"
            hover-class="app-touchable--pressed"
            @click="emit('banner', item)"
          >
            <image v-if="item.image[0]?.url" class="hero-banner__image" :src="item.image[0].url" mode="aspectFill" />
            <view v-if="item.image[0]?.url" class="hero-banner__image-shade" />
            <view class="hero-banner__orb hero-banner__orb--large" />
            <view class="hero-banner__orb hero-banner__orb--small" />
            <view class="hero-banner__eyebrow">
              {{ item.eyebrow }}
            </view>
            <view class="hero-banner__title">
              {{ item.title }}
            </view>
            <view class="hero-banner__description">
              {{ item.description }}
            </view>
            <view class="hero-banner__action">
              <text>{{ item.button_text }}</text>
              <view class="i-carbon-arrow-right" />
            </view>
          </button>
        </template>
      </wd-swiper>
    </view>
    <view v-else-if="loading" class="hero-swiper">
      <view class="hero-banner hero-banner--loading" />
    </view>

    <view class="quick-entry-grid">
      <button
        v-for="item in quickEntries"
        :key="item.title"
        class="quick-entry app-touchable"
        hover-class="app-touchable--pressed"
        @click="activate(item.action, item.title)"
      >
        <view class="quick-entry__icon">
          <view :class="item.icon" />
        </view>
        <text>{{ item.title }}</text>
      </button>
    </view>

    <view class="secondary-entry-row">
      <button
        v-for="item in secondaryEntries"
        :key="item.title"
        class="secondary-entry app-touchable"
        hover-class="app-touchable--pressed"
        @click="activate(item.action, item.title)"
      >
        <view class="secondary-entry__icon">
          <view :class="item.icon" />
        </view>
        <view class="secondary-entry__content">
          <text class="secondary-entry__title">{{ item.title }}</text>
          <text class="secondary-entry__description">{{ item.description }}</text>
        </view>
        <view class="i-carbon-chevron-right secondary-entry__arrow" />
      </button>
    </view>

    <template v-if="loading || topics.length">
      <view class="home-section-heading">
        <view>
          <text class="home-section-heading__title">精选专题</text>
          <text class="home-section-heading__subtitle">从预算与通勤场景开始找房</text>
        </view>
        <button @click="emit('list', 'topic')">
          全部专题 <view class="i-carbon-chevron-right" />
        </button>
      </view>
      <view class="topic-grid">
        <button
          v-for="item in topics"
          :key="item.slug"
          class="topic-card app-touchable"
          :class="`topic-card--${item.tone}`"
          hover-class="app-touchable--pressed"
          @click="emit('entry', item.slug)"
        >
          <image v-if="item.cover_image[0]?.url" class="entry-card__image" :src="item.cover_image[0].url" mode="aspectFill" />
          <view class="topic-card__meta">
            {{ item.eyebrow || '精选专题' }}
          </view>
          <text class="topic-card__title">{{ item.title }}</text>
          <text class="topic-card__description">{{ item.summary }}</text>
          <view class="topic-card__arrow i-carbon-arrow-up-right" />
        </button>
        <view v-for="index in loading && !topics.length ? 2 : 0" :key="`topic-loading-${index}`" class="topic-card entry-card--loading" />
      </view>
    </template>

    <view class="home-section-heading">
      <view>
        <text class="home-section-heading__title">热门租住榜</text>
        <text class="home-section-heading__subtitle">快速发现值得关注的选择</text>
      </view>
      <button @click="emit('reserved', '更多榜单')">
        更多榜单 <view class="i-carbon-chevron-right" />
      </button>
    </view>
    <view class="ranking-card">
      <button
        v-for="(item, index) in ranking"
        :key="item.name"
        class="ranking-item app-touchable"
        hover-class="app-touchable--pressed"
        @click="emit('find', HOME_RANKING_SEARCHES[item.name])"
      >
        <view class="ranking-item__number">
          {{ index + 1 }}
        </view>
        <view class="ranking-item__icon">
          <view :class="item.icon" />
        </view>
        <view class="ranking-item__content">
          <text class="ranking-item__title">{{ item.name }}</text>
          <text class="ranking-item__description">{{ item.description }}</text>
        </view>
        <view class="i-carbon-chevron-right ranking-item__arrow" />
      </button>
    </view>

    <template v-if="loading || guides.length">
      <view class="home-section-heading">
        <view>
          <text class="home-section-heading__title">租房指南</text>
          <text class="home-section-heading__subtitle">区域攻略、通勤与租房避坑</text>
        </view>
        <button @click="emit('list', 'guide')">
          全部内容 <view class="i-carbon-chevron-right" />
        </button>
      </view>
      <view class="guide-grid">
        <button
          v-for="item in guides"
          :key="item.slug"
          class="guide-card app-touchable"
          :class="`guide-card--${item.tone}`"
          hover-class="app-touchable--pressed"
          @click="emit('entry', item.slug)"
        >
          <image v-if="item.cover_image[0]?.url" class="entry-card__image" :src="item.cover_image[0].url" mode="aspectFill" />
          <view class="guide-card__type">
            {{ item.eyebrow || '实用指南' }}
          </view>
          <text class="guide-card__title">{{ item.title }}</text>
          <text class="guide-card__description">{{ item.summary }}</text>
          <view class="guide-card__action">
            阅读全文 <view class="i-carbon-arrow-right" />
          </view>
        </button>
        <view v-for="index in loading && !guides.length ? 2 : 0" :key="`guide-loading-${index}`" class="guide-card entry-card--loading" />
      </view>
    </template>

    <view class="home-section-heading home-section-heading--services">
      <view>
        <text class="home-section-heading__title">安心生活服务</text>
        <text class="home-section-heading__subtitle">租后服务能力预留</text>
      </view>
      <button @click="emit('reserved', '更多生活服务')">
        更多服务 <view class="i-carbon-chevron-right" />
      </button>
    </view>
    <view class="service-grid">
      <button
        v-for="item in services"
        :key="item.title"
        class="service-entry app-touchable"
        hover-class="app-touchable--pressed"
        @click="activate(item.action, item.title)"
      >
        <view class="service-entry__icon">
          <view :class="item.icon" />
        </view>
        <text>{{ item.title }}</text>
      </button>
    </view>
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
  margin: 0 calc(var(--app-page-gutter) * -1);
  overflow: hidden;
}

.hero-banner {
  position: relative;
  display: block;
  width: 100%;
  height: 304rpx;
  margin: 0;
  padding: 34rpx 36rpx;
  overflow: hidden;
  border: 1rpx solid rgb(255 255 255 / 12%);
  border-radius: 36rpx;
  box-sizing: border-box;
  color: #fff;
  line-height: 1;
  text-align: left;
  white-space: normal;
  box-shadow:
    inset 0 1rpx 0 rgb(255 255 255 / 18%),
    inset 0 -16rpx 30rpx rgb(30 35 90 / 8%);
}

.hero-banner--blue {
  background: linear-gradient(145deg, #6288e8, #3f63c4);
}

.hero-banner--violet {
  background: linear-gradient(145deg, #8983df, #625cbd);
}

.hero-banner--teal {
  background: linear-gradient(145deg, #55a7a4, #327b82);
}

.hero-banner--loading {
  border-color: transparent;
  background: var(--app-bg-subtle);
  box-shadow: none;
}

.hero-banner__image,
.hero-banner__image-shade {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hero-banner__image {
  opacity: 0.3;
}

.hero-banner__image-shade {
  background: linear-gradient(90deg, rgb(31 52 91 / 78%), rgb(31 52 91 / 12%));
}

.hero-banner__orb {
  position: absolute;
  border: 1rpx solid rgb(255 255 255 / 15%);
  border-radius: 50%;
  background: rgb(255 255 255 / 8%);
  pointer-events: none;
}

.hero-banner__orb--large {
  right: -68rpx;
  bottom: -112rpx;
  width: 310rpx;
  height: 310rpx;
  border-width: 36rpx;
  background: transparent;
}

.hero-banner__orb--small {
  top: -76rpx;
  right: 86rpx;
  width: 180rpx;
  height: 180rpx;
}

.hero-banner__eyebrow,
.hero-banner__title,
.hero-banner__description,
.hero-banner__action {
  position: relative;
  z-index: 1;
}

.hero-banner__eyebrow {
  font-size: 20rpx;
  font-weight: 700;
  opacity: 0.84;
}

.hero-banner__title {
  max-width: 470rpx;
  margin-top: 20rpx;
  font-size: 39rpx;
  font-weight: 750;
  line-height: 1.25;
  white-space: pre-line;
}

.hero-banner__description {
  max-width: 450rpx;
  margin-top: 15rpx;
  font-size: 20rpx;
  line-height: 1.45;
  opacity: 0.82;
}

.hero-banner__action {
  display: inline-flex;
  height: 52rpx;
  margin-top: 22rpx;
  padding: 0 18rpx;
  align-items: center;
  gap: 8rpx;
  border-radius: 26rpx;
  color: var(--app-color-brand-active);
  font-size: 20rpx;
  font-weight: 700;
  background: rgb(255 255 255 / 96%);
}

.hero-banner--violet .hero-banner__action {
  color: #5e58b5;
}

.hero-banner--teal .hero-banner__action {
  color: #327b82;
}

.quick-entry-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
  margin-top: 18rpx;
}

.quick-entry {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 10rpx 2rpx 2rpx;
  align-items: center;
  flex-direction: column;
  gap: 10rpx;
  border: 0;
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1.25;
  background: transparent;
}

.quick-entry__icon {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 25rpx;
  color: var(--app-color-brand);
  font-size: 32rpx;
  background: var(--app-bg-brand-soft);
}

.secondary-entry-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12rpx;
  margin-top: 16rpx;
}

.secondary-entry {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 104rpx;
  margin: 0;
  padding: 16rpx 17rpx;
  grid-template-columns: 48rpx minmax(0, 1fr) 18rpx;
  align-items: center;
  gap: 11rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 23rpx;
  box-sizing: border-box;
  color: inherit;
  line-height: 1;
  text-align: left;
  background: var(--app-bg-card);
}

.secondary-entry__icon {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 15rpx;
  color: var(--app-color-brand);
  font-size: 24rpx;
  background: var(--app-bg-brand-soft);
}

.secondary-entry__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8rpx;
}

.secondary-entry__title {
  color: var(--app-text-primary);
  font-size: 22rpx;
  font-weight: 700;
}

.secondary-entry__description {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 17rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.secondary-entry__arrow {
  color: var(--app-text-muted);
  font-size: 18rpx;
}

.home-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20rpx;
  margin: 46rpx 0 20rpx;
}

.home-section-heading > view {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 7rpx;
}

.home-section-heading__title {
  color: var(--app-text-primary);
  font-size: 31rpx;
  font-weight: 700;
}

.home-section-heading__subtitle {
  color: var(--app-text-muted);
  font-size: 21rpx;
}

.home-section-heading button {
  display: flex;
  width: auto;
  min-width: 0;
  height: auto;
  flex: 0 0 auto;
  margin: 0;
  padding: 8rpx 0;
  align-items: center;
  gap: 3rpx;
  border: 0;
  color: var(--app-text-muted);
  font-size: 20rpx;
  line-height: 1;
  background: transparent;
}

.topic-grid,
.guide-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}

.topic-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 192rpx;
  margin: 0;
  padding: 24rpx;
  overflow: hidden;
  align-items: flex-start;
  flex-direction: column;
  border: 0;
  border-radius: 28rpx;
  box-sizing: border-box;
  color: #fff;
  line-height: 1;
  text-align: left;
  white-space: normal;
}

.topic-card--sage {
  color: #315f58;
  background: linear-gradient(145deg, #e6f5f0, #d5ebe4);
}

.topic-card--lavender {
  color: #505b8b;
  background: linear-gradient(145deg, #f0f1fc, #dfe3f6);
}

.topic-card__meta {
  position: relative;
  z-index: 1;
  font-size: 18rpx;
  opacity: 0.78;
}

.topic-card__title {
  position: relative;
  z-index: 1;
  margin-top: 17rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.3;
}

.topic-card__description {
  position: relative;
  z-index: 1;
  margin-top: 10rpx;
  font-size: 19rpx;
  line-height: 1.45;
  opacity: 0.78;
}

.topic-card__arrow {
  position: absolute;
  right: 20rpx;
  bottom: 19rpx;
  display: flex;
  width: 45rpx;
  height: 45rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 23rpx;
  background: rgb(61 78 105 / 9%);
}

.entry-card__image {
  position: absolute;
  inset: 0 0 0 auto;
  width: 56%;
  height: 100%;
  opacity: 0.16;
}

.entry-card--loading {
  background: var(--app-bg-subtle);
}

.ranking-card {
  overflow: hidden;
  border: 1rpx solid var(--app-border-card);
  border-radius: var(--app-radius-lg);
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.ranking-item {
  position: relative;
  display: grid;
  width: 100%;
  min-height: 122rpx;
  margin: 0;
  padding: 22rpx 24rpx;
  grid-template-columns: 38rpx 66rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 15rpx;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  color: inherit;
  line-height: 1;
  text-align: left;
  background: transparent;
}

.ranking-item + .ranking-item::before {
  position: absolute;
  top: 0;
  right: 24rpx;
  left: 24rpx;
  height: 1rpx;
  background: var(--app-divider-color);
  content: '';
}

.ranking-item__number {
  color: var(--app-color-brand);
  font-size: 30rpx;
  font-weight: 800;
}

.ranking-item__icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  color: var(--app-color-brand);
  font-size: 29rpx;
  background: var(--app-bg-brand-soft);
}

.ranking-item__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 9rpx;
}

.ranking-item__title {
  color: var(--app-text-primary);
  font-size: 25rpx;
  font-weight: 700;
}

.ranking-item__description {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranking-item__arrow {
  color: var(--app-text-muted);
  font-size: 24rpx;
}

.guide-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 224rpx;
  margin: 0;
  padding: 26rpx;
  overflow: hidden;
  align-items: flex-start;
  flex-direction: column;
  border: 0;
  border-radius: 28rpx;
  box-sizing: border-box;
  color: #fff;
  line-height: 1;
  text-align: left;
  white-space: normal;
}

.guide-card--slate {
  background: linear-gradient(145deg, #617a9e, #405978);
}

.guide-card--clay {
  background: linear-gradient(145deg, #bd8979, #91635f);
}

.guide-card__type {
  position: relative;
  z-index: 1;
  font-size: 18rpx;
  opacity: 0.72;
}

.guide-card__title {
  position: relative;
  z-index: 1;
  margin-top: 17rpx;
  font-size: 27rpx;
  font-weight: 700;
  line-height: 1.4;
}

.guide-card__description {
  position: relative;
  z-index: 1;
  margin-top: 12rpx;
  font-size: 19rpx;
  line-height: 1.4;
  opacity: 0.76;
}

.guide-card__action {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: auto;
  padding-top: 20rpx;
  align-items: center;
  gap: 7rpx;
  font-size: 19rpx;
  font-weight: 700;
}

.home-section-heading--services {
  margin-top: 42rpx;
}

.service-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.service-entry {
  display: flex;
  min-width: 0;
  margin: 0;
  padding: 19rpx 5rpx 17rpx;
  align-items: center;
  flex-direction: column;
  gap: 10rpx;
  border: 1rpx solid var(--app-border-card);
  border-radius: 23rpx;
  color: var(--app-text-secondary);
  font-size: 20rpx;
  line-height: 1;
  background: var(--app-bg-card);
}

.service-entry__icon {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  color: var(--app-color-brand);
  font-size: 28rpx;
  background: var(--app-bg-brand-soft);
}
</style>
