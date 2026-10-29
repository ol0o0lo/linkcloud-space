<script setup lang="ts">
import type { PublicHouseLocatedRegion, PublicHouseRegionCity, PublicHouseRegionProvince, PublicHouseRegionSelection } from '@/domain/public-house-region'
import { computed, ref, watch } from 'vue'
import AppBottomSheet from '@/components/app/AppBottomSheet.vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { getLocatedPublicHouseRegion } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'
import { getCurrentLocationGcj02, getLocationErrorMessage } from '@/utils/location'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'change': [value: PublicHouseRegionSelection]
}>()

const regionStore = usePublicHouseRegionStore()
const browsingProvince = ref('')
const browsingCity = ref('')
const locating = ref(false)
const keyword = ref('')

const activeCity = computed<PublicHouseRegionCity | null>(() => {
  const province = regionStore.regions.find(item => item.province === browsingProvince.value)
  return province?.cities.find(item => item.city === browsingCity.value) || null
})

const sheetTitle = computed(() => activeCity.value ? '选择区域' : '选择城市')
const sheetDescription = computed(() => activeCity.value
  ? `${activeCity.value.city} · 选择全城或具体区域`
  : '仅展示当前已开通公开房源的城市')

const currentScopeLabel = computed(() => {
  const { city, district } = regionStore.selection
  if (district)
    return `${city} · ${district}`
  if (city)
    return `${city} · 全城`
  return '全国'
})

const availableCityCount = computed(() => regionStore.regions.reduce((total, province) => total + province.cities.length, 0))

const filteredRegions = computed<PublicHouseRegionProvince[]>(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  if (!query)
    return regionStore.regions

  return regionStore.regions.reduce<PublicHouseRegionProvince[]>((result, province) => {
    const provinceMatches = province.province.toLocaleLowerCase().includes(query)
    const cities = provinceMatches
      ? province.cities
      : province.cities.filter(city => city.city.toLocaleLowerCase().includes(query))
    if (cities.length)
      result.push({ ...province, cities })
    return result
  }, [])
})

const filteredCityCount = computed(() => filteredRegions.value.reduce((total, province) => total + province.cities.length, 0))

function resetBrowsingRegion() {
  browsingProvince.value = ''
  browsingCity.value = ''
}

async function loadRegions(force = false) {
  try {
    const invalidated = await regionStore.loadRegions(force)
    if (invalidated)
      uni.showToast({ title: '原选择地区暂无公开房源，已切换到全国', icon: 'none' })
    resetBrowsingRegion()
  }
  catch {
    // 错误状态由 Store 提供给弹层重试。
  }
}

function openCity(province: string, city: string) {
  browsingProvince.value = province
  browsingCity.value = city
}

function backToCities() {
  resetBrowsingRegion()
  keyword.value = ''
}

function chooseRegion(selection: PublicHouseRegionSelection) {
  regionStore.selectRegion(selection)
  emit('change', { ...regionStore.selection })
  emit('update:visible', false)
}

function chooseNationwide() {
  chooseRegion({ province: '', city: '', district: '' })
}

function chooseCityWide() {
  if (!activeCity.value)
    return
  chooseRegion({ province: browsingProvince.value, city: activeCity.value.city, district: '' })
}

function chooseDistrict(district: string) {
  if (!activeCity.value)
    return
  chooseRegion({ province: browsingProvince.value, city: activeCity.value.city, district })
}

function isCurrentSelection(selection: PublicHouseRegionSelection) {
  return regionStore.selection.province === selection.province
    && regionStore.selection.city === selection.city
    && regionStore.selection.district === selection.district
}

function isCurrentCity(province: string, city: string) {
  return regionStore.selection.province === province && regionStore.selection.city === city
}

function shortCityName(city: string) {
  return city.replace(/(自治州|地区|盟|市)$/, '') || city
}

function shortDistrictName(district: string) {
  return district.replace(/(自治县|林区|新区|[县区市])$/, '') || district
}

async function locateCurrentCity() {
  if (locating.value)
    return
  locating.value = true
  try {
    try {
      await regionStore.loadRegions()
    }
    catch {
      uni.showToast({ title: '地区列表加载失败，请先手动选择或稍后重试', icon: 'none' })
      return
    }

    let location: Awaited<ReturnType<typeof getCurrentLocationGcj02>>
    try {
      location = await getCurrentLocationGcj02()
    }
    catch (error) {
      // #ifdef MP-WEIXIN
      const modal = await uni.showModal({ title: '需要位置权限', content: '开启定位后可自动切换到当前城市，也可以继续手动选择。', confirmText: '去设置' })
      if (modal.confirm)
        await uni.openSetting()
      // #endif
      // #ifndef MP-WEIXIN
      uni.showToast({ title: getLocationErrorMessage(error), icon: 'none' })
      // #endif
      return
    }

    let located: PublicHouseLocatedRegion
    try {
      located = await getLocatedPublicHouseRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        coordinate_system: 'gcj02',
      })
    }
    catch {
      uni.showToast({ title: '定位服务暂不可用，请手动选择城市', icon: 'none' })
      return
    }
    const selection = regionStore.findLocatedRegion(located)
    if (!selection) {
      uni.showToast({ title: '当前城市暂未开通公开房源', icon: 'none' })
      return
    }
    chooseRegion(selection)
  }
  finally {
    locating.value = false
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    keyword.value = ''
    void loadRegions()
  }
})
</script>

<template>
  <AppBottomSheet
    :visible="visible"
    :title="sheetTitle"
    :description="sheetDescription"
    height="tall"
    show-handle
    :z-index="1250"
    @update:visible="emit('update:visible', $event)"
  >
    <view class="region-sheet px-0 pb-3.5 pt-0.5">
      <view v-if="!activeCity" class="region-search mb-2.5 block">
        <wd-search
          v-model="keyword"
          custom-style="padding: 0; --wot-search-input-height: 72rpx; --wot-search-input-radius: 20rpx;"
          variant="light"
          hide-cancel
          placeholder="搜索城市"
        />
      </view>

      <view class="current-scope box-border min-h-14 w-full flex items-center justify-between gap-2.5 border-hairline border-app-border-brand-soft rounded-3 border-solid px-3 py-2.5">
        <view class="current-scope__content min-w-0 flex gap-1">
          <text class="current-scope__eyebrow text-size-2xs text-content-muted">当前浏览范围</text>
          <view class="current-scope__value min-w-0 flex items-center gap-1 text-size-xs text-app-brand-active">
            <view class="i-carbon-location-filled" />
            <strong>{{ currentScopeLabel }}</strong>
          </view>
        </view>
        <button class="location-action h-7.5 inline-flex flex-none items-center justify-center gap-1 border-hairline border-app-border-brand-soft rounded-full border-solid bg-surface-card px-2.5 py-0 text-size-2xs text-app-brand-active font-bold" :disabled="locating" @click="locateCurrentCity">
          <view class="i-carbon-location-current location-action__icon text-size-xs" />
          <text>{{ locating ? '定位中…' : '定位城市' }}</text>
        </button>
      </view>

      <view v-if="regionStore.loading" class="region-state flex flex-col items-center justify-center gap-1.5 text-center text-content-muted">
        <AppLoading text="正在加载已开通城市…" />
      </view>
      <view v-else-if="regionStore.error" class="region-state flex flex-col items-center justify-center gap-1.5 text-center text-content-muted">
        <view class="i-carbon-warning-alt region-state__icon text-size-2xl text-app-brand" />
        <strong>地区列表加载失败</strong>
        <text>你仍可继续浏览当前范围的房源</text>
        <button class="region-state__retry mt-1.5 rounded-3 bg-surface-brand-soft px-3.5 py-2 text-size-xs text-app-brand" @click="loadRegions(true)">
          重新加载
        </button>
      </view>

      <template v-else-if="activeCity">
        <button class="region-back mt-2.5 h-7.5 inline-flex items-center gap-0.5 bg-transparent px-0.5 py-0 text-size-2xs text-app-brand-active font-semibold" @click="backToCities">
          <view class="i-carbon-chevron-left" />
          <text>返回城市</text>
        </button>
        <view class="section-heading">
          <strong>选择区域</strong>
          <text>{{ activeCity.districts.length + 1 }} 个范围</text>
        </view>
        <view class="region-grid grid grid-cols-3 gap-1.5">
          <button
            class="region-chip relative h-9.5 min-w-0 w-full flex items-center gap-1 overflow-hidden border-hairline border-transparent rounded-2.5 border-solid bg-surface-subtle text-size-xs text-content-secondary font-semibold"
            :class="{ 'region-chip--active': isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: '' }) }"
            @click="chooseCityWide"
          >
            <text>全城</text>
            <view v-if="isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: '' })" class="i-carbon-checkmark region-chip__check absolute right-1 top-1 text-size-3xs" />
          </button>
          <button
            v-for="item in activeCity.districts"
            :key="item.district"
            class="region-chip relative h-9.5 min-w-0 w-full flex items-center gap-1 overflow-hidden border-hairline border-transparent rounded-2.5 border-solid bg-surface-subtle text-size-xs text-content-secondary font-semibold"
            :class="{ 'region-chip--active': isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: item.district }) }"
            @click="chooseDistrict(item.district)"
          >
            <text>{{ shortDistrictName(item.district) }}</text>
            <view v-if="isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: item.district })" class="i-carbon-checkmark region-chip__check absolute right-1 top-1 text-size-3xs" />
          </button>
        </view>
      </template>

      <template v-else>
        <view class="section-heading city-heading">
          <strong>{{ keyword ? '搜索结果' : '全部城市' }}</strong>
          <text>{{ keyword ? `${filteredCityCount} 个匹配城市` : `${availableCityCount} 个城市` }}</text>
        </view>

        <view v-if="!keyword" class="quick-grid grid grid-cols-3 gap-1.5">
          <button class="region-chip region-chip--wide relative h-9.5 min-w-0 w-full flex items-center gap-1 overflow-hidden border-hairline border-transparent rounded-2.5 border-solid bg-surface-subtle text-size-xs text-content-secondary font-semibold" :class="{ 'region-chip--active': !regionStore.selection.city }" @click="chooseNationwide">
            <view class="i-carbon-earth-filled region-chip__leading-icon flex-none text-size-xs" />
            <text>全国</text>
            <view v-if="!regionStore.selection.city" class="i-carbon-checkmark region-chip__check absolute right-1 top-1 text-size-3xs" />
          </button>
        </view>

        <view v-for="province in filteredRegions" :key="province.province" class="province-section mt-3.5">
          <view class="province-heading px-0.5 pb-1.5 pt-0">
            <strong>{{ province.province }}</strong>
          </view>
          <view class="region-grid grid grid-cols-3 gap-1.5">
            <button
              v-for="city in province.cities"
              :key="city.city"
              class="region-chip relative h-9.5 min-w-0 w-full flex items-center gap-1 overflow-hidden border-hairline border-transparent rounded-2.5 border-solid bg-surface-subtle text-size-xs text-content-secondary font-semibold"
              :class="{ 'region-chip--current': isCurrentCity(province.province, city.city) }"
              @click="openCity(province.province, city.city)"
            >
              <text>{{ shortCityName(city.city) }}</text>
              <view v-if="isCurrentCity(province.province, city.city)" class="region-chip__dot absolute right-1.5 top-1 h-1 w-1 rounded-full bg-app-brand" />
            </button>
          </view>
        </view>

        <view v-if="keyword && !filteredRegions.length" class="region-state region-state--compact flex flex-col items-center justify-center gap-1.5 text-center text-content-muted">
          <view class="i-carbon-search-locate region-state__icon text-size-2xl text-app-brand" />
          <strong>没有找到相关城市</strong>
          <text>试试输入城市全称或省份名称</text>
        </view>
        <view v-else-if="regionStore.loaded && !regionStore.regions.length" class="region-state flex flex-col items-center justify-center gap-1.5 text-center text-content-muted">
          <view class="i-carbon-map region-state__icon text-size-2xl text-app-brand" />
          <strong>暂无已开通城市</strong>
          <text>公开房源发布后会自动出现在这里</text>
        </view>
      </template>
    </view>
  </AppBottomSheet>
</template>

<style scoped lang="scss">
.location-action,
.region-chip,
.region-back,
.region-state__retry {
  @apply m-0;
  @apply border-0;
  @apply box-border;
  @apply leading-tight;
}

.location-action::after,
.region-chip::after,
.region-back::after,
.region-state__retry::after {
  @apply border-0;
}

.current-scope {
  background: linear-gradient(135deg, var(--app-bg-brand-soft), var(--app-bg-card));
}

.current-scope__content {
  @apply flex-1;
  @apply flex-col;
}

.current-scope__value strong {
  @apply overflow-hidden;
  @apply text-content-primary;
  @apply text-size-sm;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}

.location-action[disabled] {
  @apply opacity-60;
}

.region-state {
  @apply min-h-35;
}

.region-state--compact {
  @apply min-h-30;
}

.region-state strong {
  @apply text-content-primary;
  @apply text-size-sm;
}

.region-state text {
  @apply text-size-2xs;
}

.section-heading,
.province-heading {
  @apply flex;
  @apply items-center;
  @apply justify-between;
}

.section-heading {
  @apply mt-4 mx-0.5 mb-2;
}

.city-heading {
  @apply mt-3.5;
}

.section-heading strong {
  @apply text-content-primary;
  @apply text-size-sm;
}

.section-heading text {
  @apply text-content-muted;
  @apply text-size-2xs;
}

.province-heading strong {
  @apply text-content-secondary;
  @apply text-size-2xs;
  @apply font-semibold;
}

.region-chip {
  @apply justify-center;
  @apply py-0 px-1.5;
}

.region-chip text {
  @apply overflow-hidden;
  @apply text-ellipsis;
  @apply whitespace-nowrap;
}

.region-chip:active {
  transform: scale(0.98);
  @apply bg-surface-brand-soft;
}

.region-chip--wide {
  @apply justify-start;
  @apply py-0 px-2.5;
}

.region-chip--current {
  @apply border-app-border-brand-soft;
  @apply text-app-brand-active;
  @apply bg-surface-card;
}

.region-chip--active {
  @apply border-app-brand;
  @apply text-content-on-brand;
  @apply bg-app-brand;
}
</style>
