<script setup lang="ts">
import type { CommuteDraft, CommutePlace } from '@/features/houses/commute'
import { computed } from 'vue'
import { COMMUTE_MODES } from '@/features/houses/commute'
import { APP_ROUTES } from '@/modules/routes'

const props = defineProps<{
  modelValue: CommuteDraft
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CommuteDraft]
}>()

function change(value: Partial<CommuteDraft>) {
  emit('update:modelValue', { ...props.modelValue, ...value })
}

const sliderMinutes = computed({
  get: () => props.modelValue.maxMinutes,
  set: value => change({ maxMinutes: Number(value) }),
})

function openPlaceSearch() {
  uni.navigateTo({
    url: `${APP_ROUTES.houseCommutePlace}${props.modelValue.place?.destinationId ? `?selected_id=${props.modelValue.place.destinationId}` : ''}`,
    events: { selectCommutePlace: (place: CommutePlace) => change({ place }) },
  })
}
</script>

<template>
  <view class="commute-picker px-0 py-0.5" :class="{ 'commute-picker--compact': compact }">
    <view class="commute-picker__label text-size-xs text-content-primary font-bold">
      目的地
    </view>
    <button class="commute-picker__destination m-0 min-h-10.5 w-full flex items-center gap-2 border-hairline border-app-card rounded-2 border-solid bg-surface-page px-3 py-0 text-left" @click="openPlaceSearch">
      <view class="i-carbon-search commute-picker__destination-icon text-size-sm" />
      <text class="commute-picker__destination-text block min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-size-xs text-content-primary" :class="{ 'commute-picker__destination-text--placeholder': !modelValue.place }">{{ modelValue.place?.name || '搜索公司、学校或地标' }}</text>
    </button>

    <view class="commute-picker__label commute-picker__label--spaced text-size-xs text-content-primary font-bold">
      出行方式
    </view>
    <view class="commute-picker__modes flex flex-wrap gap-1">
      <button v-for="item in COMMUTE_MODES" :key="item.value" class="commute-picker__mode m-0 border-hairline border-app-card rounded-1.5 border-solid bg-surface-page px-2 py-0 text-size-2xs text-content-secondary leading-7" :class="{ active: modelValue.mode === item.value }" @click="change({ mode: item.value })">
        {{ item.label }}
      </button>
    </view>

    <view class="commute-picker__time mt-4 flex justify-between text-size-2xs text-content-secondary">
      <text>最长通勤时间</text><strong>{{ modelValue.maxMinutes }} 分钟</strong>
    </view>
    <view class="commute-picker__slider mt-3">
      <wd-slider v-model="sliderMinutes" :min="15" :max="120" :step="5" show-extreme-value popover-visible="never" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.commute-picker__label {
  @apply mb-1.5;
}
.commute-picker__label--spaced {
  @apply mt-3.5;
}
.commute-picker__destination::after,
.commute-picker__mode::after {
  @apply border-0;
}
.commute-picker__destination-text--placeholder,
.commute-picker__destination-icon {
  @apply text-content-muted;
}
.commute-picker__mode.active {
  @apply border-app-brand;
  @apply text-app-brand;
  @apply bg-surface-brand-soft;
}
.commute-picker__time strong {
  @apply text-app-brand;
}
.commute-picker--compact {
  @apply p-2.5;
}
.commute-picker--compact .commute-picker__modes {
  @apply gap-1;
}
.commute-picker--compact .commute-picker__mode {
  @apply py-0 px-1.5;
  @apply text-size-2xs;
}
</style>
