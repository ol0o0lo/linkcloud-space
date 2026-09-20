<script setup lang="ts">
import type { HouseOut, PublicHouseDetailOut } from '@/features/houses/service'
import { computed } from 'vue'
import { formatHouseLayout } from '@/domain/house'

const props = defineProps<{ house: HouseOut | PublicHouseDetailOut, management?: boolean }>()
const estateName = computed(() => props.house.building.estate?.display_name || props.house.building.estate?.name || props.house.building.name)
const roomLabel = computed(() => [props.house.building.name !== estateName.value ? props.house.building.name : '', props.house.room_number].filter(Boolean).join(' '))
const location = computed(() => {
  const estate = props.house.building.estate
  return [estate && 'district' in estate ? estate.district : '', props.house.building.address || (estate && 'address' in estate ? estate.address : '')].filter(Boolean).join(' · ')
})
const status = computed(() => 'status__mapping' in props.house ? props.house.status__mapping : '招租中')
const listed = computed(() => !('status' in props.house) || props.house.status === 'listed')
const rent = computed(() => props.house.asking_rent == null ? '面议' : Number(props.house.asking_rent).toLocaleString('zh-CN'))
</script>

<template>
  <view class="detail-card summary">
    <view class="title-line">
      <view class="house-title">
        {{ estateName }}<text class="room-label">{{ roomLabel }}</text>
      </view>
      <view class="status-stack">
        <text class="state" :class="{ 'state--muted': !listed }">{{ status }}</text>
        <text v-if="management" class="publish-state">{{ listed ? '已发布' : '未发布' }}</text>
      </view>
    </view>
    <view v-if="location" class="property-sub">
      <text class="i-carbon-location property-sub-icon" /><text>{{ location }}</text>
    </view>
    <view class="price-line">
      <text v-if="house.asking_rent != null" class="currency">¥</text>
      <text class="price">{{ rent }}</text>
      <text v-if="house.asking_rent != null" class="price-unit">/ 月</text>
      <text class="deposit">押金 {{ house.deposit_amount == null ? '待确认' : `¥${Number(house.deposit_amount).toLocaleString('zh-CN')}` }}</text>
    </view>
    <view class="param-row">
      <view class="param">
        <text class="param-value">{{ formatHouseLayout(house.bedrooms, house.living_rooms) }}</text><text class="param-label">户型</text>
      </view>
      <view class="param">
        <text class="param-value">{{ house.area ? `${Number(house.area)}㎡` : '待完善' }}</text><text class="param-label">建筑面积</text>
      </view>
      <view class="param">
        <text class="param-value">{{ house.floor == null ? '待完善' : `${house.floor} 层` }}</text><text class="param-label">楼层</text>
      </view>
      <view class="param">
        <text class="param-value">{{ house.has_elevator_access ? '有电梯' : '无电梯' }}</text><text class="param-label">楼栋</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
@use './detail.scss';
.summary {
  margin-top: 12px;
  padding: 13px 14px 12px;
}
.title-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}
.house-title {
  min-width: 0;
  font-size: 18px;
  font-weight: 680;
  line-height: 24px;
  letter-spacing: -0.5px;
}
.room-label {
  margin-left: 6px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
}
.status-stack {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.state {
  padding: 3px 7px;
  border-radius: 5px;
  color: #006bcc;
  font-size: 10px;
  font-weight: 550;
  line-height: 17px;
  background: #edf6ff;
  white-space: nowrap;
}
.state--muted {
  color: #718095;
  background: #f0f2f5;
}
.publish-state {
  color: #78869a;
  font-size: 9px;
}
.property-sub {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin-top: 3px;
  color: #526177;
  font-size: 12px;
  line-height: 18px;
}
.property-sub-icon {
  flex: none;
  margin-top: 2px;
  font-size: 13px;
}
.price-line {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 12px;
}
.currency {
  font-size: 16px;
  font-weight: 600;
}
.price {
  color: #182538;
  font-size: 27px;
  font-weight: 720;
  line-height: 30px;
  letter-spacing: -0.8px;
  font-variant-numeric: tabular-nums;
}
.price-unit,
.deposit {
  color: #526177;
  font-size: 11px;
}
.deposit {
  margin-left: auto;
}
.param-row {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e7ecf2;
}
.param {
  flex: 1;
  min-width: 0;
  border-right: 1px solid #e7ecf2;
  text-align: center;
}
.param:first-child {
  flex: 1.2;
  text-align: left;
}
.param:last-child {
  border: 0;
  text-align: right;
}
.param-value {
  display: block;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
}
.param-label {
  display: block;
  margin-top: 2px;
  color: #78869a;
  font-size: 10px;
  line-height: 15px;
}
</style>
