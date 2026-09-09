import type { PublicHousesUsingGetParams } from '@/services/manual/houses'
import { normalizePublicHouseQuery } from '@/domain/house'
import { requestPublicHouse, requestPublicHouseFilters, requestPublicHouses } from '@/services/manual/houses'

export type { PublicHouseDetailOut, PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/services/manual/houses'

export function listPublicHouses(params: PublicHousesUsingGetParams) {
  return requestPublicHouses(normalizePublicHouseQuery(params) as PublicHousesUsingGetParams)
}

export function getPublicHouse(houseId: number) {
  return requestPublicHouse(houseId)
}

export function getPublicHouseFilters() {
  return requestPublicHouseFilters()
}
