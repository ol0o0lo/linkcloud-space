import type { CommuteMode, CommutePlace } from '@/services/manual/house-commute'

export { createCommuteSearch, getCommuteProgress, getCommuteRoute, getHouseCommuteRoute, getNearbyCommutePlaces, saveCommuteDestination, searchCommutePlaces } from '@/services/manual/house-commute'
export type { CommutePlace, CommuteProgress, CommuteRoute, CommuteSearchInput } from '@/services/manual/house-commute'

export interface CommuteDraft {
  place: CommutePlace | null
  mode: CommuteMode
  maxMinutes: number
}

export interface AppliedCommute extends CommuteDraft {
  searchId?: string
  destinationId?: number
  place: CommutePlace
}

export const COMMUTE_MODES: { value: CommuteMode, label: string, icon: string }[] = [
  { value: 'metro', label: '地铁', icon: 'i-carbon-train' },
  { value: 'ebike', label: '电动车', icon: 'i-carbon-scooter' },
  { value: 'bicycle', label: '自行车', icon: 'i-carbon-bicycle' },
  { value: 'walking', label: '步行', icon: 'i-carbon-pedestrian' },
  { value: 'driving', label: '驾车', icon: 'i-carbon-car' },
]

export function commuteModeLabel(mode: CommuteMode): string {
  return COMMUTE_MODES.find(item => item.value === mode)?.label || mode
}
