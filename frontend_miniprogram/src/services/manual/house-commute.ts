import { httpGet, httpPost } from '@/http/http'

export type CommuteMode = 'metro' | 'ebike' | 'bicycle' | 'walking' | 'driving'

export interface CommutePlace {
  name: string
  address: string
  city: string
  token: string
  longitude?: number
  latitude?: number
  distance_m?: number | null
  destinationId?: number
}

export interface CommuteSearchInput {
  place_token?: string
  destination_id?: number
  mode: CommuteMode
  max_minutes: number
  filters?: Record<string, unknown>
  retry?: boolean
}

export interface CommuteProgress {
  status: 'pending' | 'ready' | 'failed'
  processed: number
  total: number
  error: string
}

export interface CommuteRoute {
  mode: CommuteMode
  destination_name: string
  duration_minutes: number
  distance_m: number
  walking_distance_m: number
  steps: string[]
  transit_segments: CommuteTransitSegment[]
}

export interface CommuteTransitSegment {
  kind: 'walk' | 'metro'
  label: string
  distance_m: number
  duration_seconds: number | null
  color: string
}

const base = '/api/public/houses/commute'
const publicOptions = { requestScope: { kind: 'public' as const } }

export function searchCommutePlaces(keyword: string, city = '', location?: { latitude: number, longitude: number }) {
  return httpGet<CommutePlace[]>(`${base}/places/`, { keyword, city, ...(location ? { lat: location.latitude, lng: location.longitude } : {}) }, undefined, publicOptions)
}

export function getNearbyCommutePlaces(location: { latitude: number, longitude: number }) {
  return searchCommutePlaces('', '', location)
}

export function createCommuteSearch(input: CommuteSearchInput) {
  return httpPost<{ search_id: string, destination_id: number }>(`${base}/searches/`, input, undefined, undefined, publicOptions)
}

export function saveCommuteDestination(placeToken: string) {
  return httpPost<{ destination_id: number }>(`${base}/destinations/`, { place_token: placeToken }, undefined, undefined, publicOptions)
}

export function getCommuteProgress(searchId: string) {
  return httpGet<CommuteProgress>(`${base}/searches/${encodeURIComponent(searchId)}/`, undefined, undefined, publicOptions)
}

export function getCommuteRoute(routeId: number, houseId: number, retry = false) {
  return httpGet<CommuteRoute>(`${base}/routes/${routeId}/`, { house_id: houseId, retry }, undefined, publicOptions)
}

export function getHouseCommuteRoute(houseId: number, destinationId: number, mode: CommuteMode, retry = false) {
  return httpPost<CommuteRoute>(`${base}/routes/for-house/`, { house_id: houseId, destination_id: destinationId, mode, retry }, undefined, undefined, publicOptions)
}
