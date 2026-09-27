import type { PublicHouseMapParams, PublicHousesUsingGetParams, ResolvePublicHouseRegionParams } from '@/services/manual/houses'
import { normalizePublicHouseQuery } from '@/domain/house'
import { requestPublicHouse, requestPublicHouseFilters, requestPublicHouseMap, requestPublicHouseRegions, requestPublicHouses, requestPublicHouseSuggestions, resolvePublicHouseRegion } from '@/services/manual/houses'
import { requestPublicMetroCities, requestPublicMetroCity } from '@/services/manual/metro'

export type { PublicHouseLocationMode, PublicHouseMetroSelection, PublicHouseRadiusM, PublicMetroCityDetail, PublicMetroCitySummary, PublicMetroLine, PublicMetroStation } from '@/domain/public-house-metro'
export type { HouseAIInsightOut, HouseOut, PublicHouseDetailOut, PublicHouseFiltersOut, PublicHouseListOut, PublicHouseMapLevel, PublicHouseMapMarker, PublicHouseMapParams, PublicHouseMapResponse, PublicHouseRegionsResponse, PublicHouseSuggestion, PublicHousesUsingGetParams, ResolvePublicHouseRegionParams } from '@/services/manual/houses'

export function listPublicHouses(params: PublicHousesUsingGetParams) {
  return requestPublicHouses(normalizePublicHouseQuery(params) as PublicHousesUsingGetParams)
}

export function getPublicHouse(houseId: number) {
  return requestPublicHouse(houseId)
}

export function getPublicHouseFilters() {
  return requestPublicHouseFilters()
}

export function getPublicHouseSuggestions(keyword: string, city?: string) {
  return requestPublicHouseSuggestions(keyword, city)
}

export function getPublicHouseMap(params: PublicHouseMapParams) {
  return requestPublicHouseMap(params)
}

export function getPublicHouseRegions() {
  return requestPublicHouseRegions()
}

export function getLocatedPublicHouseRegion(params: ResolvePublicHouseRegionParams) {
  return resolvePublicHouseRegion(params)
}

export function getPublicMetroCities() {
  return requestPublicMetroCities()
}

export function getPublicMetroCity(city: string) {
  return requestPublicMetroCity(city)
}
