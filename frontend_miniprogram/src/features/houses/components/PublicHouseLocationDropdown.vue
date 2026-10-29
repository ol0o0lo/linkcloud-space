<script setup lang="ts">
import type { PublicHouseLocationMode, PublicHouseRadiusM, PublicMetroCityDetail } from '@/domain/public-house-metro'
import type { AppliedCommute, CommuteDraft } from '@/features/houses/commute'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { computed, ref, watch } from 'vue'
import AppLoading from '@/components/app/AppLoading.vue'
import CommutePicker from '@/features/houses/commute/CommutePicker.vue'
import { formatPublicHouseRadiusLabel, PUBLIC_HOUSE_RADIUS_OPTIONS } from '@/domain/public-house-metro'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { getPublicMetroCities, getPublicMetroCity } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const props = withDefaults(defineProps<{
  visible: boolean
  value: PublicHouseLocationFilterValue
  commute?: AppliedCommute | null
  preferredMode?: 'commute' | null
  showNearby?: boolean
  nearbyRadiusM?: PublicHouseRadiusM
  nearbyActive?: boolean
  locatingNearby?: boolean
}>(), { commute: null })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'apply': [value: PublicHouseLocationFilterValue]
  'apply-commute': [value: CommuteDraft]
  'clear-commute': []
  'apply-nearby': [radiusM: PublicHouseRadiusM]
  'clear-nearby': []
}>()

const regionStore = usePublicHouseRegionStore()
const workPlacePreference = useWorkPlacePreferenceStore()
const draftMode = ref<PublicHouseLocationMode | 'commute' | 'nearby'>('region')
const draftNearbyRadiusM = ref<PublicHouseRadiusM>(props.nearbyRadiusM || 1000)
const draftCommute = ref<CommuteDraft>({ place: null, mode: 'metro', maxMinutes: 45 })
const commutePickerRevision = ref(0)
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

const headerContent = computed(() => {
  if (draftMode.value === 'nearby')
    return { icon: 'i-carbon-location-current', title: '附近' }
  if (draftMode.value === 'region')
    return { icon: 'i-carbon-map', title: '区域' }
  if (draftMode.value === 'metro')
    return { icon: 'i-carbon-train', title: '地铁' }
  return { icon: 'i-carbon-location-star', title: '通勤' }
})

function stationCheckboxStyle(stationName: string) {
  const active = draftStationNames.value.includes(stationName)
  const stateStyle = active
    ? [
        'background: #eef5ff',
        'color: #1677ff',
        'font-weight: 600',
        '--wot-checkbox-label-color: #1677ff',
      ]
    : [
        'background: #ffffff',
        'color: #17233d',
        'font-weight: 400',
        '--wot-checkbox-label-color: #17233d',
      ]

  return [
    'width: 100%',
    'min-height: 88rpx',
    'padding: 0 16rpx',
    'box-sizing: border-box',
    'border-bottom: 1rpx solid #e7edf5',
    '--wot-checkbox-label-font-size: 25rpx',
    '--wot-checkbox-label-line-height: 1.35',
    '--wot-checkbox-icon-size: 38rpx',
    '--wot-checkbox-color-checked: var(--location-filter-primary)',
    ...stateStyle,
  ].join('; ')
}

function resetDraftFromValue() {
  commutePickerRevision.value += 1
  const fallbackMode = props.commute || !regionStore.selection.city ? 'commute' : props.value.mode
  draftMode.value = props.preferredMode || (props.showNearby && (props.nearbyActive || !regionStore.selection.city) ? 'nearby' : fallbackMode)
  draftNearbyRadiusM.value = props.nearbyRadiusM || 1000
  draftCommute.value = props.commute
    ? { place: props.commute.place, mode: props.commute.mode, maxMinutes: props.commute.maxMinutes }
    : { place: workPlacePreference.preference?.place || null, mode: workPlacePreference.preference?.mode || 'metro', maxMinutes: 45 }
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

function setDraftMode(mode: PublicHouseLocationMode | 'commute' | 'nearby') {
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
  if (draftMode.value === 'nearby') {
    emit('clear-nearby')
    emit('update:visible', false)
    return
  }
  if (draftMode.value === 'commute') {
    draftCommute.value = { place: null, mode: 'metro', maxMinutes: 45 }
    commutePickerRevision.value += 1
    if (props.commute) {
      emit('clear-commute')
      emit('update:visible', false)
    }
    return
  }
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
  if (draftMode.value === 'nearby') {
    emit('apply-nearby', draftNearbyRadiusM.value)
    return
  }
  if (draftMode.value === 'commute') {
    if (!draftCommute.value.place) {
      uni.showToast({ title: '请先选择通勤目的地', icon: 'none' })
      return
    }
    emit('apply-commute', { ...draftCommute.value, place: draftCommute.value.place })
    emit('update:visible', false)
    return
  }
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
  <view v-if="visible" class="location-popover-host absolute left-0 top-full z-2">
    <view class="location-popover__mask fixed inset-0 z-1 bg-hex-0f172a/28 backdrop-blur-1.5" @touchmove.stop.prevent @wheel.stop.prevent @click="closeWithoutApply" />
    <view class="location-popover" :class="{ 'location-popover--nearby': draftMode === 'nearby' }" @click.stop>
      <view class="location-popover__header box-border min-h-11 flex items-center gap-2 bg-hex-fff pb-1.5 pl-3.5 pr-2.5 pt-1.5">
        <view class="location-popover__header-icon flex-none text-size-sm text-$location-filter-primary" :class="headerContent.icon" />
        <view class="location-popover__heading min-w-0 flex flex-1 items-center">
          <strong>{{ headerContent.title }}</strong>
        </view>
        <button class="location-popover__close m-0 h-7 w-7 flex items-center justify-center border-0 rounded-full bg-surface-page p-0 text-size-sm text-content-muted leading-none" aria-label="关闭" @click="closeWithoutApply">
          <view class="i-carbon-close" />
        </button>
      </view>

      <view class="location-dropdown min-h-0 flex flex-col overflow-hidden">
        <template v-if="regionStore.selection.city || draftMode === 'commute' || draftMode === 'nearby'">
          <view class="location-dropdown__columns grid min-h-0 flex-1 overflow-hidden border-t-hairline border-t-app-divider border-t-solid" :class="{ 'location-dropdown__columns--wide': draftMode === 'commute' || draftMode === 'nearby' }">
            <view class="location-dropdown__column location-dropdown__column--mode">
              <button v-if="showNearby" class="location-dropdown__mode m-0 min-h-11 w-full flex items-center justify-center rounded-0 bg-transparent px-0.5 py-0 text-size-xs text-content-secondary font-medium leading-none" :class="{ active: draftMode === 'nearby' }" @click="setDraftMode('nearby')">
                附近
              </button>
              <button v-if="regionStore.selection.city" class="location-dropdown__mode m-0 min-h-11 w-full flex items-center justify-center rounded-0 bg-transparent px-0.5 py-0 text-size-xs text-content-secondary font-medium leading-none" :class="{ active: draftMode === 'region' }" @click="setDraftMode('region')">
                区域
              </button>
              <button v-if="regionStore.selection.city" class="location-dropdown__mode m-0 min-h-11 w-full flex items-center justify-center rounded-0 bg-transparent px-0.5 py-0 text-size-xs text-content-secondary font-medium leading-none" :class="{ active: draftMode === 'metro' }" @click="setDraftMode('metro')">
                地铁
              </button>
              <button class="location-dropdown__mode m-0 min-h-11 w-full flex items-center justify-center rounded-0 bg-transparent px-0.5 py-0 text-size-xs text-content-secondary font-medium leading-none" :class="{ active: draftMode === 'commute' }" @click="setDraftMode('commute')">
                通勤
              </button>
            </view>

            <scroll-view v-if="draftMode === 'region' || draftMode === 'metro'" class="location-dropdown__column location-dropdown__column--secondary" scroll-y enhanced :show-scrollbar="false">
              <template v-if="draftMode === 'region'">
                <button class="location-dropdown__option location-dropdown__option--secondary m-0 box-border min-h-11 w-full flex items-center rounded-0 bg-transparent text-left leading-snug" :class="{ active: !draftDistrict }" @click="selectDraftDistrict('')">
                  全区
                </button>
                <button
                  v-for="item in activeCity?.districts || []"
                  :key="item.district"
                  class="location-dropdown__option location-dropdown__option--secondary m-0 box-border min-h-11 w-full flex items-center rounded-0 bg-transparent text-left leading-snug"
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
                  class="location-dropdown__option location-dropdown__option--secondary location-dropdown__line m-0 box-border min-h-11 w-full flex items-center rounded-0 bg-transparent text-left leading-snug"
                  :class="{ active: activeLine?.name === line.name }"
                  @click="activeLineName = line.name"
                >
                  <i class="location-dropdown__line-color h-1.5 w-1.5 flex-none rounded-full" :style="{ backgroundColor: line.color || 'var(--location-filter-primary)' }" />
                  <text>{{ line.name }}</text>
                </button>
              </template>
            </scroll-view>

            <scroll-view v-if="draftMode === 'region' || draftMode === 'metro'" class="location-dropdown__column location-dropdown__column--content" scroll-y enhanced :show-scrollbar="false">
              <template v-if="draftMode === 'region'">
                <button class="location-dropdown__option location-dropdown__option--place m-0 box-border min-h-11 w-full flex items-center rounded-0 bg-transparent text-left leading-snug" :class="{ active: !draftSubdistrict }" @click="selectDraftSubdistrict('')">
                  <text>{{ draftDistrict ? `${shortRegionName(draftDistrict)}全区` : '全区' }}</text>
                  <view v-if="!draftSubdistrict" class="i-carbon-checkmark" />
                </button>
                <button
                  v-for="item in activeDistrict?.subdistricts || []"
                  :key="item.subdistrict"
                  class="location-dropdown__option location-dropdown__option--place m-0 box-border min-h-11 w-full flex items-center rounded-0 bg-transparent text-left leading-snug"
                  :class="{ active: draftSubdistrict === item.subdistrict }"
                  @click="selectDraftSubdistrict(item.subdistrict)"
                >
                  <text>{{ item.subdistrict }}</text>
                  <view v-if="draftSubdistrict === item.subdistrict" class="i-carbon-checkmark" />
                </button>
              </template>
              <view v-else-if="metroLoading" class="location-dropdown__state">
                <AppLoading text="正在加载地铁线路…" />
              </view>
              <view v-else-if="metroError" class="location-dropdown__state">
                <view class="i-carbon-warning-alt location-dropdown__state-icon text-size-2xl text-$location-filter-primary" />
                <strong>地铁数据加载失败</strong>
                <button @click="loadMetroCity">
                  重新加载
                </button>
              </view>
              <view v-else-if="!metroCity?.lines.length" class="location-dropdown__state">
                <view class="i-carbon-train location-dropdown__state-icon text-size-2xl text-$location-filter-primary" />
                <strong>该城市暂未提供地铁筛选</strong>
                <text>仍可继续使用区域条件找房</text>
              </view>
              <view v-else class="location-dropdown__stations pb-2.5">
                <wd-checkbox-group v-model="draftStationNames" :max="5" placement="right" custom-class="location-dropdown__checkbox-group">
                  <wd-checkbox
                    v-for="station in activeLine?.stations || []"
                    :key="station.name"
                    :name="station.name"
                    custom-class="location-dropdown__checkbox"
                    :custom-style="stationCheckboxStyle(station.name)"
                  >
                    {{ station.name }}
                    <template #icon="{ isChecked }">
                      <view class="location-dropdown__station-check box-border h-4.5 w-4.5 flex items-center justify-center border-1 border-hex-cbd5e3 rounded-full border-solid bg-hex-fff text-hex-fff" :class="{ 'location-dropdown__station-check--active': isChecked }">
                        <view v-if="isChecked" class="i-carbon-checkmark location-dropdown__station-check-icon text-size-2xs" />
                      </view>
                    </template>
                  </wd-checkbox>
                </wd-checkbox-group>
              </view>
            </scroll-view>
            <scroll-view v-else-if="draftMode === 'commute'" class="location-dropdown__column location-dropdown__column--commute" scroll-y enhanced :show-scrollbar="false">
              <CommutePicker :key="commutePickerRevision" v-model="draftCommute" compact />
            </scroll-view>
            <view v-else class="location-dropdown__column location-dropdown__column--nearby">
              <strong>距离范围</strong>
              <wd-radio-group v-model="draftNearbyRadiusM" type="button" direction="horizontal" custom-class="location-dropdown__nearby-options">
                <wd-radio v-for="radius in PUBLIC_HOUSE_RADIUS_OPTIONS" :key="radius" :value="radius">
                  {{ formatPublicHouseRadiusLabel(radius) }}
                </wd-radio>
              </wd-radio-group>
            </view>
          </view>
        </template>

        <view v-else class="location-dropdown__empty-city">
          <view class="i-carbon-map location-dropdown__state-icon text-size-2xl text-$location-filter-primary" />
          <strong>请先从页面右上角选择城市</strong>
          <text>{{ showNearby ? '选择城市后可按区域或地铁找房，也可直接使用附近或通勤筛选' : '选择城市后可按区域或地铁找房，也可直接使用通勤筛选' }}</text>
          <button v-if="showNearby" class="location-dropdown__commute-entry mt-2.5 text-size-xs text-app-brand" @click="setDraftMode('nearby')">
            附近找房
          </button>
          <button class="location-dropdown__commute-entry mt-2.5 text-size-xs text-app-brand" @click="setDraftMode('commute')">
            使用通勤筛选
          </button>
        </view>
      </view>

      <view class="location-popover__footer grid box-border w-full gap-1.5 border-t-hairline border-t-app-divider border-t-solid bg-hex-fff px-3 pb-3 pt-2.5">
        <wd-button block variant="plain" custom-class="location-dropdown__reset" @click="resetDraft">
          {{ draftMode === 'nearby' ? '不限附近' : draftMode === 'commute' ? '清空通勤' : '清空选择' }}
        </wd-button>
        <wd-button block custom-class="location-dropdown__apply" :loading="draftMode === 'nearby' && locatingNearby" @click="applyDraft">
          {{ draftMode === 'nearby' && locatingNearby ? '定位中…' : '查看房源' }}
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.location-popover {
  --location-filter-primary: #1677ff;
  --location-filter-primary-active: #0f63d8;
  --location-filter-primary-soft: #eef5ff;
}

.location-popover-host {
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width, 680rpx);
}

.location-popover-host::before {
  @apply absolute;
  @apply z-3;
  @apply top-1;
  left: var(--filter-pointer-x, 50%);
  @apply w-2.5;
  @apply h-2.5;
  @apply -ml-1;
  @apply border-t-hairline border-t-solid border-t-hex-ffffff/80;
  @apply border-l-hairline border-l-solid border-l-hex-ffffff/80;
  @apply bg-hex-fff;
  content: '';
  transform: rotate(45deg);
}

.location-popover {
  @apply relative;
  @apply z-2;
  @apply grid;
  @apply w-full;
  height: min(68vh, 760rpx);
  @apply mt-2;
  @apply overflow-hidden;
  @apply border-hairline border-solid border-hex-ffffff/80;
  @apply rounded-3.5;
  @apply box-border;
  grid-template-rows: auto minmax(0, 1fr) auto;
  @apply bg-hex-fff;
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
}

.location-popover--nearby {
  @apply h-auto;
  grid-template-rows: auto auto auto;
}

.location-popover__heading strong {
  @apply text-content-primary;
  @apply text-size-sm;
  @apply leading-tight;
}

.location-dropdown__option::after,
.location-dropdown__mode::after,
.location-dropdown__state button::after,
.location-popover__close::after {
  @apply border-0;
}

.location-dropdown__mode {
  @apply border-0;
  @apply border-b-hairline border-b-solid border-b-app-divider;
}

.location-dropdown__mode.active {
  @apply text-$location-filter-primary;
  @apply font-semibold;
  @apply bg-$location-filter-primary-soft;
}

.location-dropdown__columns {
  grid-template-columns: 19% 32% 49%;
}

.location-dropdown__columns--wide {
  grid-template-columns: 19% 81%;
}

.location-dropdown__column--commute {
  @apply bg-hex-fff;
}

.location-dropdown__column--nearby {
  @apply py-3.5 px-2.5;
  @apply box-border;
  @apply bg-hex-fff;
}

.location-dropdown__column--nearby strong {
  @apply text-content-primary;
  @apply text-size-xs;
}

:deep(.location-dropdown__nearby-options) {
  @apply grid;
  @apply mt-3;
  @apply grid-cols-2;
  @apply gap-1.5;
  --wot-radio-button-margin: 0;
  --wot-radio-button-min-width: 0;
  --wot-radio-checked-color: var(--location-filter-primary);
  --wot-radio-button-bg: #f5f8fc;
  --wot-radio-button-checked-bg: var(--location-filter-primary-soft);
  --wot-radio-button-border-radius: 18rpx;
}

.location-dropdown__column {
  @apply min-w-0;
  @apply h-full;
  @apply overflow-hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.location-dropdown__column::-webkit-scrollbar,
:deep(.location-dropdown__column .uni-scroll-view::-webkit-scrollbar) {
  @apply hidden;
  @apply w-0;
  @apply h-0;
}

:deep(.location-dropdown__column .uni-scroll-view) {
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.location-dropdown__column--mode {
  @apply box-border;
  @apply border-r-hairline border-r-solid border-r-app-divider;
  @apply bg-surface-page;
}

.location-dropdown__column--secondary {
  @apply border-r-hairline border-r-solid border-r-app-divider;
  @apply bg-surface-page;
}

.location-dropdown__column--content {
  @apply bg-hex-fff;
}

.location-dropdown__option {
  @apply py-2 px-3;
  @apply gap-1.5;
  @apply border-0;
  @apply border-b-hairline border-b-solid border-b-app-divider;
  @apply text-content-secondary;
  @apply text-size-xs;
}

.location-dropdown__option--secondary {
  @apply pr-1.5;
  @apply pl-2;
  @apply gap-1;
  @apply text-size-xs;
}

.location-dropdown__option--place {
  @apply pr-2;
  @apply pl-2;
  @apply text-size-xs;
}

.location-dropdown__option--secondary.active {
  @apply text-$location-filter-primary;
  @apply font-semibold;
  @apply bg-$location-filter-primary-soft;
}

.location-dropdown__option--place {
  @apply justify-between;
  @apply text-content-primary;
}

.location-dropdown__option--place.active {
  @apply text-$location-filter-primary;
  @apply font-semibold;
  @apply bg-$location-filter-primary-soft;
}

.location-dropdown__option--place .i-carbon-checkmark {
  @apply flex-none;
  @apply text-size-xs;
}

:deep(.location-dropdown__checkbox-group) {
  @apply flex;
  @apply flex-col;
}

.location-dropdown__station-check {
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.location-dropdown__station-check--active {
  @apply border-$location-filter-primary;
  @apply bg-$location-filter-primary;
  box-shadow: 0 3rpx 9rpx rgb(22 119 255 / 20%);
}

.location-dropdown__state,
.location-dropdown__empty-city {
  @apply flex;
  @apply min-h-38;
  @apply items-center;
  @apply justify-center;
  @apply flex-col;
  @apply gap-2;
  @apply p-4;
  @apply box-border;
  @apply text-content-muted;
  @apply text-size-2xs;
  @apply text-center;
}

.location-dropdown__state strong,
.location-dropdown__empty-city strong {
  @apply text-content-primary;
  @apply text-size-xs;
}

.location-dropdown__state button {
  @apply mt-1 mx-0 mb-0;
  @apply py-2 px-3;
  @apply border-0;
  @apply rounded-full;
  @apply text-$location-filter-primary;
  @apply text-size-2xs;
  @apply leading-none;
  @apply bg-$location-filter-primary-soft;
}

.location-popover__footer {
  grid-template-columns: 1fr 1.6fr;
}

:deep(.location-dropdown__reset),
:deep(.location-dropdown__apply) {
  --wot-button-height-medium: 78rpx;
  @apply rounded-2;
}

:deep(.location-dropdown__reset) {
  --wot-button-primary-color: #536278;
  --wot-button-primary-color-active: #243247;
  --wot-button-primary-plain-border: #dce4ee;
  --wot-button-primary-plain-border-active: #b8c7da;
}

:deep(.location-dropdown__apply) {
  --wot-button-primary-bg: var(--location-filter-primary);
  --wot-button-primary-bg-active: var(--location-filter-primary-active);
}
</style>
