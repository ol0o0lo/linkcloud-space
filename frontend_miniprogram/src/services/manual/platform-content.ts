import type { PublicHouseListOut } from '@/services/manual/houses'
import type { HomeContent, HomeEntryDetail, HomeEntryKind, HomeEntrySummary, PageResult } from '@/domain/home-content'
import { httpGet } from '@/http/http'

export interface HomeEntryHouse {
  house: PublicHouseListOut
  recommendation_reason: string
}

const publicRequestOptions = { requestScope: { kind: 'public' as const } }
const BASE_PATH = '/api/public/content'

export function requestHomeContent() {
  return httpGet<HomeContent>(`${BASE_PATH}/home/`, undefined, undefined, publicRequestOptions)
}

export function requestHomeEntries(kind: HomeEntryKind, page: number, pageSize: number) {
  return httpGet<PageResult<HomeEntrySummary>>(
    `${BASE_PATH}/entries/`,
    { kind, page, page_size: pageSize },
    undefined,
    publicRequestOptions,
  )
}

export function requestHomeEntry(slug: string) {
  return httpGet<HomeEntryDetail>(`${BASE_PATH}/entries/${encodeURIComponent(slug)}/`, undefined, undefined, publicRequestOptions)
}

export function requestHomeEntryHouses(slug: string, page: number, pageSize: number) {
  return httpGet<PageResult<HomeEntryHouse>>(
    `${BASE_PATH}/entries/${encodeURIComponent(slug)}/houses/`,
    { page, page_size: pageSize },
    undefined,
    publicRequestOptions,
  )
}
