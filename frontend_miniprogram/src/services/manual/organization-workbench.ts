import { houseHousesUsingGet, houseViewingRecordsUsingGet } from '@/services/openapi/guanli'
import { HouseStatus } from '@/services/openapi/types'

function organizationScope(organizationSlug: string) {
  return { requestScope: { kind: 'organization' as const, organizationSlug } }
}

export async function getListedHouseCount(organizationSlug: string): Promise<number> {
  const result = await houseHousesUsingGet({ params: { page: 1, page_size: 1, status: HouseStatus.listed }, options: organizationScope(organizationSlug) })
  return result.total
}

export async function getVacantHouseCount(organizationSlug: string): Promise<number> {
  const result = await houseHousesUsingGet({ params: { page: 1, page_size: 1, status: HouseStatus.vacant }, options: organizationScope(organizationSlug) })
  return result.total
}

export async function getScheduledViewingCount(organizationSlug: string): Promise<number> {
  const result = await houseViewingRecordsUsingGet({ params: { page: 1, page_size: 1, status: 'scheduled' }, options: organizationScope(organizationSlug) })
  return result.total
}
