<script setup lang="ts">
import type { PublicHouseSearchPreset } from '@/domain/home-content'
import { computed, ref, watch } from 'vue'
import { listPublicHouses } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const props = defineProps<{ locatingNearby?: boolean, nearbyPreset?: PublicHouseSearchPreset }>()

const emit = defineEmits<{
  change: [preset: PublicHouseSearchPreset]
  keyword: [preset: PublicHouseSearchPreset]
  search: [preset: PublicHouseSearchPreset]
  nearby: [preset: PublicHouseSearchPreset]
  clearNearby: []
  map: [preset: PublicHouseSearchPreset]
}>()

const regionStore = usePublicHouseRegionStore()
const listingType = ref('整租')
const bedroomChoice = ref('')
const houseCount = ref<number | null>(null)
const countLoading = ref(false)
const nearbyActive = computed(() => props.nearbyPreset?.nearby === 1)
let countVersion = 0

const categoryLabels = ['整租', '合租', '公寓', '短租']
const categoryValues: Record<string, NonNullable<PublicHouseSearchPreset['listing_type']>> = {
  整租: 'whole',
  合租: 'shared',
  公寓: 'apartment',
  短租: 'short_term',
}
const segmentedStyle = [
  '--wot-segmented-radius: 38rpx 38rpx 0 0',
  '--wot-segmented-border-width: 0',
  '--wot-segmented-item-font-size: 26rpx',
  '--wot-segmented-item-font-weight-active: 700',
  '--wot-segmented-outline-bg: #eef3f7',
  '--wot-segmented-outline-padding: 0',
  '--wot-segmented-outline-radius: 38rpx 38rpx 0 0',
  '--wot-segmented-outline-item-padding: 25rpx 0',
  '--wot-segmented-outline-item-color: #3e5467',
  '--wot-segmented-outline-item-bg-active: #fff',
  '--wot-segmented-outline-item-color-active: #1575c9',
].join('; ')

const preset = computed<PublicHouseSearchPreset>(() => ({
  ...props.nearbyPreset,
  listing_type: categoryValues[listingType.value],
  bedrooms: bedroomChoice.value && bedroomChoice.value !== '3+' ? Number(bedroomChoice.value) : undefined,
  bedrooms_min: bedroomChoice.value === '3+' ? 3 : undefined,
}))

watch(preset, value => emit('change', value), { immediate: true })

watch([
  listingType,
  bedroomChoice,
  () => regionStore.scopeKey,
  nearbyActive,
  () => props.nearbyPreset?.longitude,
  () => props.nearbyPreset?.latitude,
  () => props.nearbyPreset?.radius_m,
], async () => {
  const version = ++countVersion
  countLoading.value = true
  try {
    const result = await listPublicHouses({
      listing_type: preset.value.listing_type,
      bedrooms: preset.value.bedrooms,
      bedrooms_min: preset.value.bedrooms_min,
      ...(nearbyActive.value
        ? {
            longitude: preset.value.longitude,
            latitude: preset.value.latitude,
            radius_m: preset.value.radius_m,
            coordinate_system: 'gcj02',
          }
        : {
            province: regionStore.selection.province || undefined,
            city: regionStore.selection.city || undefined,
          }),
      page: 1,
      page_size: 1,
    })
    if (version === countVersion)
      houseCount.value = result.total
  }
  catch {
    if (version === countVersion)
      houseCount.value = null
  }
  finally {
    if (version === countVersion)
      countLoading.value = false
  }
}, { immediate: true })
</script>

<template>
  <view class="home-search-panel">
    <view class="home-search-panel__types">
      <wd-segmented v-model:value="listingType" :options="categoryLabels" theme="outline" :custom-style="segmentedStyle" />
    </view>
    <view class="home-search-panel__body">
      <view class="home-search-panel__search-row">
        <button class="home-search-panel__keyword app-touchable" :class="{ 'home-search-panel__keyword--located': nearbyActive }" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('keyword', preset)">
          <view :class="nearbyActive ? 'i-carbon-location' : 'i-carbon-search'" />
          <text>{{ nearbyActive ? preset.place_name || '当前位置' : '小区 / 商圈 / 地铁站' }}</text>
        </button>
        <button v-if="nearbyActive" class="home-search-panel__clear app-touchable" :disabled="locatingNearby" aria-label="清除附近筛选" hover-class="app-touchable--pressed" @click="emit('clearNearby')">
          <view class="i-carbon-close" />
        </button>
        <view class="home-search-panel__divider" />
        <button class="home-search-panel__nearby app-touchable" :class="{ 'home-search-panel__nearby--active': nearbyActive }" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('nearby', preset)">
          <view class="i-carbon-location-current" />
          <text>{{ locatingNearby ? '定位中…' : nearbyActive ? '重新定位' : '附近' }}</text>
        </button>
      </view>

      <view v-if="nearbyActive" class="home-search-panel__location-hint">
        附近 1 公里 · 按距离排序
      </view>

      <view class="home-search-panel__bedrooms">
        <wd-radio-group v-model="bedroomChoice" direction="horizontal" checked-color="#1678cf">
          <wd-radio value="">
            不限
          </wd-radio>
          <wd-radio value="1">
            1居
          </wd-radio>
          <wd-radio value="2">
            2居
          </wd-radio>
          <wd-radio value="3+">
            3居+
          </wd-radio>
        </wd-radio-group>
      </view>

      <view class="home-search-panel__actions">
        <button class="home-search-panel__submit app-touchable" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('search', preset)">
          {{ locatingNearby ? '正在定位…' : countLoading || houseCount === null ? '查看房源' : `查看 ${houseCount} 套${nearbyActive ? '附近' : ''}房源` }}
        </button>
        <button class="home-search-panel__map app-touchable" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('map', preset)">
          <view class="i-carbon-map" />
          <text>去地图看</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
button::after {
  border: 0;
}

.home-search-panel {
  position: relative;
  z-index: 2;
  overflow: hidden;
  border: 1rpx solid #e4edf4;
  border-radius: 38rpx;
  background: #eef3f7;
  box-shadow: 0 24rpx 48rpx rgb(12 55 92 / 13%);
}

.home-search-panel__body {
  padding: 28rpx 26rpx 26rpx;
  background: #fff;
}

.home-search-panel__search-row {
  display: flex;
  min-height: 78rpx;
  align-items: center;
  border-bottom: 1rpx solid #e7edf2;
}

.home-search-panel__keyword,
.home-search-panel__nearby {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #314a5e;
  font-size: 24rpx;
  line-height: 1.3;
}

.home-search-panel__keyword {
  flex: 1;
  color: #9aaab8;
  text-align: left;
}

.home-search-panel__keyword text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-search-panel__keyword--located,
.home-search-panel__nearby--active {
  color: #1575c9;
}

.home-search-panel__clear {
  display: flex;
  width: 56rpx;
  height: 64rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  background: transparent;
  color: #7b8d9d;
  font-size: 26rpx;
}

.home-search-panel__location-hint {
  padding-top: 16rpx;
  color: #657d90;
  font-size: 22rpx;
}

.home-search-panel__keyword view,
.home-search-panel__nearby view {
  flex: none;
  font-size: 28rpx;
}

.home-search-panel__divider {
  width: 1rpx;
  height: 36rpx;
  margin: 0 18rpx;
  background: #e1e9ef;
}

.home-search-panel__nearby {
  flex: none;
  font-weight: 650;
}

.home-search-panel__bedrooms {
  padding: 28rpx 0;
}

:deep(.home-search-panel__bedrooms .wd-radio-group) {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

:deep(.home-search-panel__bedrooms .wd-radio) {
  margin-right: 0;
  font-size: 22rpx;
}

.home-search-panel__actions {
  display: flex;
  gap: 14rpx;
}

.home-search-panel__submit,
.home-search-panel__map {
  display: flex;
  min-width: 0;
  height: 82rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  margin: 0;
  border-radius: 18rpx;
  font-size: 24rpx;
  font-weight: 700;
  line-height: 82rpx;
}

.home-search-panel__submit {
  flex: 1.55;
  background: #1678cf;
  color: #fff;
}

.home-search-panel__map {
  flex: 1;
  background: linear-gradient(125deg, #e9f4fc, #d8eefa);
  color: #294d68;
}

.home-search-panel__map view {
  font-size: 27rpx;
}
</style>
