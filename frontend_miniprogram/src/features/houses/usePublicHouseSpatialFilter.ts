import type { PublicHouseLocationMode, PublicHouseRadiusM } from '@/domain/public-house-metro'
import { computed, ref, watch } from 'vue'
import { formatPublicHouseRegionLabel } from '@/domain/public-house-region'
import { buildPublicHouseSpatialParams, isPublicHouseRadiusM, normalizeMetroStationNames } from '@/domain/public-house-metro'
import { usePublicHouseRegionStore } from '@/store/public-house-region'

export interface PublicHouseLocationFilterValue {
  mode: PublicHouseLocationMode
  district: string
  subdistrict?: string
  stationNames: string[]
}

export function usePublicHouseSpatialFilter(initialRadiusM: PublicHouseRadiusM = 1000) {
  const regionStore = usePublicHouseRegionStore()
  const locationMode = ref<PublicHouseLocationMode>('region')
  const district = ref('')
  const subdistrict = ref('')
  const metroStationNames = ref<string[]>([])
  const radiusM = ref<PublicHouseRadiusM>(initialRadiusM)
  const scopeMode = ref<'region' | 'nearby'>('region')
  const nearbyLocation = ref<{ latitude: number, longitude: number } | null>(null)

  const locationFilter = computed<PublicHouseLocationFilterValue>(() => ({
    mode: locationMode.value,
    district: district.value,
    subdistrict: subdistrict.value,
    stationNames: [...metroStationNames.value],
  }))
  const locationLabel = computed(() => {
    if (locationMode.value === 'metro' && metroStationNames.value.length)
      return `地铁 · ${metroStationNames.value.length}站`
    if (subdistrict.value)
      return subdistrict.value
    if (district.value) {
      return formatPublicHouseRegionLabel({
        province: regionStore.selection.province,
        city: regionStore.selection.city,
        district: district.value,
      })
    }
    return '区域/地铁'
  })
  const nearbyRadiusM = computed<PublicHouseRadiusM | null>({
    get: () => scopeMode.value === 'nearby' ? radiusM.value : null,
    set: (value) => {
      if (value == null) {
        exitNearby()
        return
      }
      setNearbyRadius(value)
    },
  })
  const requestParams = computed(() => buildPublicHouseSpatialParams({
    nearbyEnabled: scopeMode.value === 'nearby',
    nearbyLocation: nearbyLocation.value,
    radiusM: radiusM.value,
    mode: locationMode.value,
    province: regionStore.selection.province,
    city: regionStore.selection.city,
    district: district.value,
    subdistrict: subdistrict.value,
    metroStationNames: metroStationNames.value,
  }))
  const hasLocationFilter = computed(() => locationMode.value === 'metro'
    ? metroStationNames.value.length > 0
    : Boolean(district.value || subdistrict.value))
  const hasSpatialCenter = computed(() => (
    scopeMode.value === 'nearby' && nearbyLocation.value !== null
  ) || (
    scopeMode.value === 'region' && locationMode.value === 'metro' && metroStationNames.value.length > 0
  ))
  const hasAnyFilter = computed(() => scopeMode.value === 'nearby' || hasLocationFilter.value)
  const scopeKey = computed(() => [
    regionStore.scopeKey,
    scopeMode.value,
    locationMode.value,
    district.value,
    subdistrict.value,
    metroStationNames.value.join(','),
    nearbyLocation.value?.longitude || '',
    nearbyLocation.value?.latitude || '',
    radiusM.value,
  ].join('|'))

  function setLocationFilter(value: PublicHouseLocationFilterValue) {
    const stationNames = normalizeMetroStationNames(value.stationNames)
    if (value.mode === 'metro' && !regionStore.selection.city)
      throw new Error('地铁筛选必须先选择全局城市')
    if (stationNames.length > 5)
      throw new Error('最多选择 5 个地铁站')
    locationMode.value = value.mode
    district.value = value.mode === 'region' ? value.district : ''
    subdistrict.value = value.mode === 'region' && value.district ? value.subdistrict || '' : ''
    metroStationNames.value = value.mode === 'metro' ? stationNames : []
    exitNearby()
  }

  function resetLocationFilter() {
    locationMode.value = 'region'
    district.value = ''
    subdistrict.value = ''
    metroStationNames.value = []
  }

  function enterNearby(location: { latitude: number, longitude: number }, nextRadiusM?: number) {
    if (nextRadiusM !== undefined)
      setRadiusM(nextRadiusM)
    nearbyLocation.value = { ...location }
    scopeMode.value = 'nearby'
  }

  function exitNearby() {
    scopeMode.value = 'region'
    nearbyLocation.value = null
  }

  function setRadiusM(value: number) {
    if (!isPublicHouseRadiusM(value))
      throw new Error('附近范围只支持 500、1000、1500、2000 米')
    radiusM.value = value
  }

  function setNearbyRadius(value: number) {
    setRadiusM(value)
  }

  function reset() {
    resetLocationFilter()
    exitNearby()
  }

  watch(
    () => regionStore.scopeKey,
    () => reset(),
    { flush: 'sync' },
  )

  return {
    locationMode,
    district,
    subdistrict,
    metroStationNames,
    radiusM,
    scopeMode,
    nearbyLocation,
    nearbyRadiusM,
    locationFilter,
    locationLabel,
    requestParams,
    hasLocationFilter,
    hasSpatialCenter,
    hasAnyFilter,
    scopeKey,
    setLocationFilter,
    resetLocationFilter,
    enterNearby,
    exitNearby,
    setRadiusM,
    setNearbyRadius,
    reset,
  }
}
