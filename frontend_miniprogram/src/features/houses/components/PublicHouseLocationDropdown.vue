<script setup lang="ts">
import type { PublicHouseLocationMode, PublicMetroCityDetail } from '@/domain/public-house-metro'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { computed, ref, watch } from 'vue'
import AppLoading from '@/components/app/AppLoading.vue'
import { getPublicMetroCities, getPublicMetroCity } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const props = defineProps<{
  visible: boolean
  value: PublicHouseLocationFilterValue
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'apply': [value: PublicHouseLocationFilterValue]
}>()

const regionStore = usePublicHouseRegionStore()
const draftMode = ref<PublicHouseLocationMode>('region')
const draftDistrict = ref('')
const draftSubdistrict = ref('')
const draftStationNames = ref<string[]>([])
const activeLineName = ref('')
const metroCity = ref<PublicMetroCityDetail | null>(null)
const metroLoading = ref(false)
const metroError = ref('')

const activeCity = computed(() => regionStore.regions
  .find(province => province.province === regionStore.selection.province)
  ?.cities
  .find(city => city.city === regionStore.selection.city) || null)
const activeDistrict = computed(() => activeCity.value?.districts.find(item => item.district === draftDistrict.value) || null)
const activeLine = computed(() => metroCity.value?.lines.find(line => line.name === activeLineName.value) || metroCity.value?.lines[0] || null)

function shortRegionName(value: string) {
  return value.replace(/(自治县|自治州|[林新]区|地区|[盟省市县区])$/, '') || value
}

function stationCheckboxStyle(stationName: string) {
  const active = draftStationNames.value.includes(stationName)
  const stateStyle = active
    ? [
        'border-color: #cfe1ff',
        'background: #eef5ff',
        'color: #1677ff',
        'font-weight: 600',
        '--wot-checkbox-label-color: #1677ff',
      ]
    : [
        'border-color: transparent',
        'background: #ffffff',
        'color: #1f2937',
        'font-weight: 400',
        '--wot-checkbox-label-color: #1f2937',
      ]

  return [
    'width: 100%',
    'min-height: 72rpx',
    'margin: 0 0 6rpx',
    'padding: 0 14rpx 0 18rpx',
    'box-sizing: border-box',
    'border: 1rpx solid',
    'border-radius: 16rpx',
    '--wot-checkbox-label-font-size: 24rpx',
    '--wot-checkbox-label-line-height: 1.35',
    '--wot-checkbox-icon-size: 36rpx',
    '--wot-checkbox-color-checked: var(--location-filter-primary)',
    ...stateStyle,
  ].join('; ')
}

function resetDraftFromValue() {
  draftMode.value = props.value.mode
  draftDistrict.value = props.value.district
  draftSubdistrict.value = props.value.subdistrict || ''
  draftStationNames.value = [...props.value.stationNames]
  activeLineName.value = ''
}

async function loadMetroCity() {
  metroCity.value = null
  metroError.value = ''
  if (!regionStore.selection.city)
    return
  metroLoading.value = true
  try {
    const cities = await getPublicMetroCities()
    if (!cities.some(item => item.name === regionStore.selection.city)) {
      metroCity.value = {
        name: regionStore.selection.city,
        province: regionStore.selection.province,
        data_version: '',
        lines: [],
      }
      return
    }
    const result = await getPublicMetroCity(regionStore.selection.city)
    metroCity.value = result
    activeLineName.value = result.lines.find(line => line.stations.some(station => draftStationNames.value.includes(station.name)))?.name || result.lines[0]?.name || ''
    const activeStationNames = new Set(result.lines.flatMap(line => line.stations.map(station => station.name)))
    const nextSelection = draftStationNames.value.filter(name => activeStationNames.has(name))
    if (nextSelection.length !== draftStationNames.value.length) {
      draftStationNames.value = nextSelection
      uni.showToast({ title: '已移除失效地铁站', icon: 'none' })
    }
  }
  catch (cause) {
    metroError.value = cause instanceof Error ? cause.message : '地铁数据加载失败'
  }
  finally {
    metroLoading.value = false
  }
}

function setDraftMode(mode: PublicHouseLocationMode) {
  draftMode.value = mode
  if (mode === 'metro' && metroCity.value?.name !== regionStore.selection.city && !metroLoading.value)
    void loadMetroCity()
}

function selectDraftDistrict(district: string) {
  if (draftDistrict.value !== district)
    draftSubdistrict.value = ''
  draftDistrict.value = district
}

function selectDraftSubdistrict(subdistrict: string) {
  draftSubdistrict.value = subdistrict
}

function resetDraft() {
  if (draftMode.value === 'metro')
    draftStationNames.value = []
  else
    draftDistrict.value = ''
  draftSubdistrict.value = ''
}

function closeWithoutApply() {
  resetDraftFromValue()
  emit('update:visible', false)
}

function applyDraft() {
  if (draftMode.value === 'metro') {
    if (!regionStore.selection.city) {
      uni.showToast({ title: '请先从页面右上角选择城市', icon: 'none' })
      return
    }
  }
  emit('apply', {
    mode: draftMode.value,
    district: draftMode.value === 'region' ? draftDistrict.value : '',
    subdistrict: draftMode.value === 'region' ? draftSubdistrict.value : '',
    stationNames: draftMode.value === 'metro' ? [...draftStationNames.value] : [],
  })
  emit('update:visible', false)
}

watch(() => props.visible, (visible) => {
  if (!visible)
    return
  resetDraftFromValue()
  void regionStore.loadRegions()
  if (draftMode.value === 'metro')
    void loadMetroCity()
})

watch(() => regionStore.scopeKey, () => {
  metroCity.value = null
  resetDraftFromValue()
  if (props.visible && draftMode.value === 'metro')
    void loadMetroCity()
})
</script>

<template>
  <view v-if="visible" class="location-popover-host">
    <view class="location-popover__mask" @touchmove.stop.prevent @click="closeWithoutApply" />
    <view class="location-popover" @click.stop>
      <view class="location-popover__header">
        <strong>筛选</strong>
        <button class="location-popover__close" aria-label="关闭" @click="closeWithoutApply">
          <view class="i-carbon-close" />
        </button>
      </view>

      <view class="location-dropdown">
        <view v-if="regionStore.selection.city" class="location-dropdown__columns">
          <scroll-view class="location-dropdown__column location-dropdown__column--mode" scroll-y enhanced :show-scrollbar="false">
            <button class="location-dropdown__option location-dropdown__option--mode" :class="{ active: draftMode === 'region' }" @click="setDraftMode('region')">
              <text>区域</text>
            </button>
            <button class="location-dropdown__option location-dropdown__option--mode" :class="{ active: draftMode === 'metro' }" @click="setDraftMode('metro')">
              <text>地铁</text>
            </button>
          </scroll-view>

          <scroll-view class="location-dropdown__column location-dropdown__column--secondary" scroll-y enhanced :show-scrollbar="false">
            <template v-if="draftMode === 'region'">
              <button class="location-dropdown__option" :class="{ active: !draftDistrict }" @click="selectDraftDistrict('')">
                全区
              </button>
              <button
                v-for="item in activeCity?.districts || []"
                :key="item.district"
                class="location-dropdown__option"
                :class="{ active: draftDistrict === item.district }"
                @click="selectDraftDistrict(item.district)"
              >
                {{ shortRegionName(item.district) }}
              </button>
            </template>
            <template v-else>
              <button
                v-for="line in metroCity?.lines || []"
                :key="line.name"
                class="location-dropdown__option location-dropdown__line"
                :class="{ active: activeLine?.name === line.name }"
                @click="activeLineName = line.name"
              >
                <i class="location-dropdown__line-color" :style="{ backgroundColor: line.color || 'var(--location-filter-primary)' }" />
                <text>{{ line.name }}</text>
              </button>
            </template>
          </scroll-view>

          <scroll-view class="location-dropdown__column location-dropdown__column--content" scroll-y enhanced :show-scrollbar="false">
            <template v-if="draftMode === 'region'">
              <button class="location-dropdown__option" :class="{ active: !draftSubdistrict }" @click="selectDraftSubdistrict('')">
                {{ draftDistrict ? `${shortRegionName(draftDistrict)}全区` : '全区' }}
              </button>
              <button
                v-for="item in activeDistrict?.subdistricts || []"
                :key="item.subdistrict"
                class="location-dropdown__option"
                :class="{ active: draftSubdistrict === item.subdistrict }"
                @click="selectDraftSubdistrict(item.subdistrict)"
              >
                {{ item.subdistrict }}
              </button>
            </template>
            <view v-else-if="metroLoading" class="location-dropdown__state">
              <AppLoading text="正在加载地铁线路…" />
            </view>
            <view v-else-if="metroError" class="location-dropdown__state">
              <view class="i-carbon-warning-alt location-dropdown__state-icon" />
              <strong>地铁数据加载失败</strong>
              <button @click="loadMetroCity">
                重新加载
              </button>
            </view>
            <view v-else-if="!metroCity?.lines.length" class="location-dropdown__state">
              <view class="i-carbon-train location-dropdown__state-icon" />
              <strong>该城市暂未提供地铁筛选</strong>
              <text>仍可继续使用区域条件找房</text>
            </view>
            <view v-else class="location-dropdown__stations">
              <wd-checkbox-group v-model="draftStationNames" :max="5" placement="right" custom-class="location-dropdown__checkbox-group">
                <wd-checkbox
                  v-for="station in activeLine?.stations || []"
                  :key="station.name"
                  :name="station.name"
                  :custom-class="draftStationNames.includes(station.name) ? 'location-dropdown__checkbox location-dropdown__checkbox--active' : 'location-dropdown__checkbox'"
                  :custom-style="stationCheckboxStyle(station.name)"
                >
                  {{ station.name }}
                  <template #icon="{ isChecked }">
                    <view class="location-dropdown__station-check" :class="{ 'location-dropdown__station-check--active': isChecked }">
                      <view v-if="isChecked" class="i-carbon-checkmark location-dropdown__station-check-icon" />
                    </view>
                  </template>
                </wd-checkbox>
              </wd-checkbox-group>
            </view>
          </scroll-view>
        </view>

        <view v-else class="location-dropdown__empty-city">
          <view class="i-carbon-map location-dropdown__state-icon" />
          <strong>请先从页面右上角选择城市</strong>
          <text>全局地区确定后，才可按区域或地铁找房</text>
        </view>
      </view>

      <view class="location-popover__footer">
        <wd-button block variant="plain" custom-class="location-dropdown__reset" @click="resetDraft">
          重置
        </wd-button>
        <wd-button block custom-class="location-dropdown__apply" @click="applyDraft">
          查看房源
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.location-dropdown,
.location-popover__footer {
  --location-filter-primary: #1677ff;
  --location-filter-primary-active: #0f63d8;
  --location-filter-primary-soft: #eef5ff;
}

.location-popover-host {
  position: absolute;
  z-index: 2;
  top: 100%;
  left: 0;
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width, 680rpx);
}

.location-popover__mask {
  position: fixed;
  z-index: 1;
  inset: 0;
  background: rgb(15 23 42 / 24%);
  backdrop-filter: blur(3rpx);
}

.location-popover {
  position: relative;
  z-index: 2;
  display: grid;
  width: 100%;
  height: min(68vh, 820rpx);
  margin-top: 14rpx;
  overflow: hidden;
  border: 1rpx solid rgb(255 255 255 / 88%);
  border-radius: 28rpx;
  box-sizing: border-box;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: rgb(248 251 255 / 99%);
  box-shadow: 0 28rpx 72rpx rgb(26 79 145 / 22%);
  animation: location-popover-in 180ms ease-out;
}

.location-popover__header {
  display: flex;
  min-height: 78rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx 0 26rpx;
  box-sizing: border-box;
  background: rgb(255 255 255 / 96%);
}

.location-popover__header strong {
  color: var(--app-text-primary);
  font-size: 28rpx;
}

.location-popover__close {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--app-text-muted);
  font-size: 30rpx;
  line-height: 1;
  background: transparent;
}

.location-dropdown {
  min-height: 0;
  overflow: hidden;
}

.location-dropdown__option::after,
.location-dropdown__state button::after,
.location-popover__close::after {
  border: 0;
}

.location-dropdown__columns {
  display: grid;
  height: 100%;
  overflow: hidden;
  grid-template-columns: 2fr 3fr 5fr;
}

.location-dropdown__column {
  min-width: 0;
  height: 100%;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.location-dropdown__column::-webkit-scrollbar,
:deep(.location-dropdown__column .uni-scroll-view::-webkit-scrollbar) {
  display: none;
  width: 0;
  height: 0;
}

:deep(.location-dropdown__column .uni-scroll-view) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.location-dropdown__column--mode {
  padding: 12rpx 8rpx;
  box-sizing: border-box;
  background: var(--location-filter-primary-soft);
}

.location-dropdown__column--secondary {
  border-right: 1rpx solid var(--app-border-color);
  border-left: 1rpx solid var(--app-border-color);
  background: var(--app-bg-page);
}

.location-dropdown__column--content {
  background: var(--app-bg-card);
}

.location-dropdown__option {
  display: flex;
  width: 100%;
  min-height: 82rpx;
  margin: 0;
  padding: 18rpx 22rpx;
  align-items: center;
  gap: 10rpx;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  line-height: 1.35;
  text-align: left;
  background: transparent;
}

.location-dropdown__option--mode {
  min-height: 76rpx;
  justify-content: center;
  margin-bottom: 6rpx;
  padding: 12rpx 6rpx;
  border-radius: 16rpx;
  font-size: 23rpx;
}

.location-dropdown__option.active {
  color: var(--location-filter-primary);
  font-weight: 700;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 8rpx 22rpx rgb(15 23 42 / 6%);
}

.location-dropdown__line-color {
  width: 12rpx;
  height: 12rpx;
  flex: 0 0 auto;
  border-radius: 50%;
}

.location-dropdown__stations {
  padding: 12rpx 14rpx 22rpx;
}

:deep(.location-dropdown__checkbox-group) {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.location-dropdown__station-check {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #d7dee8;
  border-radius: 50%;
  box-sizing: border-box;
  color: #fff;
  background: #fff;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.location-dropdown__station-check--active {
  border-color: var(--location-filter-primary);
  background: var(--location-filter-primary);
  box-shadow: 0 4rpx 12rpx rgb(22 119 255 / 22%);
  transform: scale(1.04);
}

.location-dropdown__station-check-icon {
  font-size: 22rpx;
}

.location-dropdown__state,
.location-dropdown__empty-city {
  display: flex;
  min-height: 300rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
  padding: 32rpx;
  box-sizing: border-box;
  color: var(--app-text-muted);
  font-size: 22rpx;
  text-align: center;
}

.location-dropdown__state strong,
.location-dropdown__empty-city strong {
  color: var(--app-text-primary);
  font-size: 25rpx;
}

.location-dropdown__state-icon {
  color: var(--location-filter-primary);
  font-size: 48rpx;
}

.location-dropdown__state button {
  margin: 8rpx 0 0;
  padding: 14rpx 24rpx;
  border: 0;
  border-radius: 999rpx;
  color: var(--location-filter-primary);
  font-size: 22rpx;
  line-height: 1;
  background: var(--location-filter-primary-soft);
}

.location-popover__footer {
  display: grid;
  width: 100%;
  padding: 18rpx 22rpx 22rpx;
  box-sizing: border-box;
  grid-template-columns: 1fr 1.8fr;
  gap: 14rpx;
  background: rgb(255 255 255 / 97%);
}

:deep(.location-dropdown__reset),
:deep(.location-dropdown__apply) {
  border-radius: 20rpx;
}

:deep(.location-dropdown__reset) {
  --wot-button-primary-color: var(--location-filter-primary);
  --wot-button-primary-color-active: var(--location-filter-primary-active);
  --wot-button-primary-plain-border: var(--location-filter-primary);
  --wot-button-primary-plain-border-active: var(--location-filter-primary-active);
}

:deep(.location-dropdown__apply) {
  --wot-button-primary-bg: var(--location-filter-primary);
  --wot-button-primary-bg-active: var(--location-filter-primary-active);
}

@keyframes location-popover-in {
  from {
    opacity: 0;
    transform: translateY(-12rpx) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .location-popover {
    animation: none;
  }
}
</style>
