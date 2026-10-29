<script setup lang="ts">
import type { CommuteRoute } from '@/features/houses/commute'
import type { CommuteMode, CommuteTransitSegment } from '@/services/manual/house-commute'
import { computed } from 'vue'
import { commuteModeLabel } from '@/features/houses/commute'

const props = defineProps<{
  destinationName?: string
  mode: CommuteMode
  route?: CommuteRoute | null
  loading?: boolean
  error?: string
}>()

defineEmits<{ configure: [], retry: [] }>()

const modeIcon = computed(() => ({
  metro: 'i-carbon-train',
  ebike: 'i-carbon-scooter',
  bicycle: 'i-carbon-bicycle',
  walking: 'i-carbon-pedestrian',
  driving: 'i-carbon-car',
})[props.mode])

const distanceLabel = computed(() => {
  if (!props.route)
    return ''
  return props.route.distance_m < 1000 ? `${props.route.distance_m}米` : `${(props.route.distance_m / 1000).toFixed(1)}km`
})

const transitSegments = computed(() => props.route?.mode === 'metro' ? props.route.transit_segments || [] : [])
const visibleTransitSegments = computed(() => {
  const segments = transitSegments.value
  const firstMetro = segments.findIndex(segment => segment.kind === 'metro')
  const lastMetro = segments.reduce((last, segment, index) => segment.kind === 'metro' ? index : last, -1)
  return segments.filter((segment, index) => segment.kind === 'metro' || index < firstMetro || index > lastMetro)
})
const transferCount = computed(() => {
  const lines = transitSegments.value.filter(segment => segment.kind === 'metro').map(segment => segment.label)
  return lines.slice(1).filter((line, index) => line !== lines[index]).length
})
const walkingDistanceLabel = computed(() => {
  const distance = props.route?.walking_distance_m || 0
  return distance < 1000 ? `${distance}米` : `${(distance / 1000).toFixed(1)}km`
})
function segmentLabel(segment: CommuteTransitSegment): string {
  if (segment.kind === 'metro')
    return segment.label
  if (segment.duration_seconds)
    return `步行约${Math.ceil(segment.duration_seconds / 60)}分`
  return segment.distance_m ? `步行${segment.distance_m}米` : '步行'
}

function segmentStyle(segment: CommuteTransitSegment) {
  if (segment.kind !== 'metro' || !/^#[\da-f]{6}$/i.test(segment.color))
    return undefined
  const channels = [1, 3, 5].map(index => Number.parseInt(segment.color.slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return { backgroundColor: segment.color, color: luminance > 0.19 ? '#102030' : '#fff' }
}
</script>

<template>
  <view class="detail-card commute-card">
    <view class="commute-card__header flex items-center justify-between gap-3">
      <view class="commute-card__summary min-w-0 flex items-center gap-x-2 gap-y-1">
        <text class="commute-card__label flex-none text-size-xs text-hex-66788d font-medium leading-4.5">通勤参考</text>
        <view v-if="destinationName" class="commute-card__destination min-w-0 flex flex-1 items-center gap-1.5 text-size-xs text-hex-78869a">
          <text>到</text>
          <strong>{{ destinationName }}</strong>
        </view>
        <text v-else class="commute-card__empty basis-full text-size-xs text-hex-526177 leading-4.5">设置上班地点，查看通勤时间</text>
      </view>
      <button class="detail-text-button" :aria-label="destinationName ? '修改通勤地点' : '设置通勤地点'" @click="$emit('configure')">
        {{ destinationName ? '修改' : '设置' }} <text class="i-carbon-chevron-right" />
      </button>
    </view>
    <template v-if="destinationName">
      <view class="commute-card__route mt-2 min-h-6.5 flex items-center gap-1.5 text-size-xs text-hex-526177">
        <text :class="modeIcon" class="commute-card__mode-icon flex-none text-size-lg text-hex-006bcc" />
        <template v-if="route">
          <text class="commute-card__mode flex-none">{{ commuteModeLabel(mode) }}</text>
          <strong>约 {{ route.duration_minutes }} 分钟</strong>
        </template>
        <text v-else-if="loading">正在计算路线…</text>
        <text v-else-if="error">{{ error }}</text>
        <text v-else>{{ commuteModeLabel(mode) }}路线待计算</text>
      </view>
      <view v-if="error && !loading" class="commute-card__meta mt-1 flex flex-wrap gap-x-1.5 gap-y-0 pl-6 text-size-2xs text-hex-78869a">
        <wd-button variant="text" size="mini" @click="$emit('retry')">
          重新计算
        </wd-button>
      </view>
      <view v-if="route" class="commute-card__meta mt-1 flex flex-wrap gap-x-1.5 gap-y-0 pl-6 text-size-2xs text-hex-78869a">
        <text>全程 {{ distanceLabel }}</text>
        <template v-if="transitSegments.length">
          <text class="commute-card__meta-separator text-hex-a2adbb">·</text>
          <text>{{ transferCount ? `换乘 ${transferCount} 次` : '无需换乘' }}</text>
          <template v-if="route.walking_distance_m">
            <text class="commute-card__meta-separator text-hex-a2adbb">·</text>
            <text>总步行 {{ walkingDistanceLabel }}</text>
          </template>
        </template>
      </view>
      <view v-if="transitSegments.length" class="commute-card__transit mt-3.5">
        <scroll-view scroll-x class="commute-card__scroll" :show-scrollbar="false">
          <view class="commute-card__segments inline-flex items-center gap-1.5 pb-0.5">
            <template v-for="(segment, index) in visibleTransitSegments" :key="`${segment.kind}-${index}`">
              <text v-if="index" class="i-carbon-chevron-right commute-card__segment-arrow flex-none text-size-xs text-hex-a2adbb" />
              <view class="commute-card__segment flex flex-none items-center gap-1 rounded-1.5 bg-hex-f1f5fa px-2 py-1.5 text-size-2xs text-hex-526177" :class="{ 'commute-card__segment--metro': segment.kind === 'metro' }" :style="segmentStyle(segment)">
                <text v-if="segment.kind === 'walk'" class="i-carbon-pedestrian" />
                <text>{{ segmentLabel(segment) }}</text>
              </view>
            </template>
          </view>
        </scroll-view>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.commute-card__header > .detail-text-button {
  @apply flex-none;
}
.commute-card__summary {
  @apply flex-1;
  @apply flex-wrap;
}
.commute-card__destination strong {
  @apply min-w-0;
  @apply overflow-hidden;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
  @apply text-hex-182538;
  @apply font-semibold;
}
.commute-card__route strong {
  @apply text-hex-182538;
  @apply text-size-base;
  @apply font-bold;
}
.commute-card__scroll {
  @apply w-full;
  @apply whitespace-nowrap;
}
.commute-card__segment--metro {
  @apply text-hex-182538;
  @apply font-semibold;
  @apply bg-hex-f1f5fa;
}
</style>
