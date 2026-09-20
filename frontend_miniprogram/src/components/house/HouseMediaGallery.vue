<script setup lang="ts">
import { onHide } from '@dcloudio/uni-app'
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'

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
  emptyText?: string
}>(), {
  images: () => [],
  videos: () => [],
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
  ...normalizeMedia(props.videos, 'video'),
  ...normalizeMedia(props.images, 'image'),
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
  <view class="house-media" :class="{ 'house-media--playing': playingId }">
    <swiper v-if="mediaItems.length" class="house-media__swiper" :circular="mediaItems.length > 1" :current="currentIndex" @change="handleChange">
      <swiper-item v-for="item in mediaItems" :key="item.id">
        <video
          v-if="item.type === 'video'"
          :id="item.contextId"
          class="house-media__content"
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
          <view class="house-media__video-label">
            房源视频
          </view>
          <button class="house-media__play" aria-label="播放房源视频" @click="playVideo(item)">
            <text class="i-carbon-play house-media__play-icon" />
          </button>
        </template>
        <image
          v-if="item.type === 'image'"
          class="house-media__content"
          :src="item.url"
          mode="aspectFill"
          :aria-label="item.title || '房源图片，点击全屏查看'"
          @click="previewImage(item)"
        />
      </swiper-item>
    </swiper>
    <view v-else class="house-media__empty">
      <text class="i-carbon-image house-media__empty-icon" />
      <text>{{ emptyText }}</text>
    </view>

    <template v-if="mediaItems.length && !playingId">
      <view class="house-media__counts">
        <view v-if="videoCount" class="house-media__count">
          <text class="i-carbon-video" />
          <text>{{ videoCount }}</text>
        </view>
        <view v-if="imageCount" class="house-media__count">
          <text class="i-carbon-image" />
          <text>{{ imageCount }}</text>
        </view>
      </view>
      <view class="house-media__position">
        {{ currentIndex + 1 }} / {{ mediaItems.length }}
      </view>
      <view v-if="mediaItems.length > 1" class="house-media__dots">
        <button v-for="item, index in mediaItems" :key="`dot-${item.id}`" class="house-media__marker" :aria-label="`切换到${item.type === 'video' ? '视频' : '图片'} ${index + 1}`" @click="selectMedia(index)">
          <text v-if="item.type === 'video'" class="i-carbon-play house-media__video-dot" :class="{ 'house-media__video-dot--active': index === currentIndex }" />
          <view v-else class="house-media__dot" :class="{ 'house-media__dot--active': index === currentIndex }" />
        </button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.house-media {
  position: relative;
  width: 100%;
  height: 72.3077vw;
  max-height: 420px;
  overflow: hidden;
  background: #101820;
}

.house-media::before,
.house-media::after {
  position: absolute;
  z-index: 1;
  right: 0;
  left: 0;
  pointer-events: none;
  content: '';
}
.house-media::before {
  top: 0;
  height: 55%;
  background: linear-gradient(#0d1c2a66, transparent);
}
.house-media::after {
  bottom: 0;
  height: 35%;
  background: linear-gradient(transparent, #10203173);
}
.house-media--playing::before,
.house-media--playing::after {
  display: none;
}

.house-media__swiper,
.house-media__content,
.house-media__empty {
  width: 100%;
  height: 100%;
}

.house-media__content {
  display: block;
}

.house-media__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
  color: rgba(255, 255, 255, 0.72);
  font-size: 24rpx;
  background: linear-gradient(145deg, #253244, #111b28);
}

.house-media__empty-icon {
  font-size: 54rpx;
}

.house-media__counts,
.house-media__position,
.house-media__dots {
  position: absolute;
  z-index: 2;
}

.house-media__counts {
  bottom: 14px;
  left: 12px;
  display: flex;
  gap: 7px;
  padding: 5px 8px;
  border: 1px solid #ffffff24;
  border-radius: 7px;
  background: #11263c82;
}

.house-media__count,
.house-media__position {
  display: flex;
  align-items: center;
  gap: 3px;
  color: #fff;
  font-size: 10px;
  line-height: 15px;
}

.house-media__position {
  right: 12px;
  bottom: 17px;
  padding: 4px 6px;
  border-radius: 5px;
  background: #122c405e;
}

.house-media__dots {
  bottom: 9px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 1px;
  transform: translateX(-50%);
}

.house-media__dot {
  width: 4px;
  height: 4px;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.5);
  transition:
    width 180ms ease,
    background-color 180ms ease;
}

.house-media__dot--active {
  width: 15px;
  background: #fff;
}
.house-media__marker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 36px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
}
.house-media__marker::after,
.house-media__play::after {
  border: 0;
}
.house-media__video-dot {
  color: #ffffff8a;
  font-size: 14px;
}
.house-media__video-dot--active {
  color: #fff;
}
.house-media__play {
  position: absolute;
  z-index: 3;
  top: calc(50% - 15px);
  left: calc(50% - 26px);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin: 0;
  padding: 0;
  border: 1px solid #fff;
  border-radius: 50%;
  color: #253b51;
  font-size: 25px;
  background: #fff;
  box-shadow: 0 3px 18px #11283f20;
}
.house-media__play-icon {
  margin-left: 3px;
}
.house-media__video-label {
  position: absolute;
  z-index: 3;
  top: 107px;
  left: 14px;
  padding: 3px 6px;
  border: 1px solid #ffffff45;
  border-radius: 5px;
  color: #fff;
  font-size: 10px;
  line-height: 15px;
  background: #18304640;
}
</style>
