<script setup lang="ts">
import type { HouseOut, PublicHouseDetailOut } from '@/features/houses/service'
import { computed } from 'vue'
import { formatHouseLayout, getHouseAuxiliaryLabels } from '@/domain/house'

const props = defineProps<{ house: HouseOut | PublicHouseDetailOut, management?: boolean, prominent?: boolean }>()
const estateName = computed(() => props.house.building.estate?.display_name || props.house.building.estate?.name || props.house.building.name)
const roomLabel = computed(() => [props.house.building.name !== estateName.value ? props.house.building.name : '', props.house.room_number].filter(Boolean).join(' '))
const location = computed(() => {
  const estate = props.house.building.estate
  return [estate && 'district' in estate ? estate.district : '', props.house.building.address || (estate && 'address' in estate ? estate.address : '')].filter(Boolean).join(' · ')
})
const status = computed(() => 'status__mapping' in props.house ? props.house.status__mapping : '招租中')
const listed = computed(() => !('status' in props.house) || props.house.status === 'listed')
const active = computed(() => !('is_active' in props.house) || props.house.is_active)
const auxiliaryLabels = computed(() => 'is_active' in props.house ? getHouseAuxiliaryLabels(props.house) : [])
const rent = computed(() => props.house.asking_rent == null ? '面议' : Number(props.house.asking_rent).toLocaleString('zh-CN'))
</script>

<template>
  <view class="detail-card summary" :class="{ 'summary--prominent': prominent }">
    <view class="title-line flex items-start justify-between gap-1.5">
      <view class="house-title min-w-0 text-size-lg font-bold leading-6 tracking-tight">
        {{ estateName }}<text class="room-label ml-1.5 text-size-sm font-medium tracking-normal">{{ roomLabel }}</text>
      </view>
      <view class="status-stack flex items-end gap-1">
        <text class="state whitespace-nowrap rounded-1.5 bg-hex-edf6ff px-2 py-1 text-size-2xs text-hex-006bcc font-semibold leading-4.5" :class="{ 'state--muted': !listed }">{{ status }}</text>
        <text v-for="label in auxiliaryLabels" :key="label" class="publish-state text-size-3xs text-hex-78869a">{{ label }}</text>
        <text v-if="management" class="publish-state text-size-3xs text-hex-78869a">{{ listed && active ? '已发布' : '未发布' }}</text>
      </view>
    </view>
    <view v-if="location" class="property-sub mt-1 flex items-start gap-1 text-size-xs text-hex-526177 leading-4.5">
      <text class="i-carbon-location property-sub-icon mt-0.5 flex-none text-size-xs" /><text>{{ location }}</text>
    </view>
    <view v-if="prominent" class="price-caption mt-6 text-size-2xs text-hex-66788d font-medium">
      月租金
    </view>
    <view class="price-line mt-3 flex items-baseline gap-1.5">
      <text v-if="house.asking_rent != null" class="currency text-size-base font-semibold">¥</text>
      <text class="price text-size-2xl text-hex-182538 font-bold leading-7.5 tracking-tight tabular-nums">{{ rent }}</text>
      <text v-if="house.asking_rent != null" class="price-unit">/ 月</text>
      <text class="deposit ml-auto">押金 {{ house.deposit_amount == null ? '待确认' : `¥${Number(house.deposit_amount).toLocaleString('zh-CN')}` }}</text>
    </view>
    <view class="param-row mt-3 flex justify-between border-t-1 border-t-hex-e7ecf2 border-t-solid pt-3">
      <view class="param min-w-0 flex-1 border-r-1 border-r-hex-e7ecf2 border-r-solid text-center">
        <text class="param-value block text-size-xs font-semibold leading-4.5">{{ formatHouseLayout(house.bedrooms, house.living_rooms) }}</text><text class="param-label mt-0.5 block text-size-2xs text-hex-78869a leading-4">户型</text>
      </view>
      <view class="param min-w-0 flex-1 border-r-1 border-r-hex-e7ecf2 border-r-solid text-center">
        <text class="param-value block text-size-xs font-semibold leading-4.5">{{ house.area ? `${Number(house.area)}㎡` : '待完善' }}</text><text class="param-label mt-0.5 block text-size-2xs text-hex-78869a leading-4">建筑面积</text>
      </view>
      <view class="param min-w-0 flex-1 border-r-1 border-r-hex-e7ecf2 border-r-solid text-center">
        <text class="param-value block text-size-xs font-semibold leading-4.5">{{ house.floor == null ? '待完善' : `${house.floor} 层` }}</text><text class="param-label mt-0.5 block text-size-2xs text-hex-78869a leading-4">楼层</text>
      </view>
      <view class="param min-w-0 flex-1 border-r-1 border-r-hex-e7ecf2 border-r-solid text-center">
        <text class="param-value block text-size-xs font-semibold leading-4.5">{{ house.has_elevator_access ? '有电梯' : '无电梯' }}</text><text class="param-label mt-0.5 block text-size-2xs text-hex-78869a leading-4">电梯</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.summary {
  @apply mt-3;
  @apply pt-3.5 px-3.5 pb-3;
}
.status-stack {
  @apply flex-none;
  @apply flex-col;
}
.state--muted {
  @apply text-hex-718095;
  @apply bg-hex-f0f2f5;
}
.price-unit,
.deposit {
  @apply text-hex-526177;
  @apply text-size-2xs;
}
.param:first-child {
  flex: 1.2;
  @apply text-left;
}
.param:last-child {
  @apply border-0;
  @apply text-right;
}
.summary--prominent {
  @apply relative;
  @apply z-2;
  @apply -mt-4.5 mx-3 mb-0;
  @apply pt-5.5 px-4.5 pb-5;
  @apply border-1 border-solid border-hex-e4ebf3;
  @apply rounded-4;
  box-shadow: 0 8px 22px #182b430a;
}
.summary--prominent .house-title {
  @apply text-size-xl;
  @apply font-bold;
  @apply leading-7.5;
}
.summary--prominent .room-label {
  @apply block;
  @apply mt-1 mx-0 mb-0;
  @apply text-hex-495b70;
  @apply text-size-xs;
  @apply font-medium;
  @apply leading-5;
  @apply tracking-normal;
}
.summary--prominent .property-sub {
  @apply mt-2;
  @apply text-hex-66788d;
  @apply text-size-xs;
}
.summary--prominent .state {
  @apply py-1 px-2.5;
  @apply rounded-2;
  @apply text-hex-1269db;
  @apply bg-hex-ebf4ff;
}
.summary--prominent .state--muted {
  @apply text-hex-718095;
  @apply bg-hex-f0f2f5;
}
.summary--prominent .price-line {
  @apply mt-0.5;
}
.summary--prominent .currency,
.summary--prominent .price {
  @apply text-hex-1269db;
}
.summary--prominent .price {
  @apply text-size-4xl;
  @apply leading-9.5;
}
.summary--prominent .price-unit {
  @apply text-size-xs;
}
.summary--prominent .deposit {
  @apply text-hex-66788d;
  @apply text-size-2xs;
}
.summary--prominent .param-row {
  @apply gap-0;
  @apply mt-4.5;
  @apply py-3.5 px-1;
  @apply border-0;
  @apply rounded-3;
  @apply bg-hex-f3f7fc;
}
.summary--prominent .param {
  @apply border-hex-dce6f1;
  @apply text-center;
}
.summary--prominent .param-value {
  @apply text-size-xs;
  @apply leading-5;
}
.summary--prominent .param-label {
  @apply mt-1;
  @apply text-size-2xs;
}
</style>
