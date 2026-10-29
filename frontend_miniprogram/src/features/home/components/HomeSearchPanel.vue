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
  '--wot-segmented-outline-item-color-active: var(--app-color-brand)',
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
  <view class="home-search-panel relative z-2 overflow-hidden border-hairline border-hex-e4edf4 rounded-5 border-solid bg-hex-eef3f7">
    <view class="home-search-panel__types">
      <wd-segmented v-model:value="listingType" :options="categoryLabels" theme="outline" :custom-style="segmentedStyle" />
    </view>
    <view class="home-search-panel__body bg-hex-fff px-3.5 pb-3.5 pt-3.5">
      <view class="home-search-panel__search-row min-h-10 flex items-center border-b-hairline border-b-hex-e7edf2 border-b-solid">
        <button class="home-search-panel__keyword flex-1 app-touchable text-left text-hex-9aaab8" :class="{ 'home-search-panel__keyword--located': nearbyActive }" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('keyword', preset)">
          <view :class="nearbyActive ? 'i-carbon-location' : 'i-carbon-search'" />
          <text>{{ nearbyActive ? preset.place_name || '当前位置' : '小区 / 商圈 / 地铁站' }}</text>
        </button>
        <button v-if="nearbyActive" class="home-search-panel__clear m-0 h-8 w-7 flex flex-none app-touchable items-center justify-center bg-transparent p-0 text-size-xs text-hex-7b8d9d" :disabled="locatingNearby" aria-label="清除附近筛选" hover-class="app-touchable--pressed" @click="emit('clearNearby')">
          <view class="i-carbon-close" />
        </button>
        <view class="home-search-panel__divider mx-2.5 my-0 h-4.5 w-0.5 bg-hex-e1e9ef" />
        <button class="home-search-panel__nearby flex-none app-touchable font-bold" :class="{ 'home-search-panel__nearby--active': nearbyActive }" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('nearby', preset)">
          <view class="i-carbon-location-current" />
          <text>{{ locatingNearby ? '定位中…' : nearbyActive ? '重新定位' : '附近' }}</text>
        </button>
      </view>

      <view v-if="nearbyActive" class="home-search-panel__location-hint pt-2 text-size-2xs text-hex-657d90">
        附近 1 公里 · 按距离排序
      </view>

      <view class="home-search-panel__bedrooms px-0 py-3.5">
        <wd-radio-group v-model="bedroomChoice" direction="horizontal">
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

      <view class="home-search-panel__actions flex gap-2">
        <button class="home-search-panel__submit app-touchable bg-app-brand text-hex-fff" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('search', preset)">
          {{ locatingNearby ? '正在定位…' : countLoading || houseCount === null ? '查看房源' : `查看 ${houseCount} 套${nearbyActive ? '附近' : ''}房源` }}
        </button>
        <button class="home-search-panel__map flex-1 app-touchable bg-surface-brand-soft text-app-brand" :disabled="locatingNearby" hover-class="app-touchable--pressed" @click="emit('map', preset)">
          <view class="i-carbon-map" />
          <text>地图找房</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
button::after {
  @apply border-0;
}

.home-search-panel {
  box-shadow: 0 24rpx 48rpx rgb(12 55 92 / 13%);
}

.home-search-panel__keyword,
.home-search-panel__nearby {
  @apply flex;
  @apply min-w-0;
  @apply items-center;
  @apply gap-1.5;
  @apply m-0;
  @apply p-0;
  @apply bg-transparent;
  @apply text-hex-314a5e;
  @apply text-size-xs;
  @apply leading-tight;
}

.home-search-panel__keyword text {
  @apply min-w-0;
  @apply overflow-hidden;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}

.home-search-panel__keyword--located,
.home-search-panel__nearby--active {
  @apply text-app-brand;
}

.home-search-panel__keyword view,
.home-search-panel__nearby view {
  @apply flex-none;
  @apply text-size-sm;
}

:deep(.home-search-panel__bedrooms .wd-radio-group) {
  @apply flex;
  @apply w-full;
  @apply justify-between;
}

:deep(.home-search-panel__bedrooms .wd-radio) {
  @apply mr-0;
  @apply text-size-2xs;
}

.home-search-panel__submit,
.home-search-panel__map {
  @apply flex;
  @apply min-w-0;
  @apply h-10.5;
  @apply items-center;
  @apply justify-center;
  @apply gap-1;
  @apply m-0;
  @apply rounded-2.5;
  @apply text-size-xs;
  @apply font-bold;
  @apply leading-10.5;
}

.home-search-panel__submit {
  flex: 1.55;
}

.home-search-panel__map view {
  @apply text-size-sm;
}
</style>
