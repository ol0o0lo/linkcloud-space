import type { PublicHouseLocatedRegion, PublicHouseManualRegionPreference, PublicHouseRegionSelection } from '@/domain/public-house-region'
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  buildPublicHouseRegionParams,
  createNationwidePublicHouseRegion,
  createPublicHouseManualRegionPreference,
  findLocatedPublicHouseRegion,
  formatPublicHouseRegionLabel,
  isPublicHouseManualRegionPreference,
  isPublicHouseManualRegionPreferenceActive,
  isPublicHouseRegionSelection,
  resolvePublicHouseRegionSelection,
} from '@/domain/public-house-region'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { platformStorage } from '@/platform'
import { requestPublicHouseRegions, resolvePublicHouseRegion } from '@/services/manual/houses'

const regionPersistence = createVersionedStorage<PublicHouseRegionSelection>({
  key: 'public-house-region',
  version: 2,
  storage: platformStorage.persistent,
  validate: isPublicHouseRegionSelection,
  migrations: {
    1: value => isPublicHouseRegionSelection(value) ? { ...value, district: '' } : value,
  },
})

const preferencePersistence = createVersionedStorage<PublicHouseManualRegionPreference>({
  key: 'public-house-region-preference',
  version: 2,
  storage: platformStorage.persistent,
  validate: isPublicHouseManualRegionPreference,
  migrations: {
    1: (value) => {
      const source = value && typeof value === 'object' ? (value as Record<string, unknown>).source : null
      return source === 'manual'
        ? createPublicHouseManualRegionPreference()
        : { source: 'manual', expiresAt: 0 }
    },
  },
})

export const usePublicHouseRegionStore = defineStore('public-house-region', () => {
  const persistedSelection = regionPersistence.read()
  let persistedPreference = preferencePersistence.read()
  if (!persistedPreference && persistedSelection) {
    persistedPreference = createPublicHouseManualRegionPreference()
    preferencePersistence.write(persistedPreference)
  }
  const hasPersistedManualRegion = Boolean(
    persistedSelection
    && persistedPreference
    && isPublicHouseManualRegionPreferenceActive(persistedPreference),
  )
  if (!hasPersistedManualRegion) {
    regionPersistence.remove()
    preferencePersistence.remove()
  }
  const manualPreferenceExpiresAt = ref(hasPersistedManualRegion ? persistedPreference!.expiresAt : null)
  const selection = ref<PublicHouseRegionSelection>(hasPersistedManualRegion
    ? { ...persistedSelection!, district: '' }
    : createNationwidePublicHouseRegion())
  const regions = ref<Awaited<ReturnType<typeof requestPublicHouseRegions>>['items']>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref('')
  let pendingLoad: Promise<boolean> | null = null
  let pendingInitialLocation: Promise<boolean> | null = null
  let initialLocationAttempted = false

  const label = computed(() => formatPublicHouseRegionLabel(selection.value))
  const requestParams = computed(() => buildPublicHouseRegionParams(selection.value))
  const scopeKey = computed(() => [
    selection.value.province,
    selection.value.city,
  ].join('|'))

  async function loadRegions(force = false): Promise<boolean> {
    if (loaded.value && !force)
      return false
    if (pendingLoad)
      return pendingLoad
    pendingLoad = (async () => {
      loading.value = true
      error.value = ''
      try {
        const result = await requestPublicHouseRegions()
        regions.value = result.items
        const manualPreferenceActive = hasValidManualPreference()
        const resolved = resolvePublicHouseRegionSelection(result.items, selection.value)
        const invalidated = resolved === null
        updateSelection(resolved ? { ...resolved, district: '' } : createNationwidePublicHouseRegion())
        if (invalidated && manualPreferenceActive)
          clearManualPreference()
        else if (manualPreferenceActive)
          regionPersistence.write(selection.value)
        loaded.value = true
        return invalidated
      }
      catch (cause) {
        error.value = cause instanceof Error ? cause.message : '地区加载失败，请稍后重试'
        throw cause
      }
      finally {
        loading.value = false
        pendingLoad = null
      }
    })()
    return pendingLoad
  }

  function updateSelection(value: PublicHouseRegionSelection) {
    if (!isPublicHouseRegionSelection(value))
      throw new Error('地区选择无效')
    const normalized = { province: value.province, city: value.city, district: '' }
    if (selection.value.province === normalized.province && selection.value.city === normalized.city)
      return
    selection.value = normalized
  }

  function clearManualPreference() {
    manualPreferenceExpiresAt.value = null
    initialLocationAttempted = false
    regionPersistence.remove()
    preferencePersistence.remove()
  }

  function hasValidManualPreference(now = Date.now()) {
    const expiresAt = manualPreferenceExpiresAt.value
    if (expiresAt === null)
      return false
    if (expiresAt > now)
      return true
    clearManualPreference()
    updateSelection(createNationwidePublicHouseRegion())
    return false
  }

  function selectRegion(value: PublicHouseRegionSelection) {
    if (!isPublicHouseRegionSelection(value))
      throw new Error('地区选择无效')
    const normalized = { province: value.province, city: value.city, district: '' }
    updateSelection(normalized)
    const preference = createPublicHouseManualRegionPreference()
    manualPreferenceExpiresAt.value = preference.expiresAt
    initialLocationAttempted = false
    regionPersistence.write(normalized)
    preferencePersistence.write(preference)
  }

  function selectNationwide() {
    selectRegion(createNationwidePublicHouseRegion())
  }

  async function initializeDefaultRegion(): Promise<boolean> {
    if (pendingInitialLocation)
      return pendingInitialLocation
    if (hasValidManualPreference() && loaded.value)
      return false
    if (initialLocationAttempted && !hasValidManualPreference())
      return false

    pendingInitialLocation = (async () => {
      try {
        await loadRegions()
        if (hasValidManualPreference())
          return false
        if (initialLocationAttempted)
          return false
        initialLocationAttempted = true
        const location = await uni.getLocation({ type: 'gcj02', isHighAccuracy: true })
        const located = await resolvePublicHouseRegion({
          latitude: location.latitude,
          longitude: location.longitude,
          coordinate_system: 'gcj02',
        })
        if (hasValidManualPreference())
          return false
        const locatedSelection = findLocatedPublicHouseRegion(regions.value, located)
        if (!locatedSelection)
          return false
        updateSelection(locatedSelection)
        return true
      }
      catch {
        return false
      }
      finally {
        pendingInitialLocation = null
      }
    })()
    return pendingInitialLocation
  }

  return {
    selection,
    regions,
    loading,
    loaded,
    error,
    label,
    requestParams,
    scopeKey,
    loadRegions,
    initializeDefaultRegion,
    selectRegion,
    selectNationwide,
    findLocatedRegion: (located: PublicHouseLocatedRegion) => findLocatedPublicHouseRegion(regions.value, located),
  }
})
