import type { PublicHouseListOut as GeneratedPublicHouseListOut, PublicHousesUsingGetParams as GeneratedPublicHousesUsingGetParams } from '@/services/openapi/types'
import type { PublicHouseLocatedRegion, PublicHouseRegionProvince } from '@/domain/public-house-region'
import type { PublicHouseRadiusM } from '@/domain/public-house-metro'
import { httpGet } from '@/http/http'
import { publicHousesFiltersUsingGet, publicHousesHouseIdUsingGet, publicHousesUsingGet } from '@/services/openapi/gongkai'

export type { HouseAIInsightOut, HouseOut, PublicHouseDetailOut, PublicHouseFiltersOut } from '@/services/openapi/types'

export type PublicHouseListOut = GeneratedPublicHouseListOut & {
  commute_minutes?: number | null
  commute_route_id?: number | null
}

export type PublicHouseMapLevel = 'city' | 'district' | 'estate' | 'building'

export interface GeoPoint {
  longitude: number
  latitude: number
  coordinate_system: 'gcj02'
}

export type PublicHousesUsingGetParams = Omit<GeneratedPublicHousesUsingGetParams, 'radius_m' | 'sort' | 'listing_type'> & {
  listing_type?: 'whole' | 'shared' | 'apartment' | 'short_term'
  bedrooms_min?: number
  estate_id?: number | null
  building_id?: number | null
  subdistrict?: string
  longitude?: number
  latitude?: number
  metro_stations?: string[]
  radius_m?: PublicHouseRadiusM
  coordinate_system?: 'gcj02'
  commute_search_id?: string
  sort?: GeneratedPublicHousesUsingGetParams['sort'] | 'distance_asc' | 'commute_asc'
}

export interface PublicHouseMapMarker {
  key: string
  level: PublicHouseMapLevel
  name: string
  address: string
  location: GeoPoint
  house_count: number
  child_count: number
  min_rent: number | string | null
  target_zoom: number
  city: string
  district: string
  estate_id: number | null
  building_id: number | null
}

export interface PublicHouseMapResponse {
  level: PublicHouseMapLevel
  zoom: number
  visible_house_count: number
  marker_count: number
  unlocated_house_count: number
  truncated: boolean
  items: PublicHouseMapMarker[]
}

export interface PublicHouseSuggestion {
  keyword: string
  category: '区域' | '商圈' | '小区' | '楼栋' | '房号'
  house_count: number
  address: string
}

export interface PublicHouseMapParams {
  zoom: number
  west?: number
  south?: number
  east?: number
  north?: number
  keyword?: string
  listing_type?: 'whole' | 'shared' | 'apartment' | 'short_term'
  bedrooms?: number
  bedrooms_min?: number
  province?: string
  city?: string
  district?: string
  subdistrict?: string
  longitude?: number
  latitude?: number
  radius_m?: number
  coordinate_system: 'gcj02'
}

export interface PublicHouseRegionsResponse {
  items: PublicHouseRegionProvince[]
}

export interface ResolvePublicHouseRegionParams {
  longitude: number
  latitude: number
  coordinate_system: 'gcj02'
}

const publicRequestOptions = { requestScope: { kind: 'public' as const } }

export function requestPublicHouses(params: PublicHousesUsingGetParams) {
  return publicHousesUsingGet({
    params: params as GeneratedPublicHousesUsingGetParams,
    options: publicRequestOptions,
  })
}

export function requestPublicHouse(houseId: number) {
  return publicHousesHouseIdUsingGet({
    params: { house_id: houseId },
    options: publicRequestOptions,
  })
}

export function requestPublicHouseFilters() {
  return publicHousesFiltersUsingGet({ options: publicRequestOptions })
}

export function requestPublicHouseSuggestions(params: {
  keyword: string
  city?: string
  longitude?: number
  latitude?: number
  radius_m?: PublicHouseRadiusM
  coordinate_system?: 'gcj02'
  listing_type?: 'whole' | 'shared' | 'apartment' | 'short_term'
  bedrooms?: number
  bedrooms_min?: number
}) {
  return httpGet<PublicHouseSuggestion[]>('/api/public/houses/suggestions/', params, undefined, publicRequestOptions)
}

export function requestPublicHouseMap(params: PublicHouseMapParams) {
  return httpGet<PublicHouseMapResponse>('/api/public/houses/map/', params, undefined, publicRequestOptions)
}

export function requestPublicHouseRegions() {
  return httpGet<PublicHouseRegionsResponse>('/api/public/houses/regions/', undefined, undefined, publicRequestOptions)
}

export function resolvePublicHouseRegion(params: ResolvePublicHouseRegionParams) {
  return httpGet<PublicHouseLocatedRegion>('/api/public/houses/regions/resolve/', params, undefined, publicRequestOptions)
}
