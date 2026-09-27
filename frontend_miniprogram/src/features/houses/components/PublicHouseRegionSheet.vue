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
    <view class="region-sheet">
      <view v-if="!activeCity" class="region-search">
        <wd-search
          v-model="keyword"
          custom-style="padding: 0; --wot-search-input-height: 72rpx; --wot-search-input-radius: 20rpx;"
          variant="light"
          hide-cancel
          placeholder="搜索城市"
        />
      </view>

      <view class="current-scope">
        <view class="current-scope__content">
          <text class="current-scope__eyebrow">当前浏览范围</text>
          <view class="current-scope__value">
            <view class="i-carbon-location-filled" />
            <strong>{{ currentScopeLabel }}</strong>
          </view>
        </view>
        <button class="location-action" :disabled="locating" @click="locateCurrentCity">
          <view class="i-carbon-location-current location-action__icon" />
          <text>{{ locating ? '定位中…' : '定位城市' }}</text>
        </button>
      </view>

      <view v-if="regionStore.loading" class="region-state">
        <AppLoading text="正在加载已开通城市…" />
      </view>
      <view v-else-if="regionStore.error" class="region-state">
        <view class="i-carbon-warning-alt region-state__icon" />
        <strong>地区列表加载失败</strong>
        <text>你仍可继续浏览当前范围的房源</text>
        <button class="region-state__retry" @click="loadRegions(true)">
          重新加载
        </button>
      </view>

      <template v-else-if="activeCity">
        <button class="region-back" @click="backToCities">
          <view class="i-carbon-chevron-left" />
          <text>返回城市</text>
        </button>
        <view class="section-heading">
          <strong>选择区域</strong>
          <text>{{ activeCity.districts.length + 1 }} 个范围</text>
        </view>
        <view class="region-grid">
          <button
            class="region-chip"
            :class="{ 'region-chip--active': isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: '' }) }"
            @click="chooseCityWide"
          >
            <text>全城</text>
            <view v-if="isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: '' })" class="i-carbon-checkmark region-chip__check" />
          </button>
          <button
            v-for="item in activeCity.districts"
            :key="item.district"
            class="region-chip"
            :class="{ 'region-chip--active': isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: item.district }) }"
            @click="chooseDistrict(item.district)"
          >
            <text>{{ shortDistrictName(item.district) }}</text>
            <view v-if="isCurrentSelection({ province: browsingProvince, city: activeCity.city, district: item.district })" class="i-carbon-checkmark region-chip__check" />
          </button>
        </view>
      </template>

      <template v-else>
        <view class="section-heading city-heading">
          <strong>{{ keyword ? '搜索结果' : '全部城市' }}</strong>
          <text>{{ keyword ? `${filteredCityCount} 个匹配城市` : `${availableCityCount} 个城市` }}</text>
        </view>

        <view v-if="!keyword" class="quick-grid">
          <button class="region-chip region-chip--wide" :class="{ 'region-chip--active': !regionStore.selection.city }" @click="chooseNationwide">
            <view class="i-carbon-earth-filled region-chip__leading-icon" />
            <text>全国</text>
            <view v-if="!regionStore.selection.city" class="i-carbon-checkmark region-chip__check" />
          </button>
        </view>

        <view v-for="province in filteredRegions" :key="province.province" class="province-section">
          <view class="province-heading">
            <strong>{{ province.province }}</strong>
          </view>
          <view class="region-grid">
            <button
              v-for="city in province.cities"
              :key="city.city"
              class="region-chip"
              :class="{ 'region-chip--current': isCurrentCity(province.province, city.city) }"
              @click="openCity(province.province, city.city)"
            >
              <text>{{ shortCityName(city.city) }}</text>
              <view v-if="isCurrentCity(province.province, city.city)" class="region-chip__dot" />
            </button>
          </view>
        </view>

        <view v-if="keyword && !filteredRegions.length" class="region-state region-state--compact">
          <view class="i-carbon-search-locate region-state__icon" />
          <strong>没有找到相关城市</strong>
          <text>试试输入城市全称或省份名称</text>
        </view>
        <view v-else-if="regionStore.loaded && !regionStore.regions.length" class="region-state">
          <view class="i-carbon-map region-state__icon" />
          <strong>暂无已开通城市</strong>
          <text>公开房源发布后会自动出现在这里</text>
        </view>
      </template>
    </view>
  </AppBottomSheet>
</template>

<style scoped lang="scss">
.region-sheet {
  padding: 2rpx 0 28rpx;
}

.location-action,
.region-chip,
.region-back,
.region-state__retry {
  margin: 0;
  border: 0;
  box-sizing: border-box;
  line-height: 1.3;
}

.location-action::after,
.region-chip::after,
.region-back::after,
.region-state__retry::after {
  border: 0;
}

.region-search {
  display: block;
  margin-bottom: 18rpx;
}

.current-scope {
  display: flex;
  width: 100%;
  min-height: 112rpx;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 20rpx 22rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 22rpx;
  box-sizing: border-box;
  background: linear-gradient(135deg, var(--app-bg-brand-soft), var(--app-bg-card));
}

.current-scope__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 9rpx;
}

.current-scope__eyebrow {
  color: var(--app-text-muted);
  font-size: 20rpx;
}

.current-scope__value {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8rpx;
  color: var(--app-color-brand-active);
  font-size: 26rpx;
}

.current-scope__value strong {
  overflow: hidden;
  color: var(--app-text-primary);
  font-size: 27rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-action {
  display: inline-flex;
  height: 58rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 7rpx;
  padding: 0 18rpx;
  border: 1rpx solid var(--app-border-brand-soft);
  border-radius: 999rpx;
  color: var(--app-color-brand-active);
  font-size: 21rpx;
  font-weight: 700;
  background: var(--app-bg-card);
}

.location-action[disabled] {
  opacity: 0.58;
}

.location-action__icon {
  font-size: 24rpx;
}

.region-state {
  display: flex;
  min-height: 280rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12rpx;
  color: var(--app-text-muted);
  text-align: center;
}

.region-state--compact {
  min-height: 240rpx;
}

.region-state strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}

.region-state text {
  font-size: 22rpx;
}

.region-state__icon {
  color: var(--app-color-brand);
  font-size: 48rpx;
}

.region-state__retry {
  margin-top: 10rpx;
  padding: 14rpx 28rpx;
  border-radius: 22rpx;
  color: var(--app-color-brand);
  font-size: 23rpx;
  background: var(--app-bg-brand-soft);
}

.section-heading,
.province-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-heading {
  margin: 30rpx 2rpx 14rpx;
}

.city-heading {
  margin-top: 28rpx;
}

.section-heading strong {
  color: var(--app-text-primary);
  font-size: 27rpx;
}

.section-heading text {
  color: var(--app-text-muted);
  font-size: 20rpx;
}

.province-section {
  margin-top: 26rpx;
}

.province-heading {
  padding: 0 2rpx 12rpx;
}

.province-heading strong {
  color: var(--app-text-secondary);
  font-size: 22rpx;
  font-weight: 600;
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.region-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.region-chip {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 0 12rpx;
  overflow: hidden;
  border: 1rpx solid transparent;
  border-radius: 18rpx;
  color: var(--app-text-secondary);
  font-size: 23rpx;
  font-weight: 600;
  background: var(--app-bg-subtle);
}

.region-chip text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.region-chip:active {
  transform: scale(0.98);
  background: var(--app-bg-brand-soft);
}

.region-chip--wide {
  justify-content: flex-start;
  padding: 0 18rpx;
}

.region-chip--current {
  border-color: var(--app-border-brand-soft);
  color: var(--app-color-brand-active);
  background: var(--app-bg-card);
}

.region-chip--active {
  border-color: var(--app-color-brand);
  color: var(--app-text-on-brand);
  background: var(--app-color-brand);
}

.region-chip__leading-icon {
  flex: 0 0 auto;
  font-size: 24rpx;
}

.region-chip__check {
  position: absolute;
  top: 6rpx;
  right: 7rpx;
  font-size: 18rpx;
}

.region-chip__dot {
  position: absolute;
  top: 9rpx;
  right: 10rpx;
  width: 9rpx;
  height: 9rpx;
  border-radius: 50%;
  background: var(--app-color-brand);
}

.region-back {
  display: inline-flex;
  height: 58rpx;
  align-items: center;
  gap: 4rpx;
  margin-top: 18rpx;
  padding: 0 4rpx;
  color: var(--app-color-brand-active);
  font-size: 22rpx;
  font-weight: 600;
  background: transparent;
}
</style>
