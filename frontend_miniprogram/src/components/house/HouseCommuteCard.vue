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

defineEmits<{ configure: [] }>()

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
    <view class="detail-heading">
      <text>通勤参考</text>
      <button class="detail-text-button" @click="$emit('configure')">
        {{ destinationName ? '修改' : '设置' }} <text class="i-carbon-chevron-right" />
      </button>
    </view>
    <template v-if="destinationName">
      <view class="commute-card__destination">
        <text>到</text>
        <strong>{{ destinationName }}</strong>
      </view>
      <view class="commute-card__route">
        <text :class="modeIcon" class="commute-card__mode-icon" />
        <template v-if="route">
          <text class="commute-card__mode">{{ commuteModeLabel(mode) }}</text>
          <strong>约 {{ route.duration_minutes }} 分钟</strong>
        </template>
        <text v-else-if="loading">正在计算路线…</text>
        <text v-else-if="error">{{ error }}</text>
        <text v-else>{{ commuteModeLabel(mode) }}路线待计算</text>
      </view>
      <view v-if="route" class="commute-card__meta">
        <text>全程 {{ distanceLabel }}</text>
        <template v-if="transitSegments.length">
          <text class="commute-card__meta-separator">·</text>
          <text>{{ transferCount ? `换乘 ${transferCount} 次` : '无需换乘' }}</text>
          <template v-if="route.walking_distance_m">
            <text class="commute-card__meta-separator">·</text>
            <text>总步行 {{ walkingDistanceLabel }}</text>
          </template>
        </template>
      </view>
      <view v-if="transitSegments.length" class="commute-card__transit">
        <scroll-view scroll-x class="commute-card__scroll" :show-scrollbar="false">
          <view class="commute-card__segments">
            <template v-for="(segment, index) in visibleTransitSegments" :key="`${segment.kind}-${index}`">
              <text v-if="index" class="i-carbon-chevron-right commute-card__segment-arrow" />
              <view class="commute-card__segment" :class="{ 'commute-card__segment--metro': segment.kind === 'metro' }" :style="segmentStyle(segment)">
                <text v-if="segment.kind === 'walk'" class="i-carbon-pedestrian" />
                <text>{{ segmentLabel(segment) }}</text>
              </view>
            </template>
          </view>
        </scroll-view>
      </view>
    </template>
    <view v-else class="commute-card__empty">
      设置上班地点后，可查看这套房源的通勤时间。
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.commute-card__destination {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 3px 0 10px;
  color: #78869a;
  font-size: 12px;
}
.commute-card__destination strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #182538;
  font-weight: 600;
}
.commute-card__route {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 25px;
  color: #526177;
  font-size: 12px;
}
.commute-card__mode-icon {
  flex: none;
  color: #006bcc;
  font-size: 18px;
}
.commute-card__mode {
  flex: none;
}
.commute-card__route strong {
  color: #182538;
  font-size: 17px;
  font-weight: 650;
}
.commute-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 5px;
  margin-top: 4px;
  padding-left: 24px;
  color: #78869a;
  font-size: 11px;
}
.commute-card__meta-separator {
  color: #a2adbb;
}
.commute-card__empty {
  padding: 3px 0 2px;
  color: #78869a;
  font-size: 12px;
  line-height: 21px;
}
.commute-card__transit {
  margin-top: 13px;
}
.commute-card__scroll {
  width: 100%;
  white-space: nowrap;
}
.commute-card__segments {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-bottom: 2px;
}
.commute-card__segment {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  padding: 5px 7px;
  border-radius: 6px;
  color: #526177;
  font-size: 11px;
  background: #f1f5fa;
}
.commute-card__segment--metro {
  color: #182538;
  font-weight: 600;
  background: #f1f5fa;
}
.commute-card__segment-arrow {
  flex: none;
  color: #a2adbb;
  font-size: 12px;
}
</style>
