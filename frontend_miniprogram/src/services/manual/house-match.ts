import type { PublicHouseDetailOut, PublicHouseListOut } from '@/services/openapi/types'
import { httpGet } from '@/http/http'

export type { PublicHouseDetailOut, PublicHouseListOut } from '@/services/openapi/types'

const publicRequestOptions = {
  requestScope: { kind: 'public' as const },
  hideErrorToast: true,
  skipAuthRedirect: true,
}

export interface PublicHouseMatchConsultant {
  id: number
  name: string
  avatar_url?: string | null
  phone?: string | null
}

export interface PublicHouseMatchShare {
  title: string
  remark: string
  mode: string
  created_at: string
  expires_at?: string | null
  consultant?: PublicHouseMatchConsultant | null
}

export interface HouseMatchPage<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export function getPublicHouseMatchShare(shareKey: string) {
  return httpGet<PublicHouseMatchShare>(
    `/api/public/house-match-shares/${encodeURIComponent(shareKey)}/`,
    undefined,
    undefined,
    publicRequestOptions,
  )
}

export function listPublicHouseMatchHouses(shareKey: string, page = 1, pageSize = 20) {
  return httpGet<HouseMatchPage<PublicHouseListOut>>(
    `/api/public/house-match-shares/${encodeURIComponent(shareKey)}/houses/`,
    { page, page_size: pageSize },
    undefined,
    publicRequestOptions,
  )
}

export function getPublicHouseMatchHouse(shareKey: string, houseId: number) {
  return httpGet<PublicHouseDetailOut>(
    `/api/public/house-match-shares/${encodeURIComponent(shareKey)}/houses/${houseId}/`,
    undefined,
    undefined,
    publicRequestOptions,
  )
}
