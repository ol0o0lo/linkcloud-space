<script setup lang="ts">
import { onHide } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import type { MigrationMediaReference } from '@/domain/house-media'
import { getHouseDisplayMedia } from '@/domain/house-media'

interface HouseMediaInput {
  media_id?: unknown
  id?: unknown
  url?: unknown
  thumbnail?: unknown
  original_filename?: unknown
  [key: string]: unknown
}

interface GalleryMediaItem {
  id: string
  contextId: string
  type: 'video' | 'image'
  url: string
  thumbnail: string
  title: string
}

const props = withDefaults(defineProps<{
  images?: HouseMediaInput[]
  videos?: HouseMediaInput[]
  migrationMedia?: MigrationMediaReference[]
  emptyText?: string
}>(), {
  images: () => [],
  videos: () => [],
  migrationMedia: () => [],
  emptyText: '暂无房源媒体',
})

const currentIndex = ref(0)
const playingId = ref('')
const instance = getCurrentInstance()

function normalizeMedia(items: HouseMediaInput[], type: GalleryMediaItem['type']): GalleryMediaItem[] {
  return items.flatMap((item, index) => {
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url)
      return []
    const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail : ''
    const rawId = item.media_id ?? item.id ?? `${type}-${index}`
    return [{
      id: `${type}-${String(rawId)}-${index}`,
      contextId: `house-media-${type}-${index}`,
      type,
      url,
      thumbnail,
      title: typeof item.original_filename === 'string' ? item.original_filename : '',
    }]
  })
}

const mediaItems = computed(() => [
  ...normalizeMedia(getHouseDisplayMedia({ videos: props.videos, migration_media: props.migrationMedia }, 'video'), 'video'),
  ...normalizeMedia(getHouseDisplayMedia({ images: props.images, migration_media: props.migrationMedia }, 'image'), 'image'),
])
const imageItems = computed(() => mediaItems.value.filter(item => item.type === 'image'))
const imageUrls = computed(() => imageItems.value.map(item => item.url))
const videoCount = computed(() => mediaItems.value.filter(item => item.type === 'video').length)
const imageCount = computed(() => imageItems.value.length)
const fallbackPoster = computed(() => imageItems.value[0]?.thumbnail || imageItems.value[0]?.url || '')

watch(mediaItems, (items) => {
  if (currentIndex.value >= items.length)
    currentIndex.value = 0
})

function handleChange(event: { detail?: { current?: number } }) {
  const nextIndex = Number(event.detail?.current || 0)
  const previousItem = mediaItems.value[currentIndex.value]
  if (previousItem?.type === 'video' && nextIndex !== currentIndex.value)
    uni.createVideoContext(previousItem.contextId, instance?.proxy).pause()
  currentIndex.value = nextIndex
  playingId.value = ''
}

function playVideo(item: GalleryMediaItem) {
  playingId.value = item.id
  uni.createVideoContext(item.contextId, instance?.proxy).play()
}

function pauseVideo() {
  const item = mediaItems.value[currentIndex.value]
  if (item?.type === 'video')
    uni.createVideoContext(item.contextId, instance?.proxy).pause()
  playingId.value = ''
}

onHide(pauseVideo)
onBeforeUnmount(pauseVideo)

function selectMedia(index: number) {
  handleChange({ detail: { current: index } })
}

function previewImage(item: GalleryMediaItem) {
  if (item.type !== 'image' || !imageUrls.value.length)
    return
  uni.previewImage({ current: item.url, urls: imageUrls.value })
}
</script>

<template>
  <view class="house-media relative max-h-105 w-full overflow-hidden bg-hex-101820" :class="{ 'house-media--playing': playingId, 'house-media--empty': !mediaItems.length }">
    <swiper v-if="mediaItems.length" class="house-media__swiper" :circular="mediaItems.length > 1" :current="currentIndex" @change="handleChange">
      <swiper-item v-for="item in mediaItems" :key="item.id">
        <video
          v-if="item.type === 'video'"
          :id="item.contextId"
          class="house-media__content block"
          :src="item.url"
          :poster="item.thumbnail || fallbackPoster"
          :controls="playingId === item.id"
          :show-center-play-btn="false"
          object-fit="cover"
          :title="item.title"
          @play="playingId = item.id"
          @pause="playingId = ''"
          @ended="playingId = ''"
        />
        <template v-if="item.type === 'video' && playingId !== item.id">
          <view class="house-media__video-label absolute left-3.5 top-27 z-3 border-1 border-hex-ffffff45 rounded-1.5 border-solid bg-hex-18304640 px-1.5 py-1 text-size-2xs text-hex-fff leading-4">
            房源视频
          </view>
          <button class="house-media__play absolute z-3 m-0 h-13 w-13 flex items-center justify-center border-1 border-hex-fff rounded-full border-solid bg-hex-fff p-0 text-size-2xl text-hex-253b51" aria-label="播放房源视频" @click="playVideo(item)">
            <text class="i-carbon-play house-media__play-icon ml-1" />
          </button>
        </template>
        <image
          v-if="item.type === 'image'"
          class="house-media__content block"
          :src="item.url"
          mode="aspectFill"
          :aria-label="item.title || '房源图片，点击全屏查看'"
          @click="previewImage(item)"
        />
      </swiper-item>
    </swiper>
    <view v-else class="house-media__empty flex flex-col items-center justify-center gap-2 text-size-xs text-hex-ffffff/72">
      <text class="i-carbon-image house-media__empty-icon text-size-2xl" />
      <text>{{ emptyText }}</text>
    </view>

    <template v-if="mediaItems.length && !playingId">
      <view class="house-media__counts bottom-3.5 left-3 flex gap-2 border-1 border-hex-ffffff24 rounded-2 border-solid bg-hex-11263c82 px-2 py-1.5">
        <view v-if="videoCount" class="house-media__count">
          <text class="i-carbon-video" />
          <text>{{ videoCount }}</text>
        </view>
        <view v-if="imageCount" class="house-media__count">
          <text class="i-carbon-image" />
          <text>{{ imageCount }}</text>
        </view>
      </view>
      <view class="house-media__position bottom-4.5 right-3 rounded-1.5 bg-hex-122c405e px-1.5 py-1">
        {{ currentIndex + 1 }} / {{ mediaItems.length }}
      </view>
      <view v-if="mediaItems.length > 1" class="house-media__dots bottom-2.5 left-1/2 flex items-center gap-0.5">
        <button v-for="item, index in mediaItems" :key="`dot-${item.id}`" class="house-media__marker m-0 h-9 w-7 flex items-center justify-center border-0 bg-transparent p-0" :aria-label="`切换到${item.type === 'video' ? '视频' : '图片'} ${index + 1}`" @click="selectMedia(index)">
          <text v-if="item.type === 'video'" class="i-carbon-play house-media__video-dot text-size-sm text-hex-ffffff8a" :class="{ 'house-media__video-dot--active': index === currentIndex }" />
          <view v-else class="house-media__dot h-1 w-1 rounded-full bg-hex-ffffff/50" :class="{ 'house-media__dot--active': index === currentIndex }" />
        </button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.house-media {
  height: 72.3077vw;
}

.house-media::before,
.house-media::after {
  @apply absolute;
  @apply z-1;
  @apply right-0;
  @apply left-0;
  @apply pointer-events-none;
  content: '';
}
.house-media::before {
  @apply top-0;
  height: 55%;
  background: linear-gradient(#0d1c2a66, transparent);
}
.house-media::after {
  @apply bottom-0;
  height: 35%;
  background: linear-gradient(transparent, #10203173);
}
.house-media--playing::before,
.house-media--playing::after {
  @apply hidden;
}

.house-media__swiper,
.house-media__content,
.house-media__empty {
  @apply w-full;
  @apply h-full;
}

.house-media__empty {
  background: linear-gradient(145deg, #253244, #111b28);
}

.house-media__counts,
.house-media__position,
.house-media__dots {
  @apply absolute;
  @apply z-2;
}

.house-media__count,
.house-media__position {
  @apply flex;
  @apply items-center;
  @apply gap-1;
  @apply text-hex-fff;
  @apply text-size-2xs;
  @apply leading-4;
}

.house-media__dots {
  transform: translateX(-50%);
}

.house-media__dot {
  transition:
    width 180ms ease,
    background-color 180ms ease;
}

.house-media__dot--active {
  @apply w-4;
  @apply bg-hex-fff;
}
.house-media__marker::after,
.house-media__play::after {
  @apply border-0;
}
.house-media__video-dot--active {
  @apply text-hex-fff;
}
.house-media__play {
  top: calc(50% - 15px);
  left: calc(50% - 26px);
  box-shadow: 0 3px 18px #11283f20;
}
</style>
