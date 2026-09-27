import type { CommuteMode, CommutePlace } from '@/services/manual/house-commute'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createVersionedStorage } from '@/infra/storage/versioned-storage'
import { platformStorage } from '@/platform'

interface WorkPlacePreference {
  place: CommutePlace & { destinationId: number }
  mode: CommuteMode
}

const modes: CommuteMode[] = ['metro', 'ebike', 'bicycle', 'walking', 'driving']
const persistence = createVersionedStorage<WorkPlacePreference>({
  key: 'house-work-place',
  version: 1,
  storage: platformStorage.persistent,
  migrations: {},
  validate: (value): value is WorkPlacePreference => {
    if (!value || typeof value !== 'object')
      return false
    const candidate = value as Partial<WorkPlacePreference>
    return Boolean(candidate.place
      && typeof candidate.place.name === 'string'
      && typeof candidate.place.city === 'string'
      && typeof candidate.place.destinationId === 'number'
      && candidate.place.destinationId > 0
      && candidate.mode && modes.includes(candidate.mode))
  },
})

export const useWorkPlacePreferenceStore = defineStore('house-work-place', () => {
  let saved: WorkPlacePreference | null = null
  try {
    saved = persistence.read()
  }
  catch {
    // 存储不可用时，当前会话仍可使用上班地点。
  }
  const preference = ref<WorkPlacePreference | null>(saved)

  function save(place: CommutePlace, mode: CommuteMode = preference.value?.mode || 'metro') {
    if (!place.destinationId)
      return
    preference.value = {
      place: { name: place.name, city: place.city, address: place.address, token: '', destinationId: place.destinationId },
      mode,
    }
    try {
      persistence.write(preference.value)
    }
    catch {
      // 存储不可用时，当前会话仍可使用上班地点。
    }
  }

  function setMode(mode: CommuteMode) {
    if (preference.value)
      save(preference.value.place, mode)
  }

  return { preference, save, setMode }
})
