<script setup lang="ts">
import type { PublicHouseSearchPreset } from '@/domain/home-content'
import { computed, ref, watch } from 'vue'
import { listPublicHouses } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const emit = defineEmits<{
  change: [preset: PublicHouseSearchPreset]
  keyword: [preset: PublicHouseSearchPreset]
  search: [preset: PublicHouseSearchPreset]
  nearby: [preset: PublicHouseSearchPreset]
  map: [preset: PublicHouseSearchPreset]
}>()

const regionStore = usePublicHouseRegionStore()
const listingType = ref('整租')
const bedroomChoice = ref('')
const houseCount = ref<number | null>(null)
const countLoading = ref(false)
let countVersion = 0

const categoryLabels = ['整租', '合租', '公寓', '短租']
const categoryValues: Record<string, NonNullable<PublicHouseSearchPreset['listing_type']>> = {
  整租: 'whole',
  合租: 'shared',
  公寓: 'apartment',
  短租: 'short_term',
}
const segmentedStyle = [
  '--wot-segmented-bg: #eef3f7',
  '--wot-segmented-padding: 0',
  '--wot-segmented-radius: 38rpx 38rpx 0 0',
  '--wot-segmented-item-padding: 25rpx 0',
  '--wot-segmented-item-font-size: 26rpx',
  '--wot-segmented-item-color: #3e5467',
  '--wot-segmented-item-bg-active: #fff',
  '--wot-segmented-item-color-active: #1575c9',
  '--wot-segmented-item-font-weight-active: 700',
].join('; ')

const preset = computed<PublicHouseSearchPreset>(() => ({
  listing_type: categoryValues[listingType.value],
  bedrooms: bedroomChoice.value && bedroomChoice.value !== '3+' ? Number(bedroomChoice.value) : undefined,
  bedrooms_min: bedroomChoice.value === '3+' ? 3 : undefined,
}))

watch(preset, value => emit('change', value), { immediate: true })

watch([preset, () => regionStore.scopeKey], async () => {
  const version = ++countVersion
  countLoading.value = true
  try {
    const result = await listPublicHouses({
      ...preset.value,
      province: regionStore.selection.province || undefined,
      city: regionStore.selection.city || undefined,
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
      <wd-segmented v-model:value="listingType" :options="categoryLabels" :custom-style="segmentedStyle" />
    </view>
    <view class="home-search-panel__body">
      <view class="home-search-panel__search-row">
        <button class="home-search-panel__keyword app-touchable" hover-class="app-touchable--pressed" @click="emit('keyword', preset)">
          <view class="i-carbon-search" />
          <text>小区 / 商圈 / 地铁站</text>
        </button>
        <view class="home-search-panel__divider" />
        <button class="home-search-panel__nearby app-touchable" hover-class="app-touchable--pressed" @click="emit('nearby', preset)">
          <view class="i-carbon-location-current" />
          <text>附近</text>
        </button>
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
        <button class="home-search-panel__submit app-touchable" hover-class="app-touchable--pressed" @click="emit('search', preset)">
          {{ countLoading || houseCount === null ? '查看房源' : `查看 ${houseCount} 套房源` }}
        </button>
        <button class="home-search-panel__map app-touchable" hover-class="app-touchable--pressed" @click="emit('map', preset)">
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

.home-search-panel__types {
  padding: 0 6rpx;
}

.home-search-panel__body {
  padding: 28rpx 26rpx 26rpx;
  border-radius: 0 38rpx 38rpx;
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
