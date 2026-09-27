<script setup lang="ts">
import type { PublicHouseLocationMode, PublicMetroCityDetail } from '@/domain/public-house-metro'
import type { AppliedCommute, CommuteDraft } from '@/features/houses/commute'
import type { PublicHouseLocationFilterValue } from '@/features/houses/usePublicHouseSpatialFilter'
import { computed, ref, watch } from 'vue'
import AppLoading from '@/components/app/AppLoading.vue'
import CommutePicker from '@/features/houses/commute/CommutePicker.vue'
import { commuteModeLabel } from '@/features/houses/commute'
import { useWorkPlacePreferenceStore } from '@/features/houses/commute/preference'
import { getPublicMetroCities, getPublicMetroCity } from '@/features/houses/service'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

const props = withDefaults(defineProps<{
  visible: boolean
  value: PublicHouseLocationFilterValue
  commute?: AppliedCommute | null
  preferredMode?: 'commute' | null
}>(), { commute: null })

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'apply': [value: PublicHouseLocationFilterValue]
  'apply-commute': [value: CommuteDraft]
  'clear-commute': []
}>()

const regionStore = usePublicHouseRegionStore()
const workPlacePreference = useWorkPlacePreferenceStore()
const draftMode = ref<PublicHouseLocationMode | 'commute'>('region')
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
  if (draftMode.value === 'region') {
    const city = shortRegionName(regionStore.selection.city)
    const district = draftDistrict.value ? shortRegionName(draftDistrict.value) : '全区'
    return {
      icon: 'i-carbon-map',
      title: '区域',
      subtitle: [city, district, draftSubdistrict.value].filter(Boolean).join(' · '),
    }
  }
  if (draftMode.value === 'metro') {
    return {
      icon: 'i-carbon-train',
      title: '地铁',
      subtitle: `${activeLine.value?.name || '选择线路'} · 已选 ${draftStationNames.value.length}/5 站`,
    }
  }
  const placeName = draftCommute.value.place?.name
  const commuteSummary = `${commuteModeLabel(draftCommute.value.mode)} ${draftCommute.value.maxMinutes} 分钟内`
  return {
    icon: 'i-carbon-location-star',
    title: '通勤',
    subtitle: `${placeName ? `到${placeName}` : '未选目的地'} · ${commuteSummary}`,
  }
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
  draftMode.value = props.preferredMode || (props.commute || !regionStore.selection.city ? 'commute' : props.value.mode)
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

function setDraftMode(mode: PublicHouseLocationMode | 'commute') {
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
  <view v-if="visible" class="location-popover-host">
    <view class="location-popover__mask" @touchmove.stop.prevent @wheel.stop.prevent @click="closeWithoutApply" />
    <view class="location-popover" @click.stop>
      <view class="location-popover__header">
        <view class="location-popover__header-icon" :class="headerContent.icon" />
        <view class="location-popover__heading">
          <strong>{{ headerContent.title }}</strong>
          <text>{{ headerContent.subtitle }}</text>
        </view>
        <button class="location-popover__close" aria-label="关闭" @click="closeWithoutApply">
          <view class="i-carbon-close" />
        </button>
      </view>

      <view class="location-dropdown">
        <template v-if="regionStore.selection.city || draftMode === 'commute'">
          <view class="location-dropdown__columns" :class="{ 'location-dropdown__columns--commute': draftMode === 'commute' }">
            <view class="location-dropdown__column location-dropdown__column--mode">
              <button v-if="regionStore.selection.city" class="location-dropdown__mode" :class="{ active: draftMode === 'region' }" @click="setDraftMode('region')">
                区域
              </button>
              <button v-if="regionStore.selection.city" class="location-dropdown__mode" :class="{ active: draftMode === 'metro' }" @click="setDraftMode('metro')">
                地铁
              </button>
              <button class="location-dropdown__mode" :class="{ active: draftMode === 'commute' }" @click="setDraftMode('commute')">
                通勤
              </button>
            </view>

            <scroll-view v-if="draftMode !== 'commute'" class="location-dropdown__column location-dropdown__column--secondary" scroll-y enhanced :show-scrollbar="false">
              <template v-if="draftMode === 'region'">
                <button class="location-dropdown__option location-dropdown__option--secondary" :class="{ active: !draftDistrict }" @click="selectDraftDistrict('')">
                  全区
                </button>
                <button
                  v-for="item in activeCity?.districts || []"
                  :key="item.district"
                  class="location-dropdown__option location-dropdown__option--secondary"
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
                  class="location-dropdown__option location-dropdown__option--secondary location-dropdown__line"
                  :class="{ active: activeLine?.name === line.name }"
                  @click="activeLineName = line.name"
                >
                  <i class="location-dropdown__line-color" :style="{ backgroundColor: line.color || 'var(--location-filter-primary)' }" />
                  <text>{{ line.name }}</text>
                </button>
              </template>
            </scroll-view>

            <scroll-view v-if="draftMode !== 'commute'" class="location-dropdown__column location-dropdown__column--content" scroll-y enhanced :show-scrollbar="false">
              <template v-if="draftMode === 'region'">
                <button class="location-dropdown__option location-dropdown__option--place" :class="{ active: !draftSubdistrict }" @click="selectDraftSubdistrict('')">
                  <text>{{ draftDistrict ? `${shortRegionName(draftDistrict)}全区` : '全区' }}</text>
                  <view v-if="!draftSubdistrict" class="i-carbon-checkmark" />
                </button>
                <button
                  v-for="item in activeDistrict?.subdistricts || []"
                  :key="item.subdistrict"
                  class="location-dropdown__option location-dropdown__option--place"
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
                    custom-class="location-dropdown__checkbox"
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
            <scroll-view v-else class="location-dropdown__column location-dropdown__column--commute" scroll-y enhanced :show-scrollbar="false">
              <CommutePicker :key="commutePickerRevision" v-model="draftCommute" compact />
            </scroll-view>
          </view>
        </template>

        <view v-else class="location-dropdown__empty-city">
          <view class="i-carbon-map location-dropdown__state-icon" />
          <strong>请先从页面右上角选择城市</strong>
          <text>选择城市后可按区域或地铁找房，也可直接使用通勤筛选</text>
          <button class="location-dropdown__commute-entry" @click="setDraftMode('commute')">
            使用通勤筛选
          </button>
        </view>
      </view>

      <view class="location-popover__footer">
        <wd-button block variant="plain" custom-class="location-dropdown__reset" @click="resetDraft">
          {{ draftMode === 'commute' ? '清空通勤' : '清空选择' }}
        </wd-button>
        <wd-button block custom-class="location-dropdown__apply" @click="applyDraft">
          查看房源
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
  position: absolute;
  z-index: 2;
  top: 100%;
  left: 0;
  width: calc(100vw - var(--app-page-gutter) * 2);
  max-width: var(--public-house-filter-popover-width, 680rpx);
}

.location-popover-host::before {
  position: absolute;
  z-index: 3;
  top: 6rpx;
  left: var(--filter-pointer-x, 50%);
  width: 20rpx;
  height: 20rpx;
  margin-left: -10rpx;
  border-top: 1rpx solid rgb(255 255 255 / 80%);
  border-left: 1rpx solid rgb(255 255 255 / 80%);
  background: #fff;
  content: '';
  transform: rotate(45deg);
}

.location-popover__mask {
  position: fixed;
  z-index: 1;
  inset: 0;
  background: rgb(15 23 42 / 28%);
  backdrop-filter: blur(3rpx);
}

.location-popover {
  position: relative;
  z-index: 2;
  display: grid;
  width: 100%;
  height: min(68vh, 760rpx);
  margin-top: 14rpx;
  overflow: hidden;
  border: 1rpx solid rgb(255 255 255 / 80%);
  border-radius: 28rpx;
  box-sizing: border-box;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: #fff;
  box-shadow: 0 26rpx 68rpx rgb(26 79 145 / 18%);
  animation: location-popover-in 180ms ease-out;
}

.location-popover__header {
  display: flex;
  min-height: 104rpx;
  align-items: center;
  gap: 14rpx;
  padding: 12rpx 18rpx 12rpx 28rpx;
  box-sizing: border-box;
  background: #fff;
}

.location-popover__header-icon {
  flex: 0 0 auto;
  color: var(--location-filter-primary);
  font-size: 30rpx;
}

.location-popover__heading {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.location-popover__heading strong {
  color: var(--app-text-primary);
  font-size: 29rpx;
  line-height: 1.2;
}

.location-popover__heading text {
  overflow: hidden;
  color: var(--app-text-muted);
  font-size: 21rpx;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-popover__close {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  margin: 0;
  padding: 0;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--app-text-muted);
  font-size: 30rpx;
  line-height: 1;
  background: var(--app-bg-page);
}

.location-dropdown {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
}

.location-dropdown__option::after,
.location-dropdown__mode::after,
.location-dropdown__state button::after,
.location-popover__close::after {
  border: 0;
}

.location-dropdown__mode {
  display: flex;
  width: 100%;
  min-height: 88rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 4rpx;
  border: 0;
  border-bottom: 1rpx solid var(--app-divider-color);
  border-radius: 0;
  color: var(--app-text-secondary);
  font-size: 24rpx;
  font-weight: 500;
  line-height: 1;
  background: transparent;
}

.location-dropdown__mode.active {
  color: var(--location-filter-primary);
  font-weight: 600;
  background: var(--location-filter-primary-soft);
}

.location-dropdown__columns {
  display: grid;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  grid-template-columns: 19% 32% 49%;
  border-top: 1rpx solid var(--app-divider-color);
}

.location-dropdown__columns--commute {
  grid-template-columns: 19% 81%;
}

.location-dropdown__column--commute {
  background: #fff;
}

.location-dropdown__commute-entry {
  margin-top: 20rpx;
  color: var(--app-color-brand);
  font-size: 23rpx;
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
  box-sizing: border-box;
  border-right: 1rpx solid var(--app-divider-color);
  background: var(--app-bg-page);
}

.location-dropdown__column--secondary {
  border-right: 1rpx solid var(--app-divider-color);
  background: var(--app-bg-page);
}

.location-dropdown__column--content {
  background: #fff;
}

.location-dropdown__option {
  display: flex;
  width: 100%;
  min-height: 88rpx;
  margin: 0;
  padding: 15rpx 24rpx;
  align-items: center;
  gap: 12rpx;
  border: 0;
  border-bottom: 1rpx solid var(--app-divider-color);
  border-radius: 0;
  box-sizing: border-box;
  color: var(--app-text-secondary);
  font-size: 25rpx;
  line-height: 1.35;
  text-align: left;
  background: transparent;
}

.location-dropdown__option--secondary {
  padding-right: 10rpx;
  padding-left: 17rpx;
  gap: 9rpx;
  font-size: 24rpx;
}

.location-dropdown__option--place {
  padding-right: 16rpx;
  padding-left: 17rpx;
  font-size: 25rpx;
}

.location-dropdown__option--secondary.active {
  color: var(--location-filter-primary);
  font-weight: 600;
  background: var(--location-filter-primary-soft);
}

.location-dropdown__option--place {
  justify-content: space-between;
  color: var(--app-text-primary);
}

.location-dropdown__option--place.active {
  color: var(--location-filter-primary);
  font-weight: 600;
  background: var(--location-filter-primary-soft);
}

.location-dropdown__option--place .i-carbon-checkmark {
  flex: 0 0 auto;
  font-size: 25rpx;
}

.location-dropdown__line-color {
  width: 13rpx;
  height: 13rpx;
  flex: 0 0 auto;
  border-radius: 50%;
}

.location-dropdown__stations {
  padding-bottom: 18rpx;
}

:deep(.location-dropdown__checkbox-group) {
  display: flex;
  flex-direction: column;
}

.location-dropdown__station-check {
  display: flex;
  width: 36rpx;
  height: 36rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #cbd5e3;
  border-radius: 50%;
  box-sizing: border-box;
  color: #fff;
  background: #fff;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.location-dropdown__station-check--active {
  border-color: var(--location-filter-primary);
  background: var(--location-filter-primary);
  box-shadow: 0 3rpx 9rpx rgb(22 119 255 / 20%);
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
  padding: 18rpx 24rpx 22rpx;
  box-sizing: border-box;
  grid-template-columns: 1fr 1.6fr;
  gap: 12rpx;
  border-top: 1rpx solid var(--app-divider-color);
  background: #fff;
}

:deep(.location-dropdown__reset),
:deep(.location-dropdown__apply) {
  --wot-button-height-medium: 78rpx;
  border-radius: 16rpx;
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
