<script setup lang="ts">
import type { PublicHouseListOut } from '../service'
import { computed } from 'vue'
import { formatHouseLayout } from '@/domain/house'

const props = defineProps<{
  house: PublicHouseListOut
}>()

defineEmits<{
  click: []
}>()

const cover = computed(() => props.house.images[0]?.thumbnail || props.house.images[0]?.url || '')
const location = computed(() => [props.house.building.estate?.district, props.house.building.estate?.name || props.house.building.name].filter(Boolean).join(' · '))
</script>

<template>
  <view class="house-card" @click="$emit('click')">
    <image v-if="cover" class="house-card__cover" :src="cover" mode="aspectFill" />
    <view v-else class="house-card__cover house-card__cover--empty">
      暂无图片
    </view>
    <view class="house-card__body">
      <view class="house-card__title">
        {{ house.building.estate?.display_name || house.building.name }} {{ house.room_number }}
      </view>
      <view class="house-card__meta">
        {{ formatHouseLayout(house.bedrooms, house.living_rooms) }}
        <text v-if="house.area"> · {{ house.area }}㎡</text>
        <text v-if="house.orientation__mapping"> · {{ house.orientation__mapping }}</text>
      </view>
      <view class="house-card__location">
        {{ location || house.building.address }}
      </view>
      <view v-if="house.effective_tags.length" class="house-card__tags">
        <wd-tag v-for="tag in house.effective_tags.slice(0, 3)" :key="tag" size="small" variant="light" type="primary">
          {{ tag }}
        </wd-tag>
      </view>
      <view class="house-card__footer">
        <view class="house-card__price">
          <text class="house-card__amount">{{ house.asking_rent || '面议' }}</text>
          <text v-if="house.asking_rent"> 元/月</text>
        </view>
        <view class="house-card__publisher">
          {{ house.publisher.name }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.house-card {
  display: flex;
  gap: 24rpx;
  padding: 24rpx;
  border-radius: 24rpx;
  background: var(--app-bg-card);
  box-shadow: var(--app-shadow-card);
}

.house-card__cover {
  flex: 0 0 220rpx;
  width: 220rpx;
  height: 176rpx;
  border-radius: 18rpx;
  background: var(--app-bg-subtle);
}

.house-card__cover--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--app-text-muted);
  font-size: 24rpx;
}

.house-card__body {
  min-width: 0;
  flex: 1;
}

.house-card__title {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 30rpx;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.house-card__meta,
.house-card__location,
.house-card__publisher {
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.house-card__tags {
  display: flex;
  gap: 8rpx;
  margin-top: 12rpx;
  overflow: hidden;
}

.house-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 14rpx;
}

.house-card__price {
  color: var(--app-color-price);
  font-size: 22rpx;
  white-space: nowrap;
}

.house-card__amount {
  font-size: 34rpx;
  font-weight: 700;
}
</style>
