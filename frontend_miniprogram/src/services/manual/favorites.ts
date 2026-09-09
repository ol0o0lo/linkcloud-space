import { usersMeFavoriteUsingDelete, usersMeFavoriteUsingGet, usersMeFavoriteUsingPut } from '@/services/openapi/shoucang'

export type { FavoriteOut } from '@/services/openapi/types'

const personalRequestOptions = { requestScope: { kind: 'personal' as const } }
const idempotentPersonalRequestOptions = { ...personalRequestOptions, authRetry: 'safe' as const }

export function requestHouseFavorites(page: number, pageSize: number) {
  return usersMeFavoriteUsingGet({
    params: { target_type: 'house', page, page_size: pageSize },
    options: personalRequestOptions,
  })
}

export function requestHouseFavorite(houseId: number) {
  return usersMeFavoriteUsingGet({
    params: { target_type: 'house', target_id: String(houseId), page: 1, page_size: 1 },
    options: personalRequestOptions,
  })
}

export function createHouseFavorite(houseId: number) {
  return usersMeFavoriteUsingPut({
    params: { target_type: 'house', target_id: String(houseId) },
    options: idempotentPersonalRequestOptions,
  })
}

export function deleteHouseFavorite(houseId: number) {
  return usersMeFavoriteUsingDelete({
    params: { target_type: 'house', target_id: String(houseId) },
    options: idempotentPersonalRequestOptions,
  })
}
