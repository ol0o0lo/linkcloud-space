import type { PublicHousesUsingGetParams } from '@/services/openapi/types'
import { publicHousesFiltersUsingGet, publicHousesHouseIdUsingGet, publicHousesUsingGet } from '@/services/openapi/gongkai'

export type { PublicHouseDetailOut, PublicHouseFiltersOut, PublicHouseListOut, PublicHousesUsingGetParams } from '@/services/openapi/types'

const publicRequestOptions = { requestScope: { kind: 'public' as const } }

export function requestPublicHouses(params: PublicHousesUsingGetParams) {
  return publicHousesUsingGet({
    params,
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
